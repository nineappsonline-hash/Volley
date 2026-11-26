-- Playza: reduce repeated JWT auth.uid() evaluations in core RLS policies.
-- No role, command, predicate, or permission change is intended.
-- PostgreSQL evaluates uncorrelated (select auth.uid()) once per statement.
-- Preserve nested row-dependent subqueries and academy rating checks.

ALTER POLICY "Community games create" ON public.friendly_games
  WITH CHECK (creator_id = (SELECT auth.uid()));

ALTER POLICY "Community games owner delete" ON public.friendly_games
  USING (creator_id = (SELECT auth.uid()));

ALTER POLICY "Community games owner update" ON public.friendly_games
  USING (creator_id = (SELECT auth.uid()))
  WITH CHECK (creator_id = (SELECT auth.uid()));

ALTER POLICY "Community games read" ON public.friendly_games
  USING (
    is_public = true
    OR creator_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.friendly_game_participants p
      WHERE p.game_id = friendly_games.id
        AND p.member_id = (SELECT auth.uid())
    )
  );

ALTER POLICY "Members follow academies" ON public.academy_follows
  WITH CHECK (
    (SELECT auth.uid()) = member_id
    AND EXISTS (
      SELECT 1 FROM public.academies a
      WHERE a.id = academy_follows.academy_id AND a.is_public = true
    )
  );

ALTER POLICY "Members unfollow academies" ON public.academy_follows
  USING ((SELECT auth.uid()) = member_id);

ALTER POLICY "Members insert own ratings" ON public.academy_ratings
  WITH CHECK (
    (SELECT auth.uid()) = member_id
    AND public.member_can_rate_academy(academy_id)
  );

ALTER POLICY "Members update own ratings" ON public.academy_ratings
  USING ((SELECT auth.uid()) = member_id)
  WITH CHECK (
    (SELECT auth.uid()) = member_id
    AND public.member_can_rate_academy(academy_id)
  );
