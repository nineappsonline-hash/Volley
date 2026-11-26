-- Playza RLS initplan batch 4: venues, rentals, tournaments, teams and sessions.
-- All predicates sourced from live pg_policies; only auth.uid()/auth.jwt() wrapped.
-- Retain policy cmd, roles, permissiveness and all other authorization logic.

ALTER POLICY "Admins manage ratings" ON public.session_ratings
  USING ((EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = session_ratings.session_id) AND (s.academy_id = current_academy_id())))) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Members manage ratings" ON public.session_ratings
  USING ((EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = session_ratings.session_id) AND (s.academy_id = current_academy_id())))) AND ((SELECT auth.uid()) = member_id))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = session_ratings.session_id) AND (s.academy_id = current_academy_id())))) AND ((SELECT auth.uid()) = member_id));

ALTER POLICY "Members submit ratings" ON public.session_ratings
  WITH CHECK ((SELECT auth.uid()) = member_id);

ALTER POLICY "Admins manage waitlist" ON public.session_waitlist
  USING ((EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = session_waitlist.session_id) AND (s.academy_id = current_academy_id())))) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Members join waitlist" ON public.session_waitlist
  WITH CHECK (((SELECT auth.uid()) = member_id) AND (EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = session_waitlist.session_id) AND (s.academy_id = current_academy_id())))));

ALTER POLICY "Admins manage sports" ON public.sports
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage team members" ON public.team_members
  USING ((EXISTS ( SELECT 1
   FROM teams t
  WHERE ((t.id = team_members.team_id) AND (t.academy_id = current_academy_id())))) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage tournaments" ON public.tournaments
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage sessions" ON public.training_sessions
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage venue rentals" ON public.venue_rentals
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Playground owners manage their venue rentals" ON public.venue_rentals
  USING (EXISTS ( SELECT 1
   FROM venues v
  WHERE ((v.id = venue_rentals.venue_id) AND (v.owner_profile_id = (SELECT auth.uid())))))
  WITH CHECK (EXISTS ( SELECT 1
   FROM venues v
  WHERE ((v.id = venue_rentals.venue_id) AND (v.owner_profile_id = (SELECT auth.uid())))));

ALTER POLICY "Academy deletes own venues" ON public.venues
  USING (is_super_admin() OR ((academy_id = current_academy_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (SELECT auth.uid())) AND (p.academy_id = p.academy_id) AND (p.role = 'admin'::text))))));

ALTER POLICY "Academy inserts own venues" ON public.venues
  WITH CHECK (is_super_admin() OR ((academy_id = current_academy_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (SELECT auth.uid())) AND (p.academy_id = p.academy_id) AND (p.role = 'admin'::text))))));

ALTER POLICY "Academy updates own venues" ON public.venues
  USING (is_super_admin() OR ((academy_id = current_academy_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (SELECT auth.uid())) AND (p.academy_id = p.academy_id) AND (p.role = 'admin'::text))))))
  WITH CHECK (is_super_admin() OR ((academy_id = current_academy_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (SELECT auth.uid())) AND (p.academy_id = p.academy_id) AND (p.role = 'admin'::text))))));

ALTER POLICY "Admins manage venues" ON public.venues
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Approved playground visibility" ON public.venues
  USING ((approval_status = 'approved'::text) OR is_super_admin() OR ((academy_id = current_academy_id()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (SELECT auth.uid())) AND (p.role = 'admin'::text))))) OR (owner_profile_id = (SELECT auth.uid())));

ALTER POLICY "Playground owners delete their playgrounds" ON public.venues
  USING (owner_profile_id = (SELECT auth.uid()));

ALTER POLICY "Playground owners insert their playgrounds" ON public.venues
  WITH CHECK (is_super_admin() OR ((owner_profile_id = (SELECT auth.uid())) AND (academy_id IS NULL)));

ALTER POLICY "Playground owners update their playgrounds" ON public.venues
  USING (owner_profile_id = (SELECT auth.uid()))
  WITH CHECK (owner_profile_id = (SELECT auth.uid()));

