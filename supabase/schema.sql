-- ============================================================
-- Volleyra — Supabase Database Schema
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
  -- Location, structured as governorate + area (e.g. Cairo / Nasr City).
  governorate TEXT,
  area TEXT,
  -- Cover photo shown in the public directory and academy page.
  cover_url TEXT,
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

-- Migration for databases that predate the multi-tenant schema: CREATE TABLE
-- IF NOT EXISTS skips an existing table, so academy_id is added here — BEFORE
-- the index below references it. No-op on fresh databases.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id();

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

-- Venues (courts/halls) the academy trains at. When the venue is a playground
-- rented from a school, the tenant records the sport it is used for, the school
-- it is rented from, and the cost paid to the school.
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  address TEXT,
  capacity INTEGER,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  -- School the playground is rented from (when applicable).
  school_name TEXT,
  -- What the tenant pays the school per rental/booking.
  rental_cost DECIMAL(10, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rentals: the tenant sub-rents a playground (venue) to a customer.
CREATE TABLE IF NOT EXISTS public.venue_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  -- Price charged to the customer.
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  rental_date DATE NOT NULL,
  start_time TIME NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_method TEXT CHECK (payment_method IN ('cash', 'bank_transfer', 'e_wallet')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_venue_rentals_academy ON public.venue_rentals(academy_id, rental_date DESC);

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

-- Session waitlist: members can join when a session is full.
CREATE TABLE IF NOT EXISTS public.session_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'promoted', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_waitlist_session ON public.session_waitlist(session_id);

-- Session ratings: members rate sessions after attending.
CREATE TABLE IF NOT EXISTS public.session_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_session ON public.session_ratings(session_id);
CREATE INDEX IF NOT EXISTS idx_ratings_member ON public.session_ratings(member_id);

-- Member badges: gamification — earned for milestones.
CREATE TABLE IF NOT EXISTS public.member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🏆',
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, badge_type)
);
CREATE INDEX IF NOT EXISTS idx_badges_member ON public.member_badges(member_id);

-- Session photos: photo gallery for sessions and announcements.
CREATE TABLE IF NOT EXISTS public.session_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  announcement_id UUID REFERENCES public.announcements(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_photos_session ON public.session_photos(session_id);

-- Activity feed: timeline of member events.
CREATE TABLE IF NOT EXISTS public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('joined', 'attended', 'payment', 'badge', 'evaluation', 'rating', 'checkin')),
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_member ON public.activity_feed(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_academy ON public.activity_feed(academy_id, created_at DESC);

-- Recurring schedules: generates training_sessions from a pattern.
CREATE TABLE IF NOT EXISTS public.recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  time TIME NOT NULL,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
  age_group TEXT,
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Column migrations for already-deployed databases ──────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id();
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
  ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS session_price NUMERIC;
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
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS governorate TEXT;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS session_booking_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC NOT NULL DEFAULT 5;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS rental_cost DECIMAL(10, 2);

CREATE INDEX IF NOT EXISTS idx_training_sport ON public.training_sessions(sport_id);
CREATE INDEX IF NOT EXISTS idx_training_venue ON public.training_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_payments_academy ON public.payments(academy_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON public.session_bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_member ON public.session_bookings(member_id);

-- ── Session bookings: members book sessions at other academies ──────────────────
-- Only academies with session_booking_enabled = TRUE appear in the marketplace.
-- The platform takes platform_fee_percent from the session price.
CREATE TABLE IF NOT EXISTS public.session_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  session_price NUMERIC NOT NULL,
  platform_fee NUMERIC NOT NULL,
  member_payment NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_in_at TIMESTAMPTZ,
  notes TEXT,
  UNIQUE(session_id, member_id)
);

-- Scope old single-tenant constraints.
ALTER TABLE public.monthly_costs DROP CONSTRAINT IF EXISTS monthly_costs_month_year_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_costs_academy_month
  ON public.monthly_costs(academy_id, month, year);
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
  v_new_country TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_country', '')), '');
  v_new_governorate TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_governorate', '')), '');
  v_new_area TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_area', '')), '');
  v_code TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'academy_code', '')), '');
  v_academy UUID;
