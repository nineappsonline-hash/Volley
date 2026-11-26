-- Security: obey underlying tables' RLS for private game participant data.
-- Before this migration, unauthenticated view queries could retrieve all
-- participant rows, including nonapproved payment and receipt metadata.
-- SECURITY INVOKER enforces friendly_game_participants RLS:
-- anon sees only approved participants; authenticated visibility is also scoped.
-- The view structure, columns and ownership remain unchanged.
-- Likewise secure blocked_members without bypassing blocks/profiles RLS.
ALTER VIEW public.game_account_participants SET (security_invoker = true);
ALTER VIEW public.blocked_members SET (security_invoker = true);
