-- Optimize remaining Playza RLS policies through per-statement auth initplans.
-- Exact existing expressions from pg_policies (2026-11-27).
-- Preserve roles, command, permissiveness, predicates and WITH CHECK behavior.

ALTER POLICY "Admins manage announcements" ON public.announcements
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Followers read announcements" ON public.announcements
  USING (academy_id IN ( SELECT f.academy_id
   FROM academy_follows f
  WHERE (f.member_id = (SELECT auth.uid()))));

ALTER POLICY "Admins manage attendance" ON public.attendance
  USING ((EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = attendance.session_id) AND (s.academy_id = current_academy_id())))) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Members manage attendance" ON public.attendance
  USING ((EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = attendance.session_id) AND (s.academy_id = current_academy_id())))) AND ((SELECT auth.uid()) = member_id))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = attendance.session_id) AND (s.academy_id = current_academy_id())))) AND ((SELECT auth.uid()) = member_id));

ALTER POLICY "Admins manage coach availability" ON public.coach_availability
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Coach contracts read owner" ON public.coach_contracts
  USING ((academy_id = current_academy_id()) AND (EXISTS ( SELECT 1
   FROM coaches c
  WHERE ((c.id = coach_contracts.coach_id) AND (c.profile_id = (SELECT auth.uid()))))));

ALTER POLICY "Admins manage coaches" ON public.coaches
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage expenses" ON public.expenses
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage badges" ON public.member_badges
  USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = member_badges.member_id) AND (p.academy_id = current_academy_id())))) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Members view own badges" ON public.member_badges
  USING (((SELECT auth.uid()) = member_id) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = member_badges.member_id) AND (p.academy_id = current_academy_id())))));

ALTER POLICY "Admins manage plans" ON public.membership_plans
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage costs" ON public.monthly_costs
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Payroll disputes read coach" ON public.payroll_disputes
  USING (EXISTS ( SELECT 1
   FROM coaches c
  WHERE ((c.id = payroll_disputes.coach_id) AND (c.profile_id = (SELECT auth.uid())))));

ALTER POLICY "Payroll entries read coach" ON public.payroll_entries
  USING (EXISTS ( SELECT 1
   FROM coaches c
  WHERE ((c.id = payroll_entries.coach_id) AND (c.profile_id = (SELECT auth.uid())))));

ALTER POLICY "Admins manage evaluations" ON public.player_evaluations
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Members view own evaluations" ON public.player_evaluations
  USING ((SELECT auth.uid()) = member_id);

ALTER POLICY "Attendees insert own playground ratings" ON public.playground_ratings
  WITH CHECK (((SELECT auth.uid()) = member_id) AND member_can_rate_playground(venue_id));

ALTER POLICY "Attendees update own playground ratings" ON public.playground_ratings
  USING ((SELECT auth.uid()) = member_id)
  WITH CHECK (((SELECT auth.uid()) = member_id) AND member_can_rate_playground(venue_id));

ALTER POLICY "Admins full access" ON public.profiles
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