BEGIN
  IF v_new_name <> '' THEN
    INSERT INTO public.academies (name, slug, country, governorate, area, is_trial, trial_ends_at)
    VALUES (
      left(v_new_name, 60),
      lower(regexp_replace(left(v_new_name, 40), '[^a-zA-Z0-9]+', '-', 'g'))
        || '-' || left(md5(random()::text), 4),
      v_new_country,
      v_new_governorate,
      v_new_area,
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
-- 3.5 ACTIVITY FEED & BADGE AUTO-AWARD
-- ────────────────────────────────────────────────────────────

-- Log attendance events to activity_feed
CREATE OR REPLACE FUNCTION public.log_attendance_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_academy UUID;
  v_member_name TEXT;
  v_session_date DATE;
BEGIN
  SELECT s.academy_id, s.date INTO v_academy, v_session_date
  FROM public.training_sessions s WHERE s.id = NEW.session_id;

  SELECT name INTO v_member_name FROM public.profiles WHERE id = NEW.member_id;

  IF NEW.is_present THEN
    INSERT INTO public.activity_feed (academy_id, member_id, activity_type, description, metadata)
    VALUES (v_academy, NEW.member_id, 'attended',
      v_member_name || ' attended session on ' || v_session_date::TEXT,
      jsonb_build_object('session_id', NEW.session_id, 'date', v_session_date));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_attendance ON public.attendance;
CREATE TRIGGER log_attendance
  AFTER INSERT ON public.attendance
  FOR EACH ROW WHEN (NEW.is_present = TRUE)
  EXECUTE FUNCTION public.log_attendance_activity();

-- Log payment events
CREATE OR REPLACE FUNCTION public.log_payment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_name TEXT;
BEGIN
  SELECT name INTO v_member_name FROM public.profiles WHERE id = NEW.member_id;
  INSERT INTO public.activity_feed (academy_id, member_id, activity_type, description, metadata)
  VALUES (NEW.academy_id, NEW.member_id, 'payment',
    v_member_name || ' paid ' || NEW.amount || ' on ' || NEW.payment_date::TEXT,
    jsonb_build_object('payment_id', NEW.id, 'amount', NEW.amount));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_payment ON public.payments;
CREATE TRIGGER log_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_activity();

-- Auto-award badges based on attendance milestones
CREATE OR REPLACE FUNCTION public.check_and_award_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_member_name TEXT;
  v_academy UUID;
BEGIN
  SELECT sessions_attended, academy_id, name INTO v_count, v_academy, v_member_name
  FROM public.profiles WHERE id = NEW.member_id;

  -- First session badge
  IF v_count = 1 AND NOT EXISTS (SELECT 1 FROM public.member_badges WHERE member_id = NEW.member_id AND badge_type = 'first_session') THEN
    INSERT INTO public.member_badges (member_id, badge_type, badge_name, description, icon)
    VALUES (NEW.member_id, 'first_session', 'First Step', 'Attended first session', '⭐');
  END IF;

  -- 10 sessions
  IF v_count >= 10 AND NOT EXISTS (SELECT 1 FROM public.member_badges WHERE member_id = NEW.member_id AND badge_type = 'ten_sessions') THEN
    INSERT INTO public.member_badges (member_id, badge_type, badge_name, description, icon)
    VALUES (NEW.member_id, 'ten_sessions', 'Regular', 'Attended 10 sessions', '🔥');
  END IF;

  -- 25 sessions
  IF v_count >= 25 AND NOT EXISTS (SELECT 1 FROM public.member_badges WHERE member_id = NEW.member_id AND badge_type = 'twenty_five_sessions') THEN
    INSERT INTO public.member_badges (member_id, badge_type, badge_name, description, icon)
    VALUES (NEW.member_id, 'twenty_five_sessions', 'Dedicated', 'Attended 25 sessions', '💪');
  END IF;

  -- 50 sessions
  IF v_count >= 50 AND NOT EXISTS (SELECT 1 FROM public.member_badges WHERE member_id = NEW.member_id AND badge_type = 'fifty_sessions') THEN
    INSERT INTO public.member_badges (member_id, badge_type, badge_name, description, icon)
    VALUES (NEW.member_id, 'fifty_sessions', 'Champion', 'Attended 50 sessions', '🏆');
  END IF;

  -- 100 sessions
  IF v_count >= 100 AND NOT EXISTS (SELECT 1 FROM public.member_badges WHERE member_id = NEW.member_id AND badge_type = 'hundred_sessions') THEN
    INSERT INTO public.member_badges (member_id, badge_type, badge_name, description, icon)
    VALUES (NEW.member_id, 'hundred_sessions', 'Legend', 'Attended 100 sessions', '👑');
  END IF;

  -- Log the badge activity if any badge was earned
  IF FOUND THEN
    INSERT INTO public.activity_feed (academy_id, member_id, activity_type, description, metadata)
    VALUES (v_academy, NEW.member_id, 'badge',
      v_member_name || ' earned a new badge!',
      jsonb_build_object('badge_type', NEW.badge_type));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_badges_on_attendance ON public.attendance;
CREATE TRIGGER check_badges_on_attendance
  AFTER INSERT OR UPDATE ON public.attendance
  FOR EACH ROW WHEN (NEW.is_present = TRUE)
  EXECUTE FUNCTION public.check_and_award_badges();

-- ────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- Every policy scopes by academy via current_academy_id(); admins
-- additionally need the admin role claim.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_bookings ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.venue_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Members edit own academy" ON public.academies;
CREATE POLICY "Members edit own academy" ON public.academies
  FOR UPDATE USING (id = public.current_academy_id());

-- session_bookings: members create bookings for sessions at other academies;
-- admins of the session's academy manage them; members view their own.
DROP POLICY IF EXISTS "Members create bookings" ON public.session_bookings;
CREATE POLICY "Members create bookings" ON public.session_bookings
  FOR INSERT WITH CHECK (
    auth.uid() = member_id
    AND EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = session_id
        AND s.academy_id <> public.current_academy_id()
        AND s.status = 'scheduled'
    )
    AND EXISTS (
      SELECT 1 FROM public.academies a
      WHERE a.id = academy_id AND a.session_booking_enabled = TRUE
    )
  );

