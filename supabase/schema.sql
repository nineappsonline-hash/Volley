-- ============================================================
-- Volley Academy — Supabase Database Schema
-- Multi-tenant edition: every academy owns its own data.
-- Run this entire file in the Supabase SQL Editor.
-- Safe to re-run (idempotent) — includes migration backfills.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. HELPERS
-- ────────────────────────────────────────────────────────────

-- The academy of the current user. Used by table defaults (so clients never
-- send academy_id) and by every RLS policy. SECURITY DEFINER so it can read
-- profiles without recursive RLS.
-- NOTE: plpgsql (not sql) on purpose — sql-language bodies are validated
-- against existing relations at creation time, which would fail on a fresh
-- database where public.profiles doesn't exist yet (circular dependency:
-- profiles.academy_id defaults to this function).
CREATE OR REPLACE FUNCTION public.current_academy_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_academy UUID;
BEGIN
  SELECT academy_id INTO v_academy FROM public.profiles WHERE id = auth.uid();
  RETURN v_academy;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 1. TABLES
-- ────────────────────────────────────────────────────────────

-- Academies (tenants). Each user belongs to exactly one academy.
CREATE TABLE IF NOT EXISTS public.academies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  -- Short code new members enter on signup to join this academy.
  invite_code TEXT UNIQUE NOT NULL DEFAULT UPPER(left(replace(gen_random_uuid()::text, '-', ''), 6)),
  -- Public page slug: /a/<slug>
  slug TEXT UNIQUE,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  -- Token for the read-only .ics calendar feed: /api/calendar/<token>
  calendar_token TEXT UNIQUE DEFAULT md5(random()::text || clock_timestamp()::text),
  -- Trial period: new academies get a 14-day free trial.
  is_trial BOOLEAN NOT NULL DEFAULT TRUE,
  trial_ends_at TIMESTAMPTZ,
  trial_extended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  name TEXT NOT NULL,
  phone TEXT,
  join_date DATE,
  membership_type TEXT NOT NULL DEFAULT 'full' CHECK (membership_type IN ('full', 'half')),
  -- 0 until the admin records a payment; the sync trigger then sets the real plan.
  subscription_sessions INTEGER NOT NULL DEFAULT 0,
  sessions_attended INTEGER NOT NULL DEFAULT 0,
  -- Whether the member has been added to the roster by an admin.
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  -- Short code used for QR / quick check-in at the door.
  checkin_code TEXT UNIQUE DEFAULT UPPER(left(replace(gen_random_uuid()::text, '-', ''), 8)),
  -- Last time an admin sent this member a renewal reminder.
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_academy ON public.profiles(academy_id);

-- Flexible membership plans defined per academy (Full/Half are just seeds).
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  sessions_count INTEGER NOT NULL CHECK (sessions_count > 0),
  price DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  payment_date DATE NOT NULL,
  membership_type TEXT NOT NULL DEFAULT 'full' CHECK (membership_type IN ('full', 'half')),
  subscription_sessions INTEGER NOT NULL DEFAULT 8,
  -- Optional link to the plan purchased (flexible plans).
  plan_id UUID REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  -- How the money was collected.
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash', 'card', 'wallet', 'bank_transfer', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_member ON public.payments(member_id, payment_date DESC);

-- Coaches (staff records — not login accounts).
CREATE TABLE IF NOT EXISTS public.coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  phone TEXT,
  specialty TEXT,
  monthly_salary DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Venues (courts/halls) the academy trains at.
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  address TEXT,
  capacity INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Training sessions table
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
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

-- Guests table: walk-in players who pay per single session.
CREATE TABLE IF NOT EXISTS public.session_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_guests_session ON public.session_guests(session_id);

-- Costs table
CREATE TABLE IF NOT EXISTS public.monthly_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  -- Coach fee is a monthly amount prorated over the Full (8) or Half (4)
  -- session basis; court rental is monthly.
  -- cost_per_session = (coach_fee / 8 or 4) + (court_rental / sessions_per_month)
  coach_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  coach_fee_basis TEXT NOT NULL DEFAULT 'full' CHECK (coach_fee_basis IN ('full', 'half')),
  court_rental DECIMAL(10, 2) NOT NULL DEFAULT 0,
  sessions_per_month INTEGER NOT NULL DEFAULT 0,
  cost_per_session DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

