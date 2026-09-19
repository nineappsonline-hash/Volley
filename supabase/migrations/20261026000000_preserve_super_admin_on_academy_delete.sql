-- ────────────────────────────────────────────────────────────
-- PRESERVE THE PLATFORM SUPER-ADMIN ON ACADEMY DELETION
--
-- super_admin_delete_academy deleted every profile's auth row for the
-- academy, including the platform super-admin (mo.dowaik@gmail.com) when
-- that account belonged to the academy. Because is_super_admin()/isPlatformAdmin
-- are email-based, deleting the auth row silently removed the platform's
-- last admin.
--
-- Now the function:
--   • detaches the protected profile (academy_id → NULL),
--   • removes academy-owned rows that reference it with a CASCADE FK
--     (enumerated from the catalogs, so future tables are covered),
--   • excludes it from the DELETE FROM auth.users.
-- Mirrors the definition in supabase/schema.sql.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.super_admin_delete_academy(p_academy_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids UUID[];
  v_protected_ids UUID[];
  v_row RECORD;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_academy_id IS NULL THEN
    RAISE EXCEPTION 'Missing academy id';
  END IF;

  -- Remember every login belonging to the academy before the cascade erases rows.
  SELECT array_agg(id) INTO v_user_ids
  FROM public.profiles
  WHERE academy_id = p_academy_id;

  -- The platform super-admin (verified Auth email) must survive any academy
  -- deletion: is_super_admin()/isPlatformAdmin() are email-based, so deleting
  -- its auth row would silently strip the platform of its last admin.
  SELECT array_agg(id) INTO v_protected_ids
  FROM public.profiles
  WHERE id = ANY(v_user_ids)
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = profiles.id
        AND lower(u.email) = 'mo.dowaik@gmail.com'
        AND u.email_confirmed_at IS NOT NULL
        AND (u.banned_until IS NULL OR u.banned_until <= now())
    );

  IF v_protected_ids IS NOT NULL THEN
    -- Detach the protected profile(s) from this academy (profiles.academy_id
    -- is nullable), so the academy delete below does not cascade to them.
    UPDATE public.profiles SET academy_id = NULL WHERE id = ANY(v_protected_ids);

    -- Remove every academy-owned row that references the protected profile
    -- with a CASCADE foreign key (member rows, subscriptions, follows,
    -- messages, …). Rows owned by other academies — or owned by no academy —
    -- keep pointing at the profile, which remains valid because the profile
    -- survives. Enumerated from the catalogs so new tables are covered too.
    FOR v_row IN
      SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_name = tc.constraint_name
         AND kcu.constraint_schema = tc.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.constraint_schema = tc.constraint_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = 'public'
         AND tc.delete_rule = 'CASCADE'
         AND ccu.table_schema = 'public'
         AND ccu.table_name = 'profiles'
         AND ccu.column_name = 'id'
    LOOP
      -- Only tables that carry an academy_id can be owned by this academy.
      IF EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = v_row.table_name
          AND c.column_name = 'academy_id'
      ) THEN
        EXECUTE format(
          'DELETE FROM public.%I WHERE %I = ANY($1) AND academy_id = $2',
          v_row.table_name, v_row.column_name)
          USING v_protected_ids, p_academy_id;
      END IF;
    END LOOP;
  END IF;

  -- Cascades to branches, sports, members, sessions, games, payments…
  DELETE FROM public.academies WHERE id = p_academy_id;

  -- Remove the associated auth accounts (and their emails), never the
  -- protected platform admin account.
  IF v_user_ids IS NOT NULL THEN
    IF v_protected_ids IS NOT NULL THEN
      DELETE FROM auth.users
      WHERE id = ANY(v_user_ids) AND id <> ALL(v_protected_ids);
    ELSE
      DELETE FROM auth.users WHERE id = ANY(v_user_ids);
    END IF;
  END IF;
END;
$$;