DROP POLICY IF EXISTS "Members view own bookings" ON public.session_bookings;
CREATE POLICY "Members view own bookings" ON public.session_bookings
  FOR SELECT USING (auth.uid() = member_id);

DROP POLICY IF EXISTS "Admins manage bookings" ON public.session_bookings;
CREATE POLICY "Admins manage bookings" ON public.session_bookings
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

-- profiles
DROP POLICY IF EXISTS "Members full access" ON public.profiles;
CREATE POLICY "Members full access" ON public.profiles
  FOR ALL USING (
    academy_id = public.current_academy_id()
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
  );

DROP POLICY IF EXISTS "Admins full access" ON public.profiles;
CREATE POLICY "Admins full access" ON public.profiles
  FOR ALL USING (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

-- Members may not change role, email, join_date, or academy_id directly.
-- Subscription counters and check-in code are managed by triggers.
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.uid() IS NULL OR auth.uid() = NEW.id) AND NOT (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.join_date IS DISTINCT FROM OLD.join_date
       OR (NEW.academy_id IS DISTINCT FROM OLD.academy_id
           AND NOT (OLD.academy_id IS NULL AND NEW.is_active = FALSE)) THEN
      RAISE EXCEPTION 'Not allowed to change restricted profile fields';
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
DROP POLICY IF EXISTS "Members manage payments" ON public.payments;
CREATE POLICY "Members manage payments" ON public.payments
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- training_sessions: admins manage, members view (same academy).
DROP POLICY IF EXISTS "Members manage sessions" ON public.training_sessions;
CREATE POLICY "Members manage sessions" ON public.training_sessions
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- attendance: scoped through the parent session's academy.
-- Members can mark their own attendance; admins manage all.
DROP POLICY IF EXISTS "Members manage attendance" ON public.attendance;
CREATE POLICY "Members manage attendance" ON public.attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
    AND auth.uid() = member_id
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
    AND auth.uid() = member_id
  );