-- Sports: each academy keeps its own catalog (Volleyball, Basketball, …).
CREATE TABLE IF NOT EXISTS public.sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams table (a team groups members and belongs to one sport)
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
  age_group TEXT,
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teams_sport ON public.teams(sport_id);

-- Team roster: which members belong to which team
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);

-- Announcements board: short posts from the academy to its members.
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- General expenses beyond coach fee + court rental (equipment, uniforms…).
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('equipment', 'uniforms', 'tournament', 'travel', 'other')),
  expense_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player development: periodic coach evaluations per member.
CREATE TABLE IF NOT EXISTS public.player_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evaluated_by TEXT,
  evaluation_date DATE NOT NULL,
  technique SMALLINT NOT NULL CHECK (technique BETWEEN 1 AND 5),
  tactics SMALLINT NOT NULL CHECK (tactics BETWEEN 1 AND 5),
  fitness SMALLINT NOT NULL CHECK (fitness BETWEEN 1 AND 5),
  attitude SMALLINT NOT NULL CHECK (attitude BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_evaluations_member ON public.player_evaluations(member_id, evaluation_date DESC);

-- Recurring schedule templates ("Mon/Wed 18:00 volleyball at Hall A").
CREATE TABLE IF NOT EXISTS public.schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday … 6 = Saturday
  time TIME NOT NULL,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
  age_group TEXT,
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coach availability: which days/times each coach is available.
CREATE TABLE IF NOT EXISTS public.coach_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time)
);
CREATE INDEX IF NOT EXISTS idx_coach_avail_coach ON public.coach_availability(coach_id);

-- Tournaments
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  description TEXT,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tournament matches
CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_name TEXT NOT NULL,
  team_a_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  team_b_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  score_a INTEGER,
  score_b INTEGER,
  match_date DATE,
  match_time TIME,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'canceled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tournament_matches ON public.tournament_matches(tournament_id);

-- Trial session requests submitted from the public academy page.
CREATE TABLE IF NOT EXISTS public.trial_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  preferred_date DATE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Column migrations for already-deployed databases ──────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE;
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'cash';
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS age_group TEXT,
  ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE public.monthly_costs
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE;
ALTER TABLE public.sports
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE;
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS age_group TEXT,
  ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS checkin_code TEXT;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS trial_extended_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_training_sport ON public.training_sessions(sport_id);
CREATE INDEX IF NOT EXISTS idx_training_venue ON public.training_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_payments_academy ON public.payments(academy_id, payment_date DESC);

-- Scope the old single-tenant unique constraints per academy.
ALTER TABLE public.monthly_costs DROP CONSTRAINT IF EXISTS monthly_costs_month_year_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_costs_academy_month
  ON public.monthly_costs(academy_id, month, year);
ALTER TABLE public.sports DROP CONSTRAINT IF EXISTS sports_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sports_academy_name
  ON public.sports(academy_id, name);

