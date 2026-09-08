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
  -- Location, structured as country → governorate → city/area.
  country TEXT,
  governorate TEXT,
  area TEXT,
  -- Cover photo shown in the public directory and academy page.
  cover_url TEXT,
  -- Brand logo uploaded during academy setup.
  logo_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  -- Token for the read-only .ics calendar feed: /api/calendar/<token>
  calendar_token TEXT UNIQUE DEFAULT md5(random()::text || clock_timestamp()::text),
  -- Trial period: new academies get a 14-day free trial.
  is_trial BOOLEAN NOT NULL DEFAULT TRUE,
  trial_ends_at TIMESTAMPTZ,
  trial_extended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Multiple branches/locations per academy.
CREATE TABLE IF NOT EXISTS public.academy_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  address TEXT,
  country TEXT,
  governorate TEXT,
  area TEXT,
  phone TEXT,
  is_main BOOLEAN NOT NULL DEFAULT FALSE,
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
  country TEXT,
  -- Community join criteria: games may restrict players by gender and/or age.
  gender TEXT CHECK (gender IN ('male', 'female')),
  birth_date DATE,
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
  -- Nullable so a venue can sit in the platform's unassigned playground pool
  -- until an academy claims it (via the admin console or academy signup).
  academy_id UUID REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  name TEXT NOT NULL,
  address TEXT,
  capacity INTEGER,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  -- School the playground is rented from (when applicable).
  school_name TEXT,
  -- What the tenant pays the school/owner per unit of time (1 unit = 1 hour).
  rental_cost DECIMAL(10, 2),
  -- Number of time units (hours) rented from the owner per booking.
  rental_hours DECIMAL(5, 2) NOT NULL DEFAULT 1,
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
  -- Rate charged to the customer per unit of time (1 unit = 1 hour).
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  -- Number of time units (hours) the rental lasts.
  hours DECIMAL(5, 2) NOT NULL DEFAULT 1,
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

-- Academy media: photo gallery for academies and their playgrounds.
CREATE TABLE IF NOT EXISTS public.academy_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academy_photos_academy ON public.academy_photos(academy_id);

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
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS trial_extended_at TIMESTAMPTZ;ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS country TEXT;
  ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS governorate TEXT;
  ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS session_booking_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC NOT NULL DEFAULT 5;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS rental_cost DECIMAL(10, 2);
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS rental_hours DECIMAL(5, 2) NOT NULL DEFAULT 1;
ALTER TABLE public.venue_rentals ADD COLUMN IF NOT EXISTS hours DECIMAL(5, 2) NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_training_sport ON public.training_sessions(sport_id);
CREATE INDEX IF NOT EXISTS idx_training_venue ON public.training_sessions(venue_id);
CREATE INDEX IF NOT EXISTS idx_payments_academy ON public.payments(academy_id, payment_date DESC);

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

CREATE INDEX IF NOT EXISTS idx_bookings_session ON public.session_bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_member ON public.session_bookings(member_id);

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

  -- Seed the full sport catalog for every academy so dropdowns show all sports.
  INSERT INTO public.sports (academy_id, name)
  SELECT a.id, az.name
  FROM public.academies a
  CROSS JOIN (VALUES
    ('Football'), ('Basketball'), ('Handball'), ('Volleyball'), ('Tennis'),
    ('Swimming'), ('Padel'), ('Squash'), ('Table Tennis'), ('Badminton'),
    ('Gymnastics'), ('Karate'), ('Boxing'), ('Athletics'), ('Kung Fu'),
    ('Taekwondo'), ('CrossFit'), ('Judo'), ('Kickboxing'), ('Wrestling'),
    ('Archery'), ('Fencing'), ('Equestrian'), ('Cycling'), ('Weightlifting'), ('Parkour')
  ) AS az(name)
  ON CONFLICT (academy_id, name) DO NOTHING;

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
  v_venue JSONB;
BEGIN
  IF v_new_name <> '' THEN
    -- A phone number is mandatory to create an academy account. Reject the
    -- whole signup (user + academy) if it is missing or blank.
    IF NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Phone number is required to create an academy account';
    END IF;

    INSERT INTO public.academies (name, slug, country, governorate, area, is_public, is_trial, trial_ends_at, plan)
    VALUES (
      left(v_new_name, 60),
      lower(regexp_replace(left(v_new_name, 40), '[^a-zA-Z0-9]+', '-', 'g'))
        || '-' || left(md5(random()::text), 4),
      v_new_country,
      v_new_governorate,
      v_new_area,
      TRUE,
      TRUE,
      NOW() + INTERVAL '30 days',
      -- New academies start on a 1-month trial of the top (Enterprise/elite)
      -- plan so the whole product is usable during the trial period.
      'elite'
    )
    RETURNING id INTO v_academy;

    INSERT INTO public.membership_plans (academy_id, name, sessions_count)
    VALUES (v_academy, 'Full', 8), (v_academy, 'Half', 4);

    -- Seed only the sports the admin chose at signup so pickers list supported sports.
    INSERT INTO public.sports (academy_id, name)
    SELECT v_academy, trim(az.name)
    FROM unnest(string_to_array(COALESCE(NEW.raw_user_meta_data ->> 'sports', ''), ',')) AS az(name)
    WHERE trim(az.name) <> ''
    ON CONFLICT (academy_id, name) DO NOTHING;

    INSERT INTO public.profiles (id, email, role, name, phone, country, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'admin',
      COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
      COALESCE(v_new_country, NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'country', '')), '')),
      CURRENT_DATE, v_academy, TRUE
    )
    ON CONFLICT (id) DO NOTHING;

    -- Attach the chosen playgrounds to the new academy: an unassigned pool
    -- playground can be claimed by id, or new ones are created from details.
    FOR v_venue IN
      SELECT value FROM jsonb_array_elements(
        COALESCE(NEW.raw_user_meta_data -> 'new_academy_venues', '[]'::jsonb)
      )
    LOOP
      IF v_venue ? 'id' THEN
        UPDATE public.venues
        SET academy_id = v_academy
        WHERE id = (v_venue ->> 'id')::uuid AND academy_id IS NULL;
      ELSE
        INSERT INTO public.venues (
          academy_id, name, address, capacity, school_name,
          rental_cost, rental_hours, country, governorate, area
        )
        VALUES (
          v_academy,
          trim(v_venue ->> 'name'),
          NULLIF(v_venue ->> 'address', ''),
          NULLIF(v_venue ->> 'capacity', '')::integer,
          NULLIF(v_venue ->> 'school_name', ''),
          NULLIF(v_venue ->> 'rental_cost', '')::numeric,
          COALESCE(NULLIF(v_venue ->> 'rental_hours', '')::numeric, 1),
          COALESCE(v_new_country, NULLIF(v_venue ->> 'country', '')),
          COALESCE(v_new_governorate, NULLIF(v_venue ->> 'governorate', '')),
          COALESCE(v_new_area, NULLIF(v_venue ->> 'area', ''))
        );
      END IF;
    END LOOP;
  ELSE
    IF v_code IS NOT NULL THEN
      SELECT id INTO v_academy FROM public.academies WHERE UPPER(invite_code) = UPPER(v_code);
    END IF;

    INSERT INTO public.profiles (id, email, role, name, phone, country, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'member',
      COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'country', '')), ''),
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
ALTER TABLE public.academy_branches ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.academy_photos ENABLE ROW LEVEL SECURITY;
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

-- session_guests: scoped through the parent session's academy.
DROP POLICY IF EXISTS "Members manage guests" ON public.session_guests;
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

-- session_calculations: scoped through the parent session's academy.
DROP POLICY IF EXISTS "Members manage calculations" ON public.session_calculations;
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

-- Public directory: anyone may read the sports of academies marked is_public.
DROP POLICY IF EXISTS "Public view public academy sports" ON public.sports;
CREATE POLICY "Public view public academy sports" ON public.sports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.academies a
      WHERE a.id = sports.academy_id AND a.is_public = TRUE
    )
  );

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

-- venues: admins manage; members read for display. Unassigned venues are
-- selectable by anyone so academy owners can claim them during signup; the
-- contact columns stay column-restricted (admin API only).
DROP POLICY IF EXISTS "Members manage venues" ON public.venues;
CREATE POLICY "Members manage venues" ON public.venues
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

DROP POLICY IF EXISTS "Unassigned playgrounds are viewable" ON public.venues;
CREATE POLICY "Unassigned playgrounds are viewable" ON public.venues
  FOR SELECT USING (academy_id IS NULL);

DROP POLICY IF EXISTS "Members manage venue rentals" ON public.venue_rentals;
CREATE POLICY "Members manage venue rentals" ON public.venue_rentals
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- academy_photos: world-readable gallery, editable by the academy's owners.
DROP POLICY IF EXISTS "Academy photos: public view" ON public.academy_photos;
CREATE POLICY "Academy photos: public view" ON public.academy_photos
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Academy photos: manage" ON public.academy_photos;
CREATE POLICY "Academy photos: manage" ON public.academy_photos
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- announcements: admins manage; members read.
DROP POLICY IF EXISTS "Members manage announcements" ON public.announcements;
CREATE POLICY "Members manage announcements" ON public.announcements
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- academy_branches: members of the academy manage its branches.
DROP POLICY IF EXISTS "Members manage branches" ON public.academy_branches;
CREATE POLICY "Members manage branches" ON public.academy_branches
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
-- session_waitlist: members join/leave; admins manage all.
DROP POLICY IF EXISTS "Members manage waitlist" ON public.session_waitlist;
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