DROP POLICY IF EXISTS "Members view attendance" ON public.attendance;
CREATE POLICY "Members view attendance" ON public.attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
      WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
  );

-- session_guests: scoped through the parent session's academy.DROP POLICY IF EXISTS "Members manage guests" ON public.session_guests;
CREATE POLICY "Members manage guests" ON public.session_guests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
        WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
        WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
  );

-- monthly_costs: admins manage; members never read the raw table (it holds
-- coach salary / court rental). They only see cost_per_session via the view below.
DROP POLICY IF EXISTS "Members manage costs" ON public.monthly_costs;
CREATE POLICY "Members manage costs" ON public.monthly_costs
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- session_calculations: scoped through the parent session's academy.DROP POLICY IF EXISTS "Members manage calculations" ON public.session_calculations;
CREATE POLICY "Members manage calculations" ON public.session_calculations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
        WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
  )
  WITH CHECK (
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
DROP POLICY IF EXISTS "Members manage sports" ON public.sports;
CREATE POLICY "Members manage sports" ON public.sports
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- teams + team_members: admins manage; members can view teams and rosters.
DROP POLICY IF EXISTS "Members manage teams" ON public.teams;
CREATE POLICY "Members manage teams" ON public.teams
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

DROP POLICY IF EXISTS "Members manage team members" ON public.team_members;
CREATE POLICY "Members manage team members" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.academy_id = public.current_academy_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.academy_id = public.current_academy_id()
    )
  );

-- membership_plans: admins manage; members read (to see what they can buy).
DROP POLICY IF EXISTS "Members manage plans" ON public.membership_plans;
CREATE POLICY "Members manage plans" ON public.membership_plans
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- coaches: admins manage; members read names/specialties for display.
DROP POLICY IF EXISTS "Members manage coaches" ON public.coaches;
CREATE POLICY "Members manage coaches" ON public.coaches
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- venues: admins manage; members read for display.
DROP POLICY IF EXISTS "Members manage venues" ON public.venues;
CREATE POLICY "Members manage venues" ON public.venues
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

DROP POLICY IF EXISTS "Members manage venue rentals" ON public.venue_rentals;
CREATE POLICY "Members manage venue rentals" ON public.venue_rentals
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- announcements: admins manage; members read.
DROP POLICY IF EXISTS "Members manage announcements" ON public.announcements;
CREATE POLICY "Members manage announcements" ON public.announcements
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- expenses: admin-only (financial data).
DROP POLICY IF EXISTS "Members manage expenses" ON public.expenses;
CREATE POLICY "Members manage expenses" ON public.expenses
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- player_evaluations: admins manage; members read their own.
DROP POLICY IF EXISTS "Members manage evaluations" ON public.player_evaluations;
CREATE POLICY "Members manage evaluations" ON public.player_evaluations
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- schedule_templates: admins manage; members read (schedule display).
DROP POLICY IF EXISTS "Members manage templates" ON public.schedule_templates;
CREATE POLICY "Members manage templates" ON public.schedule_templates
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- coach_availability: admins manage; members read.
DROP POLICY IF EXISTS "Members manage coach availability" ON public.coach_availability;
CREATE POLICY "Members manage coach availability" ON public.coach_availability
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- tournaments: admins manage; members read.
DROP POLICY IF EXISTS "Members manage tournaments" ON public.tournaments;
CREATE POLICY "Members manage tournaments" ON public.tournaments
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

