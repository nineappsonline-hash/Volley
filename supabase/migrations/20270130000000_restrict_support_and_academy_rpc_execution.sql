-- Playza: restrict anonymous access to 10 auth-guarded SECURITY DEFINER mutation RPCs.
-- Existing authenticated and service_role grants retained.
-- Support_notify is an unguarded privileged INSERT helper; it must not be
-- callable by either PUBLIC, anon, or authenticated directly. It is used only
-- by postgres-owned SECURITY DEFINER support RPCs (owner retains EXECUTE).
-- No body, RLS policy or table is modified.

REVOKE EXECUTE ON FUNCTION public.academy_reschedule_booking(uuid, date, time without time zone, date, time without time zone, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.academy_save_lead(jsonb, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.academy_save_member_details(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.academy_send_renewal_reminder(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.academy_set_staff(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_ticket_message(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_route_support_ticket(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.change_ticket_status(uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_support_ticket(text, text, uuid, text, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.route_support_ticket(uuid, uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.support_notify(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
