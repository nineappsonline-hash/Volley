-- ═══════════════════════════════════════════════════════════════════════════
-- Second platform super-admin: nayra112002@gmail.com
--
-- Platform administration is tied to verified Auth emails. Until now the
-- allow-list held a single address (mo.dowaik@gmail.com). This migration
-- turns every allow-list check into a two-email list:
--   • is_super_admin() — the RLS/RPC authorization source of truth
--   • delete_my_account() — the super-admin account cannot delete itself
--   • super_admin_delete_academy() — the super-admin survives academy deletion
-- It also widens the profiles role constraint to accept 'super_admin' and
-- flips the second admin's auto-created profile row onto the new role.
-- Auto-seeded by the on_auth_user_created trigger as 'member' because the
-- historical profiles.role CHECK rejected 'super_admin'.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Authorization: allow-list of verified platform admin emails.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()
    AND lower(email) IN ('mo.dowaik@gmail.com', 'nayra112002@gmail.com')
    AND email_confirmed_at IS NOT NULL
    AND (banned_until IS NULL OR banned_until <= now()));
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- 2. Accept 'super_admin' on profiles rows (currently rejected by the CHECK).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'member', 'playground_owner'));

-- 3. Flip the new admin's profile (the trigger created it as role='member').
UPDATE public.profiles
SET role = 'super_admin', academy_id = NULL, is_active = TRUE
WHERE EXISTS (
  SELECT 1 FROM auth.users u
  WHERE u.id = profiles.id AND lower(u.email) = 'nayra112002@gmail.com'
);

-- 4. Self-service deletion guard: both platform admins are irremovable.
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
    WHERE id = v_uid AND lower(email) IN ('mo.dowaik@gmail.com', 'nayra112002@gmail.com')
  ) THEN
    RAISE EXCEPTION 'The platform administrator account cannot delete itself';
  END IF;

  SELECT role, COALESCE(academy_id, public.current_academy_id())
    INTO v_role, v_academy
  FROM public.profiles
  WHERE id = v_uid;

  BEGIN
    -- Mirror the storage trigger's guards: receipts and avatars uploaded by
    -- this account may be removed as part of the deletion.
    ALTER TABLE storage.objects DISABLE TRIGGER protect_delete;
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
    ALTER TABLE storage.objects ENABLE TRIGGER protect_delete;
  EXCEPTION
    WHEN OTHERS THEN
      ALTER TABLE storage.objects ENABLE TRIGGER protect_delete;
      RAISE;
  END;

  IF v_role = 'admin' AND v_academy IS NOT NULL THEN
    DELETE FROM public.academies WHERE id = v_academy;
  END IF;

  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- 5. Academy deletion: both platform admins survive any academy deletion.
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

  -- The platform super-admins (verified Auth emails) must survive any academy
  -- deletion: is_super_admin()/isPlatformAdmin() are email-based, so deleting
  -- their auth rows would silently strip the platform of its last admin.
  SELECT array_agg(id) INTO v_protected_ids
  FROM public.profiles
  WHERE id = ANY(v_user_ids)
    AND EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = profiles.id
        AND lower(u.email) IN ('mo.dowaik@gmail.com', 'nayra112002@gmail.com')
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
  -- protected platform admin accounts.
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
