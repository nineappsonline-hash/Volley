-- Family members: parents (members) manage their children as academy members
-- without creating separate login accounts.
--
-- Design notes:
--   • A child is a normal `profiles` row (role 'member', is_active true) with a
--     synthetic UUID as id — no auth.users row exists for it.
--   • `guardian_id` links the child profile to the parent's profile.
--   • Children have no email; profiles.email is now nullable (children only).
--   • The child's member records (attendance, payments, evaluations, badges,
--     activity) cascade off the profiles row like any other member.
--   • All creation/editing/deletion goes through SECURITY DEFINER RPCs that
--     enforce `guardian_id = auth.uid()`.

-- 1. Children have no auth account, so profiles.id must not be FK-constrained
--    to auth.users. (Account deletion now removes the profile explicitly —
--    delete_my_account and the platform-admin API are updated below.)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Children have no login email.
ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

-- 3. Link a member (parent) to he child profiles they manage.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS guardian_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_guardian ON public.profiles(guardian_id);

-- 4. Prevent non-admins from re-assigning a guardian (no self-adoption /
--    stealing another member's child by editing the child row directly).
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') THEN
    IF NEW.guardian_id IS DISTINCT FROM OLD.guardian_id
       OR ((auth.uid() IS NULL OR auth.uid() = NEW.id)
           AND (NEW.role IS DISTINCT FROM OLD.role
                OR NEW.email IS DISTINCT FROM OLD.email
                OR NEW.id IS DISTINCT FROM OLD.id
                OR NEW.join_date IS DISTINCT FROM OLD.join_date
                OR (NEW.academy_id IS DISTINCT FROM OLD.academy_id
                    AND NOT (OLD.academy_id IS NULL AND NEW.is_active = FALSE)))) THEN
      RAISE EXCEPTION 'Not allowed to change restricted profile fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. RPCs: parents create / edit / remove their own children.

DROP FUNCTION IF EXISTS public.add_family_member(TEXT, TEXT, DATE, TEXT, TEXT, INTEGER, DATE);
CREATE OR REPLACE FUNCTION public.add_family_member(
  p_name                   TEXT,
  p_gender                 TEXT DEFAULT NULL,
  p_birth_date             DATE DEFAULT NULL,
  p_phone                  TEXT DEFAULT NULL,
  p_membership_type        TEXT DEFAULT 'full',
  p_subscription_sessions  INTEGER DEFAULT 0,
  p_join_date              DATE DEFAULT CURRENT_DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_academy  UUID;
  v_role     TEXT;
  v_id       UUID := gen_random_uuid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_gender IS NOT NULL AND p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Invalid gender';
  END IF;
  IF p_membership_type IS NULL OR p_membership_type NOT IN ('full', 'half') THEN
    RAISE EXCEPTION 'Invalid membership type';
  END IF;
  IF p_subscription_sessions < 0 THEN
    RAISE EXCEPTION 'Sessions cannot be negative';
  END IF;

  SELECT role, academy_id INTO v_role, v_academy
  FROM public.profiles
  WHERE id = v_uid;

  IF v_role <> 'member' THEN
    RAISE EXCEPTION 'Only members can add family members';
  END IF;
  IF v_academy IS NULL THEN
    RAISE EXCEPTION 'Join an academy first to add family members';
  END IF;

  INSERT INTO public.profiles (
    id, academy_id, email, role, name, phone, gender, birth_date, join_date,
    membership_type, subscription_sessions, is_active,
    community_visible, notify_game_alerts, guardian_id
  ) VALUES (
    v_id, v_academy, NULL, 'member', btrim(p_name), NULLIF(p_phone, ''),
    NULLIF(p_gender, ''), p_birth_date, COALESCE(p_join_date, CURRENT_DATE),
    p_membership_type, p_subscription_sessions, TRUE,
    FALSE, FALSE, v_uid
  );

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_family_member(TEXT, TEXT, DATE, TEXT, TEXT, INTEGER, DATE) TO authenticated;

DROP FUNCTION IF EXISTS public.update_family_member(UUID, TEXT, TEXT, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.update_family_member(
  p_child_id    UUID,
  p_name        TEXT DEFAULT NULL,
  p_gender      TEXT DEFAULT NULL,
  p_birth_date  DATE DEFAULT NULL,
  p_phone       TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_gender IS NOT NULL AND p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Invalid gender';
  END IF;

  UPDATE public.profiles SET
    name      = btrim(p_name),
    gender    = NULLIF(p_gender, ''),
    birth_date = p_birth_date,
    phone     = NULLIF(p_phone, '')
  WHERE id = p_child_id AND guardian_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Family member not found';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_family_member(UUID, TEXT, TEXT, DATE, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.remove_family_member(UUID);
CREATE OR REPLACE FUNCTION public.remove_family_member(
  p_child_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.profiles
  WHERE id = p_child_id AND guardian_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Family member not found';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_family_member(UUID) TO authenticated;

-- 6. Explicit guardian read access to the child profile row (defense in depth;
--    the academy-wide member reads already expose per-member data).
DROP POLICY IF EXISTS "Guardians read children" ON public.profiles;
CREATE POLICY "Guardians read children" ON public.profiles
  FOR SELECT TO authenticated USING (guardian_id = auth.uid());

-- 7. Account deletion no longer relies on the (dropped) auth.users FK cascade.
--    Removing the profile row still cascades to every member record.
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

  SELECT role, COALESCE(academy_id, public.current_academy_id())
    INTO v_role, v_academy
    FROM public.profiles
    WHERE id = v_uid;

  -- Remove subscription payment screenshots uploaded by this user.
  DELETE FROM storage.objects
  WHERE bucket_id = 'subscription-receipts'
    AND (storage.foldername(name))[1] = v_uid::text;

  IF v_role = 'admin' AND v_academy IS NOT NULL THEN
    -- Remove fee-receipt files the admin uploaded (subfolder = their uid).
    DELETE FROM storage.objects
    WHERE bucket_id = 'game-fee-receipts'
      AND (storage.foldername(name))[1] = v_uid::text;
    -- Cascades to branches, venues, coaches, members, sessions, payments…
    DELETE FROM public.academies WHERE id = v_academy;
  END IF;

  -- Cascades to the profile and every member record created by this user.
  DELETE FROM public.profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;