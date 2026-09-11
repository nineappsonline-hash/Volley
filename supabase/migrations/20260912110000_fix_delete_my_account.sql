-- Fix self-service account deletion:
--  1. storage.protect_delete blocked the cleanup of uploaded receipts/avatars,
--     aborting the whole function with 42501 for anyone with uploaded files.
--     The trigger is now disabled only around the cleanup when we run as owner.
--  2. The platform super-admin (mo.dowaik) can no longer delete their own
--     account — it would remove the platform's last administrator.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_academy UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = v_uid AND lower(email) = 'mo.dowaik@gmail.com'
  ) THEN
    RAISE EXCEPTION 'The platform administrator account cannot delete itself';
  END IF;

  SELECT role, COALESCE(academy_id, public.current_academy_id())
    INTO v_role, v_academy
    FROM public.profiles
    WHERE id = v_uid;

  ALTER TABLE storage.objects DISABLE TRIGGER protect_delete;
  BEGIN
    DELETE FROM storage.objects
    WHERE bucket_id = 'subscription-receipts'
      AND (storage.foldername(name))[1] = v_uid::text;

    DELETE FROM storage.objects
    WHERE bucket_id = 'game-fee-receipts'
      AND (storage.foldername(name))[1] = v_uid::text;

    DELETE FROM storage.objects
    WHERE bucket_id = 'avatars'
      AND name LIKE 'avatars/' || v_uid::text || '/%';

    IF v_role = 'admin' AND v_academy IS NOT NULL THEN
      DELETE FROM storage.objects
      WHERE bucket_id = 'academy-media'
        AND name LIKE 'academies/' || v_academy::text || '/%';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      ALTER TABLE storage.objects ENABLE TRIGGER protect_delete;
      RAISE;
  END;
  ALTER TABLE storage.objects ENABLE TRIGGER protect_delete;

  IF v_role = 'admin' AND v_academy IS NOT NULL THEN
    DELETE FROM public.academies WHERE id = v_academy;
  END IF;

  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;