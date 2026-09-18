-- ────────────────────────────────────────────────────────────
-- COMPLAINTS / SUPPORT / CUSTOMER SATISFACTION
--
-- Academy-tenant support ticketing: categories with SLA defaults,
-- a prioritized queue, staff assignment/routing, internal notes,
-- pause/resume with SLA-aware due dates, escalations, a satisfaction
-- survey (once per resolution) and an admin dashboard.
--
-- Security model (mirrors the coaching conventions):
--   * admin        → academy owner/admins (profiles.role = 'admin')
--   * coach        → member with a linked staff record
--                     (public.coaches.profile_id = auth.uid())
--   * staff = admin OR coach (public.is_academy_staff())
--   * players/coaches submit tickets; staff handle them.
--   * Internal notes are visible ONLY to academy staff.
--   * All mutations run through SECURITY DEFINER RPCs that re-check
--     access in SQL; direct client writes are not allowed.
-- ────────────────────────────────────────────────────────────

-- ── 0. ACCESS HELPERS (self-contained bootstrap) ───────────

-- The academy role helpers normally come from the earlier migration
-- 20260918000000_ai_coach_assistant.sql. When this migration is applied to a
-- database that never ran that one (e.g. a fresh schema.sql-only database),
-- we (re)create them here so every policy below resolves. Definitions exactly
-- mirror the originals; CREATE OR REPLACE keeps them idempotent.

-- The coach→member link is normally added by 20260916000000_coach_invitations.sql.
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS profile_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Current academy admin (owner) for the authenticated user.
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

-- The authenticated user is linked to a staff coach record in the academy.
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

-- Academy staff = admin OR linked coach.
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

-- Coach ids of the current user within the academy.
CREATE OR REPLACE FUNCTION public.current_coach_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT c.id FROM public.coaches c
    WHERE c.profile_id = auth.uid()
      AND c.is_active
      AND c.academy_id = public.current_academy_id()
  );
$$;
GRANT EXECUTE ON FUNCTION public.current_coach_ids() TO authenticated;

-- Team ids the current coach is assigned to.
CREATE OR REPLACE FUNCTION public.current_coach_team_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT t.id FROM public.teams t
    WHERE t.academy_id = public.current_academy_id()
      AND t.coach_id = ANY (public.current_coach_ids())
  );
$$;
GRANT EXECUTE ON FUNCTION public.current_coach_team_ids() TO authenticated;

-- ── 1. ROUTING PREFERENCES ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_routing_prefs (
  academy_id UUID PRIMARY KEY REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  auto_assign BOOLEAN NOT NULL DEFAULT TRUE,
  notify_new_ticket BOOLEAN NOT NULL DEFAULT TRUE,
  notify_status_changes BOOLEAN NOT NULL DEFAULT TRUE,
  ticket_suffix TEXT NOT NULL DEFAULT 'PLAYZA' CHECK (char_length(ticket_suffix) BETWEEN 1 AND 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. CATEGORIES ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name_en TEXT NOT NULL CHECK (char_length(name_en) BETWEEN 1 AND 80),
  name_ar TEXT NOT NULL CHECK (char_length(name_ar) BETWEEN 1 AND 80),
  description TEXT,
  -- Default priority applied to tickets in this category.
  default_priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (default_priority IN ('low', 'medium', 'high', 'urgent')),
  -- SLA target in hours for tickets in this category (0 = use the
  -- priority-based default table in the SLA function).
  sla_hours NUMERIC(6, 2) NOT NULL DEFAULT 0 CHECK (sla_hours >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. TICKET SEQUENCE COUNTERS ────────────────────────────

-- Per-academy, per-calendar-year sequence for ticket numbers like
-- PLAYZA-<INVITE-CODE>-2026-00042. Row is locked during numbering so
-- concurrent creates cannot collide.
CREATE TABLE IF NOT EXISTS public.support_ticket_counters (
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  seq INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (academy_id, year)
);

-- ── 4. TICKETS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  number TEXT NOT NULL UNIQUE,
  category_id UUID NOT NULL REFERENCES public.support_categories(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.academy_branches(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 8000),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'pending', 'resolved', 'closed', 'escalated')),
  source TEXT NOT NULL DEFAULT 'player'
    CHECK (source IN ('player', 'staff', 'email', 'web', 'mobile')),
  submitter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- SLA target. Paused intervals shift it forward on resume.
  sla_due_at TIMESTAMPTZ NOT NULL,
  first_response_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  paused_reason TEXT CHECK (paused_reason IN (
    'waiting_on_player', 'waiting_on_academy', 'waiting_on_third_party', 'other'
  )),
  escalated_at TIMESTAMPTZ,
  escalated_from_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_summary TEXT,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  satisfaction_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_academy_status
  ON public.support_tickets(academy_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_submitter
  ON public.support_tickets(submitter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assignee
  ON public.support_tickets(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla
  ON public.support_tickets(academy_id, sla_due_at) WHERE status IN ('open', 'in_progress', 'pending');

-- ── 5. CONVERSATION + PAUSES + AUDIT + SURVEYS ─────────────

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  -- Staff-only note. Hidden from the submitter at the RLS level.
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket
  ON public.support_ticket_messages(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.support_ticket_pauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN (
    'waiting_on_player', 'waiting_on_academy', 'waiting_on_third_party', 'other'
  )),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_support_pauses_ticket
  ON public.support_ticket_pauses(ticket_id);

CREATE TABLE IF NOT EXISTS public.support_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  field TEXT,
  previous TEXT,
  current TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_support_audit_ticket
  ON public.support_audit_log(ticket_id, created_at);

CREATE TABLE IF NOT EXISTS public.support_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL UNIQUE REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  nps INTEGER CHECK (nps BETWEEN -100 AND 100),
  feedback TEXT CHECK (char_length(feedback) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. ROW LEVEL SECURITY ──────────────────────────────────

ALTER TABLE public.support_routing_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_counters ENABLE ROW LEVEL SECURITY;

-- Categories are visible to every authenticated member of the academy and
-- read/edited by staff only (write policies intentionally absent — RPCs only).
DROP POLICY IF EXISTS "Support categories read" ON public.support_categories;
CREATE POLICY "Support categories read" ON public.support_categories
  FOR SELECT TO authenticated
  USING (academy_id = public.current_academy_id());

-- Tickets: staff read every ticket in the academy; submitter reads their own.
-- There are no INSERT/UPDATE/DELETE policies — every write goes through an RPC.
DROP POLICY IF EXISTS "Support tickets read staff" ON public.support_tickets;
CREATE POLICY "Support tickets read staff" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    academy_id = public.current_academy_id()
    AND public.is_academy_staff()
  );

DROP POLICY IF EXISTS "Support tickets read submitter" ON public.support_tickets;
CREATE POLICY "Support tickets read submitter" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    academy_id = public.current_academy_id()
    AND submitter_id = auth.uid()
  );

DROP POLICY IF EXISTS "Support tickets read coach teams" ON public.support_tickets;
CREATE POLICY "Support tickets read coach teams" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    academy_id = public.current_academy_id()
    AND public.is_academy_coach()
    AND (
      assignee_id = auth.uid()
      OR team_id = ANY (public.current_coach_team_ids())
    )
  );

-- Messages: staff read every message; the submitter reads the public thread
-- only (internal notes are hidden at the row level).
DROP POLICY IF EXISTS "Support messages read staff" ON public.support_ticket_messages;
CREATE POLICY "Support messages read staff" ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.academy_id = public.current_academy_id()
        AND public.is_academy_staff()
    )
  );

DROP POLICY IF EXISTS "Support messages read public submitter" ON public.support_ticket_messages;
CREATE POLICY "Support messages read public submitter" ON public.support_ticket_messages
  FOR SELECT TO authenticated
  USING (
    is_internal = FALSE
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.academy_id = public.current_academy_id()
        AND t.submitter_id = auth.uid()
    )
  );

