-- Playza RLS initplan batch 3: selected academy, payment and booking policies.
-- Snapshot generated from live pg_policies on 2026-11-27.
-- Only wrap auth.uid() and auth.jwt() calls in uncorrelated SELECTs.
-- Keep every other policy expression, role and operation unchanged.

ALTER POLICY "Admin edits own academy" ON public.academies
  USING ((id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "staff_read" ON public.academy_staff
  USING ((profile_id = (SELECT auth.uid())) OR academy_can(academy_id, 'owner'::text));

ALTER POLICY "training_booking_read" ON public.academy_training_bookings
  USING ((member_id = (SELECT auth.uid())) OR is_super_admin() OR academy_program_access(program_id, 'bookings'::text) OR academy_program_access(program_id, 'finance'::text));

ALTER POLICY "Rent payments read" ON public.friendly_game_rent_payments
  USING (EXISTS ( SELECT 1
   FROM friendly_games g
  WHERE ((g.id = friendly_game_rent_payments.game_id) AND ((g.is_public = true) OR (g.creator_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
           FROM friendly_game_participants p
          WHERE ((p.game_id = g.id) AND (p.member_id = (SELECT auth.uid())))))))));

ALTER POLICY "Admins manage payments" ON public.payments
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Members view own payments" ON public.payments
  USING ((SELECT auth.uid()) = member_id);

ALTER POLICY "Plan subs own insert" ON public.plan_subscriptions
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Plan subs own select" ON public.plan_subscriptions
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "Owner edits own pending application" ON public.playground_owners
  USING ((profile_id = (SELECT auth.uid())) AND (status = ANY (ARRAY['pending'::text, 'rejected'::text])))
  WITH CHECK ((profile_id = (SELECT auth.uid())) AND (status = ANY (ARRAY['pending'::text, 'rejected'::text])));

ALTER POLICY "Owner views own application" ON public.playground_owners
  USING (profile_id = (SELECT auth.uid()));

ALTER POLICY "Admins manage bookings" ON public.session_bookings
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Members create bookings" ON public.session_bookings
  WITH CHECK (((SELECT auth.uid()) = member_id) AND (EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = session_bookings.session_id) AND (s.academy_id <> current_academy_id()) AND (s.status = 'scheduled'::text)))) AND (EXISTS ( SELECT 1
   FROM academies a
  WHERE ((a.id = session_bookings.academy_id) AND (a.session_booking_enabled = true)))));

ALTER POLICY "Members view own bookings" ON public.session_bookings
  USING ((SELECT auth.uid()) = member_id);