-- session_ratings: members rate; admins manage.
DROP POLICY IF EXISTS "Members manage ratings" ON public.session_ratings;
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
-- Drop both parameter-order variants first so exactly one overload exists
-- (parameter reordering via CREATE OR REPLACE would otherwise leave a stale
-- second function behind and confuse PostgREST's RPC resolution).
DROP FUNCTION IF EXISTS public.activate_member_premium(INTEGER, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.activate_member_premium(NUMERIC, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.activate_member_premium(
  p_amount         NUMERIC,
  p_months         INTEGER DEFAULT 1,
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
  NUMERIC,
  INTEGER,
  TEXT
) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 7. COMMUNITY
-- An open member directory + public "friendly games".
--
-- Users can be members WITHOUT being attached to an academy, so the
-- community is not scoped by current_academy_id(). Instead:
--   • profiles.bio / community_visible  → opt in/out of the directory
--   • community_members (view)          → safe, cross-academy directory
--   • friendly_games                    → any member creates a public game
--   • friendly_game_participants        → join/leave tracked (RPC-only)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS community_visible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS availability_days INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS interested_sports TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notify_game_alerts BOOLEAN NOT NULL DEFAULT FALSE;

-- Safe community-wide directory: NO email / phone / checkin code exposure.
-- Plain (definer) view so an authenticated member from any academy can
-- read the safe fields. bio is public by design (open directory).
DROP VIEW IF EXISTS public.blocked_members;
CREATE VIEW public.blocked_members AS
SELECT
  b.id,
  b.blocker_id,
  p.id AS blocked_id,
  p.name AS blocked_name,
  b.created_at
FROM public.blocks b
LEFT JOIN public.profiles p ON p.id = b.blocked_id;
GRANT SELECT ON public.blocked_members TO authenticated;

DROP VIEW IF EXISTS public.community_members;
CREATE VIEW public.community_members AS
SELECT
  p.id,
  p.name,
  p.bio,
  p.academy_id,
  a.name AS academy_name,
  COALESCE(a.area, a.governorate) AS area,
  p.skill_level,
  p.position,
  p.availability_days,
  p.interested_sports,
  p.lat,
  p.lng
FROM public.profiles p
LEFT JOIN public.academies a ON a.id = p.academy_id
WHERE p.community_visible = TRUE
  AND p.name IS NOT NULL;
GRANT SELECT ON public.community_members TO authenticated;

-- Friendly games — the community's open court.
-- creator_name is denormalized (set at creation) so every member — even from
-- another academy — can see who organized the game without extra joins/RLS.
CREATE TABLE IF NOT EXISTS public.friendly_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  area TEXT,
  location TEXT,
  game_date DATE NOT NULL,
  start_time TIME NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 12 CHECK (max_players >= 2),
  skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS creator_name TEXT NOT NULL DEFAULT 'Member';
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS creation_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fee_method TEXT CHECK (fee_method IN ('instapay', 'e_wallet', 'visa', 'kashier')),
  ADD COLUMN IF NOT EXISTS fee_receipt_url TEXT;
-- Fee-review workflow: games start "pending" super-admin review of the receipt;
-- approved => creation_fee_paid = TRUE, rejected cancels the game (same rule as
-- plan subscriptions — the game goes live immediately and is cancelled if the
-- payment turns out to be fake).
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS fee_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (fee_status IN ('pending', 'approved', 'rejected'));
-- Playground the game is booked at (a selectable pool venue).
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS playground_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;
-- Private games share an invite code; whoever has it can join.
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS invite_code TEXT;
-- Who may join: gender filter + age range (min_age / max_age, both optional).
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'mixed'
    CHECK (gender IN ('male', 'female', 'mixed')),
  ADD COLUMN IF NOT EXISTS min_age INTEGER
    CHECK (min_age IS NULL OR (min_age BETWEEN 0 AND 120)),
  ADD COLUMN IF NOT EXISTS max_age INTEGER
    CHECK (max_age IS NULL OR (max_age BETWEEN 0 AND 120)),
  ADD CONSTRAINT friendly_games_age_order CHECK (
    min_age IS NULL OR max_age IS NULL OR min_age <= max_age
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendly_games_invite_code
  ON public.friendly_games(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_friendly_games_playground
  ON public.friendly_games(playground_id);
CREATE INDEX IF NOT EXISTS idx_friendly_games_gender
  ON public.friendly_games(gender);
CREATE INDEX IF NOT EXISTS idx_friendly_games_date ON public.friendly_games(game_date);
CREATE INDEX IF NOT EXISTS idx_friendly_games_sport ON public.friendly_games(sport);
CREATE INDEX IF NOT EXISTS idx_friendly_games_creator ON public.friendly_games(creator_id);

CREATE TABLE IF NOT EXISTS public.friendly_game_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.friendly_games(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('organizer', 'player')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(game_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_fgp_game ON public.friendly_game_participants(game_id);
CREATE INDEX IF NOT EXISTS idx_fgp_member ON public.friendly_game_participants(member_id);

ALTER TABLE public.friendly_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendly_game_participants ENABLE ROW LEVEL SECURITY;

-- Community games: anyone authenticated sees public games; the owner and any
-- member in the roster see the game too (private games become visible once a
-- member joins via the shared invite link).
DROP POLICY IF EXISTS "Community games read" ON public.friendly_games;
CREATE POLICY "Community games read" ON public.friendly_games
  FOR SELECT TO authenticated USING (
    is_public = TRUE
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friendly_game_participants p
      WHERE p.game_id = friendly_games.id AND p.member_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Community games create" ON public.friendly_games;
CREATE POLICY "Community games create" ON public.friendly_games
  FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Community games owner update" ON public.friendly_games;
CREATE POLICY "Community games owner update" ON public.friendly_games
  FOR UPDATE TO authenticated USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Community games owner delete" ON public.friendly_games;
CREATE POLICY "Community games owner delete" ON public.friendly_games
  FOR DELETE TO authenticated USING (creator_id = auth.uid());

-- Participants are visible to anyone authenticated (roster on game cards).
-- Inserts/deletes are RPC-only (join_friendly_game / leave_friendly_game)
-- so seat limits and the open/full status stay consistent.
DROP POLICY IF EXISTS "Community participants read" ON public.friendly_game_participants;
CREATE POLICY "Community participants read" ON public.friendly_game_participants
  FOR SELECT TO authenticated USING (TRUE);

-- Members must always be able to read & edit their OWN profile row, even
-- when they are not attached to any academy (community-first signup).
DROP POLICY IF EXISTS "Members read own profile" ON public.profiles;
CREATE POLICY "Members read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Members update own profile" ON public.profiles;
CREATE POLICY "Members update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ────────────────────────────────────────────────────────────
-- 7.5 COMMUNITY RPCs
-- ────────────────────────────────────────────────────────────

-- Drop both signatures first so re-running this file never leaves a stale
-- overload behind (parameter reordering changes the RPC signature).
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_friendly_game(
  p_title          TEXT,
  p_sport          TEXT,
  p_game_date      DATE,
  p_start_time     TIME,
  p_playground_id  UUID DEFAULT NULL,
  p_area           TEXT DEFAULT NULL,
  p_location       TEXT DEFAULT NULL,
  p_lat            DOUBLE PRECISION DEFAULT NULL,
  p_lng            DOUBLE PRECISION DEFAULT NULL,
  p_max_players    INTEGER DEFAULT 12,
  p_skill_level    TEXT DEFAULT NULL,
  p_description    TEXT DEFAULT NULL,
  p_is_public      BOOLEAN DEFAULT TRUE,
  p_recurrence     TEXT DEFAULT NULL,
  p_fee_method     TEXT DEFAULT NULL,
  p_fee_receipt_url TEXT DEFAULT NULL,
  -- Join criteria: who may join this game.
  p_gender         TEXT DEFAULT 'mixed',
  p_min_age        INTEGER DEFAULT NULL,
  p_max_age        INTEGER DEFAULT NULL,
  p_invite_code    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_game   UUID;
  v_name   TEXT;
  v_venue  public.venues%ROWTYPE;
  v_code   TEXT;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  IF p_sport IS NULL OR btrim(p_sport) = '' THEN
    RAISE EXCEPTION 'Sport is required';
  END IF;
  IF p_game_date IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Date and time are required';
  END IF;

  -- Playground must be one of the platform's selectable pool venues.
  IF p_playground_id IS NOT NULL THEN
    SELECT * INTO v_venue
    FROM public.venues
    WHERE id = p_playground_id AND academy_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Playground not available';
    END IF;
  END IF;

  -- Payment: same three methods as subscriptions; kashier is not live yet.
  IF p_fee_method IS NULL OR p_fee_method NOT IN ('instapay', 'e_wallet', 'kashier') THEN
    RAISE EXCEPTION 'A payment method is required to create a friendly game';
  END IF;
  IF p_fee_method = 'kashier' THEN
    RAISE EXCEPTION 'Kashier gateway is not available yet';
  END IF;
  IF p_fee_receipt_url IS NULL OR btrim(p_fee_receipt_url) = '' THEN
    RAISE EXCEPTION 'A receipt is required to confirm the game creation fee';
  END IF;

  -- Join criteria.
  IF p_gender IS NULL OR p_gender NOT IN ('male', 'female', 'mixed') THEN
    RAISE EXCEPTION 'Invalid gender criteria';
  END IF;
  IF (p_min_age IS NOT NULL AND (p_min_age < 0 OR p_min_age > 120))
     OR (p_max_age IS NOT NULL AND (p_max_age < 0 OR p_max_age > 120)) THEN
    RAISE EXCEPTION 'Invalid age range';
  END IF;
  IF p_min_age IS NOT NULL AND p_max_age IS NOT NULL AND p_min_age > p_max_age THEN
    RAISE EXCEPTION 'Invalid age range';
  END IF;

  SELECT name INTO v_name FROM public.profiles WHERE id = v_member;
  v_name := COALESCE(NULLIF(btrim(v_name), ''), 'Member');

  -- Private games get a shareable invite code (generated when not provided).
  IF p_is_public = FALSE THEN
    v_code := upper(btrim(COALESCE(p_invite_code, '')));
    IF v_code = '' THEN
      LOOP
        v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.friendly_games WHERE invite_code = v_code
        );
      END LOOP;
    END IF;
    IF v_code !~ '^[A-Z0-9]{4,16}$' THEN
      RAISE EXCEPTION 'Invalid invite code';
    END IF;
  END IF;

  INSERT INTO public.friendly_games
    (creator_id, creator_name, sport, title, description, area, location, lat, lng,
     playground_id, game_date, start_time, max_players, skill_level, is_public,
     recurrence, invite_code, gender, min_age, max_age,
     creation_fee_paid, fee_status, fee_method, fee_receipt_url)
  VALUES
    (v_member,
     v_name,
     btrim(p_sport),
     btrim(p_title),
     NULLIF(btrim(COALESCE(p_description, '')), ''),
     COALESCE(NULLIF(btrim(COALESCE(p_area, '')), ''), v_venue.area),
     COALESCE(NULLIF(btrim(COALESCE(p_location, '')), ''), v_venue.name),
     CASE WHEN v_venue.lat IS NOT NULL THEN v_venue.lat
          WHEN p_lat BETWEEN -90 AND 90 THEN p_lat ELSE NULL END,
     CASE WHEN v_venue.lng IS NOT NULL THEN v_venue.lng
          WHEN p_lng BETWEEN -180 AND 180 THEN p_lng ELSE NULL END,
     p_playground_id,
     p_game_date,
     p_start_time,
     GREATEST(p_max_players, 2),
     CASE WHEN p_skill_level IN ('beginner', 'intermediate', 'advanced')
          THEN p_skill_level ELSE NULL END,
     COALESCE(p_is_public, TRUE),
     CASE WHEN p_recurrence IN ('weekly') THEN p_recurrence ELSE NULL END,
     v_code,
     p_gender,
     p_min_age,
     p_max_age,
     FALSE,
     'pending',
     p_fee_method,
     p_fee_receipt_url)
  RETURNING id INTO v_game;

  -- The creator is always the organizer participant.
  INSERT INTO public.friendly_game_participants (game_id, member_id, role)
  VALUES (v_game, v_member, 'organizer');

  -- Alert members who opted in to matching-sport game alerts (capped).
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT
    p.id,
    'game_alert',
    'New ' || btrim(p_sport) || ' game',
    btrim(p_title),
    '/games'
  FROM public.profiles p
  WHERE p.id <> v_member
    AND p.notify_game_alerts = TRUE
    AND p.interested_sports @> ARRAY[btrim(p_sport)]
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE b.blocker_id = p.id AND b.blocked_id = v_member
    )
  LIMIT 100;

  RETURN v_game;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_friendly_game(
  TEXT, TEXT, DATE, TIME, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION,
  INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT
) TO authenticated;

-- Resolve a private game by its invite code (for the shared link). SECURITY
-- DEFINER so a non-participant with a valid code can see the game; the code is
-- the secret that unlocks the private game.
CREATE OR REPLACE FUNCTION public.get_game_by_invite(p_code TEXT)
RETURNS SETOF public.friendly_games
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.friendly_games
  WHERE invite_code = upper(btrim(COALESCE(p_code, '')))
    AND status <> 'cancelled'
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_game_by_invite(TEXT) TO authenticated;

-- Storage bucket for friendly-game creation fee receipts. Files are uploaded
-- by the payer under their own subfolder and only they can read them back.
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-fee-receipts', 'game-fee-receipts', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Game fee receipts: upload own" ON storage.objects;
CREATE POLICY "Game fee receipts: upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'game-fee-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Game fee receipts: read own" ON storage.objects;
CREATE POLICY "Game fee receipts: read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'game-fee-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage bucket for session/announcement photos. The bucket is public so the
-- generated getPublicUrl() links load in <img> tags; uploads come from any
-- authenticated member.
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-photos', 'session-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Session photos: upload" ON storage.objects;
CREATE POLICY "Session photos: upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'session-photos');

DROP POLICY IF EXISTS "Session photos: read" ON storage.objects;
CREATE POLICY "Session photos: read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'session-photos');

-- Storage bucket for academy logo + gallery photos. Public bucket so images
-- load in <img> tags; uploads come from any authenticated academy owner.
INSERT INTO storage.buckets (id, name, public)
VALUES ('academy-media', 'academy-media', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Academy media: upload" ON storage.objects;
CREATE POLICY "Academy media: upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'academy-media');

DROP POLICY IF EXISTS "Academy media: read" ON storage.objects;
CREATE POLICY "Academy media: read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'academy-media');

DROP FUNCTION IF EXISTS public.join_friendly_game(UUID);
CREATE OR REPLACE FUNCTION public.join_friendly_game(p_game_id UUID, p_invite_code TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_game   friendly_games;
  v_count  INTEGER;
  v_prof   profiles%ROWTYPE;
  v_age    INTEGER;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- Private games require the invite code from the shared link.
  IF NOT v_game.is_public THEN
    IF p_invite_code IS NULL
       OR upper(btrim(p_invite_code)) <> v_game.invite_code THEN
      RAISE EXCEPTION 'This game is private — use the invite link to join';
    END IF;
  END IF;

  IF v_game.status NOT IN ('open', 'full') THEN
    RAISE EXCEPTION 'This game is no longer open';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendly_game_participants
    WHERE game_id = p_game_id AND member_id = v_member
  ) THEN
    RAISE EXCEPTION 'You already joined this game';
  END IF;

  -- Gender criteria.
  IF v_game.gender IN ('male', 'female') THEN
    SELECT * INTO v_prof FROM public.profiles WHERE id = v_member;
    IF v_prof.gender IS NULL THEN
      RAISE EXCEPTION 'Add your gender to your profile to join this game';
    END IF;
    IF v_prof.gender <> v_game.gender THEN
      RAISE EXCEPTION 'This game is for % players only', v_game.gender;
    END IF;
  END IF;

  -- Age criteria.
  IF v_game.min_age IS NOT NULL OR v_game.max_age IS NOT NULL THEN
    IF v_prof.id IS NULL THEN
      SELECT * INTO v_prof FROM public.profiles WHERE id = v_member;
    END IF;
    IF v_prof.birth_date IS NULL THEN
      RAISE EXCEPTION 'Add your birth date to your profile to join this game';
    END IF;
    v_age := date_part('year', age(current_date, v_prof.birth_date))::INTEGER;
    IF v_game.min_age IS NOT NULL AND v_age < v_game.min_age THEN
      RAISE EXCEPTION 'This game is for ages % and up', v_game.min_age;
    END IF;
    IF v_game.max_age IS NOT NULL AND v_age > v_game.max_age THEN
      RAISE EXCEPTION 'This game is for ages up to %', v_game.max_age;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
  IF v_count >= v_game.max_players THEN
    RAISE EXCEPTION 'This game is full';
  END IF;

  INSERT INTO public.friendly_game_participants (game_id, member_id, role)
  VALUES (p_game_id, v_member, 'player');

  -- Tell the organizer someone joined (unless it's their own game).
  IF v_game.creator_id <> v_member THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.creator_id,
      'game_join',
      'Someone joined your game',
      (SELECT name FROM public.profiles WHERE id = v_member) || ' joined ' || btrim(v_game.title) || '.',
      '/games'
    );
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
  IF v_count >= v_game.max_players AND v_game.status = 'open' THEN
    UPDATE public.friendly_games SET status = 'full' WHERE id = p_game_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.creator_id,
      'game_filled',
      'Your game is full',
      btrim(v_game.title) || ' just filled up — get ready to play!',
      '/games'
    );
  END IF;

  RETURN p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_friendly_game(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_friendly_game(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_game   friendly_games;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- The organizer quitting cancels the game (no ownership transfer) and
  -- everyone who signed up gets a notification.
  IF v_game.creator_id = v_member THEN
    UPDATE public.friendly_games SET status = 'cancelled' WHERE id = p_game_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    SELECT
      member_id,
      'game_cancelled',
      'Game cancelled',
      btrim(v_game.title) || ' was cancelled by the organizer.',
      '/community'
    FROM public.friendly_game_participants WHERE game_id = p_game_id;
    RETURN;
  END IF;

  DELETE FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND member_id = v_member;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_game.creator_id,
    'game_left',
    'Someone left your game',
    (SELECT name FROM public.profiles WHERE id = v_member) || ' left ' || btrim(v_game.title) || '.',
    '/community'
  );

  IF v_game.status = 'full' THEN
    UPDATE public.friendly_games SET status = 'open' WHERE id = p_game_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_friendly_game(UUID) TO authenticated;

-- Realtime for the community so games load without a page refresh.
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friendly_games;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friendly_game_participants;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END
$$;

-- ────────────────────────────────────────────────────────────
-- 7.6 GEO LOCATIONS
-- lat/lng let members find the nearest academy/playground and
-- let tenants pin their location on the map.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- ────────────────────────────────────────────────────────────
-- 7.7 GOOGLE-MAPS-STYLE LOCATION PINS
-- Members can pin their own location; friendly games get a pin.
-- (profiles.lat / lng are declared above, next to the community view.)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.friendly_games ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.friendly_games ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- ────────────────────────────────────────────────────────────
-- 8. ENGAGEMENT, SCORES & TRUST
-- Recurring games, scores/results, notifications, skill profile +
-- matchmaking alerts, community reports/blocks, housekeeping job.
-- ────────────────────────────────────────────────────────────

-- 8.1 friendly_games: recurrence + results
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS recurrence TEXT CHECK (recurrence IN ('weekly')),
  ADD COLUMN IF NOT EXISTS source_game_id UUID REFERENCES public.friendly_games(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS result_a INTEGER,
  ADD COLUMN IF NOT EXISTS result_b INTEGER,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_friendly_games_source ON public.friendly_games(source_game_id);

-- Participants flagged when a game was already full (waitlist seats).
ALTER TABLE public.friendly_game_participants
  ADD COLUMN IF NOT EXISTS is_waitlisted BOOLEAN NOT NULL DEFAULT FALSE;

-- 8.2 Member skill profile (used by the matchmaker + game alerts).
-- The columns themselves (skill_level, position, availability_days,
-- interested_sports, notify_game_alerts) are declared in section 7 next to
-- the community_members view, which needs them at creation time.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skill_level TEXT CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS availability_days INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS interested_sports TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notify_game_alerts BOOLEAN NOT NULL DEFAULT FALSE;

-- 8.3 Notifications (in-app). Recipients always own their own rows; RPCs
-- (SECURITY DEFINER) can also write on behalf of other members.
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON public.notifications(recipient_id, is_read, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notifications own read" ON public.notifications;
CREATE POLICY "Notifications own read" ON public.notifications
  FOR SELECT TO authenticated USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "Notifications own insert" ON public.notifications;
CREATE POLICY "Notifications own insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (recipient_id = auth.uid());
DROP POLICY IF EXISTS "Notifications own update" ON public.notifications;
CREATE POLICY "Notifications own update" ON public.notifications
  FOR UPDATE TO authenticated USING (recipient_id = auth.uid());
DROP POLICY IF EXISTS "Notifications own delete" ON public.notifications;
CREATE POLICY "Notifications own delete" ON public.notifications
  FOR DELETE TO authenticated USING (recipient_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 8.4 Community trust: reports (moderated by platform admins) + member blocks.

-- One source of truth for "is this user a platform super admin". The role
-- travels in the JWT's app_metadata (see src/lib/session.ts). We also accept
-- profiles.role = 'super_admin' so legacy rows keep working on older databases.
-- Defined here (before the reports policies below use it); sections 8.5+ reuse it.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'role',
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  ) = 'super_admin';
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('member', 'game')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status, created_at DESC);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reports reporter create" ON public.reports;
CREATE POLICY "Reports reporter create" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS "Reports super admin read" ON public.reports;
CREATE POLICY "Reports super admin read" ON public.reports
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
DROP POLICY IF EXISTS "Reports super admin update" ON public.reports;
CREATE POLICY "Reports super admin update" ON public.reports
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (status IN ('open', 'resolved', 'dismissed'));

CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Blocks own read" ON public.blocks;
CREATE POLICY "Blocks own read" ON public.blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid() OR blocked_id = auth.uid());
DROP POLICY IF EXISTS "Blocks own insert" ON public.blocks;
CREATE POLICY "Blocks own insert" ON public.blocks
  FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
DROP POLICY IF EXISTS "Blocks own delete" ON public.blocks;
CREATE POLICY "Blocks own delete" ON public.blocks
  FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- 8.5 ── RPCs ──

-- Cancel a game as its organizer (with participant notifications).
CREATE OR REPLACE FUNCTION public.cancel_friendly_game(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_game   friendly_games;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF v_game.creator_id <> v_member THEN
    RAISE EXCEPTION 'Only the organizer can cancel this game';
  END IF;

  IF v_game.status = 'cancelled' THEN RETURN; END IF;
  UPDATE public.friendly_games SET status = 'cancelled' WHERE id = p_game_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT
    member_id,
    'game_cancelled',
    'Game cancelled',
    btrim(v_game.title) || ' was cancelled by the organizer.',
    '/community'
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_friendly_game(UUID) TO authenticated;

-- Materialize weekly-friendly-game instances (lazy, idempotent). Called on
-- every community load so a "weekly" game behaves like a true series without
-- needing a cron daemon. Copies the organizer + previous occurrence's crew.
DO $fn$
BEGIN
DROP FUNCTION IF EXISTS public.materialize_recurring_games();
END $fn$;
CREATE OR REPLACE FUNCTION public.materialize_recurring_games()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent    public.friendly_games%ROWTYPE;
  v_dt        DATE;
  v_new_id    UUID;
  v_anchor    UUID;
  v_created   INTEGER := 0;
  v_horizon   DATE := CURRENT_DATE + 56;
BEGIN
  FOR v_parent IN
    SELECT fg.* FROM public.friendly_games fg
    WHERE fg.recurrence = 'weekly'
      AND fg.source_game_id IS NULL
      AND fg.status IN ('open', 'full')
  LOOP
    v_dt := v_parent.game_date + 1;
    -- Fill any missed slots between today and the horizon.
    IF v_dt < CURRENT_DATE THEN v_dt := CURRENT_DATE; END IF;
    WHILE v_dt <= v_horizon LOOP
      IF date_part('isodow', v_dt) = date_part('isodow', v_parent.game_date)
         AND NOT EXISTS (
           SELECT 1 FROM public.friendly_games f
           WHERE f.source_game_id = v_parent.id AND f.game_date = v_dt
         )
      THEN
        INSERT INTO public.friendly_games
          (creator_id, creator_name, sport, title, description, area, location,
           lat, lng, game_date, start_time, max_players, skill_level, is_public,
           status, source_game_id, recurrence)
        VALUES
          (v_parent.creator_id, v_parent.creator_name, v_parent.sport,
           v_parent.title, v_parent.description, v_parent.area, v_parent.location,
           v_parent.lat, v_parent.lng, v_dt, v_parent.start_time,
           v_parent.max_players, v_parent.skill_level, v_parent.is_public,
           'open', v_parent.id, 'weekly')
        RETURNING id INTO v_new_id;

        -- Carry the roster over from the most recent past occurrence.
        SELECT MAX(f2.id) INTO v_anchor
        FROM public.friendly_games f2
        WHERE (f2.source_game_id = v_parent.id OR f2.id = v_parent.id)
          AND f2.game_date < v_dt AND f2.status <> 'cancelled';
        IF v_anchor IS NOT NULL THEN
          INSERT INTO public.friendly_game_participants (game_id, member_id, role)
          SELECT v_new_id, member_id, role
          FROM public.friendly_game_participants
          WHERE game_id = v_anchor
          ON CONFLICT DO NOTHING;
        END IF;

        v_created := v_created + 1;
      END IF;
      v_dt := v_dt + 1;
    END LOOP;
  END LOOP;
  RETURN v_created;
END;
$$;
GRANT EXECUTE ON FUNCTION public.materialize_recurring_games() TO authenticated;

-- Stop a weekly series: clears recurrence on the parent and cancels all future
-- child instances so no more weekly games are materialized. Organizer only.
CREATE OR REPLACE FUNCTION public.stop_recurring_game(p_parent_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.friendly_games
    WHERE id = p_parent_id AND creator_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the organizer can stop this series';
  END IF;
  -- Demote the parent to a one-off game.
  UPDATE public.friendly_games
    SET recurrence = NULL
  WHERE id = p_parent_id;
  -- Cancel future child instances (those not yet past).
  UPDATE public.friendly_games
    SET status = 'cancelled'
  WHERE source_game_id = p_parent_id
    AND game_date > CURRENT_DATE
    AND status IN ('open', 'full');
END;
$$;
GRANT EXECUTE ON FUNCTION public.stop_recurring_game(UUID) TO authenticated;

-- Organizer submits the final score; participants get notified.
CREATE OR REPLACE FUNCTION public.submit_game_score(
  p_game_id UUID,
  p_result_a INTEGER,
  p_result_b INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_game   friendly_games;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF v_game.creator_id <> v_member THEN
    RAISE EXCEPTION 'Only the organizer can submit the score';
  END IF;
  IF v_game.status = 'cancelled' THEN
    RAISE EXCEPTION 'This game was cancelled';
  END IF;
  IF p_result_a IS NULL OR p_result_b IS NULL OR p_result_a < 0 OR p_result_b < 0 THEN
    RAISE EXCEPTION 'Invalid score';
  END IF;

  UPDATE public.friendly_games
  SET status = 'completed',
      result_a = p_result_a,
      result_b = p_result_b,
      completed_by = v_member,
      completed_at = NOW()
  WHERE id = p_game_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT
    DISTINCT member_id,
    'game_result',
    'Score submitted',
    btrim(v_game.title) || ': ' || p_result_a || ' – ' || p_result_b,
    '/community'
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_game_score(UUID, INTEGER, INTEGER) TO authenticated;

-- Mark notifications (all or a subset) as read.
CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids UUID[] DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) = 0 THEN
    UPDATE public.notifications SET is_read = TRUE WHERE recipient_id = v_member;
  ELSE
    UPDATE public.notifications SET is_read = TRUE
    WHERE recipient_id = v_member AND id = ANY(p_ids);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(UUID[]) TO authenticated;

-- Report a member or a game to the moderation queue.
CREATE OR REPLACE FUNCTION public.file_report(
  p_target_type TEXT,
  p_target_id   TEXT,
  p_reason      TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_id     UUID;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_target_type NOT IN ('member', 'game') THEN
    RAISE EXCEPTION 'Invalid target type';
  END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Please add a reason';
  END IF;
  IF p_target_type = 'member' AND v_member::TEXT = p_target_id THEN
    RAISE EXCEPTION 'You cannot report yourself';
  END IF;
  IF p_target_type = 'game' AND EXISTS (
    SELECT 1 FROM public.friendly_games WHERE id = p_target_id::UUID AND creator_id = v_member
  ) THEN
    RAISE EXCEPTION 'You cannot report your own game';
  END IF;

  INSERT INTO public.reports (reporter_id, target_type, target_id, reason)
  VALUES (v_member, p_target_type, p_target_id, left(btrim(p_reason), 500))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.file_report(TEXT, TEXT, TEXT) TO authenticated;

-- Platform admins resolve/dismiss a report.
CREATE OR REPLACE FUNCTION public.resolve_report(p_report_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_status NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.reports SET status = p_status WHERE id = p_report_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_report(UUID, TEXT) TO authenticated;

-- Block (and unblock) a member so their games don't surface for you.
CREATE OR REPLACE FUNCTION public.block_member(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_member_id = auth.uid() THEN RAISE EXCEPTION 'You cannot block yourself'; END IF;
  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_member_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.block_member(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.unblock_member(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.blocks
  WHERE blocker_id = auth.uid() AND blocked_id = p_member_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.unblock_member(UUID) TO authenticated;

-- 8.6 Realtime for notifications.
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END
$$;

-- 8.7 Daily housekeeping via pg_cron (idempotent): auto-complete stale games.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_class WHERE relname = 'job') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'volley-daily-housekeeping') THEN
      PERFORM cron.unschedule('volley-daily-housekeeping');
    END IF;
    PERFORM cron.schedule('volley-daily-housekeeping', '0 3 * * *', $job$
      UPDATE public.friendly_games SET status = 'completed'
      WHERE status IN ('open', 'full') AND game_date < CURRENT_DATE;
    $job$);
  END IF;
END
$do$;

-- ────────────────────────────────────────────────────────────
-- 8.8 WEB PUSH NOTIFICATIONS
-- push_subscriptions stores each browser's push endpoint. The browser calls
-- the RPCs to add/remove its subscription. When a notification row is
-- inserted, a pg_net hook forwards it to the Edge Function
-- "notify-push", which fans it out with the Web Push protocol (VAPID).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Push subs own select" ON public.push_subscriptions;
CREATE POLICY "Push subs own select" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Push subs own insert" ON public.push_subscriptions;
CREATE POLICY "Push subs own insert" ON public.push_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Push subs own delete" ON public.push_subscriptions;
CREATE POLICY "Push subs own delete" ON public.push_subscriptions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Upsert a browser push subscription for the current user.
-- The RPC (SECURITY DEFINER) reads the raw subscription from the HTTP client.
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, NULL)
  ON CONFLICT (endpoint)
  DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_push_subscription(p_endpoint TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  DELETE FROM public.push_subscriptions
  WHERE user_id = auth.uid() AND endpoint = p_endpoint;
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_push_subscription(TEXT) TO authenticated;

-- Deliver new notifications to the recipient's subscribed devices via the
-- Edge Function "notify-push" (deployed separately, see supabase/functions/).
-- Requires the pg_net extension. The function URL and auth header use only
-- non-secret values (public anon key). If services are missing we skip
-- silently and in-app notifications still work.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE OR REPLACE FUNCTION public.notify_push_forward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Non-secret constants. Replace with this project's own values if re-run
  -- against a different project (function URL + anon/publishable key).
  v_functions_url TEXT := 'https://wknaiyouwjobmzzjoutz.supabase.co/functions/v1';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrbmFpeW91d2pvYm16empvdXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1Mjc1ODYsImV4cCI6MjEwMjEwMzU4Nn0.oNl-1ctScgybJWMwrQSmJrOvLLhkYJ9zO0E_mwWeaB0';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url := v_functions_url || '/notify-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'recipient_id', NEW.recipient_id::text,
        'title', NEW.title,
        'body', NEW.body,
        'link', NEW.link,
        'type', NEW.type
      ),
      timeout_milliseconds := 5000
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_push_on_insert ON public.notifications;
CREATE TRIGGER notify_push_on_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_forward();

-- ────────────────────────────────────────────────────────────
-- 8.9 SUPER ADMIN, PLANS, FEE REVIEW & LEADERBOARD
-- ────────────────────────────────────────────────────────────

-- public.is_super_admin() is defined in section 8.4 (before the reports
-- policies that use it). CREATE OR REPLACE keeps this safe to re-run.

-- Super admins may inspect every community game (any fee status), not just the
-- public ones or their own.
DROP POLICY IF EXISTS "Community games super admin read" ON public.friendly_games;
CREATE POLICY "Community games super admin read" ON public.friendly_games
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- Super admins can open the (private) fee-receipt files themselves.
DROP POLICY IF EXISTS "Game fee receipts: super admin read" ON storage.objects;
CREATE POLICY "Game fee receipts: super admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'game-fee-receipts'
    AND public.is_super_admin()
  );

-- Super-admin reviews the receipt uploaded for a friendly game: approving sets
-- creation_fee_paid = TRUE; rejecting marks the fee rejected and cancels the
-- game (same rule as plan subscriptions — the game went live immediately, so a
-- fake payment cancels it). Both the organizer and players are notified.
CREATE OR REPLACE FUNCTION public.review_game_fee(p_game_id UUID, p_approve BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game friendly_games;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF p_approve THEN
    UPDATE public.friendly_games
    SET fee_status = 'approved', creation_fee_paid = TRUE
    WHERE id = p_game_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.creator_id,
      'game_fee_reviewed',
      'Game fee approved',
      'The ' || btrim(v_game.title) || ' creation fee was verified.',
      '/games'
    );
  ELSE
    -- Fake / unverified payment: cancel the game and tell everyone.
    UPDATE public.friendly_games
    SET fee_status = 'rejected', creation_fee_paid = FALSE, status = 'cancelled'
    WHERE id = p_game_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    SELECT
      member_id,
      'game_fee_reviewed',
      'Game cancelled — payment not verified',
      btrim(v_game.title) ||
        ' was cancelled because the creation fee could not be verified.',
      '/games'
    FROM public.friendly_game_participants WHERE game_id = p_game_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_game_fee(UUID, BOOLEAN) TO authenticated;

-- ── Academy subscription plan ──
-- Display-only before; now real: the super admin assigns a plan and the
-- database enforces its limits (venues / coaches / marketplace publishing).
ALTER TABLE public.academies
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'starter'
  CHECK (plan IN ('starter', 'plus', 'elite'));

-- Super admins see and manage every academy (list, trial, plans).
DROP POLICY IF EXISTS "Academies super admin read" ON public.academies;
CREATE POLICY "Academies super admin read" ON public.academies
  FOR SELECT TO authenticated USING (public.is_super_admin());
DROP POLICY IF EXISTS "Academies super admin update" ON public.academies;
CREATE POLICY "Academies super admin update" ON public.academies
  FOR UPDATE TO authenticated USING (public.is_super_admin());

-- Assign/change an academy's plan (super admin only).
CREATE OR REPLACE FUNCTION public.set_academy_plan(p_academy_id UUID, p_plan TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_plan NOT IN ('starter', 'plus', 'elite') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;
  UPDATE public.academies SET plan = p_plan WHERE id = p_academy_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_academy_plan(UUID, TEXT) TO authenticated;

-- Plan limits: Starter = 1 venue, Plus = 3, Elite = unlimited.
CREATE OR REPLACE FUNCTION public.guard_venue_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.academies WHERE id = NEW.academy_id;
  IF v_plan = 'starter' THEN v_limit := 1;
  ELSIF v_plan = 'plus' THEN v_limit := 3;
  ELSE RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.venues WHERE academy_id = NEW.academy_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Your plan allows only % venue(s). Upgrade to add more.', v_limit;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_venue_limit_on_insert ON public.venues;
CREATE TRIGGER guard_venue_limit_on_insert
  BEFORE INSERT ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.guard_venue_limit();

-- Plan limits: Starter = 1 coach, Plus/Elite = unlimited.
CREATE OR REPLACE FUNCTION public.guard_coach_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.academies WHERE id = NEW.academy_id;
  IF v_plan <> 'starter' THEN RETURN NEW; END IF;
  SELECT count(*) INTO v_count FROM public.coaches WHERE academy_id = NEW.academy_id;
  IF v_count >= 1 THEN
    RAISE EXCEPTION 'Your plan allows only 1 coach. Upgrade to add more.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_coach_limit_on_insert ON public.coaches;
CREATE TRIGGER guard_coach_limit_on_insert
  BEFORE INSERT ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION public.guard_coach_limit();

-- Marketplace publishing (session_booking_enabled) is an Elite-only feature.
CREATE OR REPLACE FUNCTION public.guard_session_booking_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_booking_enabled AND COALESCE(NEW.plan, 'starter') <> 'elite' THEN
    RAISE EXCEPTION 'Marketplace publishing requires the Elite plan.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_session_booking_plan ON public.academies;
CREATE TRIGGER guard_session_booking_plan
  BEFORE INSERT OR UPDATE OF session_booking_enabled, plan ON public.academies
  FOR EACH ROW EXECUTE FUNCTION public.guard_session_booking_plan();

-- ────────────────────────────────────────────────────────────
-- Plan subscription purchases (member Pro + academy Plus/Elite)
--
-- Users pay through one of three methods:
--   1. Instapay link  https://ipn.eg/S/jimmydodo3/instapay/45APuk
--   2. E-wallet       01023862436
--   3. Kashier gateway (details to follow — not wired yet)
--
-- Instapay & e-wallet require the payer to upload a screenshot of the
-- transfer. The subscription activates immediately; the receipt is then
-- verified by a team member (super admin). If the payment screenshot cannot
-- be verified, the subscription is cancelled (member reverts to free,
-- academy reverts to starter) and the user is notified.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  academy_id     UUID REFERENCES public.academies(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL CHECK (kind IN ('member', 'academy')),
  plan           TEXT NOT NULL CHECK (plan IN ('pro', 'plus', 'elite')),
  billing_cycle  TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'semi', 'yearly')),
  amount         NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  method         TEXT NOT NULL CHECK (method IN ('instapay', 'e_wallet', 'kashier')),
  receipt_url    TEXT,
  receipt_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (receipt_status IN ('pending', 'verified', 'rejected')),
  reviewed_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_user
  ON public.plan_subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_subscriptions_review
  ON public.plan_subscriptions(receipt_status, created_at DESC);

ALTER TABLE public.plan_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plan subs own select" ON public.plan_subscriptions;
CREATE POLICY "Plan subs own select" ON public.plan_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Plan subs own insert" ON public.plan_subscriptions;
CREATE POLICY "Plan subs own insert" ON public.plan_subscriptions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Plan subs super admin all" ON public.plan_subscriptions;
CREATE POLICY "Plan subs super admin all" ON public.plan_subscriptions
  FOR ALL TO authenticated USING (public.is_super_admin());

-- Storage bucket for subscription payment screenshots (private, like game fees).
INSERT INTO storage.buckets (id, name, public)
VALUES ('subscription-receipts', 'subscription-receipts', FALSE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Subscription receipts: upload own" ON storage.objects;
CREATE POLICY "Subscription receipts: upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'subscription-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Subscription receipts: read own" ON storage.objects;
CREATE POLICY "Subscription receipts: read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'subscription-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Subscription receipts: super admin read" ON storage.objects;
CREATE POLICY "Subscription receipts: super admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'subscription-receipts'
    AND public.is_super_admin()
  );

-- Prices are fixed server-side so the client can't underpay.
CREATE OR REPLACE FUNCTION public.plan_price(
  p_kind TEXT,
  p_plan TEXT,
  p_cycle TEXT
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_kind = 'member' AND p_plan = 'pro' THEN
      CASE p_cycle WHEN 'monthly' THEN 100 WHEN 'semi' THEN 500 WHEN 'yearly' THEN 1000 END
    WHEN p_kind = 'academy' AND p_plan = 'plus' THEN
      CASE p_cycle WHEN 'monthly' THEN 200 WHEN 'yearly' THEN 2100 END
    WHEN p_kind = 'academy' AND p_plan = 'elite' THEN
      CASE p_cycle WHEN 'monthly' THEN 350 WHEN 'yearly' THEN 3800 END
    ELSE NULL
  END
$$;
GRANT EXECUTE ON FUNCTION public.plan_price(TEXT, TEXT, TEXT) TO authenticated;

-- Purchase a plan subscription: activates the plan immediately and queues the
-- payment screenshot (instapay / e-wallet) for verification.
CREATE OR REPLACE FUNCTION public.purchase_plan_subscription(
  p_kind          TEXT,
  p_plan          TEXT,
  p_billing_cycle TEXT,
  p_method        TEXT,
  p_receipt_url   TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_amount   NUMERIC;
  v_months   INTEGER;
  v_academy  UUID;
  v_receipt  TEXT;
  v_sub_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_kind NOT IN ('member', 'academy') OR p_plan NOT IN ('pro', 'plus', 'elite') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;
  IF p_kind = 'member' AND p_plan <> 'pro' THEN
    RAISE EXCEPTION 'Invalid member plan';
  END IF;
  IF p_kind = 'academy' AND p_plan = 'pro' THEN
    RAISE EXCEPTION 'Invalid academy plan';
  END IF;
  IF p_method NOT IN ('instapay', 'e_wallet', 'kashier') THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF p_method = 'kashier' THEN
    RAISE EXCEPTION 'Kashier gateway is not available yet';
  END IF;

  v_amount := public.plan_price(p_kind, p_plan, p_billing_cycle);
  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'Invalid billing cycle';
  END IF;
  v_months := CASE p_billing_cycle WHEN 'monthly' THEN 1 WHEN 'semi' THEN 6 WHEN 'yearly' THEN 12 END;

  -- Screenshot methods must come with a receipt to verify later.
  v_receipt := NULLIF(btrim(coalesce(p_receipt_url, '')), '');
  IF v_receipt IS NULL THEN
    RAISE EXCEPTION 'A payment screenshot is required for this method';
  END IF;

  IF p_kind = 'academy' THEN
    SELECT academy_id INTO v_academy FROM public.profiles WHERE id = v_uid AND role = 'admin';
    IF v_academy IS NULL THEN
      RAISE EXCEPTION 'Only an academy admin can subscribe for an academy';
    END IF;
  END IF;

  INSERT INTO public.plan_subscriptions
    (user_id, academy_id, kind, plan, billing_cycle, amount, method, receipt_url, receipt_status)
  VALUES
    (v_uid, v_academy, p_kind, p_plan, p_billing_cycle, v_amount, p_method, v_receipt, 'pending')
  RETURNING id INTO v_sub_id;

  IF p_kind = 'member' THEN
    -- Activate premium and extend expiry.
    UPDATE public.profiles
    SET member_plan = 'premium',
        premium_expires_at = GREATEST(
          COALESCE(premium_expires_at, NOW()),
          NOW()
        ) + make_interval(months => v_months)
    WHERE id = v_uid;

    -- Record in the academy payments ledger (mapped to the payments.method CHECK).
    BEGIN
      INSERT INTO public.payments
        (member_id, academy_id, amount, payment_date, method, subscription_sessions, notes)
      VALUES
        (v_uid,
         (SELECT academy_id FROM public.profiles WHERE id = v_uid),
         v_amount,
         NOW()::DATE,
         CASE p_method WHEN 'instapay' THEN 'bank_transfer' WHEN 'e_wallet' THEN 'wallet' ELSE 'card' END,
         8,
         'Member Pro subscription (' || p_billing_cycle || ')');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- no academy attached: Pro benefit still granted, ledger not tracked
    END;
  ELSE
    -- Activate the academy plan now (also converts any unpaid trial to paid).
    UPDATE public.academies
    SET plan = p_plan,
        is_trial = FALSE,
        trial_ends_at = NULL
    WHERE id = v_academy;
  END IF;

  RETURN v_sub_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.purchase_plan_subscription(
  TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- Super admin verifies (or rejects) a payment screenshot. Rejecting cancels the
-- granted subscription and notifies the buyer.
CREATE OR REPLACE FUNCTION public.review_subscription_receipt(
  p_subscription_id UUID,
  p_approve BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_uid UUID := auth.uid();
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_sub FROM public.plan_subscriptions WHERE id = p_subscription_id;
  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'Subscription not found';
  END IF;
  IF v_sub.receipt_status <> 'pending' THEN
    RAISE EXCEPTION 'Subscription already reviewed';
  END IF;

  IF p_approve THEN
    UPDATE public.plan_subscriptions
    SET receipt_status = 'verified', reviewed_by = v_uid, reviewed_at = NOW()
    WHERE id = p_subscription_id;

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_sub.user_id,
      'subscription_verified',
      'Payment verified',
      'Your subscription payment was confirmed. Thanks!',
      '/checkout'
    );
  ELSE
    UPDATE public.plan_subscriptions
    SET receipt_status = 'rejected', reviewed_by = v_uid, reviewed_at = NOW()
    WHERE id = p_subscription_id;

    -- Cancel the granted subscription.
    IF v_sub.kind = 'member' THEN
      UPDATE public.profiles
      SET member_plan = 'free', premium_expires_at = NULL
      WHERE id = v_sub.user_id AND member_plan = 'premium';
    ELSE
      UPDATE public.academies
      SET plan = 'starter'
      WHERE id = v_sub.academy_id AND plan <> 'starter';
    END IF;

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_sub.user_id,
      'subscription_rejected',
      'Subscription cancelled',
      'Your subscription was cancelled because we could not verify your payment screenshot.',
      '/checkout'
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_subscription_receipt(UUID, BOOLEAN) TO authenticated;

-- ── Community leaderboard ──
-- Points = 2 per completed friendly game + 1 per attended session. Only
-- community-visible members rank. The plain view runs with owner privileges,
-- so it can aggregate across academies/RLS for this public ranking.
DROP VIEW IF EXISTS public.community_leaderboard;
CREATE VIEW public.community_leaderboard AS
WITH played AS (
  SELECT p.member_id, count(*)::int AS games_played
  FROM public.friendly_game_participants p
  JOIN public.friendly_games g ON g.id = p.game_id
  WHERE g.status = 'completed'
  GROUP BY p.member_id
),
attend AS (
  SELECT a.member_id, count(*)::int AS sessions_attended
  FROM public.attendance a
  GROUP BY a.member_id
)
SELECT
  pr.id AS member_id,
  pr.name,
  COALESCE(played.games_played, 0) AS games_played,
  COALESCE(attend.sessions_attended, 0) AS sessions_attended,
  COALESCE(played.games_played, 0) * 2 + COALESCE(attend.sessions_attended, 0) AS points
FROM public.profiles pr
LEFT JOIN played ON played.member_id = pr.id
LEFT JOIN attend ON attend.member_id = pr.id
WHERE pr.name IS NOT NULL
  AND pr.community_visible = TRUE
ORDER BY points DESC;
GRANT SELECT ON public.community_leaderboard TO authenticated;

-- ── Scouting: player shortlist ──
-- A member can "note" players they want to scout; the note is private.
CREATE TABLE IF NOT EXISTS public.scout_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scout_id, player_id)
);
CREATE INDEX IF NOT EXISTS idx_scout_notes_scout ON public.scout_notes(scout_id);
CREATE INDEX IF NOT EXISTS idx_scout_notes_player ON public.scout_notes(player_id);
ALTER TABLE public.scout_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Scout notes own select" ON public.scout_notes;
CREATE POLICY "Scout notes own select" ON public.scout_notes
  FOR SELECT TO authenticated USING (scout_id = auth.uid());
DROP POLICY IF EXISTS "Scout notes own insert" ON public.scout_notes;
CREATE POLICY "Scout notes own insert" ON public.scout_notes
  FOR INSERT TO authenticated WITH CHECK (scout_id = auth.uid());
DROP POLICY IF EXISTS "Scout notes own delete" ON public.scout_notes;
CREATE POLICY "Scout notes own delete" ON public.scout_notes
  FOR DELETE TO authenticated USING (scout_id = auth.uid());

CREATE OR REPLACE FUNCTION public.toggle_scout_note(p_player_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existed BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_player_id = auth.uid() THEN RAISE EXCEPTION 'You cannot scout yourself'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.scout_notes
    WHERE scout_id = auth.uid() AND player_id = p_player_id
  ) INTO v_existed;
  IF v_existed THEN
    DELETE FROM public.scout_notes
    WHERE scout_id = auth.uid() AND player_id = p_player_id;
  ELSE
    INSERT INTO public.scout_notes (scout_id, player_id)
    VALUES (auth.uid(), p_player_id);
  END IF;
  RETURN NOT v_existed;
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_scout_note(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 8.10 ACCOUNT DELETION
-- ────────────────────────────────────────────────────────────

-- Users can erase their own account (profile + auth row + every personal
-- record). Academy admins additionally delete the academy they run and
-- everything under it (all child tables ON DELETE CASCADE from academies).
-- Runs as SECURITY DEFINER so the caller can remove their auth.users row.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_academy UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, COALESCE(academy_id, public.current_academy_id())
    INTO v_role, v_academy
    FROM public.profiles
    WHERE id = v_uid;

  -- Remove subscription payment screenshots uploaded by this user.
  DELETE FROM storage.objects
  WHERE bucket_id = 'subscription-receipts'
    AND (storage.foldername(name))[1] = v_uid::text;

  IF v_role = 'admin' AND v_academy IS NOT NULL THEN
    -- Remove fee-receipt files the admin uploaded (subfolder = their uid).
    DELETE FROM storage.objects
    WHERE bucket_id = 'game-fee-receipts'
      AND (storage.foldername(name))[1] = v_uid::text;
    -- Cascades to branches, venues, coaches, members, sessions, payments…
    DELETE FROM public.academies WHERE id = v_academy;
  END IF;

  -- Cascades to the profile and every member record created by this user.
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
-- Platform administration is tied to a verified Auth email, not profile roles.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()
    AND lower(email) = 'mo.dowaik@gmail.com' AND email_confirmed_at IS NOT NULL
    AND (banned_until IS NULL OR banned_until <= now()));
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_account_blocked()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND banned_until > now());
$$;
REVOKE ALL ON FUNCTION public.is_account_blocked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_blocked() TO authenticated;

-- Restrictive policies also deny direct database access with an unexpired JWT.
DO $$
DECLARE target record;
BEGIN
  FOR target IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Blocked accounts denied" ON public.%I', target.tablename);
    EXECUTE format('CREATE POLICY "Blocked accounts denied" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT (SELECT public.is_account_blocked())) WITH CHECK (NOT (SELECT public.is_account_blocked()))', target.tablename);
  END LOOP;
END $$;

-- PostgREST runs this before RPCs as well as table requests, including definer RPCs.
CREATE OR REPLACE FUNCTION public.check_account_access()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.is_account_blocked() THEN
    RAISE EXCEPTION 'Account is blocked' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.check_account_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_account_access() TO anon, authenticated, service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.check_account_access';
NOTIFY pgrst, 'reload config';

DROP POLICY IF EXISTS "Blocked accounts denied" ON storage.objects;
CREATE POLICY "Blocked accounts denied" ON storage.objects AS RESTRICTIVE
FOR ALL TO authenticated
USING (NOT (SELECT public.is_account_blocked()))
WITH CHECK (NOT (SELECT public.is_account_blocked()));

-- ────────────────────────────────────────────────────────────
-- 8.12 PLATFORM ANALYTICS (super admin dashboard)
-- ────────────────────────────────────────────────────────────

-- One-shot aggregates for the super-admin dashboard. SECURITY DEFINER so it
-- can read every tenant's rows; the is_super_admin() guard keeps it private.
-- Game-creation fee amounts are intentionally NOT summed here — the client
-- multiplies the approved-game count by GAME_CREATION_FEE (sole source of
-- truth in src/lib/constants.ts).
CREATE OR REPLACE FUNCTION public.super_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT jsonb_build_object(
    'members', jsonb_build_object(
      'total',        (SELECT count(*)                 FROM public.profiles),
      'members',      (SELECT count(*)                 FROM public.profiles WHERE role = 'member'),
      'admins',       (SELECT count(*)                 FROM public.profiles WHERE role = 'admin'),
      'by_month', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', m, 'count', c) ORDER BY m)
        FROM (SELECT to_char(created_at, 'YYYY-MM') AS m, count(*) AS c
              FROM public.profiles GROUP BY 1) s), '[]'::jsonb)
    ),
    'games', jsonb_build_object(
      'total',    (SELECT count(*) FROM public.friendly_games),
      'approved', (SELECT count(*) FROM public.friendly_games WHERE creation_fee_paid),
      'by_month', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', m, 'count', c) ORDER BY m)
        FROM (SELECT to_char(created_at, 'YYYY-MM') AS m, count(*) AS c
              FROM public.friendly_games GROUP BY 1) s), '[]'::jsonb),
      'by_sport', COALESCE((SELECT jsonb_agg(jsonb_build_object('sport', sport, 'count', c) ORDER BY c DESC)
        FROM (SELECT sport, count(*) AS c FROM public.friendly_games GROUP BY 1) s), '[]'::jsonb),
      'by_status', COALESCE((SELECT jsonb_agg(jsonb_build_object('status', status, 'count', c))
        FROM (SELECT status, count(*) AS c FROM public.friendly_games GROUP BY 1) s), '[]'::jsonb)
    ),
    'academies', jsonb_build_object(
      'total',  (SELECT count(*) FROM public.academies),
      'trials', (SELECT count(*) FROM public.academies WHERE is_trial),
      'paid',   (SELECT count(*) FROM public.academies WHERE NOT is_trial),
      'by_plan', jsonb_build_object(
        'starter', (SELECT count(*) FROM public.academies WHERE plan = 'starter'),
        'plus',    (SELECT count(*) FROM public.academies WHERE plan = 'plus'),
        'elite',   (SELECT count(*) FROM public.academies WHERE plan = 'elite')
      ),
      'by_month', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', m, 'count', c) ORDER BY m)
        FROM (SELECT to_char(created_at, 'YYYY-MM') AS m, count(*) AS c
              FROM public.academies GROUP BY 1) s), '[]'::jsonb)
    ),
    'fees', jsonb_build_object(
      'session_total', COALESCE((SELECT sum(platform_fee) FROM public.session_bookings WHERE status <> 'cancelled'), 0),
      'session_count', (SELECT count(*) FROM public.session_bookings WHERE status <> 'cancelled'),
      'session_by_month', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', m, 'total', t, 'count', c) ORDER BY m)
        FROM (SELECT to_char(booked_at, 'YYYY-MM') AS m, sum(platform_fee) AS t, count(*) AS c
              FROM public.session_bookings WHERE status <> 'cancelled' GROUP BY 1) s), '[]'::jsonb),
      'game_count', (SELECT count(*) FROM public.friendly_games WHERE creation_fee_paid),
      'game_by_month', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', m, 'count', c) ORDER BY m)
        FROM (SELECT to_char(created_at, 'YYYY-MM') AS m, count(*) AS c
              FROM public.friendly_games WHERE creation_fee_paid GROUP BY 1) s), '[]'::jsonb),
      'payments_total', COALESCE((SELECT sum(amount) FROM public.payments), 0),
      'payments_count', (SELECT count(*) FROM public.payments),
      'payments_by_month', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', m, 'total', t, 'count', c) ORDER BY m)
        FROM (SELECT to_char(payment_date, 'YYYY-MM') AS m, sum(amount) AS t, count(*) AS c
              FROM public.payments GROUP BY 1) s), '[]'::jsonb)
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;
REVOKE ALL ON FUNCTION public.super_admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_stats() TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 8.13 ACADEMY MANAGEMENT (super admin)
-- ────────────────────────────────────────────────────────────

-- The platform console's academy editor reads any academy's admin profile,
-- sports and branches.
DROP POLICY IF EXISTS "Super admin read profiles" ON public.profiles;
CREATE POLICY "Super admin read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin read sports" ON public.sports;
CREATE POLICY "Super admin read sports" ON public.sports
  FOR SELECT TO authenticated USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super admin read branches" ON public.academy_branches;
CREATE POLICY "Super admin read branches" ON public.academy_branches
  FOR SELECT TO authenticated USING (public.is_super_admin());

-- Edit an academy's details, membership level, sports, playgrounds (venues),
-- coaches and the admin contact (name / phone / email) from the platform
-- console in one call.
CREATE OR REPLACE FUNCTION public.super_admin_update_academy(
  p_academy_id UUID,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_email TEXT := NULLIF(trim(COALESCE(p_payload ->> 'admin_email', '')), '');
  v_trial_active BOOLEAN;
  v_item JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_academy_id IS NULL THEN
    RAISE EXCEPTION 'Missing academy id';
  END IF;

  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE academy_id = p_academy_id AND role = 'admin'
  ORDER BY created_at LIMIT 1;

  -- Will the academy be inside a trial after this update?
  v_trial_active := COALESCE(
    (p_payload ->> 'is_trial')::boolean,
    (SELECT is_trial FROM public.academies WHERE id = p_academy_id)
  );

  -- Academy identity / location / visibility / subscription. A trial with a
  -- blank date is calculated automatically as 1 month from account creation.
  UPDATE public.academies SET
    name           = COALESCE(NULLIF(trim(COALESCE(p_payload ->> 'name', '')), ''), name),
    description    = COALESCE(NULLIF(p_payload ->> 'description', ''), description),
    country        = COALESCE(NULLIF(p_payload ->> 'country', ''), country),
    governorate    = COALESCE(NULLIF(p_payload ->> 'governorate', ''), governorate),
    area           = COALESCE(NULLIF(p_payload ->> 'area', ''), area),
    cover_url      = COALESCE(NULLIF(p_payload ->> 'cover_url', ''), cover_url),
    is_public      = COALESCE((p_payload ->> 'is_public')::boolean, is_public),
    is_trial       = v_trial_active,
    plan           = CASE
                       WHEN p_payload ? 'plan'
                         AND p_payload ->> 'plan' IN ('starter', 'plus', 'elite')
                         THEN p_payload ->> 'plan'
                       ELSE plan
                     END,
    trial_ends_at  = CASE
                       WHEN p_payload ? 'trial_ends_at'
                         AND NULLIF(p_payload ->> 'trial_ends_at', '') IS NOT NULL
                         THEN NULLIF(p_payload ->> 'trial_ends_at', '')::timestamptz
                       WHEN v_trial_active
                         THEN (SELECT created_at FROM public.academies WHERE id = p_academy_id)
                            + INTERVAL '1 month'
                       ELSE trial_ends_at
                     END
  WHERE id = p_academy_id;

  -- Sports roster: a supplied List replaces the current list entirely.
  IF p_payload ? 'sports' THEN
    DELETE FROM public.sports WHERE academy_id = p_academy_id;
    INSERT INTO public.sports (academy_id, name)
    SELECT p_academy_id, trim(az.name)
    FROM jsonb_array_elements_text(COALESCE(p_payload -> 'sports', '[]'::jsonb)) AS az(name)
    WHERE trim(az.name) <> ''
    ON CONFLICT (academy_id, name) DO NOTHING;
  END IF;

  -- Playgrounds (venues): rows with an id are updated in place, rows without
  -- one are added, and existing rows that disappear are removed. Updating an
  -- unassigned pool playground assigns it to this academy. The console is not
  -- bound by the per-plan venue limits. Removed rows are deleted first so rows
  -- added in the same call are never mistaken for removals.
  IF p_payload ? 'venues' THEN
    ALTER TABLE public.venues DISABLE TRIGGER guard_venue_limit_on_insert;
    BEGIN
      DELETE FROM public.venues
      WHERE academy_id = p_academy_id
        AND NOT (id IN (
          SELECT (x ->> 'id')::uuid
          FROM jsonb_array_elements(p_payload -> 'venues') AS x
          WHERE x ? 'id'
        ));
      FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'venues') LOOP
        IF v_item ? 'id' THEN
          UPDATE public.venues SET
            academy_id    = p_academy_id,
            name         = COALESCE(NULLIF(trim(COALESCE(v_item ->> 'name', '')), ''), name),
            address      = CASE WHEN v_item ? 'address' THEN NULLIF(v_item ->> 'address', '') ELSE address END,
            capacity     = CASE WHEN v_item ? 'capacity' THEN NULLIF(v_item ->> 'capacity', '')::integer ELSE capacity END,
            school_name  = CASE WHEN v_item ? 'school_name' THEN NULLIF(v_item ->> 'school_name', '') ELSE school_name END,
            rental_cost  = CASE WHEN v_item ? 'rental_cost' THEN NULLIF(v_item ->> 'rental_cost', '')::numeric ELSE rental_cost END,
            rental_hours = CASE WHEN v_item ? 'rental_hours'
                                THEN COALESCE(NULLIF(v_item ->> 'rental_hours', '')::numeric, 1)
                                ELSE rental_hours END,
            sport_id     = CASE WHEN v_item ? 'sport'
                                THEN (SELECT id FROM public.sports
                                      WHERE academy_id = p_academy_id
                                        AND name = v_item ->> 'sport' LIMIT 1)
                                ELSE sport_id END
          WHERE id = (v_item ->> 'id')::uuid
            AND (academy_id = p_academy_id OR academy_id IS NULL);
        ELSE
          INSERT INTO public.venues (
            academy_id, name, address, capacity, sport_id, school_name,
            rental_cost, rental_hours
          )
          VALUES (
            p_academy_id,
            trim(v_item ->> 'name'),
            NULLIF(v_item ->> 'address', ''),
            NULLIF(v_item ->> 'capacity', '')::integer,
            (SELECT id FROM public.sports
             WHERE academy_id = p_academy_id
               AND name = v_item ->> 'sport' LIMIT 1),
            NULLIF(v_item ->> 'school_name', ''),
            NULLIF(v_item ->> 'rental_cost', '')::numeric,
            COALESCE(NULLIF(v_item ->> 'rental_hours', '')::numeric, 1)
          );
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE public.venues ENABLE TRIGGER guard_venue_limit_on_insert;
      RAISE;
    END;
    ALTER TABLE public.venues ENABLE TRIGGER guard_venue_limit_on_insert;
  END IF;

  -- Coaches: same incremental pattern. The console is not bound by the
  -- per-plan coach limits.
  IF p_payload ? 'coaches' THEN
    ALTER TABLE public.coaches DISABLE TRIGGER guard_coach_limit_on_insert;
    BEGIN
      DELETE FROM public.coaches
      WHERE academy_id = p_academy_id
        AND NOT (id IN (
          SELECT (x ->> 'id')::uuid
          FROM jsonb_array_elements(p_payload -> 'coaches') AS x
          WHERE x ? 'id'
        ));
      FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'coaches') LOOP
        IF v_item ? 'id' THEN
          UPDATE public.coaches SET
            name           = COALESCE(NULLIF(trim(COALESCE(v_item ->> 'name', '')), ''), name),
            phone          = CASE WHEN v_item ? 'phone' THEN NULLIF(v_item ->> 'phone', '') ELSE phone END,
            specialty      = CASE WHEN v_item ? 'specialty' THEN NULLIF(v_item ->> 'specialty', '') ELSE specialty END,
            monthly_salary = CASE WHEN v_item ? 'monthly_salary'
                                  THEN NULLIF(v_item ->> 'monthly_salary', '')::numeric
                                  ELSE monthly_salary END,
            is_active      = COALESCE((v_item ->> 'is_active')::boolean, is_active)
          WHERE id = (v_item ->> 'id')::uuid AND academy_id = p_academy_id;
        ELSE
          INSERT INTO public.coaches (academy_id, name, phone, specialty, monthly_salary, is_active)
          VALUES (
            p_academy_id,
            trim(v_item ->> 'name'),
            NULLIF(v_item ->> 'phone', ''),
            NULLIF(v_item ->> 'specialty', ''),
            NULLIF(v_item ->> 'monthly_salary', '')::numeric,
            COALESCE((v_item ->> 'is_active')::boolean, TRUE)
          );
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE public.coaches ENABLE TRIGGER guard_coach_limit_on_insert;
      RAISE;
    END;
    ALTER TABLE public.coaches ENABLE TRIGGER guard_coach_limit_on_insert;
  END IF;

  -- Contact details live on the founder's profile (and auth email when given).
  IF v_admin_id IS NOT NULL AND (
    p_payload ? 'admin_email' OR p_payload ? 'admin_name' OR p_payload ? 'admin_phone'
  ) THEN
    -- Bypass the self-guard trigger so the console may change a foreign profile.
    ALTER TABLE public.profiles DISABLE TRIGGER guard_profile_update;
    BEGIN
      IF v_email IS NOT NULL
         AND v_email <> (SELECT email FROM public.profiles WHERE id = v_admin_id) THEN
        UPDATE auth.users SET email = v_email WHERE id = v_admin_id;
      END IF;
      UPDATE public.profiles SET
        email = COALESCE(v_email, email),
        name  = COALESCE(NULLIF(trim(COALESCE(p_payload ->> 'admin_name', '')), ''), name),
        phone = CASE
                  WHEN p_payload ? 'admin_phone'
                    THEN NULLIF(p_payload ->> 'admin_phone', '')
                  ELSE phone
                END
      WHERE id = v_admin_id;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE public.profiles ENABLE TRIGGER guard_profile_update;
      RAISE;
    END;
    ALTER TABLE public.profiles ENABLE TRIGGER guard_profile_update;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.super_admin_update_academy(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_update_academy(UUID, JSONB) TO authenticated;

-- Permanently delete an academy and every account tied to it.
CREATE OR REPLACE FUNCTION public.super_admin_delete_academy(p_academy_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids UUID[];
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_academy_id IS NULL THEN
    RAISE EXCEPTION 'Missing academy id';
  END IF;

  -- Remember every login belonging to the academy before the cascade erases rows.
  SELECT array_agg(id) INTO v_user_ids
  FROM public.profiles
  WHERE academy_id = p_academy_id;

  -- Cascades to branches, sports, members, sessions, games, payments…
  DELETE FROM public.academies WHERE id = p_academy_id;

  -- Remove the associated auth accounts (and their emails).
  IF v_user_ids IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = ANY(v_user_ids);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.super_admin_delete_academy(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_delete_academy(UUID) TO authenticated;

-- ── Automatic trial expiry ──
-- Once a 1-month trial passes, the academy automatically drops back to the
-- free (starter) plan. pg_cron runs the check on a schedule; only academies
-- still on the trial plan ('elite') are downgraded so paid choices are kept.
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-expiry-downgrade') THEN
    PERFORM cron.unschedule('trial-expiry-downgrade');
  END IF;
  PERFORM cron.schedule('trial-expiry-downgrade', '*/5 * * * *', $cron$
    UPDATE public.academies
       SET is_trial = false, plan = 'starter', session_booking_enabled = false
     WHERE is_trial AND trial_ends_at < NOW() AND plan = 'elite';
  $cron$);
END
$$;

-- Location and contact fields edited by platform administrators.
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS governorate TEXT,
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;
NOTIFY pgrst, 'reload schema';

-- Contact details are available only through the protected platform admin API.
-- Table-level SELECT would override column-level restrictions, so replace it.
REVOKE SELECT ON public.venues FROM PUBLIC, anon, authenticated;
DO $$
DECLARE col RECORD;
BEGIN
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues'
  LOOP
    EXECUTE format('REVOKE SELECT (%I) ON public.venues FROM PUBLIC, anon, authenticated', col.column_name);
    IF col.column_name NOT IN ('contact_person', 'contact_phone') THEN
      EXECUTE format('GRANT SELECT (%I) ON public.venues TO anon, authenticated', col.column_name);
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