-- Pauses/audit logs: staff only (they describe internal workflow).
DROP POLICY IF EXISTS "Support pauses read staff" ON public.support_ticket_pauses;
CREATE POLICY "Support pauses read staff" ON public.support_ticket_pauses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.academy_id = public.current_academy_id()
        AND public.is_academy_staff()
    )
  );

DROP POLICY IF EXISTS "Support audit read staff" ON public.support_audit_log;
CREATE POLICY "Support audit read staff" ON public.support_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.academy_id = public.current_academy_id()
        AND public.is_academy_staff()
    )
  );

DROP POLICY IF EXISTS "Support surveys read staff" ON public.support_surveys;
CREATE POLICY "Support surveys read staff" ON public.support_surveys
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.academy_id = public.current_academy_id()
        AND public.is_academy_staff()
    )
  );

DROP POLICY IF EXISTS "Support surveys read submitter" ON public.support_surveys;
CREATE POLICY "Support surveys read submitter" ON public.support_surveys
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.academy_id = public.current_academy_id()
        AND t.submitter_id = auth.uid()
    )
  );

-- ── 7. DEFAULT CATEGORIES ON ACADEMY CREATION ──────────────

CREATE OR REPLACE FUNCTION public.seed_support_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.support_categories (academy_id, name_en, name_ar, default_priority, sla_hours, sort_order)
  VALUES
    (NEW.id, 'Payment & billing', 'الدفع والفوترة', 'high', 8, 1),
    (NEW.id, 'Schedule & sessions', 'الجدول والتدريبات', 'medium', 24, 2),
    (NEW.id, 'Attendance & membership', 'الحضور والعضوية', 'medium', 24, 3),
    (NEW.id, 'Coach feedback', 'ملاحظات المدربين', 'low', 48, 4),
    (NEW.id, 'Facility & booking', 'المنشآت والحجوزات', 'medium', 24, 5),
    (NEW.id, 'Other', 'أخرى', 'low', 48, 6);
  INSERT INTO public.support_routing_prefs (academy_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS seed_support_categories_on_academy ON public.academies;
CREATE TRIGGER seed_support_categories_on_academy
  AFTER INSERT ON public.academies
  FOR EACH ROW EXECUTE FUNCTION public.seed_support_categories();

-- ── 8. SLA HELPER ──────────────────────────────────────────

-- Priority-based SLA targets in hours, used when the category does not
-- override with its own sla_hours.
CREATE OR REPLACE FUNCTION public.support_sla_hours(
  p_priority TEXT,
  p_category_id UUID
)
RETURNS NUMERIC(6, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla NUMERIC(6, 2);
  v_default NUMERIC(6, 2) := CASE p_priority
    WHEN 'low' THEN 48
    WHEN 'medium' THEN 24
    WHEN 'high' THEN 8
    WHEN 'urgent' THEN 4
    ELSE 24
  END;
BEGIN
  IF p_category_id IS NULL THEN
    RETURN v_default;
  END IF;
  SELECT sla_hours INTO v_sla
  FROM public.support_categories c
  WHERE c.id = p_category_id AND c.academy_id = public.current_academy_id();
  IF v_sla IS NULL OR v_sla <= 0 THEN
    RETURN v_default;
  END IF;
  RETURN v_sla;
END;
$$;

-- ── 9. IN-APP NOTIFICATION HELPER ──────────────────────────

CREATE OR REPLACE FUNCTION public.support_notify(
  p_recipient_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_link TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (p_recipient_id, p_type, p_title, p_body, p_link)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── 10. CREATE TICKET ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_subject TEXT,
  p_description TEXT,
  p_category_id UUID,
  p_priority TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_team_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'player'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_academy UUID;
  v_category_id UUID;
  v_category_priority TEXT;
  v_year INTEGER;
  v_seq INTEGER;
  v_acode TEXT;
  v_suffix TEXT;
  v_number TEXT;
  v_sla NUMERIC(6, 2);
  v_ticket_id UUID;
  v_assignee UUID := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT academy_id INTO v_academy FROM public.profiles WHERE id = v_uid;
  IF v_academy IS NULL THEN
    RAISE EXCEPTION 'You have not joined an academy yet';
  END IF;

  -- Only academy members may open tickets here; staff open from the dashboard.
  IF p_source = 'staff' AND NOT public.is_academy_staff() THEN
    RAISE EXCEPTION 'Only academy staff can open staff tickets' USING ERRCODE = '42501';
  END IF;

  -- The category must belong to the caller's academy and be active.
  SELECT id, default_priority INTO v_category_id, v_category_priority
  FROM public.support_categories
  WHERE id = p_category_id AND academy_id = v_academy AND is_active;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'Unknown support category';
  END IF;

  -- Blocking per-academy/per-year sequence for the display number.
  v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  SELECT seq INTO v_seq
  FROM public.support_ticket_counters
  WHERE academy_id = v_academy AND year = v_year
  FOR UPDATE;

  IF v_seq IS NULL THEN
    INSERT INTO public.support_ticket_counters (academy_id, year, seq)
    VALUES (v_academy, v_year, 1);
    v_seq := 1;
  ELSE
    v_seq := v_seq + 1;
    UPDATE public.support_ticket_counters
    SET seq = v_seq
    WHERE academy_id = v_academy AND year = v_year;
  END IF;

  SELECT COALESCE(b.invite_code, 'ACAD') INTO v_acode
  FROM public.academies b WHERE b.id = v_academy;
  SELECT COALESCE(ticket_suffix, 'PLAYZA') INTO v_suffix
  FROM public.support_routing_prefs WHERE academy_id = v_academy;
  v_number := upper(v_suffix) || '-' || upper(v_acode) || '-' || v_year ||
              '-' || lpad(v_seq::TEXT, 5, '0');

  v_sla := public.support_sla_hours(COALESCE(p_priority, v_category_priority), p_category_id);

  -- Optional auto-route: assign to the least-busy active academy admin.
  IF COALESCE((SELECT auto_assign FROM public.support_routing_prefs
               WHERE academy_id = v_academy), TRUE) THEN
    SELECT p.id INTO v_assignee
    FROM public.profiles p
    LEFT JOIN public.support_tickets t
      ON t.assignee_id = p.id AND t.status IN ('open', 'in_progress', 'pending', 'escalated')
    WHERE p.academy_id = v_academy AND p.role = 'admin'
    GROUP BY p.id
    ORDER BY count(t.id) ASC, p.created_at ASC
    LIMIT 1;
  END IF;

  INSERT INTO public.support_tickets (
    academy_id, number, category_id, branch_id, team_id, subject, description,
    priority, status, source, submitter_id, assignee_id, sla_due_at
  )
  VALUES (
    v_academy, v_number, p_category_id, p_branch_id, p_team_id,
    btrim(p_subject), btrim(p_description),
    COALESCE(p_priority, v_category_priority), 'open', p_source, v_uid, v_assignee,
    NOW() + (v_sla || ' hours')::INTERVAL
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.support_ticket_messages (ticket_id, author_id, body, is_internal, is_system)
  VALUES (v_ticket_id, v_uid, btrim(p_description), FALSE, TRUE);

  INSERT INTO public.support_audit_log (ticket_id, actor_id, action, field, previous, current)
  VALUES (v_ticket_id, v_uid, 'created', 'status', NULL, 'open');

  PERFORM public.support_notify(
    v_uid, 'support_ticket', 'Ticket ' || v_number || ' opened',
    left(btrim(p_subject), 120),
    '/support/' || v_ticket_id
  );

  -- Notify academy admins (they are the support queue).
  IF COALESCE((SELECT notify_new_ticket FROM public.support_routing_prefs WHERE academy_id = v_academy), TRUE) THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    SELECT p.id, 'support_ticket', 'New ticket ' || v_number,
      left(btrim(p_subject), 120), '/support/' || v_ticket_id
    FROM public.profiles p
    WHERE p.academy_id = v_academy AND p.role = 'admin';
  END IF;

  RETURN v_ticket_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_support_ticket(TEXT, TEXT, UUID, TEXT, UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(TEXT, TEXT, UUID, TEXT, UUID, UUID, TEXT) TO authenticated;
-- ── 11. ADD MESSAGE ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.add_ticket_message(
  p_ticket_id UUID,
  p_body TEXT,
  p_is_internal BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ticket RECORD;
  v_staff BOOLEAN;
  v_msg_id UUID;
  v_status_before TEXT;
  v_was_open BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id AND academy_id = public.current_academy_id()
  FOR UPDATE;

  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  v_staff := public.is_academy_staff();

  -- Access: academy staff, the submitter (public thread only), or the coach
  -- of the group referenced by the ticket.
  IF NOT (v_staff
          OR v_ticket.submitter_id = v_uid
          OR (public.is_academy_coach()
              AND (v_ticket.team_id = ANY (public.current_coach_team_ids()))))
  THEN
    RAISE EXCEPTION 'No access to this ticket' USING ERRCODE = '42501';
  END IF;

  -- Internal notes are strictly staff-only.
  IF p_is_internal AND NOT v_staff THEN
    RAISE EXCEPTION 'Only academy staff can post internal notes' USING ERRCODE = '42501';
  END IF;

  v_status_before := v_ticket.status;
  v_was_open := v_ticket.status = 'open';

  INSERT INTO public.support_ticket_messages (ticket_id, author_id, body, is_internal)
  VALUES (p_ticket_id, v_uid, btrim(p_body), p_is_internal)
  RETURNING id INTO v_msg_id;

  UPDATE public.support_tickets
  SET updated_at = NOW()
  WHERE id = p_ticket_id;

  -- First public staff reply auto-moves the ticket to in_progress and records
  -- the first-response time for SLA reporting.
  IF v_staff AND NOT p_is_internal AND v_was_open THEN
    UPDATE public.support_tickets
    SET status = 'in_progress',
        first_response_at = NOW(),
        updated_at = NOW()
    WHERE id = p_ticket_id;

    INSERT INTO public.support_audit_log (ticket_id, actor_id, action, field, previous, current)
    VALUES (p_ticket_id, v_uid, 'status', 'status', v_status_before, 'in_progress');

    INSERT INTO public.support_audit_log (ticket_id, actor_id, action, field, previous, current)
    VALUES (p_ticket_id, v_uid, 'sla', 'first_response_at', NULL, NOW()::TEXT);

    PERFORM public.support_notify(
      v_ticket.submitter_id, 'support_reply',
      'Your ticket ' || v_ticket.number || ' got a reply',
      left(btrim(p_body), 120),
      '/support/' || p_ticket_id
    );
  END IF;

  RETURN v_msg_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_ticket_message(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_ticket_message(UUID, TEXT, BOOLEAN) TO authenticated;

-- ── 12. STATUS TRANSITIONS ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.change_ticket_status(
  p_ticket_id UUID,
  p_new_status TEXT,
  p_resolution_summary TEXT DEFAULT NULL,
  p_pause_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ticket RECORD;
  v_old TEXT;
  v_staff BOOLEAN;
  v_sla NUMERIC(6, 2);
  v_pause RECORD;
  v_pause_secs DOUBLE PRECISION;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_new_status NOT IN ('open', 'in_progress', 'pending', 'resolved', 'closed', 'escalated') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id AND academy_id = public.current_academy_id()
  FOR UPDATE;

  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  v_staff := public.is_academy_staff();

  -- Transition matrix.
  IF v_staff THEN
    IF NOT (
      (v_ticket.status = 'open'      AND p_new_status IN ('in_progress', 'pending', 'resolved', 'closed', 'escalated'))
      OR (v_ticket.status = 'in_progress' AND p_new_status IN ('open', 'pending', 'resolved', 'closed', 'escalated'))
      OR (v_ticket.status = 'pending' AND p_new_status IN ('open', 'in_progress', 'resolved', 'closed', 'escalated'))
      OR (v_ticket.status = 'escalated' AND p_new_status IN ('open', 'in_progress', 'pending', 'resolved', 'closed'))
      OR (v_ticket.status = 'resolved' AND p_new_status IN ('open', 'closed'))
      OR (v_ticket.status = 'closed'   AND p_new_status IN ('open'))
    ) THEN
      RAISE EXCEPTION 'Invalid status transition from % to %', v_ticket.status, p_new_status;
    END IF;
  ELSIF v_ticket.submitter_id = v_uid THEN
    -- Players may only re-open their own resolved/closed tickets.
    IF NOT (v_ticket.status IN ('resolved', 'closed') AND p_new_status = 'open') THEN
      RAISE EXCEPTION 'Invalid status transition' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'No access to this ticket' USING ERRCODE = '42501';
  END IF;

  v_old := v_ticket.status;

  IF p_new_status = 'pending' THEN
    IF p_pause_reason IS NULL THEN
      RAISE EXCEPTION 'pause_reason is required when pausing a ticket';
    END IF;
    INSERT INTO public.support_ticket_pauses (ticket_id, reason, requested_by)
    VALUES (p_ticket_id, p_pause_reason, v_uid);
    PERFORM public.support_notify(
      v_ticket.submitter_id, 'support_ticket',
      'Ticket ' || v_ticket.number || ' paused',
      'Waiting on: ' || p_pause_reason,
      '/support/' || p_ticket_id
    );
  END IF;

  -- Resuming from a pause: close the open pause, shift the SLA forward by the
  -- paused duration.
  IF v_ticket.status = 'pending' AND p_new_status IN ('open', 'in_progress') THEN
    SELECT * INTO v_pause
    FROM public.support_ticket_pauses
    WHERE ticket_id = p_ticket_id AND ended_at IS NULL
    ORDER BY started_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_pause.id IS NULL THEN
      v_pause_secs := 0;
    ELSE
      UPDATE public.support_ticket_pauses
      SET ended_at = NOW()
      WHERE id = v_pause.id;
      v_pause_secs := EXTRACT(EPOCH FROM (NOW() - v_pause.started_at));
    END IF;

    UPDATE public.support_tickets
    SET sla_due_at = sla_due_at + make_interval(secs => v_pause_secs)
    WHERE id = p_ticket_id;

    PERFORM public.support_notify(
      v_ticket.submitter_id, 'support_ticket',
      'Ticket ' || v_ticket.number || ' resumed',
      'Your request is being handled again.',
      '/support/' || p_ticket_id
    );
  END IF;

  IF p_new_status = 'resolved' THEN
    IF v_staff THEN
      v_ticket.sla_due_at := v_ticket.sla_due_at; -- keep for reference
    END IF;
    UPDATE public.support_tickets
    SET status = 'resolved',
        resolved_at = NOW(),
        resolved_by = v_uid,
        resolution_summary = p_resolution_summary,
        updated_at = NOW()
    WHERE id = p_ticket_id;

    PERFORM public.support_notify(
      v_ticket.submitter_id, 'support_ticket',
      'Ticket ' || v_ticket.number || ' resolved',
      COALESCE(p_resolution_summary, 'The issue has been resolved.'),
      '/support/' || p_ticket_id
    );
  ELSIF p_new_status = 'open' AND v_old IN ('resolved', 'closed') THEN
    v_sla := public.support_sla_hours(v_ticket.priority, v_ticket.category_id);
    -- Reopening clears the previous resolution's survey so the new resolution
    -- round can be rated again (once per resolution).
    DELETE FROM public.support_surveys WHERE ticket_id = p_ticket_id;
    UPDATE public.support_tickets
    SET status = 'open',
        resolved_at = NULL,
        resolved_by = NULL,
        resolution_summary = NULL,
        satisfaction_rating = NULL,
        satisfaction_comment = NULL,
        sla_due_at = GREATEST(sla_due_at, NOW() + (v_sla || ' hours')::INTERVAL),
        updated_at = NOW()
    WHERE id = p_ticket_id;
  ELSIF p_new_status = 'escalated' THEN
    UPDATE public.support_tickets
    SET status = 'escalated',
        escalated_at = NOW(),
        escalated_from_id = assignee_id,
        assignee_id = (
          SELECT p.id FROM public.profiles p
          LEFT JOIN public.support_tickets t
            ON t.assignee_id = p.id AND t.status IN ('open', 'in_progress', 'pending', 'escalated')
          WHERE p.academy_id = public.current_academy_id() AND p.role = 'admin'
          GROUP BY p.id
          ORDER BY count(t.id) ASC, p.created_at ASC
          LIMIT 1
        ),
        updated_at = NOW()
    WHERE id = p_ticket_id;

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    SELECT p.id, 'support_ticket',
      'Ticket ' || v_ticket.number || ' escalated',
      'Overdue ticket requires attention.', '/support/' || p_ticket_id
    FROM public.profiles p
    WHERE p.academy_id = v_ticket.academy_id AND p.role = 'admin';
  ELSE
    UPDATE public.support_tickets
    SET status = p_new_status, updated_at = NOW()
    WHERE id = p_ticket_id;

    IF p_new_status = 'open' THEN
      UPDATE public.support_tickets
      SET paused_at = NULL, paused_reason = NULL
      WHERE id = p_ticket_id;
    END IF;
  END IF;

  INSERT INTO public.support_audit_log (ticket_id, actor_id, action, field, previous, current)
  VALUES (p_ticket_id, v_uid, 'status', 'status', v_old, p_new_status);
END;
$$;
REVOKE ALL ON FUNCTION public.change_ticket_status(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_ticket_status(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ── 13. ASSIGNMENT / ROUTING ───────────────────────────────

-- Assign (or re-assign) a ticket to a specific academy staff member.
CREATE OR REPLACE FUNCTION public.route_support_ticket(
  p_ticket_id UUID,
  p_assignee_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ticket RECORD;
  v_old UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_staff() THEN
    RAISE EXCEPTION 'Only academy staff can route tickets' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id AND academy_id = public.current_academy_id()
  FOR UPDATE;

  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  -- Assignee must be an active staff member of this academy.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_assignee_id
      AND p.academy_id = v_ticket.academy_id
      AND (p.role = 'admin'
           OR EXISTS (
             SELECT 1 FROM public.coaches c
             WHERE c.profile_id = p.id AND c.is_active AND c.academy_id = v_ticket.academy_id
           ))
  ) THEN
    RAISE EXCEPTION 'Assignee must be academy staff';
  END IF;

  IF v_ticket.assignee_id IS DISTINCT FROM p_assignee_id THEN
    v_old := v_ticket.assignee_id;
    UPDATE public.support_tickets
    SET assignee_id = p_assignee_id, updated_at = NOW()
    WHERE id = p_ticket_id;

    INSERT INTO public.support_audit_log (ticket_id, actor_id, action, field, previous, current)
    VALUES (p_ticket_id, v_uid, 'assign', 'assignee_id', v_old::TEXT, p_assignee_id::TEXT);

    PERFORM public.support_notify(
      p_assignee_id, 'support_ticket',
      'Ticket ' || v_ticket.number || ' assigned to you',
      left(v_ticket.subject, 120),
      '/support/' || p_ticket_id
    );
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.route_support_ticket(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.route_support_ticket(UUID, UUID) TO authenticated;

-- Auto-route: assign the least-busy academy admin to an unassigned ticket.
CREATE OR REPLACE FUNCTION public.auto_route_support_ticket(p_ticket_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ticket RECORD;
  v_admin UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_staff() THEN
    RAISE EXCEPTION 'Only academy staff can route tickets' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id AND academy_id = public.current_academy_id()
  FOR UPDATE;
  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  SELECT p.id INTO v_admin
  FROM public.profiles p
  LEFT JOIN public.support_tickets t
    ON t.assignee_id = p.id AND t.status IN ('open', 'in_progress', 'pending', 'escalated')
  WHERE p.academy_id = v_ticket.academy_id AND p.role = 'admin'
  GROUP BY p.id
  ORDER BY count(t.id) ASC, p.created_at ASC
  LIMIT 1;

  IF v_admin IS NOT NULL AND v_ticket.assignee_id IS DISTINCT FROM v_admin THEN
    UPDATE public.support_tickets
    SET assignee_id = v_admin, updated_at = NOW()
    WHERE id = p_ticket_id;

    INSERT INTO public.support_audit_log (ticket_id, actor_id, action, field, previous, current)
    VALUES (p_ticket_id, v_uid, 'assign', 'assignee_id', v_ticket.assignee_id::TEXT, v_admin::TEXT);

    PERFORM public.support_notify(v_admin, 'support_ticket',
      'Ticket ' || v_ticket.number || ' assigned to you',
      left(v_ticket.subject, 120), '/support/' || p_ticket_id);
  END IF;

  RETURN v_admin;
END;
$$;
REVOKE ALL ON FUNCTION public.auto_route_support_ticket(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_route_support_ticket(UUID) TO authenticated;

-- ── 14. CATEGORY MANAGEMENT (ADMIN ONLY) ───────────────────

CREATE OR REPLACE FUNCTION public.manage_support_category(
  p_name_en TEXT,
  p_name_ar TEXT,
  p_default_priority TEXT DEFAULT 'medium',
  p_sla_hours NUMERIC(6, 2) DEFAULT 0,
  p_description TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT TRUE,
  p_sort_order INTEGER DEFAULT 0,
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
  v_cat_id UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_admin() THEN
    RAISE EXCEPTION 'Only academy admins can manage categories' USING ERRCODE = '42501';
  END IF;

  IF btrim(COALESCE(p_name_en, '')) = '' OR btrim(COALESCE(p_name_ar, '')) = '' THEN
    RAISE EXCEPTION 'Both an English and an Arabic category name are required';
  END IF;
  IF p_default_priority NOT IN ('low', 'medium', 'high', 'urgent') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;
  IF p_sla_hours < 0 THEN
    RAISE EXCEPTION 'sla_hours cannot be negative';
  END IF;

  v_academy := public.current_academy_id();

  IF p_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.support_categories
                   WHERE id = p_id AND academy_id = v_academy) THEN
      RAISE EXCEPTION 'Category not found';
    END IF;
    UPDATE public.support_categories
    SET name_en = btrim(p_name_en),
        name_ar = btrim(p_name_ar),
        default_priority = p_default_priority,
        sla_hours = p_sla_hours,
        description = p_description,
        is_active = p_is_active,
        sort_order = p_sort_order,
        updated_at = NOW()
    WHERE id = p_id AND academy_id = v_academy;
    RETURN p_id;
  END IF;

  INSERT INTO public.support_categories (
    academy_id, name_en, name_ar, default_priority, sla_hours, description, is_active, sort_order
  )
  VALUES (
    v_academy, btrim(p_name_en), btrim(p_name_ar), p_default_priority,
    p_sla_hours, p_description, p_is_active, p_sort_order
  )
  RETURNING id INTO v_cat_id;

  RETURN v_cat_id;
END;
$$;
REVOKE ALL ON FUNCTION public.manage_support_category(TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_support_category(TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, INTEGER, UUID) TO authenticated;

-- ── 15. SATISFACTION SURVEY ────────────────────────────────

-- The submitter can rate the handling once per resolution: the rating is
-- recorded after the ticket is resolved/closed and is cleared (with the
-- survey row) if the ticket is later reopened.
CREATE OR REPLACE FUNCTION public.submit_support_survey(
  p_ticket_id UUID,
  p_rating INTEGER,
  p_nps INTEGER DEFAULT NULL,
  p_feedback TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ticket RECORD;
  v_survey_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  IF p_nps IS NOT NULL AND (p_nps < -100 OR p_nps > 100) THEN
    RAISE EXCEPTION 'NPS must be between -100 and 100';
  END IF;

  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id AND academy_id = public.current_academy_id()
  FOR UPDATE;

  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;
  IF v_ticket.submitter_id <> v_uid THEN
    RAISE EXCEPTION 'Only the submitter can rate this ticket' USING ERRCODE = '42501';
  END IF;
  IF v_ticket.status NOT IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'Ticket must be resolved before it can be rated';
  END IF;

  -- Once per resolution: reopening clears the survey, so an existing row
  -- means this resolution was already rated.
  IF EXISTS (SELECT 1 FROM public.support_surveys WHERE ticket_id = p_ticket_id) THEN
    RAISE EXCEPTION 'Survey already submitted for this resolution' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.support_surveys (ticket_id, submitted_by, rating, nps, feedback)
  VALUES (p_ticket_id, v_uid, p_rating, p_nps, p_feedback)
  RETURNING id INTO v_survey_id;

  UPDATE public.support_tickets
  SET satisfaction_rating = p_rating,
      satisfaction_comment = COALESCE(p_feedback, satisfaction_comment),
      updated_at = NOW()
  WHERE id = p_ticket_id;

  INSERT INTO public.support_audit_log (ticket_id, actor_id, action, field, previous, current)
  VALUES (p_ticket_id, v_uid, 'survey', 'satisfaction_rating', NULL, p_rating::TEXT);

  RETURN v_survey_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_support_survey(UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_support_survey(UUID, INTEGER, INTEGER, TEXT) TO authenticated;

-- ── 16. DASHBOARD STATS ────────────────────────────────────

-- Staff dashboard: counts, SLA/CSAT metrics and trends. Admins see the whole
-- academy; coaches see only the tickets in their scope.
CREATE OR REPLACE FUNCTION public.get_support_dashboard_stats(
  p_scope TEXT DEFAULT 'academy' -- 'academy' (admin) | 'mine' (coach)
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_academy UUID;
  v_is_admin BOOLEAN;
  v_filter TEXT;
  v_sql TEXT;
  v_res JSONB;
BEGIN
  IF v_uid IS NULL OR NOT public.is_academy_staff() THEN
    RAISE EXCEPTION 'Only academy staff can view support dashboards' USING ERRCODE = '42501';
  END IF;

  v_academy := public.current_academy_id();
  v_is_admin := public.is_academy_admin();

  -- Scope: admins always get the full academy; coaches default to 'mine'.
  IF NOT v_is_admin AND p_scope <> 'academy' THEN
    v_filter := format(
      't.academy_id = %L::uuid AND (t.assignee_id = %L::uuid OR t.team_id = ANY (%L::uuid[]) OR t.submitter_id = %L::uuid)',
      v_academy, v_uid, public.current_coach_team_ids(), v_uid
    );
  ELSE
    v_filter := format('t.academy_id = %L::uuid', v_academy);
  END IF;

  v_sql := format($STAT$
    SELECT jsonb_build_object(
      'open_count',
        (SELECT count(*) FROM public.support_tickets t WHERE %s AND t.status = 'open'),
      'in_progress_count',
        (SELECT count(*) FROM public.support_tickets t WHERE %s AND t.status = 'in_progress'),
      'pending_count',
        (SELECT count(*) FROM public.support_tickets t WHERE %s AND t.status = 'pending'),
      'escalated_count',
        (SELECT count(*) FROM public.support_tickets t WHERE %s AND t.status = 'escalated'),
      'overdue_count',
        (SELECT count(*) FROM public.support_tickets t WHERE %s AND t.status IN ('open', 'in_progress', 'pending') AND t.sla_due_at < NOW()),
      'unassigned_count',
        (SELECT count(*) FROM public.support_tickets t WHERE %s AND t.status IN ('open', 'in_progress') AND t.assignee_id IS NULL),
      'total_count',
        (SELECT count(*) FROM public.support_tickets t WHERE %s),
      'csat_avg',
        (SELECT round(avg(s.rating)::numeric, 2) FROM public.support_surveys s
          JOIN public.support_tickets t ON t.id = s.ticket_id WHERE %s),
      'nps_avg',
        (SELECT round(avg(s.nps)::numeric, 2) FROM public.support_surveys s
          JOIN public.support_tickets t ON t.id = s.ticket_id WHERE %s AND s.nps IS NOT NULL),
      'survey_count',
        (SELECT count(*) FROM public.support_surveys s
          JOIN public.support_tickets t ON t.id = s.ticket_id WHERE %s),
      'avg_first_response_hours',
        (SELECT round(avg(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600.0)::numeric, 2)
          FROM public.support_tickets t WHERE %s AND t.first_response_at IS NOT NULL),
      'avg_resolution_hours',
        (SELECT round(avg(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0)::numeric, 2)
          FROM public.support_tickets t WHERE %s AND t.resolved_at IS NOT NULL),
      'by_status', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', count) ORDER BY count DESC), '[]'::jsonb)
        FROM (SELECT t.status, count(*)::INT AS count FROM public.support_tickets t WHERE %s GROUP BY t.status) sub
      ),
      'by_priority', (
        SELECT coalesce(jsonb_agg(jsonb_build_object('priority', priority, 'count', count) ORDER BY count DESC), '[]'::jsonb)
        FROM (SELECT t.priority, count(*)::INT AS count FROM public.support_tickets t WHERE %s GROUP BY t.priority) sub
      ),
      'by_category', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                'category_id', c.id, 'name_en', c.name_en, 'name_ar', c.name_ar,
                'count', cnt.count, 'avg_rating', cnt.avg_rating) ORDER BY cnt.count DESC), '[]'::jsonb)
        FROM public.support_categories c
        LEFT JOIN (
          SELECT t.category_id, count(*)::INT AS count, round(avg(s.rating)::numeric, 2) AS avg_rating
          FROM public.support_tickets t
          LEFT JOIN public.support_surveys s ON s.ticket_id = t.id
          WHERE %s
          GROUP BY t.category_id
        ) cnt ON cnt.category_id = c.id
        WHERE c.academy_id = %L::uuid AND cnt.count IS NOT NULL
      ),
      'trend', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
                'date', d::date, 'created', created.cnt, 'resolved', resolved.cnt) ORDER BY d), '[]'::jsonb)
        FROM generate_series((CURRENT_DATE - 13)::date, CURRENT_DATE::date, '1 day'::interval) d
        CROSS JOIN LATERAL (
          SELECT count(*)::INT AS cnt FROM public.support_tickets t WHERE %s AND t.created_at::date = d::date
        ) created
        CROSS JOIN LATERAL (
          SELECT count(*)::INT AS cnt FROM public.support_tickets t WHERE %s AND t.resolved_at::date = d::date
        ) resolved
      )
    ) AS res
  $STAT$, v_filter, v_filter, v_filter, v_filter, v_filter, v_filter, v_filter,
        v_filter, v_filter, v_filter, v_filter, v_filter, v_filter, v_filter,
        v_filter, v_academy, v_filter, v_filter);

  EXECUTE v_sql INTO v_res;
  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.get_support_dashboard_stats(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_dashboard_stats(TEXT) TO authenticated;

-- ── 17. SLA ESCALATION RUNNER (BACKGROUND JOB) ─────────────

-- Escalates overdue tickets to the least-busy academy admin. Run on a
-- schedule (e.g. every 10 minutes); it only acts on tickets that are actually
-- past their SLA and not already escalated/resolved/closed.
CREATE OR REPLACE FUNCTION public.run_sla_escalations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_t RECORD;
  v_admin UUID;
  v_sla NUMERIC(6, 2);
BEGIN
  FOR v_t IN
    SELECT t.id, t.number, t.academy_id, t.status, t.subject, t.priority, t.assignee_id
    FROM public.support_tickets t
    WHERE t.status IN ('open', 'in_progress')
      AND t.sla_due_at < NOW()
      AND t.academy_id IS NOT NULL
    ORDER BY t.sla_due_at ASC
  LOOP
    SELECT p.id INTO v_admin
    FROM public.profiles p
    LEFT JOIN public.support_tickets t
      ON t.assignee_id = p.id AND t.status IN ('open', 'in_progress', 'pending', 'escalated')
    WHERE p.academy_id = v_t.academy_id AND p.role = 'admin'
    GROUP BY p.id
    ORDER BY count(t.id) ASC, p.created_at ASC
    LIMIT 1;

    UPDATE public.support_tickets
    SET status = 'escalated',
        escalated_at = NOW(),
        escalated_from_id = assignee_id,
        assignee_id = v_admin,
        updated_at = NOW()
    WHERE id = v_t.id;

    INSERT INTO public.support_audit_log (ticket_id, actor_id, action, field, previous, current)
    VALUES (v_t.id, NULL, 'sla_escalate', 'status', v_t.status, 'escalated');

    INSERT INTO public.support_audit_log (ticket_id, actor_id, action, field, previous, current)
    VALUES (v_t.id, NULL, 'sla_escalate', 'assignee_id', v_t.assignee_id::TEXT, v_admin::TEXT);

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    SELECT p.id, 'support_ticket',
      'Ticket ' || v_t.number || ' escalated (overdue)',
      left(v_t.subject, 120), '/support/' || v_t.id
    FROM public.profiles p
    WHERE p.academy_id = v_t.academy_id AND p.role = 'admin';

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.run_sla_escalations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_sla_escalations() TO service_role;

-- ── 18. DETAIL FETCH ───────────────────────────────────────

-- Single ticket with human-readable names for the detail page. Returns NULL
-- when the caller has no access. SECURITY DEFINER so joins across profiles
-- (which expose few rows via RLS) still work.
CREATE OR REPLACE FUNCTION public.get_support_ticket_detail(p_ticket_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row RECORD;
  v_can_staff BOOLEAN;
  v_access BOOLEAN;
  v_messages JSONB;
  v_pauses JSONB;
  v_audit JSONB;
  v_survey JSONB;
  v_names JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT t.* INTO v_row
  FROM public.support_tickets t
  WHERE t.id = p_ticket_id AND t.academy_id = public.current_academy_id();

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  v_can_staff := public.is_academy_staff();

  v_access := v_can_staff
    OR v_row.submitter_id = v_uid
    OR (public.is_academy_coach()
        AND (v_row.team_id = ANY (public.current_coach_team_ids())
             OR v_row.assignee_id = v_uid));

  IF NOT v_access THEN
    RAISE EXCEPTION 'No access to this ticket' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'submitter', (SELECT pr.name FROM public.profiles pr WHERE pr.id = v_row.submitter_id),
    'assignee', (SELECT pr.name FROM public.profiles pr WHERE pr.id = v_row.assignee_id),
    'category_en', (SELECT c.name_en FROM public.support_categories c WHERE c.id = v_row.category_id),
    'category_ar', (SELECT c.name_ar FROM public.support_categories c WHERE c.id = v_row.category_id),
    'branch', (SELECT b.name FROM public.academy_branches b WHERE b.id = v_row.branch_id),
    'team', (SELECT tm.name FROM public.teams tm WHERE tm.id = v_row.team_id)
  ) INTO v_names;

  -- Public messages only for non-staff; everything for staff.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'author_id', m.author_id,
    'author', (SELECT pr.name FROM public.profiles pr WHERE pr.id = m.author_id),
    'author_role', (SELECT pr.role FROM public.profiles pr WHERE pr.id = m.author_id),
    'is_internal', m.is_internal,
    'is_system', m.is_system,
    'body', m.body,
    'created_at', m.created_at
  ) ORDER BY m.created_at ASC), '[]'::jsonb)
  INTO v_messages
  FROM public.support_ticket_messages m
  WHERE m.ticket_id = p_ticket_id
    AND (v_can_staff OR m.is_internal = FALSE);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'reason', p.reason, 'started_at', p.started_at, 'ended_at', p.ended_at
  ) ORDER BY p.started_at ASC), '[]'::jsonb)
  INTO v_pauses
  FROM public.support_ticket_pauses p
  WHERE p.ticket_id = p_ticket_id;

  IF v_can_staff THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'actor', (SELECT pr.name FROM public.profiles pr WHERE pr.id = a.actor_id),
      'action', a.action, 'field', a.field,
      'previous', a.previous, 'current', a.current, 'created_at', a.created_at
    ) ORDER BY a.created_at ASC), '[]'::jsonb)
    INTO v_audit
    FROM public.support_audit_log a
    WHERE a.ticket_id = p_ticket_id;
  ELSE
    v_audit := '[]'::jsonb;
  END IF;

  SELECT CASE WHEN v_can_staff OR v_row.submitter_id = v_uid THEN
    coalesce(jsonb_agg(jsonb_build_object(
      'rating', s.rating, 'nps', s.nps, 'feedback', s.feedback, 'created_at', s.created_at
    )), '[]'::jsonb)
  ELSE '[]'::jsonb END
  INTO v_survey
  FROM public.support_surveys s
  WHERE s.ticket_id = p_ticket_id;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'number', v_row.number,
    'academy_id', v_row.academy_id,
    'category_id', v_row.category_id,
    'branch_id', v_row.branch_id,
    'team_id', v_row.team_id,
    'subject', v_row.subject,
    'description', v_row.description,
    'priority', v_row.priority,
    'status', v_row.status,
    'source', v_row.source,
    'submitter_id', v_row.submitter_id,
    'assignee_id', v_row.assignee_id,
    'sla_due_at', v_row.sla_due_at,
    'first_response_at', v_row.first_response_at,
    'paused_at', v_row.paused_at,
    'paused_reason', v_row.paused_reason,
    'escalated_at', v_row.escalated_at,
    'escalated_from_id', v_row.escalated_from_id,
    'resolved_at', v_row.resolved_at,
    'resolved_by', v_row.resolved_by,
    'resolution_summary', v_row.resolution_summary,
    'satisfaction_rating', v_row.satisfaction_rating,
    'satisfaction_comment', v_row.satisfaction_comment,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at,
    'names', v_names,
    'messages', v_messages,
    'pauses', v_pauses,
    'audit_log', v_audit,
    'surveys', v_survey,
    'is_staff', v_can_staff,
    'is_owner', v_row.submitter_id = v_uid
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_support_ticket_detail(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_support_ticket_detail(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