-- ────────────────────────────────────────────────────────────
-- 1.5 MIGRATION BACKFILL (idempotent)
-- Assigns every existing row to the (single) default academy and
-- seeds starter data, so upgrading deployments keeps working.
-- ────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_academy UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.academies) THEN
    INSERT INTO public.academies (name, slug)
    VALUES (
      COALESCE(
        (SELECT p.name FROM public.profiles p WHERE p.role = 'admin' ORDER BY p.created_at LIMIT 1),
        'My Academy'
      ),
      'academy-' || left(md5(random()::text), 6)
    )
    RETURNING id INTO v_academy;
  ELSE
    SELECT id INTO v_academy FROM public.academies ORDER BY created_at LIMIT 1;
  END IF;

  UPDATE public.profiles          SET academy_id = v_academy WHERE academy_id IS NULL;
  UPDATE public.sports            SET academy_id = v_academy WHERE academy_id IS NULL;
  UPDATE public.teams             SET academy_id = v_academy WHERE academy_id IS NULL;
  UPDATE public.training_sessions SET academy_id = v_academy WHERE academy_id IS NULL;
  UPDATE public.payments          SET academy_id = v_academy WHERE academy_id IS NULL;
  UPDATE public.monthly_costs     SET academy_id = v_academy WHERE academy_id IS NULL;

  -- Seed the default sport for every academy that has none.
  INSERT INTO public.sports (academy_id, name)
  SELECT a.id, 'Volleyball' FROM public.academies a
  WHERE NOT EXISTS (SELECT 1 FROM public.sports s WHERE s.academy_id = a.id);

  -- Seed Full/Half plans for every academy that has no plans yet.
  INSERT INTO public.membership_plans (academy_id, name, sessions_count)
  SELECT a.id, 'Full', 8 FROM public.academies a
  WHERE NOT EXISTS (SELECT 1 FROM public.membership_plans p WHERE p.academy_id = a.id);
  INSERT INTO public.membership_plans (academy_id, name, sessions_count)
  SELECT a.id, 'Half', 4 FROM public.academies a
  WHERE NOT EXISTS (
    SELECT 1 FROM public.membership_plans p
    WHERE p.academy_id = a.id AND p.sessions_count <= 4
  );

  -- Make sure every profile has a check-in code.
  UPDATE public.profiles
  SET checkin_code = UPPER(left(replace(gen_random_uuid()::text, '-', ''), 8))
  WHERE checkin_code IS NULL;

  -- Make sure every academy has a calendar token and slug.
  UPDATE public.academies
  SET calendar_token = md5(random()::text || clock_timestamp()::text)
  WHERE calendar_token IS NULL;
  UPDATE public.academies
  SET slug = 'academy-' || left(md5(random()::text), 6)
  WHERE slug IS NULL;
END
$$;

-- ────────────────────────────────────────────────────────────
-- 2. TRIGGERS — profile creation & role claim sync
-- ────────────────────────────────────────────────────────────

-- Auto-create a profile when a user signs up.
-- Signup metadata decides how the account joins an academy:
--   { new_academy_name } → creates a NEW academy; signer becomes its admin.
--   { academy_code }     → joins that academy as a pending member.
--   neither              → legacy signup (no academy; admin adds them later).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_name TEXT := trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_name', ''));
  v_code TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'academy_code', '')), '');
  v_academy UUID;