DROP POLICY IF EXISTS "Members manage tournament matches" ON public.tournament_matches;
CREATE POLICY "Members manage tournament matches" ON public.tournament_matches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.academy_id = public.current_academy_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.academy_id = public.current_academy_id()
    )
  );

-- trial_requests: anyone may submit; only admins of that academy read/manage.
-- session_waitlist: members join/leave; admins manage all.DROP POLICY IF EXISTS "Members manage waitlist" ON public.session_waitlist;
CREATE POLICY "Members manage waitlist" ON public.session_waitlist
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
        WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
        WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
  );

-- session_ratings: members rate; admins manage.DROP POLICY IF EXISTS "Members manage ratings" ON public.session_ratings;
CREATE POLICY "Members manage ratings" ON public.session_ratings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
        WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
    AND auth.uid() = member_id
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions s
        WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    )
    AND auth.uid() = member_id
  );

-- member_badges: admins assign; members view their own.
DROP POLICY IF EXISTS "Members manage badges" ON public.member_badges;
CREATE POLICY "Members manage badges" ON public.member_badges
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = member_id AND p.academy_id = public.current_academy_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = member_id AND p.academy_id = public.current_academy_id()
    )
  );

-- session_photos: admins manage; members view.
DROP POLICY IF EXISTS "Members manage photos" ON public.session_photos;
CREATE POLICY "Members manage photos" ON public.session_photos
  FOR ALL USING (
    (session_id IS NULL OR EXISTS (
      SELECT 1 FROM public.training_sessions s WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    ))
  )
  WITH CHECK (
    (session_id IS NULL OR EXISTS (
      SELECT 1 FROM public.training_sessions s WHERE s.id = session_id AND s.academy_id = public.current_academy_id()
    ))
  );

-- activity_feed: admins + members view their academy; system inserts via trigger.
DROP POLICY IF EXISTS "Members manage activity" ON public.activity_feed;
CREATE POLICY "Members manage activity" ON public.activity_feed
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- recurring_schedules: admins manage; members read.
DROP POLICY IF EXISTS "Members manage recurring" ON public.recurring_schedules;
CREATE POLICY "Members manage recurring" ON public.recurring_schedules
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- trial_requests: anyone may submit; only admins of that academy read/manage.
DROP POLICY IF EXISTS "Public submit trial requests" ON public.trial_requests;
CREATE POLICY "Public submit trial requests" ON public.trial_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Members manage trial requests" ON public.trial_requests;
CREATE POLICY "Members manage trial requests" ON public.trial_requests
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

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

-- ────────────────────────────────────────────────────────────
-- 5. PUBLIC ACADEMY DIRECTORY & RATINGS
-- Members who sign up without an invite code can browse public
-- academies and pick one; registered users can rate academies.
-- ────────────────────────────────────────────────────────────

-- Public contact/location info shown in the directory.
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS address TEXT;

