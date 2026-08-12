-- ============================================================
-- Volley Academy — Supabase Database Schema
-- Run this entire file in the Supabase SQL Editor.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLES
-- ────────────────────────────────────────────────────────────

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  name TEXT NOT NULL,
  phone TEXT,
  join_date DATE,
  subscription_sessions INTEGER NOT NULL DEFAULT 8,
  sessions_attended INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  payment_date DATE NOT NULL,
  subscription_sessions INTEGER NOT NULL DEFAULT 8,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_member ON public.payments(member_id, payment_date DESC);

-- Training sessions table
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time TIME NOT NULL,
  location TEXT,
  notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_training_date ON public.training_sessions(date);

-- Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_present BOOLEAN NOT NULL,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, member_id)
);

-- Costs table
CREATE TABLE IF NOT EXISTS public.monthly_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  coach_salary DECIMAL(10, 2) NOT NULL DEFAULT 0,
  court_rental DECIMAL(10, 2) NOT NULL DEFAULT 0,
  sessions_per_month INTEGER NOT NULL DEFAULT 0,
  cost_per_session DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month, year)
);

-- Session calculations table (automatic profit/loss per session)
CREATE TABLE IF NOT EXISTS public.session_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  total_revenue DECIMAL(10, 2) NOT NULL DEFAULT 0,
  cost_per_session DECIMAL(10, 2) NOT NULL DEFAULT 0,
  profit_loss DECIMAL(10, 2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- 2. TRIGGERS — profile creation & role claim sync
-- ────────────────────────────────────────────────────────────

-- Auto-create a profile when a user signs up (default role: member)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, name, join_date)
  VALUES (
    NEW.id,
    NEW.email,
    'member',
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    CURRENT_DATE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep the JWT `app_metadata.role` claim in sync with profiles.role
-- so middleware can read the role without a database round-trip.
CREATE OR REPLACE FUNCTION public.sync_role_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_role_changed ON public.profiles;
CREATE TRIGGER on_profile_role_changed
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_claim();

-- ────────────────────────────────────────────────────────────
-- 3. AUTOMATIC FINANCIAL CALCULATIONS
-- ────────────────────────────────────────────────────────────

-- Revenue contribution of an attending member =
--   most recent payment amount ÷ that payment's subscription sessions (default 8)
-- Cost for a session = monthly cost_per_session for the session's month.
CREATE OR REPLACE FUNCTION public.recompute_session_calculation(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revenue NUMERIC := 0;
  v_cost NUMERIC := 0;
  v_month INTEGER;
  v_year INTEGER;
BEGIN
  -- Bail out when the session no longer exists (e.g. session cascade-deleted,
  -- which fires the attendance AFTER DELETE trigger). Otherwise the FK on
  -- session_calculations would abort the DELETE of the session itself.
  IF NOT EXISTS (SELECT 1 FROM public.training_sessions WHERE id = p_session_id) THEN
    RETURN;
  END IF;

  -- Canceled sessions are excluded from financial calculations.
  IF EXISTS (SELECT 1 FROM public.training_sessions WHERE id = p_session_id AND status = 'canceled') THEN
    DELETE FROM public.session_calculations WHERE session_id = p_session_id;
    RETURN;
  END IF;

  -- Revenue: sum of (latest payment / subscription_sessions) for attending members
  SELECT COALESCE(SUM(p.amount / NULLIF(p.subscription_sessions, 0)), 0)
  INTO v_revenue
  FROM public.attendance a
  JOIN public.payments p ON p.id = (
    SELECT pp.id
    FROM public.payments pp
    WHERE pp.member_id = a.member_id
    ORDER BY pp.payment_date DESC, pp.created_at DESC
    LIMIT 1
  )
  WHERE a.session_id = p_session_id AND a.is_present;

  -- Cost for the session's month
  SELECT EXTRACT(MONTH FROM s.date)::INT, EXTRACT(YEAR FROM s.date)::INT
  INTO v_month, v_year
  FROM public.training_sessions s
  WHERE s.id = p_session_id;

  SELECT mc.cost_per_session INTO v_cost
  FROM public.monthly_costs mc
  WHERE mc.month = v_month AND mc.year = v_year;

  v_cost := COALESCE(v_cost, 0);

  INSERT INTO public.session_calculations (session_id, total_revenue, cost_per_session, profit_loss)
  VALUES (p_session_id, v_revenue, v_cost, v_revenue - v_cost)
  ON CONFLICT (session_id) DO UPDATE SET
    total_revenue = EXCLUDED.total_revenue,
    cost_per_session = EXCLUDED.cost_per_session,
    profit_loss = EXCLUDED.profit_loss,
    calculated_at = NOW();
END;
$$;

-- Recompute when attendance changes
CREATE OR REPLACE FUNCTION public.trigger_recompute_on_attendance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_session_calculation(COALESCE(NEW.session_id, OLD.session_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS attendance_recompute ON public.attendance;
CREATE TRIGGER attendance_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_on_attendance();

-- Recompute affected sessions when a payment changes
CREATE OR REPLACE FUNCTION public.trigger_recompute_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_session_calculation(a.session_id)
  FROM public.attendance a
  WHERE a.member_id = COALESCE(NEW.member_id, OLD.member_id) AND a.is_present;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS payment_recompute ON public.payments;
CREATE TRIGGER payment_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_on_payment();

-- Recompute all sessions in a month when monthly costs change
CREATE OR REPLACE FUNCTION public.trigger_recompute_on_costs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recompute_session_calculation(s.id)
  FROM public.training_sessions s
  WHERE EXTRACT(MONTH FROM s.date)::INT = COALESCE(NEW.month, OLD.month)
    AND EXTRACT(YEAR FROM s.date)::INT = COALESCE(NEW.year, OLD.year);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS costs_recompute ON public.monthly_costs;
CREATE TRIGGER costs_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.monthly_costs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_on_costs();

-- Recompute/clear calculations when a session is created or its status changes
-- (canceled sessions are removed from the financials).
CREATE OR REPLACE FUNCTION public.trigger_recompute_on_session_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'canceled' THEN
    DELETE FROM public.session_calculations WHERE session_id = NEW.id;
  ELSE
    PERFORM public.recompute_session_calculation(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS session_status_recompute ON public.training_sessions;
CREATE TRIGGER session_status_recompute
  AFTER UPDATE OF status ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_on_session_status();

-- Keep profiles.sessions_attended in sync
CREATE OR REPLACE FUNCTION public.sync_sessions_attended()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles p
  SET sessions_attended = (
    SELECT COUNT(*) FROM public.attendance a
    WHERE a.member_id = p.id AND a.is_present
  )
  WHERE p.id = COALESCE(NEW.member_id, OLD.member_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS attendance_sync_count ON public.attendance;
CREATE TRIGGER attendance_sync_count
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.sync_sessions_attended();

-- ────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_calculations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access" ON public.profiles;
CREATE POLICY "Admins have full access" ON public.profiles
  FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Members view own profile" ON public.profiles;
CREATE POLICY "Members view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Members update own profile" ON public.profiles;
CREATE POLICY "Members update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = 'member');

-- Members may only update their own name/phone — never subscription counters,
-- role, email or join date. RLS cannot restrict columns, so a trigger enforces it.
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.uid() IS NULL OR auth.uid() = NEW.id) AND NOT (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') THEN
    IF NEW.subscription_sessions IS DISTINCT FROM OLD.subscription_sessions
       OR NEW.sessions_attended IS DISTINCT FROM OLD.sessions_attended
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.join_date IS DISTINCT FROM OLD.join_date THEN
      RAISE EXCEPTION 'Not allowed to change subscription fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_update ON public.profiles;
CREATE TRIGGER guard_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- payments: admins manage all, members see their own
DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments" ON public.payments
  FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Members view own payments" ON public.payments;
CREATE POLICY "Members view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = member_id);

-- training_sessions: admins manage, members can view
DROP POLICY IF EXISTS "Admins manage sessions" ON public.training_sessions;
CREATE POLICY "Admins manage sessions" ON public.training_sessions
  FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Members view sessions" ON public.training_sessions;
CREATE POLICY "Members view sessions" ON public.training_sessions
  FOR SELECT USING (true);

-- attendance: admins manage, members see their own
DROP POLICY IF EXISTS "Admins manage attendance" ON public.attendance;
CREATE POLICY "Admins manage attendance" ON public.attendance
  FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Members view own attendance" ON public.attendance;
CREATE POLICY "Members view own attendance" ON public.attendance
  FOR SELECT USING (auth.uid() = member_id);

-- monthly_costs: admins manage, members can view
DROP POLICY IF EXISTS "Admins manage costs" ON public.monthly_costs;
CREATE POLICY "Admins manage costs" ON public.monthly_costs
  FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Members view costs" ON public.monthly_costs;
CREATE POLICY "Members view costs" ON public.monthly_costs
  FOR SELECT USING (true);

-- session_calculations: admins manage, members can view
DROP POLICY IF EXISTS "Admins manage calculations" ON public.session_calculations;
CREATE POLICY "Admins manage calculations" ON public.session_calculations
  FOR ALL USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Members view calculations" ON public.session_calculations;
CREATE POLICY "Members view calculations" ON public.session_calculations
  FOR SELECT USING (true);

-- ────────────────────────────────────────────────────────────
-- 5. REALTIME (idempotent)
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.session_calculations;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.training_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END
$$;

-- ────────────────────────────────────────────────────────────
-- 6. FIRST ADMIN (run once)
-- ────────────────────────────────────────────────────────────
-- 1. Create a user in Supabase Dashboard → Authentication → Users (or via signup).
-- 2. Grab their UUID and run:
--
--    UPDATE public.profiles SET role = 'admin' WHERE id = '<user-uuid>';
--
-- The sync_role_claim trigger will set app_metadata.role = 'admin',
-- so the middleware grants admin access on their next sign-in.