BEGIN
  IF v_new_name <> '' THEN
    INSERT INTO public.academies (name, slug, is_trial, trial_ends_at)
    VALUES (
      left(v_new_name, 60),
      lower(regexp_replace(left(v_new_name, 40), '[^a-zA-Z0-9]+', '-', 'g'))
        || '-' || left(md5(random()::text), 4),
      TRUE,
      NOW() + INTERVAL '14 days'
    )
    RETURNING id INTO v_academy;

    INSERT INTO public.membership_plans (academy_id, name, sessions_count)
    VALUES (v_academy, 'Full', 8), (v_academy, 'Half', 4);

    -- Seed sports from signup metadata (comma-separated) or default to Volleyball
    IF NEW.raw_user_meta_data ->> 'sports' IS NOT NULL AND NEW.raw_user_meta_data ->> 'sports' != '' THEN
      INSERT INTO public.sports (academy_id, name)
      SELECT v_academy, trim(unnest(string_to_array(NEW.raw_user_meta_data ->> 'sports', ',')));
    ELSE
      INSERT INTO public.sports (academy_id, name) VALUES (v_academy, 'Volleyball');
    END IF;

    INSERT INTO public.profiles (id, email, role, name, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'admin',
      COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      CURRENT_DATE, v_academy, TRUE
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    IF v_code IS NOT NULL THEN
      SELECT id INTO v_academy FROM public.academies WHERE UPPER(invite_code) = UPPER(v_code);
    END IF;

    INSERT INTO public.profiles (id, email, role, name, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'member',
      COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      CURRENT_DATE, v_academy, FALSE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
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
  v_guest_revenue NUMERIC := 0;
  v_cost NUMERIC := 0;
  v_month INTEGER;
  v_year INTEGER;
  v_academy UUID;
BEGIN
  -- Bail out when the session no longer exists (e.g. session cascade-deleted,
  -- which fires the attendance AFTER DELETE trigger). Otherwise the FK on
  -- session_calculations would abort the DELETE of the session itself.
  IF NOT EXISTS (SELECT 1 FROM public.training_sessions WHERE id = p_session_id) THEN
    RETURN;
  END IF;

  SELECT academy_id INTO v_academy FROM public.training_sessions WHERE id = p_session_id;

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

  -- Revenue: guest walk-in payments
  SELECT COALESCE(SUM(g.amount_paid), 0)
  INTO v_guest_revenue
  FROM public.session_guests g
  WHERE g.session_id = p_session_id;
  v_revenue := v_revenue + v_guest_revenue;

  -- Cost for the session's month
  SELECT EXTRACT(MONTH FROM s.date)::INT, EXTRACT(YEAR FROM s.date)::INT
  INTO v_month, v_year
  FROM public.training_sessions s
  WHERE s.id = p_session_id;

  SELECT mc.cost_per_session INTO v_cost
  FROM public.monthly_costs mc
  WHERE mc.month = v_month AND mc.year = v_year
    AND (v_academy IS NULL OR mc.academy_id = v_academy);

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

-- Recompute when guests change (guest payments add to session revenue)
CREATE OR REPLACE FUNCTION public.trigger_recompute_on_guest()
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

DROP TRIGGER IF EXISTS guest_recompute ON public.session_guests;
CREATE TRIGGER guest_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.session_guests
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recompute_on_guest();

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
    AND EXTRACT(YEAR FROM s.date)::INT = COALESCE(NEW.year, OLD.year)
    AND s.academy_id = COALESCE(NEW.academy_id, OLD.academy_id);
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

-- Keep the member's plan in sync with their latest payment.
-- No payments = no plan yet (0 sessions).
CREATE OR REPLACE FUNCTION public.sync_membership_from_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  v_member_id := COALESCE(NEW.member_id, OLD.member_id);

  IF EXISTS (SELECT 1 FROM public.payments WHERE member_id = v_member_id) THEN
    UPDATE public.profiles p
    SET membership_type = x.membership_type,
        subscription_sessions = x.subscription_sessions
    FROM (
      SELECT pp.member_id, pp.membership_type, pp.subscription_sessions
      FROM public.payments pp
      WHERE pp.member_id = v_member_id
      ORDER BY pp.payment_date DESC, pp.created_at DESC
      LIMIT 1
    ) x
    WHERE p.id = v_member_id;
  ELSE
    UPDATE public.profiles p
    SET membership_type = 'full', subscription_sessions = 0
    WHERE p.id = v_member_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS payment_sync_membership ON public.payments;
CREATE TRIGGER payment_sync_membership
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_membership_from_payment();

-- ────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- Every policy scopes by academy via current_academy_id(); admins
-- additionally need the admin role claim.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_requests ENABLE ROW LEVEL SECURITY;

-- Helper predicates (kept inline in policies for clarity).
-- is_admin   : auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
-- in_academy : academy_id = public.current_academy_id()

-- academies: users see their own; the public sees pages marked is_public;
-- admins may edit their own academy's public settings.
DROP POLICY IF EXISTS "View own academy" ON public.academies;
CREATE POLICY "View own academy" ON public.academies
  FOR SELECT USING (id = public.current_academy_id());

DROP POLICY IF EXISTS "Public view public academies" ON public.academies;
CREATE POLICY "Public view public academies" ON public.academies
  FOR SELECT USING (is_public = TRUE);

DROP POLICY IF EXISTS "Admin edits own academy" ON public.academies;
CREATE POLICY "Admin edits own academy" ON public.academies
  FOR UPDATE USING (id = public.current_academy_id() AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- profiles
DROP POLICY IF EXISTS "Admins have full access" ON public.profiles;
CREATE POLICY "Admins have full access" ON public.profiles
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Members view own profile" ON public.profiles;
CREATE POLICY "Members view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Members update own profile" ON public.profiles;
CREATE POLICY "Members update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = 'member');

-- Members may only update their own name/phone — never subscription counters,
-- role, email, join date, academy or check-in code. A trigger enforces it.
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
       OR NEW.join_date IS DISTINCT FROM OLD.join_date
       OR NEW.academy_id IS DISTINCT FROM OLD.academy_id
       OR NEW.checkin_code IS DISTINCT FROM OLD.checkin_code THEN
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

-- payments: admins manage within their academy; members see their own.
DROP POLICY IF EXISTS "Admins manage payments" ON public.payments;
CREATE POLICY "Admins manage payments" ON public.payments
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Members view own payments" ON public.payments;
CREATE POLICY "Members view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = member_id);

-- training_sessions: admins manage, members view (same academy).
DROP POLICY IF EXISTS "Admins manage sessions" ON public.training_sessions;
CREATE POLICY "Admins manage sessions" ON public.training_sessions
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Members view sessions" ON public.training_sessions;
CREATE POLICY "Members view sessions" ON public.training_sessions
  FOR SELECT USING (academy_id = public.current_academy_id());

-- attendance: scoped through the parent session's academy.
DROP POLICY IF EXISTS "Admins manage attendance" ON public.attendance;
CREATE POLICY "Admins manage attendance" ON public.attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Members view attendance" ON public.attendance;
CREATE POLICY "Members view attendance" ON public.attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
  );

-- session_guests: scoped through the parent session's academy.
DROP POLICY IF EXISTS "Admins manage guests" ON public.session_guests;
CREATE POLICY "Admins manage guests" ON public.session_guests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Members view guests" ON public.session_guests;
CREATE POLICY "Members view guests" ON public.session_guests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
  );

-- monthly_costs: admins manage; members never read the raw table (it holds
-- coach salary / court rental). They only see cost_per_session via the view below.
DROP POLICY IF EXISTS "Admins manage costs" ON public.monthly_costs;
CREATE POLICY "Admins manage costs" ON public.monthly_costs
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

-- Safe, column-limited view for members: per-session cost only.
-- Definer-rights view (default) filtered to the caller's academy.
DROP VIEW IF EXISTS public.member_session_costs;
CREATE VIEW public.member_session_costs AS
SELECT month, year, cost_per_session
FROM public.monthly_costs
WHERE academy_id = public.current_academy_id();
GRANT SELECT ON public.member_session_costs TO authenticated;

-- session_calculations: scoped through the parent session's academy.
DROP POLICY IF EXISTS "Admins manage calculations" ON public.session_calculations;
CREATE POLICY "Admins manage calculations" ON public.session_calculations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Members view calculations" ON public.session_calculations;
CREATE POLICY "Members view calculations" ON public.session_calculations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
  );

