-- ═══════════════════════════════════════════════════════════════
-- Tournament details: time, entry fee, participant cap, playground.
--
-- New columns on `tournaments`:
--   start_time / end_time   : when the tournament runs (besides the dates)
--   participant_fee         : EGP per participant (0 = free)
--   max_participants        : cap on the participant pool (NULL = unlimited)
--   venue_id                : the playground where it is held
--
-- The participant pool also becomes readable by every member (read-only) so
-- anyone can see how full a tournament is (`tournament_participants(count)`);
-- writes stay restricted to the hosting academy's admins.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS participant_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_participants INTEGER
    CHECK (max_participants IS NULL OR max_participants > 0),
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;

-- Everyone may read the participant pool (counts, who joined) for any
-- tournament; management stays with the hosting academy.
DROP POLICY IF EXISTS "Members read tournament participants" ON public.tournament_participants;
CREATE POLICY "Members read tournament participants" ON public.tournament_participants
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id
    )
  );