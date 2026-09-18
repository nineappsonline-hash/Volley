-- ────────────────────────────────────────────────────────────
-- COACH PAYROLL / COMPENSATION / COMMISSIONS
--
-- Effective-dated coach contracts, per-academy compensation rules
-- (session / player / revenue / hybrid bases), payroll periods and
-- runs with immutable snapshots, per-coach entries with an itemized
-- breakdown, manual adjustments, payment recording and disputes.
--
-- Principles:
--   * Money is stored as NUMERIC(12,2) in a per-row currency (default: EGP);
--     everything is rounded to 2 decimals — no binary floats.
--   * A contract is versioned by new rows (effective_from is the version
--     boundary); the old contract is closed when a newer one begins.
--   * A payroll run is idempotent while the period is a DRAFT: re-running
--     recomputes formula lines and keeps the manual bonus/deduction.
--   * Finalizing a period locks the numbers (entries become immutable
--     snapshots — approved). Corrections after finalization require either a
--     new draft period or a dispute; payments are recorded, never changed.
--   * All mutations run through SECURITY DEFINER RPCs. Direct client writes
--     are not allowed (no INSERT/UPDATE/DELETE policies exist).
--
-- Permission matrix (enforced inside the RPCs):
--   * admin  → create/edit contracts & rules, create periods, run payroll,
--              adjust, finalize, lock, record payments, resolve disputes.
--   * coach  → submit a dispute on their own entry, read their own entries.
-- ────────────────────────────────────────────────────────────

-- ── 0. ACCESS HELPERS (self-contained bootstrap) ───────────

-- The academy role helpers normally come from the earlier migration
-- 20260918000000_ai_coach_assistant.sql (and are re-created by
-- 20261021000000_support_and_satisfaction.sql). We re-declare them here too so
-- this migration also runs standalone against a schema.sql-only database.
-- CREATE OR REPLACE keeps them idempotent.

-- The coach→member link is normally added by 20260916000000_coach_invitations.sql.
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS profile_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.is_academy_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.academy_id = public.current_academy_id()
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_academy_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_academy_coach()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coaches c
    WHERE c.profile_id = auth.uid()
      AND c.is_active
      AND c.academy_id = public.current_academy_id()
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_academy_coach() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_academy_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_academy_admin() OR public.is_academy_coach();
$$;
GRANT EXECUTE ON FUNCTION public.is_academy_staff() TO authenticated;

-- ── 1. CONTRACTS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coach_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  -- Version boundary: the same coach can have several rows; at most one
  -- "currently effective" contract exists (others are closed with effective_to).
  effective_from DATE NOT NULL,
  effective_to DATE CHECK (effective_to IS NULL OR effective_to >= effective_from),
  base_salary NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_salary >= 0),
  currency TEXT NOT NULL DEFAULT 'EGP',
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coach_contracts_coach
  ON public.coach_contracts(coach_id, effective_from DESC);

-- ── 2. COMPENSATION RULES ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.compensation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name_en TEXT NOT NULL CHECK (char_length(name_en) BETWEEN 1 AND 120),
  name_ar TEXT NOT NULL CHECK (char_length(name_ar) BETWEEN 1 AND 120),
  basis TEXT NOT NULL CHECK (basis IN ('session', 'player', 'revenue', 'hybrid')),
  value_type TEXT NOT NULL CHECK (value_type IN ('per_unit', 'percent', 'amount')),
  -- Per-unit / percentage / fixed amount. For 'revenue' the expected type is
  -- 'percent'; for 'session'/'player' it is 'per_unit' or 'amount'.
  value NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (value >= 0),
  -- Session basis only: minimum present-player percentage for a session to count.
  min_attendance_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (min_attendance_pct BETWEEN 0 AND 100),
  -- Hybrid basis: [{basis, value_type, value, min_attendance_pct}].
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE CHECK (effective_to IS NULL OR effective_to >= effective_from),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compensation_rules_academy
  ON public.compensation_rules(academy_id, is_active);

-- ── 3. PERIODS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  period_type TEXT NOT NULL DEFAULT 'monthly'
    CHECK (period_type IN ('monthly', 'weekly', 'biweekly', 'custom')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'finalized', 'locked')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  finalized_at TIMESTAMPTZ,
  finalized_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_academy
  ON public.payroll_periods(academy_id, start_date DESC);