CREATE TABLE IF NOT EXISTS public.academy_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(academy_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_academy_ratings_academy ON public.academy_ratings(academy_id);

ALTER TABLE public.academy_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view academy ratings" ON public.academy_ratings;
CREATE POLICY "Anyone can view academy ratings" ON public.academy_ratings
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Members insert own ratings" ON public.academy_ratings;
CREATE POLICY "Members insert own ratings" ON public.academy_ratings
  FOR INSERT WITH CHECK (auth.uid() = member_id);

DROP POLICY IF EXISTS "Members update own ratings" ON public.academy_ratings;
CREATE POLICY "Members update own ratings" ON public.academy_ratings
  FOR UPDATE USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

-- A member who signed up without an invite code may attach themselves to
-- exactly one public academy (they stay pending until an admin approves).
CREATE OR REPLACE FUNCTION public.join_public_academy(p_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_public BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_public INTO v_is_public FROM public.academies WHERE id = p_academy_id;
  IF v_is_public IS NOT TRUE THEN
    RAISE EXCEPTION 'Academy not found';
  END IF;

  UPDATE public.profiles
  SET academy_id = p_academy_id
  WHERE id = auth.uid()
    AND academy_id IS NULL
    AND role = 'member';

  RETURN FOUND; -- false if already attached to an academy
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_public_academy(UUID) TO authenticated;

-- Book a session at another academy. The platform takes platform_fee_percent
-- from the session_price; the member pays the remainder to the academy.
-- Requires the session's academy to have session_booking_enabled = TRUE.
CREATE OR REPLACE FUNCTION public.book_session(
  p_session_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member     UUID;
  v_session    training_sessions;
  v_academy    academies;
  v_fee_pct    NUMERIC;
  v_fee        NUMERIC;
  v_to_academy NUMERIC;
  v_booking    UUID;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_session
  FROM public.training_sessions
  WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF v_session.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Session is not bookable';
  END IF;

  SELECT * INTO v_academy
  FROM public.academies
  WHERE id = v_session.academy_id;
  IF NOT FOUND OR NOT v_academy.session_booking_enabled THEN
    RAISE EXCEPTION 'This academy does not accept session bookings';
  END IF;

  -- Members can only book sessions at other academies (not their own).
  IF v_session.academy_id = coalesce((SELECT academy_id FROM public.profiles WHERE id = v_member), null) THEN
    RAISE EXCEPTION 'Cannot book a session at your own academy';
  END IF;

  -- Platform fee.
  v_fee_pct := coalesce(v_academy.platform_fee_percent, 5);
  v_fee := round(v_session.session_price * v_fee_pct / 100, 2);
  v_to_academy := v_session.session_price - v_fee;

  INSERT INTO public.session_bookings
    (session_id, member_id, academy_id, session_price, platform_fee, member_payment, notes)
  VALUES
    (p_session_id, v_member, v_session.academy_id, v_session.session_price, v_fee, v_to_academy, p_notes)
  RETURNING id INTO v_booking;

  RETURN v_booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_session(UUID, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 6. MEMBER PREMIUM PLAN
-- Optional upgrade that unlocks cross-academy features.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_plan TEXT NOT NULL DEFAULT 'free'
    CHECK (member_plan IN ('free', 'premium')),
  ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- Admins may upgrade/downgrade a member's plan.
DROP POLICY IF EXISTS "Members manage member plan" ON public.profiles;
CREATE POLICY "Members manage member plan" ON public.profiles
  FOR UPDATE USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- Members may read and update their own plan via the profiles UPDATE policy.

-- An RPC for members to activate premium (simulates a payment flow).
-- In production this would verify payment via Stripe/etc. before calling.
CREATE OR REPLACE FUNCTION public.activate_member_premium(
  p_months         INTEGER DEFAULT 1,
  p_amount         NUMERIC,
  p_method         TEXT DEFAULT 'card'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id UUID;
  v_payment  UUID;
BEGIN
  v_member_id := auth.uid();
  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Record the payment now; later we will replace this with a real gateway call.
  INSERT INTO public.payments AS pm
    (member_id, academy_id, amount, payment_date, method, subscription_sessions)
  VALUES
    (v_member_id,
     coalesce((SELECT academy_id FROM public.profiles WHERE id = v_member_id), public.current_academy_id()),
     p_amount,
     NOW()::DATE,
     p_method,
     8)
  RETURNING id INTO v_payment;

  -- Activate the premium plan and extend expiry.
  UPDATE public.profiles
  SET member_plan = 'premium',
      premium_expires_at = GREATEST(
        COALESCE(premium_expires_at, NOW()),
        NOW()
      ) + (p_months || ' months')::INTERVAL
  WHERE id = v_member_id;

  RETURN v_payment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_member_premium(
  INTEGER,
  NUMERIC,
  TEXT
) TO authenticated;
