-- Optimize remaining Playza RLS policies through per-statement auth initplans.
-- Exact existing expressions from pg_policies (2026-11-27).
-- Preserve roles, command, permissiveness, predicates and WITH CHECK behavior.

ALTER POLICY "Admins have full access" ON public.profiles
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage member plan" ON public.profiles
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage recurring" ON public.recurring_schedules
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Reports reporter create" ON public.reports
  WITH CHECK (reporter_id = (SELECT auth.uid()));

ALTER POLICY "Admins manage templates" ON public.schedule_templates
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Scout notes own delete" ON public.scout_notes
  USING (scout_id = (SELECT auth.uid()));

ALTER POLICY "Scout notes own insert" ON public.scout_notes
  WITH CHECK (scout_id = (SELECT auth.uid()));

ALTER POLICY "Scout notes own select" ON public.scout_notes
  USING (scout_id = (SELECT auth.uid()));

ALTER POLICY "Admins manage calculations" ON public.session_calculations
  USING ((EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = session_calculations.session_id) AND (s.academy_id = current_academy_id())))) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage guests" ON public.session_guests
  USING ((EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = session_guests.session_id) AND (s.academy_id = current_academy_id())))) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage photos" ON public.session_photos
  USING (((session_id IS NULL) OR (EXISTS ( SELECT 1
   FROM training_sessions s
  WHERE ((s.id = session_photos.session_id) AND (s.academy_id = current_academy_id()))))) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Support surveys read submitter" ON public.support_surveys
  USING (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_surveys.ticket_id) AND (t.academy_id = current_academy_id()) AND (t.submitter_id = (SELECT auth.uid())))));

ALTER POLICY "Support messages read public submitter" ON public.support_ticket_messages
  USING ((is_internal = false) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_ticket_messages.ticket_id) AND (t.academy_id = current_academy_id()) AND (t.submitter_id = (SELECT auth.uid()))))));

ALTER POLICY "Support tickets read coach teams" ON public.support_tickets
  USING ((academy_id = current_academy_id()) AND is_academy_coach() AND ((assignee_id = (SELECT auth.uid())) OR (team_id = ANY (current_coach_team_ids()))));

ALTER POLICY "Support tickets read submitter" ON public.support_tickets
  USING ((academy_id = current_academy_id()) AND (submitter_id = (SELECT auth.uid())));

ALTER POLICY "Admins manage teams" ON public.teams
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

ALTER POLICY "Admins manage tournament matches" ON public.tournament_matches
  USING (EXISTS ( SELECT 1
   FROM tournaments t
  WHERE ((t.id = tournament_matches.tournament_id) AND (t.academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))))
  WITH CHECK (EXISTS ( SELECT 1
   FROM tournaments t
  WHERE ((t.id = tournament_matches.tournament_id) AND (t.academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))));

ALTER POLICY "Admins manage trial requests" ON public.trial_requests
  USING ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text))
  WITH CHECK ((academy_id = current_academy_id()) AND ((((SELECT auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text));