-- ── 4. ENTRIES (IMMUTABLE SNAPSHOTS) ───────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  -- Full snapshot of the contract that produced this entry.
  contract_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Itemized lines: [{kind, basis, label_en, label_ar, unit, unit_count,
  --                   revenue_base, rate, amount, eligible_count, manual}].
  breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  gross_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  deduction_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deduction_amount >= 0),
  net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EGP',
  -- Manual bonus/deduction applied on top of the computed breakdown.
  adjustment_kind TEXT CHECK (adjustment_kind IS NULL OR adjustment_kind IN ('bonus', 'deduction')),
  adjustment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (adjustment_amount >= 0),
  adjustment_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'errored', 'disputed')),
  approver UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('cash', 'bank_transfer', 'e_wallet', 'other')),
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Correction chain: when an approved entry is corrected, a new entry rows
  -- points back to the one it corrects.
  correction_of UUID REFERENCES public.payroll_entries(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_id, coach_id)
);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_period
  ON public.payroll_entries(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_coach
  ON public.payroll_entries(coach_id, period_id);

-- ── 5. DISPUTES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL UNIQUE REFERENCES public.payroll_entries(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 3000),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  resolution TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ── 6. ROW LEVEL SECURITY ──────────────────────────────────

ALTER TABLE public.coach_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_disputes ENABLE ROW LEVEL SECURITY;

-- Contracts & rules are read by academy staff (includes coaches) and by the
-- coach whose contract it is. No write policies — RPCs only.
DROP POLICY IF EXISTS "Coach contracts read staff" ON public.coach_contracts;
CREATE POLICY "Coach contracts read staff" ON public.coach_contracts
  FOR SELECT TO authenticated
  USING (
    academy_id = public.current_academy_id()
    AND public.is_academy_staff()
  );

DROP POLICY IF EXISTS "Coach contracts read owner" ON public.coach_contracts;
CREATE POLICY "Coach contracts read owner" ON public.coach_contracts
  FOR SELECT TO authenticated
  USING (
    academy_id = public.current_academy_id()
    AND EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.id = coach_id AND c.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Compensation rules read staff" ON public.compensation_rules;
CREATE POLICY "Compensation rules read staff" ON public.compensation_rules
  FOR SELECT TO authenticated
  USING (academy_id = public.current_academy_id() AND public.is_academy_staff());

DROP POLICY IF EXISTS "Payroll periods read staff" ON public.payroll_periods;
CREATE POLICY "Payroll periods read staff" ON public.payroll_periods
  FOR SELECT TO authenticated
  USING (academy_id = public.current_academy_id() AND public.is_academy_staff());

-- Entries: staff read everything; coaches read only their own.
DROP POLICY IF EXISTS "Payroll entries read staff" ON public.payroll_entries;
CREATE POLICY "Payroll entries read staff" ON public.payroll_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_periods p
      WHERE p.id = period_id
        AND p.academy_id = public.current_academy_id()
        AND public.is_academy_staff()
    )
  );

DROP POLICY IF EXISTS "Payroll entries read coach" ON public.payroll_entries;
CREATE POLICY "Payroll entries read coach" ON public.payroll_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.id = coach_id AND c.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Payroll disputes read staff" ON public.payroll_disputes;
CREATE POLICY "Payroll disputes read staff" ON public.payroll_disputes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_entries e
      JOIN public.payroll_periods p ON p.id = e.period_id
      WHERE e.id = entry_id
        AND p.academy_id = public.current_academy_id()
        AND public.is_academy_staff()
    )
  );

DROP POLICY IF EXISTS "Payroll disputes read coach" ON public.payroll_disputes;
CREATE POLICY "Payroll disputes read coach" ON public.payroll_disputes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coaches c
      WHERE c.id = coach_id AND c.profile_id = auth.uid()
    )
  );

-- ── 7. HELPER: CURRENT STAFF RECORD ────────────────────────

-- The coaches.id linked to the authenticated member, if any.
CREATE OR REPLACE FUNCTION public.current_coach_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM public.coaches c
  WHERE c.profile_id = auth.uid() AND c.is_active
  ORDER BY c.created_at ASC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_coach_id() TO authenticated;

