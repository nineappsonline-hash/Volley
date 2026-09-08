-- Reconcile the live DB: the platform admin uses mo.dowaik@gmail.com.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()
    AND lower(email) = 'mo.dowaik@gmail.com' AND email_confirmed_at IS NOT NULL
    AND (banned_until IS NULL OR banned_until <= now()));
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;