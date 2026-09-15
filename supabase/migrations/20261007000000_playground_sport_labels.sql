-- A member can browse playgrounds across academies, while sports themselves
-- remain academy-scoped. Expose only each playground's sport identifier/name.
CREATE OR REPLACE FUNCTION public.playground_sport_labels()
RETURNS TABLE (venue_id UUID, sport_id UUID, sport_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, s.id, s.name FROM public.venues v
  JOIN public.sports s ON s.id = v.sport_id;
$$;
REVOKE ALL ON FUNCTION public.playground_sport_labels() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.playground_sport_labels() TO anon, authenticated;