-- Human labels for a compensation basis (used by the calculation engine).
CREATE OR REPLACE FUNCTION public.expected_label(p_basis TEXT, p_lang TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_basis = 'session' THEN CASE WHEN p_lang = 'en' THEN 'Sessions' ELSE 'حصة' END
    WHEN p_basis = 'player' THEN CASE WHEN p_lang = 'en' THEN 'Players' ELSE 'لاعب' END
    WHEN p_basis = 'revenue' THEN CASE WHEN p_lang = 'en' THEN 'Revenue' ELSE 'إيراد' END
    ELSE ''
  END;
$$;
GRANT EXECUTE ON FUNCTION public.expected_label(TEXT, TEXT) TO public;

-- ── 8. ADMIN GUARDS ────────────────────────────────────────

-- All payroll admin RPCs start with this check.
CREATE OR REPLACE FUNCTION public.require_payroll_admin()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can manage payroll' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ── 9. CONTRACTS ───────────────────────────────────────────

-- Insert a new contract version. Any currently effective contract for the
-- same coach is closed the day before the new version starts.
CREATE OR REPLACE FUNCTION public.upsert_coach_contract(
  p_coach_id UUID,
  p_base_salary NUMERIC,
  p_effective_from DATE,
  p_effective_to DATE DEFAULT NULL,
  p_currency TEXT DEFAULT 'EGP',
  p_auto_renew BOOLEAN DEFAULT TRUE,
  p_notes TEXT DEFAULT NULL,
  p_contract_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_academy UUID;
  v_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can manage contracts' USING ERRCODE = '42501';
  END IF;
  IF p_effective_to IS NOT NULL AND p_effective_to < p_effective_from THEN
    RAISE EXCEPTION 'Contract end must be on or after its start';
  END IF;
  IF p_base_salary < 0 THEN
    RAISE EXCEPTION 'Base salary cannot be negative';
  END IF;
  IF btrim(COALESCE(p_currency, '')) = '' THEN
    p_currency := 'EGP';
  END IF;

  v_academy := public.current_academy_id();
  IF NOT EXISTS (SELECT 1 FROM public.coaches WHERE id = p_coach_id
                 AND academy_id = v_academy) THEN
    RAISE EXCEPTION 'Coach not found in this academy';
  END IF;

  -- Update path (salary / notes / flags only; dates version the contract).
  IF p_contract_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.coach_contracts
                   WHERE id = p_contract_id AND coach_id = p_coach_id
                     AND academy_id = v_academy) THEN
      RAISE EXCEPTION 'Contract not found';
    END IF;
    UPDATE public.coach_contracts
    SET base_salary = p_base_salary,
        currency = p_currency,
        auto_renew = p_auto_renew,
        notes = p_notes,
        updated_at = NOW()
    WHERE id = p_contract_id;
    RETURN p_contract_id;
  END IF;

  -- Insert path: close the previously effective contract's range.
  UPDATE public.coach_contracts
  SET effective_to = p_effective_from - 1, updated_at = NOW()
  WHERE coach_id = p_coach_id
    AND academy_id = v_academy
    AND (effective_to IS NULL OR effective_to >= p_effective_from);

  INSERT INTO public.coach_contracts (
    academy_id, coach_id, effective_from, effective_to,
    base_salary, currency, auto_renew, notes, created_by
  )
  VALUES (
    v_academy, p_coach_id, p_effective_from, p_effective_to,
    p_base_salary, p_currency, p_auto_renew, p_notes, v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_coach_contract(UUID, NUMERIC, DATE, DATE, TEXT, BOOLEAN, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_coach_contract(UUID, NUMERIC, DATE, DATE, TEXT, BOOLEAN, TEXT, UUID) TO authenticated;

-- ── 10. COMPENSATION RULES ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_compensation_rule(
  p_name_en TEXT,
  p_name_ar TEXT,
  p_basis TEXT,
  p_value_type TEXT,
  p_value NUMERIC,
  p_min_attendance_pct NUMERIC DEFAULT 0,
  p_components JSONB DEFAULT '[]'::jsonb,
  p_effective_from DATE DEFAULT CURRENT_DATE,
  p_effective_to DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_academy UUID;
  v_id UUID;
  v_comp RECORD;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can manage compensation rules' USING ERRCODE = '42501';
  END IF;

  IF btrim(COALESCE(p_name_en, '')) = '' OR btrim(COALESCE(p_name_ar, '')) = '' THEN
    RAISE EXCEPTION 'Both an English and an Arabic rule name are required';
  END IF;
  IF p_basis NOT IN ('session', 'player', 'revenue', 'hybrid') THEN
    RAISE EXCEPTION 'Invalid basis';
  END IF;
  IF p_value_type NOT IN ('per_unit', 'percent', 'amount') THEN
    RAISE EXCEPTION 'Invalid value type';
  END IF;
  IF p_value < 0 THEN
    RAISE EXCEPTION 'Value cannot be negative';
  END IF;
  IF p_effective_to IS NOT NULL AND p_effective_to < p_effective_from THEN
    RAISE EXCEPTION 'Rule end must be on or after its start';
  END IF;
  -- percent only makes sense for revenue commissions.
  IF p_value_type = 'percent' AND p_basis <> 'revenue' THEN
    RAISE EXCEPTION 'Percent values only apply to revenue-based rules';
  END IF;
  IF p_basis = 'hybrid' AND jsonb_array_length(COALESCE(p_components, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Hybrid rules require at least one component';
  END IF;

  v_academy := public.current_academy_id();

  IF p_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.compensation_rules
                   WHERE id = p_id AND academy_id = v_academy) THEN
      RAISE EXCEPTION 'Rule not found';
    END IF;
    UPDATE public.compensation_rules
    SET name_en = btrim(p_name_en),
        name_ar = btrim(p_name_ar),
        basis = p_basis,
        value_type = p_value_type,
        value = p_value,
        min_attendance_pct = p_min_attendance_pct,
        components = p_components,
        effective_to = p_effective_to,
        notes = p_notes,
        updated_at = NOW()
    WHERE id = p_id AND academy_id = v_academy;
    RETURN p_id;
  END IF;

  INSERT INTO public.compensation_rules (
    academy_id, name_en, name_ar, basis, value_type, value,
    min_attendance_pct, components, effective_from, effective_to, notes, created_by
  )
  VALUES (
    v_academy, btrim(p_name_en), btrim(p_name_ar), p_basis, p_value_type, p_value,
    p_min_attendance_pct, p_components, p_effective_from, p_effective_to, p_notes, v_uid
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_compensation_rule(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, DATE, DATE, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_compensation_rule(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, JSONB, DATE, DATE, TEXT, UUID) TO authenticated;

-- ── 11. PERIODS ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_payroll_period(
  p_name TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_period_type TEXT DEFAULT 'monthly',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_academy UUID;
  v_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can create payroll periods' USING ERRCODE = '42501';
  END IF;
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Period end must be on or after its start';
  END IF;
  IF btrim(COALESCE(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Period name is required';
  END IF;

  v_academy := public.current_academy_id();

  -- No overlapping periods: every date belongs to exactly one run.
  IF EXISTS (
    SELECT 1 FROM public.payroll_periods
    WHERE academy_id = v_academy
      AND p_start_date <= end_date AND start_date <= p_end_date
  ) THEN
    RAISE EXCEPTION 'Period overlaps an existing payroll period';
  END IF;

  INSERT INTO public.payroll_periods (
    academy_id, name, period_type, start_date, end_date, created_by, notes
  )
  VALUES (v_academy, btrim(p_name), p_period_type, p_start_date, p_end_date, v_uid, p_notes)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_payroll_period(TEXT, DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payroll_period(TEXT, DATE, DATE, TEXT, TEXT) TO authenticated;

-- ── 12. CALCULATION ENGINE ─────────────────────────────────

-- Computes ONE coach's entry for a draft period. Returns the breakdown so a
-- caller can preview it, or raises when the period is not editable.
CREATE OR REPLACE FUNCTION public.calculate_coach_entry(
  p_period_id UUID,
  p_coach_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_period RECORD;
  v_coach RECORD;
  v_team_ids UUID[];
  v_player_ids UUID[];
  v_player_count INTEGER := 0;
  v_period_days INTEGER;
  v_contract RECORD;
  v_base NUMERIC(12, 2) := 0;
  v_overlap_days INTEGER;
  v_base_line JSONB;
  v_snapshot JSONB := '{}'::jsonb;
  v_rule RECORD;
  v_comp RECORD;
  v_session_test RECORD;
  v_lines JSONB := '[]'::jsonb;
  v_line JSONB;
  v_eligible_sessions INTEGER;
  v_present INTEGER;
  v_invited INTEGER;
  v_pct NUMERIC(5, 2);
  v_session_amount NUMERIC(12, 2);
  v_revenue NUMERIC(12, 2) := 0;
  v_gross NUMERIC(12, 2) := 0;
  v_deduction NUMERIC(12, 2) := 0;
  v_net NUMERIC(12, 2);
  v_existing RECORD;
  v_adj NUMERIC(12, 2);
  v_adj_kind TEXT;
  v_adj_reason TEXT;
  v_currency TEXT := 'EGP';
  v_base_basis TEXT;
  v_unit_count INTEGER;
  v_amount NUMERIC(12, 2);
  v_invited_count INTEGER := 0;
  v_line_amount NUMERIC(12, 2);
  v_rule_count INTEGER;
  n INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can run payroll' USING ERRCODE = '42501';
  END IF;

  -- Current period must be a draft.
  SELECT * INTO v_period FROM public.payroll_periods WHERE id = p_period_id;
  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'Payroll period not found';
  END IF;
  IF v_period.status <> 'draft' THEN
    RAISE EXCEPTION 'Period is % and can no longer be recalculated', v_period.status;
  END IF;

  SELECT * INTO v_coach FROM public.coaches c
  WHERE c.id = p_coach_id AND c.academy_id = v_period.academy_id;
  IF v_coach.id IS NULL THEN
    RAISE EXCEPTION 'Coach not found in this academy';
  END IF;

  v_period_days := (v_period.end_date - v_period.start_date) + 1;

  -- Coached teams + their current rosters (snapshot at compute time).
  SELECT ARRAY(SELECT t.id FROM public.teams t
               WHERE t.academy_id = v_period.academy_id AND t.coach_id = p_coach_id)
  INTO v_team_ids;
  IF v_team_ids IS NOT NULL AND cardinality(v_team_ids) > 0 THEN
    SELECT ARRAY(SELECT DISTINCT tm.member_id FROM public.team_members tm
                 WHERE tm.team_id = ANY (v_team_ids))
    INTO v_player_ids;
    v_player_count := CASE WHEN v_player_ids IS NULL THEN 0 ELSE cardinality(v_player_ids) END;
  END IF;

  -- ── Base salary from the effective contract (prorated) ──
  SELECT * INTO v_contract
  FROM public.coach_contracts
  WHERE coach_id = p_coach_id
    AND academy_id = v_period.academy_id
    AND effective_from <= v_period.end_date
    AND (effective_to IS NULL OR effective_to >= v_period.start_date)
  ORDER BY effective_from DESC
  LIMIT 1;

  IF v_contract.id IS NOT NULL THEN
    v_overlap_days := (
      LEAST(COALESCE(v_contract.effective_to, v_period.end_date), v_period.end_date)
      - GREATEST(v_contract.effective_from, v_period.start_date)
    ) + 1;
    IF v_overlap_days < 0 THEN v_overlap_days := 0; END IF;
    v_base := round(v_contract.base_salary * v_overlap_days / v_period_days, 2);
    v_currency := COALESCE(NULLIF(v_contract.currency, ''), 'EGP');
    v_snapshot := jsonb_build_object(
      'source', 'contract',
      'contract_id', v_contract.id,
      'effective_from', v_contract.effective_from,
      'effective_to', v_contract.effective_to,
      'base_salary', v_contract.base_salary,
      'currency', v_currency
    );
    v_base_basis := 'base';
  ELSE
    -- Fallback to the legacy monthly salary field (full period).
    v_base := round(COALESCE(v_coach.monthly_salary, 0), 2);
    v_snapshot := jsonb_build_object(
      'source', 'monthly_salary',
      'base_salary', v_coach.monthly_salary,
      'currency', 'EGP'
    );
    v_base_basis := 'base';
  END IF;

  v_lines := v_lines || jsonb_build_object(
    'kind', 'base', 'basis', v_base_basis,
    'label_en', 'Base salary', 'label_ar', 'الراتب الأساسي',
    'amount', v_base, 'manual', false
  );

  -- ── Compensation rules ──
  FOR v_rule IN
    SELECT r.* FROM public.compensation_rules r
    WHERE r.academy_id = v_period.academy_id AND r.is_active
      AND r.effective_from <= v_period.end_date
      AND (r.effective_to IS NULL OR r.effective_to >= v_period.start_date)
    ORDER BY r.created_at ASC
  LOOP
    IF v_rule.basis = 'hybrid' THEN
      -- Evaluate each component under the rules' umbrella label.
      v_rule_count := jsonb_array_length(v_rule.components);
      n := 0;
      WHILE n < v_rule_count LOOP
        SELECT * INTO v_comp
          FROM jsonb_to_record(jsonb_array_element(v_rule.components, n))
          AS (basis TEXT, value_type TEXT, value NUMERIC, min_attendance_pct NUMERIC);
        v_line_amount := 0;
        v_unit_count := 0;
        v_revenue := 0;

        IF v_comp.basis = 'revenue' AND v_player_count > 0 THEN
          SELECT coalesce(sum(p.amount), 0) INTO v_revenue
          FROM public.payments p
          WHERE p.member_id = ANY (v_player_ids)
            AND p.academy_id = v_period.academy_id
            AND p.payment_date BETWEEN v_period.start_date AND v_period.end_date;
          IF v_comp.value_type = 'percent' THEN
            v_line_amount := round(v_revenue * v_comp.value / 100, 2);
          ELSE
            v_line_amount := v_comp.value;
          END IF;
        ELSIF v_comp.basis IN ('session', 'player') THEN
          IF v_comp.basis = 'player' THEN
            v_unit_count := v_player_count;
          ELSE
            v_eligible_sessions := 0;
            FOR v_session_test IN
              SELECT s.id, s.date
              FROM public.training_sessions s
              WHERE s.academy_id = v_period.academy_id
                AND s.status = 'completed'
                AND s.date BETWEEN v_period.start_date AND v_period.end_date
                AND EXISTS (
                  SELECT 1 FROM public.attendance a
                  WHERE a.session_id = s.id AND a.is_present
                    AND a.member_id = ANY (v_player_ids)
                )
            LOOP
              SELECT count(*) FILTER (WHERE a.is_present),
                     count(*)
                INTO v_present, v_invited
              FROM public.attendance a
              WHERE a.session_id = v_session_test.id
                AND a.member_id = ANY (v_player_ids);
              IF v_invited > 0 THEN
                v_pct := round(v_present::numeric * 100 / v_invited, 2);
                IF v_pct >= COALESCE(v_comp.min_attendance_pct, 0) THEN
                  v_eligible_sessions := v_eligible_sessions + 1;
                END IF;
              END IF;
            END LOOP;
            v_unit_count := v_eligible_sessions;
          END IF;
          IF v_comp.value_type = 'per_unit' THEN
            v_line_amount := round(v_unit_count * v_comp.value, 2);
          ELSE
            v_line_amount := v_comp.value;
          END IF;
        END IF;

        v_lines := v_lines || jsonb_build_object(
          'kind', lower(v_comp.basis),
          'basis', lower(v_comp.basis),
          'label_en', v_rule.name_en || ' (' || expected_label(v_comp.basis, 'en') || ')',
          'label_ar', v_rule.name_ar || ' (' || expected_label(v_comp.basis, 'ar') || ')',
          'unit', v_comp.value,
          'unit_count', v_unit_count,
          'revenue_base', CASE WHEN v_comp.basis = 'revenue' THEN v_revenue ELSE NULL END,
          'rate', CASE WHEN v_comp.value_type = 'percent' THEN v_comp.value ELSE NULL END,
          'min_attendance_pct', COALESCE(v_comp.min_attendance_pct, 0),
          'amount', v_line_amount,
          'manual', false
        );
        n := n + 1;
      END LOOP;
    ELSIF v_rule.basis = 'revenue' AND v_player_count > 0 THEN
      SELECT coalesce(sum(p.amount), 0) INTO v_revenue
      FROM public.payments p
      WHERE p.member_id = ANY (v_player_ids)
        AND p.academy_id = v_period.academy_id
        AND p.payment_date BETWEEN v_period.start_date AND v_period.end_date;

      IF v_rule.value_type = 'percent' THEN
        v_line_amount := round(v_revenue * v_rule.value / 100, 2);
      ELSE
        v_line_amount := v_rule.value;
      END IF;

      v_lines := v_lines || jsonb_build_object(
        'kind', 'revenue', 'basis', 'revenue',
        'label_en', v_rule.name_en, 'label_ar', v_rule.name_ar,
        'rate', CASE WHEN v_rule.value_type = 'percent' THEN v_rule.value ELSE NULL END,
        'revenue_base', v_revenue, 'unit_count', 0,
        'amount', v_line_amount, 'manual', false
      );
    ELSIF v_rule.basis IN ('session', 'player') THEN
      IF v_rule.basis = 'player' THEN
        v_unit_count := v_player_count;
      ELSE
        v_eligible_sessions := 0;
        FOR v_session_test IN
          SELECT s.id, s.date
          FROM public.training_sessions s
          WHERE s.academy_id = v_period.academy_id
            AND s.status = 'completed'
            AND s.date BETWEEN v_period.start_date AND v_period.end_date
            AND EXISTS (
              SELECT 1 FROM public.attendance a
              WHERE a.session_id = s.id AND a.is_present
                AND a.member_id = ANY (v_player_ids)
            )
        LOOP
          SELECT count(*) FILTER (WHERE a.is_present), count(*)
            INTO v_present, v_invited
          FROM public.attendance a
          WHERE a.session_id = v_session_test.id
            AND a.member_id = ANY (v_player_ids);
          IF v_invited > 0 THEN
            v_pct := round(v_present::numeric * 100 / v_invited, 2);
            IF v_pct >= v_rule.min_attendance_pct THEN
              v_eligible_sessions := v_eligible_sessions + 1;
            END IF;
          END IF;
        END LOOP;
        v_unit_count := v_eligible_sessions;
      END IF;

      IF v_rule.value_type = 'per_unit' THEN
        v_line_amount := round(v_unit_count * v_rule.value, 2);
      ELSE
        v_line_amount := v_rule.value;
      END IF;

      v_lines := v_lines || jsonb_build_object(
        'kind', lower(v_rule.basis), 'basis', lower(v_rule.basis),
        'label_en', v_rule.name_en, 'label_ar', v_rule.name_ar,
        'unit', v_rule.value, 'unit_count', v_unit_count,
        'min_attendance_pct', v_rule.min_attendance_pct,
        'amount', v_line_amount, 'manual', false
      );
    END IF;
  END LOOP;

  -- ── Preserve manual adjustment across recomputes ──
  SELECT * INTO v_existing FROM public.payroll_entries
  WHERE period_id = p_period_id AND coach_id = p_coach_id;
  v_adj := COALESCE(v_existing.adjustment_amount, 0);
  v_adj_kind := v_existing.adjustment_kind;
  v_adj_reason := v_existing.adjustment_reason;
  IF v_adj > 0 THEN
    IF v_adj_kind = 'deduction' THEN
      v_lines := v_lines || jsonb_build_object(
        'kind', 'deduction', 'basis', 'deduction',
        'label_en', COALESCE(NULLIF(v_adj_reason, ''), 'Manual deduction'),
        'label_ar', COALESCE(NULLIF(v_adj_reason, ''), 'خصم يدوي'),
        'amount', v_adj, 'manual', true
      );
    ELSE
      v_lines := v_lines || jsonb_build_object(
        'kind', 'bonus', 'basis', 'bonus',
        'label_en', COALESCE(NULLIF(v_adj_reason, ''), 'Manual bonus'),
        'label_ar', COALESCE(NULLIF(v_adj_reason, ''), 'مكافأة يدوية'),
        'amount', v_adj, 'manual', true
      );
    END IF;
  END IF;

  -- ── Totals (deductions are separate from gross) ──
  SELECT round(coalesce(sum(x.amount) FILTER (WHERE x.kind <> 'deduction'), 0), 2),
         round(coalesce(sum(x.amount) FILTER (WHERE x.kind = 'deduction'), 0), 2)
    INTO v_gross, v_deduction
  FROM jsonb_to_recordset(v_lines) AS x(kind TEXT, amount NUMERIC);
  v_net := round(v_gross - v_deduction, 2);

  INSERT INTO public.payroll_entries (
    period_id, coach_id, contract_snapshot, breakdown,
    gross_amount, deduction_amount, net_amount, currency,
    adjustment_kind, adjustment_amount, adjustment_reason, status
  )
  VALUES (
    p_period_id, p_coach_id, v_snapshot, v_lines,
    v_gross, v_deduction, v_net, v_currency,
    v_adj_kind, v_adj, v_adj_reason, 'pending'
  )
  ON CONFLICT (period_id, coach_id) DO UPDATE
    SET contract_snapshot = EXCLUDED.contract_snapshot,
        breakdown = EXCLUDED.breakdown,
        gross_amount = EXCLUDED.gross_amount,
        deduction_amount = EXCLUDED.deduction_amount,
        net_amount = EXCLUDED.net_amount,
        currency = EXCLUDED.currency,
        status = CASE
          WHEN public.payroll_entries.status IN ('errored', 'disputed') THEN 'errored'
          ELSE 'pending'
        END,
        updated_at = NOW();

  RETURN v_lines;
END;
$$;
REVOKE ALL ON FUNCTION public.calculate_coach_entry(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_coach_entry(UUID, UUID) TO authenticated;
-- ── 13. RUN / RECALCULATE ─────────────────────────────────

-- Computes (or recomputes) every coach's entry for a draft period and
-- returns the number of entries created. Idempotent while status = draft.
CREATE OR REPLACE FUNCTION public.run_payroll_period(
  p_period_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_period RECORD;
  v_coach RECORD;
  v_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can run payroll' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_period FROM public.payroll_periods WHERE id = p_period_id;
  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'Payroll period not found';
  END IF;
  IF v_period.status <> 'draft' THEN
    RAISE EXCEPTION 'Period is %, cannot rerun payroll', v_period.status;
  END IF;

  FOR v_coach IN
    SELECT c.id FROM public.coaches c
    WHERE c.academy_id = v_period.academy_id AND c.is_active
    ORDER BY c.created_at ASC
  LOOP
    BEGIN
      PERFORM public.calculate_coach_entry(p_period_id, v_coach.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Surface the coach that failed and keep going (period stays draft so it
      -- can be retried after the data issue is fixed).
      RAISE EXCEPTION 'Payroll failed for coach %: %', v_coach.id, SQLERRM USING ERRCODE = 'P0001';
    END;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.run_payroll_period(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_payroll_period(UUID) TO authenticated;

-- ── 14. ADJUSTMENTS ───────────────────────────────────────

-- Applies a manual bonus or deduction to a pending entry. Re-running the
-- period keeps this adjustment (the reason is carried into the breakdown).
CREATE OR REPLACE FUNCTION public.adjust_payroll_entry(
  p_entry_id UUID,
  p_kind TEXT,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_entry RECORD;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can adjust payroll' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('bonus', 'deduction') THEN
    RAISE EXCEPTION 'Adjustment kind must be bonus or deduction';
  END IF;
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Adjustment amount cannot be negative (use kind to choose direction)';
  END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'An adjustment reason is required';
  END IF;

  SELECT e.*, p.status AS period_status
    INTO v_entry
  FROM public.payroll_entries e
  JOIN public.payroll_periods p ON p.id = e.period_id
  WHERE e.id = p_entry_id
  FOR UPDATE OF e;

  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'Payroll entry not found';
  END IF;
  IF v_entry.period_status <> 'draft' THEN
    RAISE EXCEPTION 'Period is %, cannot adjust entries', v_entry.period_status;
  END IF;
  IF v_entry.status NOT IN ('pending', 'errored') THEN
    RAISE EXCEPTION 'Entry is %, cannot adjust', v_entry.status;
  END IF;

  UPDATE public.payroll_entries
  SET adjustment_kind = p_kind,
      adjustment_amount = p_amount,
      adjustment_reason = btrim(p_reason),
      updated_at = NOW()
  WHERE id = p_entry_id;

  -- Recompute so the totals include the adjustment.
  PERFORM public.calculate_coach_entry(v_entry.period_id, v_entry.coach_id);
END;
$$;
REVOKE ALL ON FUNCTION public.adjust_payroll_entry(UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_payroll_entry(UUID, TEXT, NUMERIC, TEXT) TO authenticated;

-- ── 15. FINALIZE / LOCK ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.finalize_payroll_period(
  p_period_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_period RECORD;
  v_count INTEGER;
  v_bad INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can finalize payroll' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_period FROM public.payroll_periods WHERE id = p_period_id;
  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'Payroll period not found';
  END IF;
  IF v_period.status <> 'draft' THEN
    RAISE EXCEPTION 'Period is %, can only finalize a draft', v_period.status;
  END IF;

  -- Every active coach must have a computed entry before finalizing.
  SELECT count(*) INTO v_count
  FROM public.coaches c
  WHERE c.academy_id = v_period.academy_id AND c.is_active;

  SELECT count(*) INTO v_count FROM public.payroll_entries
  WHERE period_id = p_period_id AND status IN ('pending', 'approved');

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Run payroll first — no entries exist for this period';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payroll_entries
             WHERE period_id = p_period_id AND status IN ('errored', 'disputed')) THEN
    RAISE EXCEPTION 'Some entries still have errors or open disputes';
  END IF;

  UPDATE public.payroll_entries
  SET status = 'approved',
      approver = v_uid,
      approved_at = NOW(),
      updated_at = NOW()
  WHERE period_id = p_period_id AND status = 'pending';

  UPDATE public.payroll_periods
  SET status = 'finalized',
      finalized_at = NOW(),
      finalized_by = v_uid,
      updated_at = NOW()
  WHERE id = p_period_id;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_payroll_period(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_payroll_period(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.lock_payroll_period(
  p_period_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_period RECORD;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can lock payroll' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_period FROM public.payroll_periods WHERE id = p_period_id;
  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'Payroll period not found';
  END IF;
  IF v_period.status <> 'finalized' THEN
    RAISE EXCEPTION 'Period is %, can only lock a finalized period', v_period.status;
  END IF;

  UPDATE public.payroll_periods
  SET status = 'locked',
      locked_at = NOW(),
      locked_by = v_uid,
      updated_at = NOW()
  WHERE id = p_period_id;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_payroll_period(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_payroll_period(UUID) TO authenticated;

-- ── 16. PAYMENTS ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pay_payroll_entry(
  p_entry_id UUID,
  p_method TEXT,
  p_payment_date DATE DEFAULT CURRENT_DATE,
  p_reference TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_entry RECORD;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can record payroll payments' USING ERRCODE = '42501';
  END IF;
  IF p_method NOT IN ('cash', 'bank_transfer', 'e_wallet', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  SELECT e.*, p.status AS period_status
    INTO v_entry
  FROM public.payroll_entries e
  JOIN public.payroll_periods p ON p.id = e.period_id
  WHERE e.id = p_entry_id
  FOR UPDATE OF e;

  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'Payroll entry not found';
  END IF;
  IF v_entry.period_status NOT IN ('finalized', 'locked') THEN
    RAISE EXCEPTION 'Period is %, must be finalized before paying', v_entry.period_status;
  END IF;
  IF v_entry.status NOT IN ('approved', 'disputed') THEN
    RAISE EXCEPTION 'Entry status is %, cannot pay', v_entry.status;
  END IF;
  IF v_entry.net_amount < 0 THEN
    RAISE EXCEPTION 'Net is negative (%.2f) — resolve this before paying', v_entry.net_amount;
  END IF;

  UPDATE public.payroll_entries
  SET status = 'paid',
      payment_method = p_method,
      payment_reference = NULLIF(btrim(COALESCE(p_reference, '')), ''),
      paid_at = p_payment_date::timestamptz,
      paid_by = v_uid,
      updated_at = NOW()
  WHERE id = p_entry_id;
END;
$$;
REVOKE ALL ON FUNCTION public.pay_payroll_entry(UUID, TEXT, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_payroll_entry(UUID, TEXT, DATE, TEXT) TO authenticated;

-- ── 17. DISPUTES ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.open_payroll_dispute(
  p_entry_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_coach_id UUID;
  v_entry RECORD;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'A dispute reason is required';
  END IF;

  SELECT id INTO v_coach_id FROM public.coaches
  WHERE profile_id = v_uid AND is_active
  ORDER BY created_at ASC LIMIT 1;

  SELECT e.* INTO v_entry
  FROM public.payroll_entries e
  WHERE e.id = p_entry_id AND e.coach_id = v_coach_id;

  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'Entry not found or not yours';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payroll_disputes WHERE entry_id = p_entry_id AND status = 'open') THEN
    RAISE EXCEPTION 'An open dispute already exists for this entry';
  END IF;

  IF v_entry.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approved entries can be disputed (current status: %)', v_entry.status;
  END IF;

  UPDATE public.payroll_entries SET status = 'disputed', updated_at = NOW()
  WHERE id = p_entry_id;

  INSERT INTO public.payroll_disputes (entry_id, coach_id, reason)
  VALUES (p_entry_id, v_coach_id, btrim(p_reason))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.open_payroll_dispute(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_payroll_dispute(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_payroll_dispute(
  p_dispute_id UUID,
  p_decision TEXT,
  p_resolution TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_dispute RECORD;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can resolve disputes' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('resolved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be resolved or rejected';
  END IF;

  SELECT d.* INTO v_dispute FROM public.payroll_disputes d WHERE d.id = p_dispute_id;
  IF v_dispute.id IS NULL THEN
    RAISE EXCEPTION 'Dispute not found';
  END IF;
  IF v_dispute.status <> 'open' THEN
    RAISE EXCEPTION 'Dispute is already %', v_dispute.status;
  END IF;

  -- Decision 'resolved' grants the coach the correction: the entry returns to
  -- approved so it can be paid (the correction line is added via
  -- adjust_payroll_entry before finalizing or a new period).
  UPDATE public.payroll_disputes
  SET status = p_decision,
      resolution = NULLIF(btrim(COALESCE(p_resolution, '')), ''),
      resolved_by = v_uid,
      resolved_at = NOW()
  WHERE id = p_dispute_id;

  UPDATE public.payroll_entries
  SET status = 'approved', updated_at = NOW()
  WHERE id = v_dispute.entry_id;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_payroll_dispute(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_payroll_dispute(UUID, TEXT, TEXT) TO authenticated;

-- ── 18. READS (CLIENT-FACING) ─────────────────────────────

-- Coach-facing: their own payroll entries across all finalized periods.
CREATE OR REPLACE FUNCTION public.get_my_payroll_entries()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_coach_id UUID;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id INTO v_coach_id FROM public.coaches
  WHERE profile_id = v_uid AND is_active
  ORDER BY created_at ASC LIMIT 1;

  IF v_coach_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(entry ORDER BY period_start DESC), '[]'::jsonb)
    INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'entry_id', e.id,
      'period_id', p.id,
      'period_name', p.name,
      'period_start', p.start_date,
      'period_end', p.end_date,
      'period_status', p.status,
      'gross_amount', e.gross_amount,
      'deduction_amount', e.deduction_amount,
      'net_amount', e.net_amount,
      'currency', e.currency,
      'status', e.status,
      'breakdown', e.breakdown,
      'contract_snapshot', e.contract_snapshot,
      'paid_at', e.paid_at,
      'payment_method', e.payment_method,
      'dispute_status', (SELECT d.status FROM public.payroll_disputes d WHERE d.entry_id = e.id LIMIT 1),
      'dispute_reason', (SELECT d.reason FROM public.payroll_disputes d WHERE d.entry_id = e.id LIMIT 1)
    ) AS entry,
    p.start_date AS period_start
    FROM public.payroll_entries e
    JOIN public.payroll_periods p ON p.id = e.period_id
    WHERE e.coach_id = v_coach_id
      AND p.status IN ('finalized', 'locked')
  ) s;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_payroll_entries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_payroll_entries() TO authenticated;

-- Admin-facing: periods + totals + outstanding positions.
CREATE OR REPLACE FUNCTION public.get_payroll_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_academy UUID;
  v_result JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_staff() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  v_academy := public.current_academy_id();

  SELECT jsonb_build_object(
    'periods', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY start_date DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'period_type', p.period_type,
          'start_date', p.start_date,
          'end_date', p.end_date,
          'status', p.status,
          'entry_count', count(e.id),
          'paid_count', count(e.id) FILTER (WHERE e.status = 'paid'),
          'unpaid_count', count(e.id) FILTER (WHERE e.status = 'approved'),
          'disputed_count', count(e.id) FILTER (WHERE e.status = 'disputed'),
          'net_total', round(coalesce(sum(e.net_amount), 0), 2),
          'paid_total', round(coalesce(sum(e.net_amount) FILTER (WHERE e.status = 'paid'), 0), 2),
          'unpaid_total', round(coalesce(sum(e.net_amount) FILTER (WHERE e.status = 'approved'), 0), 2)
        ) AS row_data,
        p.start_date
        FROM public.payroll_periods p
        LEFT JOIN public.payroll_entries e ON e.period_id = p.id
        WHERE p.academy_id = v_academy
        GROUP BY p.id, p.start_date
      ) t
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_payroll_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payroll_overview() TO authenticated;

-- ── 19. CONCURRENCY GUARD ─────────────────────────────────

-- A payroll period that has been finalized or locked is immutable: the
-- aproved entries are snapshots. This trigger forbids DELETE of finalized
-- periods and non-approving changes to approved/paid entries.
DROP TRIGGER IF EXISTS trg_payroll_guard ON public.payroll_periods;
CREATE OR REPLACE FUNCTION public.guard_payroll_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('finalized', 'locked') THEN
      RAISE EXCEPTION 'Finalized payroll periods cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('finalized', 'locked') THEN
    -- The only allowed transition on a finalized period is finalized → locked.
    IF NEW.status = 'locked' AND OLD.status = 'finalized' THEN
      RETURN NEW;
    END IF;
    IF NEW.status = OLD.status
       AND OLD.start_date = NEW.start_date
       AND OLD.end_date = NEW.end_date
       AND OLD.name = NEW.name THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Finalized payroll periods are immutable except via lock';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_payroll_guard
BEFORE UPDATE OR DELETE ON public.payroll_periods
FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_period();

DROP TRIGGER IF EXISTS trg_payroll_entry_guard ON public.payroll_entries;
CREATE OR REPLACE FUNCTION public.guard_payroll_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Payroll entries cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('paid') THEN
    -- Only the payment bookkeeping fields may change (e.g. correcting a
    -- mismatched reference/method). Money itself is fixed.
    IF OLD.gross_amount = NEW.gross_amount
       AND OLD.net_amount = NEW.net_amount
       AND OLD.deduction_amount = NEW.deduction_amount
       AND OLD.breakdown = NEW.breakdown THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Paid entries are immutable snapshots';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status = 'approved' THEN
    IF OLD.gross_amount <> NEW.gross_amount OR OLD.net_amount <> NEW.net_amount THEN
      RAISE EXCEPTION 'Approved amount cannot change outside the payroll workflow';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_payroll_entry_guard
BEFORE UPDATE OR DELETE ON public.payroll_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_payroll_entry();
