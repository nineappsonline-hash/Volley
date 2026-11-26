-- Playza: pin function search_path for three functions flagged by Supabase Security Advisor.
-- These functions are SECURITY INVOKER and their relations/functions are schema qualified.
-- ALTER FUNCTION changes no body, arguments, return value, privileges or volatility.
-- Empty search_path uses pg_catalog implicitly and prevents search_path hijack.

ALTER FUNCTION public.guard_venue_rental_court() SET search_path = '';
ALTER FUNCTION public.minutes_of_day(time without time zone) SET search_path = '';
ALTER FUNCTION public.player_display_name(public.profiles) SET search_path = '';
