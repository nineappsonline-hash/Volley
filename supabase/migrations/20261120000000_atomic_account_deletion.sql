-- Family profiles removed the profiles -> auth.users foreign key. Delete both
-- records explicitly and atomically, including profiles orphaned by older UI.
CREATE OR REPLACE FUNCTION public.platform_delete_account(p_id UUID, p_confirmation TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_profile public.profiles%ROWTYPE;
  v_has_auth BOOLEAN;
  v_has_profile BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only a super admin can delete accounts' USING ERRCODE = '42501';
  END IF;
  IF p_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own administrator account';
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = p_id FOR UPDATE;
  v_has_auth := FOUND;
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_id FOR UPDATE;
  v_has_profile := FOUND;
  IF NOT v_has_auth AND NOT v_has_profile THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  IF v_has_auth OR v_profile.email IS NOT NULL THEN
    IF lower(btrim(COALESCE(p_confirmation, ''))) = '' OR
       lower(btrim(p_confirmation)) IS DISTINCT FROM lower(btrim(COALESCE(v_email, v_profile.email))) THEN
      RAISE EXCEPTION 'Enter the account email to confirm deletion';
    END IF;
  ELSIF p_confirmation IS DISTINCT FROM v_profile.name THEN
    RAISE EXCEPTION 'Enter the member name exactly to confirm deletion';
  END IF;
  DELETE FROM public.profiles WHERE id = p_id;
  DELETE FROM auth.users WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_delete_account(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_delete_account(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
