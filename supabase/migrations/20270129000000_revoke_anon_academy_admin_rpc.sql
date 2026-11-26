-- Playza: restrict four academy mutation SECURITY DEFINER RPCs to signed-in users.
-- The functions already perform academy capability checks internally.
-- Anonymous users cannot legitimately import members, adjust finances,
-- assign academy branches, or record training attendance.
-- Keep authenticated and service_role EXECUTE privileges unchanged.
-- Existing explicit ACLs have no PUBLIC grant; no other functions altered.

REVOKE EXECUTE ON FUNCTION public.academy_adjust_membership(uuid, text, jsonb, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.academy_assign_branch(text, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.academy_import_roster(jsonb, boolean, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.academy_mark_booking_attendance(uuid, date, time without time zone, boolean) FROM anon;
