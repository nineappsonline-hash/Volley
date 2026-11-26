-- Playza RLS: merge only exact same-role SELECT policies with OR.
-- Preserves the union of original permissive policies and every restrictive policy.
-- Generated using the live pg_policies definitions on 2026-11-27.
-- No modification to grants, row checks, UPDATE/DELETE/INSERT policies.

CREATE POLICY "Public academies or own academy read" ON public.academies
AS PERMISSIVE FOR SELECT TO PUBLIC
USING (
  ((is_public = true)) OR ((id = current_academy_id()))
);
DROP POLICY "Public view public academies" ON public.academies;
DROP POLICY "View own academy" ON public.academies;

CREATE POLICY "Community games unified read" ON public.friendly_games
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  (((is_public = true) OR (creator_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM friendly_game_participants p
  WHERE ((p.game_id = friendly_games.id) AND (p.member_id = ( SELECT auth.uid() AS uid))))))) OR (is_super_admin())
);
DROP POLICY "Community games read" ON public.friendly_games;
DROP POLICY "Community games super admin read" ON public.friendly_games;

CREATE POLICY "Coach contracts unified read" ON public.coach_contracts
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  (((academy_id = current_academy_id()) AND (EXISTS ( SELECT 1
   FROM coaches c
  WHERE ((c.id = coach_contracts.coach_id) AND (c.profile_id = ( SELECT auth.uid() AS uid))))))) OR (((academy_id = current_academy_id()) AND is_academy_staff()))
);
DROP POLICY "Coach contracts read owner" ON public.coach_contracts;
DROP POLICY "Coach contracts read staff" ON public.coach_contracts;

-- The dropped sports condition appears in the OR of the retained policy.
DROP POLICY "Public view public academy sports" ON public.sports;
