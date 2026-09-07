-- Platform administration is tied to a verified Auth email, not profile roles.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()
    AND lower(email) = 'mo.dowaik@gmail.com' AND email_confirmed_at IS NOT NULL
    AND (banned_until IS NULL OR banned_until <= now()));
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_account_blocked()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND banned_until > now());
$$;
REVOKE ALL ON FUNCTION public.is_account_blocked() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_blocked() TO authenticated;

-- Restrictive policies also deny direct database access with an unexpired JWT.
DO $$
DECLARE target record;
BEGIN
  FOR target IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Blocked accounts denied" ON public.%I', target.tablename);
    EXECUTE format('CREATE POLICY "Blocked accounts denied" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT (SELECT public.is_account_blocked())) WITH CHECK (NOT (SELECT public.is_account_blocked()))', target.tablename);
  END LOOP;
END $$;

-- PostgREST runs this before RPCs as well as table requests, including definer RPCs.
CREATE OR REPLACE FUNCTION public.check_account_access()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.is_account_blocked() THEN
    RAISE EXCEPTION 'Account is blocked' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.check_account_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_account_access() TO anon, authenticated, service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.check_account_access';
NOTIFY pgrst, 'reload config';

DROP POLICY IF EXISTS "Blocked accounts denied" ON storage.objects;
CREATE POLICY "Blocked accounts denied" ON storage.objects AS RESTRICTIVE
FOR ALL TO authenticated
USING (NOT (SELECT public.is_account_blocked()))
WITH CHECK (NOT (SELECT public.is_account_blocked()));