-- Safe, column-limited view for members: member names only (no phone/email),
-- so the attendance roster can be rendered for every session.
DROP VIEW IF EXISTS public.member_roster;
CREATE VIEW public.member_roster AS
SELECT id, name
FROM public.profiles
WHERE role = 'member' AND is_active = true
  AND academy_id = public.current_academy_id();
GRANT SELECT ON public.member_roster TO authenticated;

-- sports: admins manage; everyone in the academy can read the list.
DROP POLICY IF EXISTS "Admins manage sports" ON public.sports;
CREATE POLICY "Admins manage sports" ON public.sports
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view sports" ON public.sports;
CREATE POLICY "Authenticated view sports" ON public.sports
  FOR SELECT USING (academy_id = public.current_academy_id());

-- teams + team_members: admins manage; members can view teams and rosters.
DROP POLICY IF EXISTS "Admins manage teams" ON public.teams;
CREATE POLICY "Admins manage teams" ON public.teams
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view teams" ON public.teams;
CREATE POLICY "Authenticated view teams" ON public.teams
  FOR SELECT USING (academy_id = public.current_academy_id());

DROP POLICY IF EXISTS "Admins manage team members" ON public.team_members;
CREATE POLICY "Admins manage team members" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.academy_id = public.current_academy_id()
    )
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view team members" ON public.team_members;
CREATE POLICY "Authenticated view team members" ON public.team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.academy_id = public.current_academy_id()
    )
  );

-- membership_plans: admins manage; members read (to see what they can buy).
DROP POLICY IF EXISTS "Admins manage plans" ON public.membership_plans;
CREATE POLICY "Admins manage plans" ON public.membership_plans
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view plans" ON public.membership_plans;
CREATE POLICY "Authenticated view plans" ON public.membership_plans
  FOR SELECT USING (academy_id = public.current_academy_id() AND is_active = TRUE);

-- coaches: admins manage; members read names/specialties for display.
DROP POLICY IF EXISTS "Admins manage coaches" ON public.coaches;
CREATE POLICY "Admins manage coaches" ON public.coaches
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view coaches" ON public.coaches;
CREATE POLICY "Authenticated view coaches" ON public.coaches
  FOR SELECT USING (academy_id = public.current_academy_id());

