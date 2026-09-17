-- Make "Beach Volleyball" available in every academy's sport dropdowns
-- (add playground, add venue, teams, sessions, tournaments, etc.).
--
-- The sports table holds one row per academy per sport name; the add-playground
-- dialog and other pickers read from it (useSports → SELECT * FROM sports).
-- Beach Volleyball was newly added to COMMUNITY_SPORTS in the app, but existing
-- academies' sports rows are seeded from a hardcoded list that predates it.

INSERT INTO public.sports (academy_id, name)
SELECT a.id, 'Beach Volleyball'
FROM public.academies a
ON CONFLICT (academy_id, name) DO NOTHING;

NOTIFY pgrst, 'reload schema';