-- ═══════════════════════════════════════════════════════════════════════════
-- Member ratings for academies and playgrounds
--
-- Members may rate (1–5 stars + optional comment) the academies they attend
-- and the playgrounds where they played a completed friendly game.
--   • academy_ratings (existing)    — was open to any signed-in member;
--                                     INSERT/UPDATE are now gated on real
--                                     attendance.
--   • playground_ratings (new)      — mirrors academy_ratings for the public
--                                     playground pool (venues).
-- The SQL helpers and the RPC below are the single source of truth for
-- "attendee", so the UI and the row-level policies can never disagree.
-- Security model:
--   * Anyone (anon/authenticated) may read ratings.
--   * Only the caller may insert/update their own rating row, AND only when
--     they are an attendee of that academy / completed a game at that venue.
--   * No delete — a rating can be updated (e.g. changed stars/comment).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. ELIGIBILITY HELPERS ─────────────────────────────────

-- May the current user rate this academy? They must currently belong to it
-- OR have been marked present in one of its training sessions.
CREATE OR REPLACE FUNCTION public.member_can_rate_academy(p_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.academy_id = p_academy_id
  ) OR EXISTS (
    SELECT 1
    FROM public.attendance a
    JOIN public.training_sessions ts ON ts.id = a.session_id
    WHERE a.member_id = auth.uid()
      AND a.is_present
      AND ts.academy_id = p_academy_id
  );
$$;
REVOKE ALL ON FUNCTION public.member_can_rate_academy(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_can_rate_academy(UUID) TO authenticated;

-- May the current user rate this playground? They must have taken part
-- (organizer or player) in a completed friendly game booked there.
CREATE OR REPLACE FUNCTION public.member_can_rate_playground(p_venue_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendly_game_participants p
    JOIN public.friendly_games g ON g.id = p.game_id
    WHERE p.member_id = auth.uid()
      AND g.playground_id = p_venue_id
      AND g.status = 'completed'
  );
$$;
REVOKE ALL ON FUNCTION public.member_can_rate_playground(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_can_rate_playground(UUID) TO authenticated;

-- Client-facing eligibility: which academy/venue ids the current member may
-- rate. Keeps the directory pages in sync with the RLS gates above.
CREATE OR REPLACE FUNCTION public.member_rating_eligibility()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'academies',
      (SELECT coalesce(jsonb_agg(DISTINCT t.academy_id), '[]'::jsonb)
       FROM (
         SELECT academy_id FROM public.profiles
         WHERE id = auth.uid() AND academy_id IS NOT NULL
         UNION
         SELECT ts.academy_id
         FROM public.attendance a
         JOIN public.training_sessions ts ON ts.id = a.session_id
         WHERE a.member_id = auth.uid() AND a.is_present AND ts.academy_id IS NOT NULL
       ) t),
    'playgrounds',
      (SELECT coalesce(jsonb_agg(DISTINCT g.playground_id), '[]'::jsonb)
       FROM public.friendly_game_participants p
       JOIN public.friendly_games g ON g.id = p.game_id
       WHERE p.member_id = auth.uid()
         AND g.playground_id IS NOT NULL
         AND g.status = 'completed')
  );
$$;
REVOKE ALL ON FUNCTION public.member_rating_eligibility() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_rating_eligibility() TO authenticated;

-- ── 2. PLAYGROUND RATINGS TABLE ────────────────────────────

CREATE TABLE IF NOT EXISTS public.playground_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(venue_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_playground_ratings_venue
  ON public.playground_ratings(venue_id);
CREATE INDEX IF NOT EXISTS idx_playground_ratings_member
  ON public.playground_ratings(member_id);

ALTER TABLE public.playground_ratings ENABLE ROW LEVEL SECURITY;

-- Grants: everyone reads public ratings; authenticated members insert/update
-- their own row (RLS gates the "own + attendee" rules). No DELETE by design.
REVOKE ALL ON public.playground_ratings FROM anon;
GRANT SELECT ON public.playground_ratings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.playground_ratings TO authenticated;

-- Anyone can view ratings (they power the public explorer).
DROP POLICY IF EXISTS "Anyone can view playground ratings" ON public.playground_ratings;
CREATE POLICY "Anyone can view playground ratings" ON public.playground_ratings
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Attendees insert own playground ratings" ON public.playground_ratings;
CREATE POLICY "Attendees insert own playground ratings" ON public.playground_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = member_id
    AND public.member_can_rate_playground(venue_id)
  );

DROP POLICY IF EXISTS "Attendees update own playground ratings" ON public.playground_ratings;
CREATE POLICY "Attendees update own playground ratings" ON public.playground_ratings
  FOR UPDATE USING (auth.uid() = member_id)
  WITH CHECK (
    auth.uid() = member_id
    AND public.member_can_rate_playground(venue_id)
  );

-- ── 3. GATE ACADEMY RATINGS ON ATTENDANCE ──────────────────
-- Insert/update required only that the row belonged to the caller. Now the
-- caller must also be (or have been) an attendee of the rated academy.

DROP POLICY IF EXISTS "Members insert own ratings" ON public.academy_ratings;
CREATE POLICY "Members insert own ratings" ON public.academy_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = member_id
    AND public.member_can_rate_academy(academy_id)
  );

DROP POLICY IF EXISTS "Members update own ratings" ON public.academy_ratings;
CREATE POLICY "Members update own ratings" ON public.academy_ratings
  FOR UPDATE USING (auth.uid() = member_id)
  WITH CHECK (
    auth.uid() = member_id
    AND public.member_can_rate_academy(academy_id)
  );

NOTIFY pgrst, 'reload schema';