-- venues: admins manage; members read for display.
DROP POLICY IF EXISTS "Admins manage venues" ON public.venues;
CREATE POLICY "Admins manage venues" ON public.venues
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view venues" ON public.venues;
CREATE POLICY "Authenticated view venues" ON public.venues
  FOR SELECT USING (academy_id = public.current_academy_id());

-- announcements: admins manage; members read.
DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
CREATE POLICY "Admins manage announcements" ON public.announcements
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view announcements" ON public.announcements;
CREATE POLICY "Authenticated view announcements" ON public.announcements
  FOR SELECT USING (academy_id = public.current_academy_id());

-- expenses: admin-only (financial data).
DROP POLICY IF EXISTS "Admins manage expenses" ON public.expenses;
CREATE POLICY "Admins manage expenses" ON public.expenses
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

-- player_evaluations: admins manage; members read their own.
DROP POLICY IF EXISTS "Admins manage evaluations" ON public.player_evaluations;
CREATE POLICY "Admins manage evaluations" ON public.player_evaluations
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Members view own evaluations" ON public.player_evaluations;
CREATE POLICY "Members view own evaluations" ON public.player_evaluations
  FOR SELECT USING (auth.uid() = member_id);

-- schedule_templates: admins manage; members read (schedule display).
DROP POLICY IF EXISTS "Admins manage templates" ON public.schedule_templates;
CREATE POLICY "Admins manage templates" ON public.schedule_templates
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view templates" ON public.schedule_templates;
CREATE POLICY "Authenticated view templates" ON public.schedule_templates
  FOR SELECT USING (academy_id = public.current_academy_id());

-- coach_availability: admins manage; members read.
DROP POLICY IF EXISTS "Admins manage coach availability" ON public.coach_availability;
CREATE POLICY "Admins manage coach availability" ON public.coach_availability
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view coach availability" ON public.coach_availability;
CREATE POLICY "Authenticated view coach availability" ON public.coach_availability
  FOR SELECT USING (academy_id = public.current_academy_id());

-- tournaments: admins manage; members read.
DROP POLICY IF EXISTS "Admins manage tournaments" ON public.tournaments;
CREATE POLICY "Admins manage tournaments" ON public.tournaments
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view tournaments" ON public.tournaments;
CREATE POLICY "Authenticated view tournaments" ON public.tournaments
  FOR SELECT USING (academy_id = public.current_academy_id());

-- tournament_matches: scoped through parent tournament.
DROP POLICY IF EXISTS "Admins manage tournament matches" ON public.tournament_matches;
CREATE POLICY "Admins manage tournament matches" ON public.tournament_matches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.academy_id = public.current_academy_id()
    )
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

DROP POLICY IF EXISTS "Authenticated view tournament matches" ON public.tournament_matches;
CREATE POLICY "Authenticated view tournament matches" ON public.tournament_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.academy_id = public.current_academy_id()
    )
  );

-- trial_requests: anyone may submit; only admins of that academy read/manage.
DROP POLICY IF EXISTS "Public submit trial requests" ON public.trial_requests;
CREATE POLICY "Public submit trial requests" ON public.trial_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins manage trial requests" ON public.trial_requests;
CREATE POLICY "Admins manage trial requests" ON public.trial_requests
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

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
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.session_guests;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END
$$;

-- ────────────────────────────────────────────────────────────
-- 6. FIRST ACADEMY ADMIN (run once)
-- ────────────────────────────────────────────────────────────
-- Preferred: use the signup page → "Create academy" tab; the first user
-- becomes that academy's admin automatically.
--
-- Legacy manual setup:
-- 1. Create a user in Supabase Dashboard → Authentication → Users (or via signup).
-- 2. Grab their UUID and run:
--
--    UPDATE public.profiles
--    SET role = 'admin', is_active = TRUE,
--        academy_id = (SELECT id FROM public.academies ORDER BY created_at LIMIT 1)
--    WHERE id = '<user-uuid>';
--
-- The sync_role_claim trigger will set app_metadata.role = 'admin',
-- so the middleware grants admin access on their next sign-in.
