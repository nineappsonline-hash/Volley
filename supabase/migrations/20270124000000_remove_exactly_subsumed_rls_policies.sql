-- Playza RLS cleanup: remove policies exactly subsumed by same-role permissive ALL policies.
-- Verified against live pg_policies. No restrictive policies are changed.
-- 13 SELECT policies duplicate the SELECT arm of an ALL policy with identical
-- roles and USING; 3 profiles policies duplicate the existing ALL policies.
-- NOTE: "Admins have full access" has implicit WITH CHECK = USING (PG default).

DROP POLICY IF EXISTS "Academy members view activity" ON public.activity_feed;
DROP POLICY IF EXISTS "Authenticated view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Authenticated view coach availability" ON public.coach_availability;
DROP POLICY IF EXISTS "Authenticated view coaches" ON public.coaches;
DROP POLICY IF EXISTS "Authenticated view templates" ON public.schedule_templates;
DROP POLICY IF EXISTS "Members view calculations" ON public.session_calculations;
DROP POLICY IF EXISTS "Members view guests" ON public.session_guests;
DROP POLICY IF EXISTS "Authenticated view photos" ON public.session_photos;
DROP POLICY IF EXISTS "Members view waitlist" ON public.session_waitlist;
DROP POLICY IF EXISTS "Authenticated view team members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated view teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated view venue rentals" ON public.venue_rentals;
DROP POLICY IF EXISTS "Authenticated view venues" ON public.venues;
DROP POLICY IF EXISTS "Admins have full access" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage member plan" ON public.profiles;
DROP POLICY IF EXISTS "Members manage member plan" ON public.profiles;
