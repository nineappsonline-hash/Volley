-- Full platform reset: delete every user (auth account, profile, all their
-- content, their academies, and their storage files) EXCEPT the platform
-- super-admin (mo.dowaik).
--
-- Result: only mo.dowaik remains; every deleted email is freed so those users
-- can create brand-new accounts.
--
-- Run in the Supabase SQL editor (postgres role). Everything is wrapped in a
-- single atomic block: if any step fails, nothing is changed.

DO $$
DECLARE
  v_survive_auth_id     UUID;
  v_survive_profile_ids UUID[];
  v_keep_academy_id     UUID;
  v_deleted_auth        INTEGER;
  v_deleted_profiles    INTEGER;
  v_deleted_academies   INTEGER;
BEGIN
  -- The super-admin is identified the same way the app gates admin access:
  -- the verified Auth email mo.dowaik@gmail.com. Never by username alone.
  SELECT id INTO v_survive_auth_id
  FROM auth.users
  WHERE lower(email) = 'mo.dowaik@gmail.com';

  IF v_survive_auth_id IS NULL THEN
    RAISE EXCEPTION 'Super-admin auth user mo.dowaik@gmail.com not found. Aborting.';
  END IF;

  -- The matching profile(s): same id, same email, or the mo.dowaik username.
  v_survive_profile_ids := ARRAY(
    SELECT id FROM public.profiles
    WHERE id = v_survive_auth_id
       OR username = 'mo.dowaik'
       OR lower(email) = 'mo.dowaik@gmail.com'
  );

  IF cardinality(v_survive_profile_ids) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 super-admin profile but found % (ids: %). Aborting.',
      cardinality(v_survive_profile_ids), v_survive_profile_ids;
  END IF;

  -- Keep only the academy the super-admin belongs to (probably none).
  SELECT academy_id INTO v_keep_academy_id
  FROM public.profiles
  WHERE id = v_survive_profile_ids[1];

  -- 1. People and everything they own. profile cascades clean up payments,
  -- attendance, memberships, friendly games (+ participants + chat),
  -- notifications, blocks, subscriptions, scout notes, goals, renewals, etc.
  DELETE FROM public.profiles
  WHERE NOT (id = ANY(v_survive_profile_ids));
  GET DIAGNOSTICS v_deleted_profiles = ROW_COUNT;

  -- 2. Academies (and via CASCADE every venue, session, sport, team,
  -- membership plan, expense, tournament, photo, booking, rating, ...).
  DELETE FROM public.academies
  WHERE id IS DISTINCT FROM v_keep_academy_id;
  GET DIAGNOSTICS v_deleted_academies = ROW_COUNT;

  -- 3. Moderation reports: targets have no FK, so remove them explicitly.
  DELETE FROM public.reports;

  -- 4. Storage files uploaded by deleted users/academies (receipts, avatars,
  -- photos). The super-admin's own avatar and receipts are kept.
  DELETE FROM storage.objects
  WHERE bucket_id IN ('avatars', 'session-photos', 'academy-media',
                      'game-fee-receipts', 'subscription-receipts')
    AND NOT (
      name LIKE 'avatars/' || v_survive_profile_ids[1]::text || '/%'
      OR name LIKE v_survive_profile_ids[1]::text || '/%'
    );

  -- 5. Free the deleted emails (and any orphaned accounts) for re-signup.
  DELETE FROM auth.users WHERE id <> v_survive_auth_id;
  GET DIAGNOSTICS v_deleted_auth = ROW_COUNT;

  RAISE NOTICE 'Reset complete: % auth users, % profiles, % academies deleted. '
               'Kept auth % / profile % / academy %.',
    v_deleted_auth, v_deleted_profiles, v_deleted_academies,
    v_survive_auth_id, v_survive_profile_ids[1], v_keep_academy_id;
END $$;