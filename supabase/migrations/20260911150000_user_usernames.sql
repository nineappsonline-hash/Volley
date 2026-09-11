-- User usernames: a unique, slug-style handle (@username) collected at signup
-- and used as the primary way to distinguish members across the community.

-- 1. Helper: turn arbitrary text into a guaranteed-unique lowercase handle.
CREATE OR REPLACE FUNCTION public.make_unique_username(p_base TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base      TEXT;
  v_candidate TEXT;
  v_n         INTEGER := 0;
BEGIN
  v_base := lower(btrim(COALESCE(p_base, '')));
  v_base := regexp_replace(v_base, '[^a-z0-9_]+', '_', 'g');
  v_base := trim(both '_' FROM v_base);
  IF char_length(v_base) < 3 THEN
    v_base := 'player';
  END IF;
  v_base := left(v_base, 20);
  LOOP
    v_candidate := CASE WHEN v_n = 0 THEN v_base ELSE v_base || '_' || v_n END;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE username = v_candidate
    );
    v_n := v_n + 1;
  END LOOP;
  RETURN v_candidate;
END;
$$;
GRANT EXECUTE ON FUNCTION public.make_unique_username(TEXT) TO authenticated;

-- 2. Byte-for-byte availability check a client can call before submitting.
-- SECURITY DEFINER so members can verify other handles despite profiles RLS.
CREATE OR REPLACE FUNCTION public.is_username_taken(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(btrim(p_username)));
$$;
GRANT EXECUTE ON FUNCTION public.is_username_taken(TEXT) TO authenticated;

-- 3. The column itself.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- 4. Backfill existing members from their display name (or email local part).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, name, email FROM public.profiles WHERE username IS NULL ORDER BY created_at
  LOOP
    UPDATE public.profiles
    SET username = public.make_unique_username(
      COALESCE(NULLIF(btrim(r.name), ''), split_part(COALESCE(r.email, ''), '@', 1))
    )
    WHERE id = r.id;
  END LOOP;
END $$;

-- 5. Guarantee a handle on every row that arrives without one (family members,
-- admin-created accounts). Chosen handles are lowercased and stored as-is, so
-- the client must verify availability first.
CREATE OR REPLACE FUNCTION public.profiles_assign_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base TEXT;
BEGIN
  IF NEW.username IS NOT NULL AND btrim(NEW.username) <> '' THEN
    NEW.username := lower(btrim(NEW.username));
    RETURN NEW;
  END IF;
  v_base := COALESCE(NULLIF(btrim(NEW.name), ''), split_part(COALESCE(NEW.email, ''), '@', 1));
  NEW.username := public.make_unique_username(v_base);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_assign_username_trigger ON public.profiles;
CREATE TRIGGER profiles_assign_username_trigger
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_assign_username();

ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_username ON public.profiles (username);

-- 6. Signups carry the chosen handle down into the profiles insert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_name TEXT := trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_name', ''));
  v_new_country TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_country', '')), '');
  v_new_governorate TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_governorate', '')), '');
  v_new_area TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_area', '')), '');
  v_code TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'academy_code', '')), '');
  v_gender TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'gender', '')), '');
  v_birth_date DATE := NULLIF(NEW.raw_user_meta_data ->> 'birth_date', '')::date;
  v_username TEXT := NULLIF(lower(btrim(COALESCE(NEW.raw_user_meta_data ->> 'username', ''))), '');
  v_academy UUID;
  v_venue JSONB;
BEGIN
  IF v_new_name <> '' THEN
    -- A phone number is mandatory to create an academy account. Reject the
    -- whole signup (user + academy) if it is missing or blank.
    IF NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Phone number is required to create an academy account';
    END IF;

    INSERT INTO public.academies (name, slug, country, governorate, area, is_public, is_trial, trial_ends_at, plan)
    VALUES (
      left(v_new_name, 60),
      lower(regexp_replace(left(v_new_name, 40), '[^a-zA-Z0-9]+', '-', 'g'))
        || '-' || left(md5(random()::text), 4),
      v_new_country,
      v_new_governorate,
      v_new_area,
      TRUE,
      TRUE,
      NOW() + INTERVAL '30 days',
      -- New academies start on a 1-month trial of the top (Enterprise/elite)
      -- plan so the whole product is usable during the trial period.
      'elite'
    )
    RETURNING id INTO v_academy;

    INSERT INTO public.membership_plans (academy_id, name, sessions_count)
    VALUES (v_academy, 'Full', 8), (v_academy, 'Half', 4);

    -- Seed only the sports the admin chose at signup so pickers list supported sports.
    INSERT INTO public.sports (academy_id, name)
    SELECT v_academy, trim(az.name)
    FROM unnest(string_to_array(COALESCE(NEW.raw_user_meta_data ->> 'sports', ''), ',')) AS az(name)
    WHERE trim(az.name) <> ''
    ON CONFLICT (academy_id, name) DO NOTHING;

    INSERT INTO public.profiles (id, email, role, name, username, phone, country, gender, birth_date, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'admin',
      COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      v_username,
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
      COALESCE(v_new_country, NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'country', '')), '')),
      v_gender, v_birth_date,
      CURRENT_DATE, v_academy, TRUE
    )
    ON CONFLICT (id) DO NOTHING;

    -- Attach the chosen playgrounds to the new academy: an unassigned pool
    -- playground can be claimed by id, or new ones are created from details.
    FOR v_venue IN
      SELECT value FROM jsonb_array_elements(
        COALESCE(NEW.raw_user_meta_data -> 'new_academy_venues', '[]'::jsonb)
      )
    LOOP
      IF v_venue ? 'id' THEN
        UPDATE public.venues
        SET academy_id = v_academy
        WHERE id = (v_venue ->> 'id')::uuid AND academy_id IS NULL;
      ELSE
        INSERT INTO public.venues (
          academy_id, name, address, capacity, school_name,
          rental_cost, rental_hours, country, governorate, area
        )
        VALUES (
          v_academy,
          trim(v_venue ->> 'name'),
          NULLIF(v_venue ->> 'address', ''),
          NULLIF(v_venue ->> 'capacity', '')::integer,
          NULLIF(v_venue ->> 'school_name', ''),
          NULLIF(v_venue ->> 'rental_cost', '')::numeric,
          COALESCE(NULLIF(v_venue ->> 'rental_hours', '')::numeric, 1),
          COALESCE(v_new_country, NULLIF(v_venue ->> 'country', '')),
          COALESCE(v_new_governorate, NULLIF(v_venue ->> 'governorate', '')),
          COALESCE(v_new_area, NULLIF(v_venue ->> 'area', ''))
        );
      END IF;
    END LOOP;
  ELSE
    IF v_code IS NOT NULL THEN
      SELECT id INTO v_academy FROM public.academies WHERE UPPER(invite_code) = UPPER(v_code);
    END IF;

    INSERT INTO public.profiles (id, email, role, name, username, phone, country, gender, birth_date, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'member',
      COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      v_username,
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'country', '')), ''),
      v_gender, v_birth_date,
      CURRENT_DATE, v_academy, FALSE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Community views expose the handle.
DROP VIEW IF EXISTS public.community_members;
CREATE VIEW public.community_members AS
SELECT
  p.id,
  p.name,
  p.username,
  p.avatar_url,
  p.bio,
  p.academy_id,
  a.name AS academy_name,
  COALESCE(a.area, a.governorate) AS area,
  p.skill_level,
  p.position,
  p.availability_days,
  p.interested_sports,
  p.lat,
  p.lng
FROM public.profiles p
LEFT JOIN public.academies a ON a.id = p.academy_id
WHERE p.community_visible = TRUE
  AND p.name IS NOT NULL;
GRANT SELECT ON public.community_members TO authenticated;

DROP VIEW IF EXISTS public.community_leaderboard;
CREATE VIEW public.community_leaderboard AS
WITH played AS (
  SELECT p.member_id, count(*)::int AS games_played
  FROM public.friendly_game_participants p
  JOIN public.friendly_games g ON g.id = p.game_id
  WHERE g.status = 'completed'
  GROUP BY p.member_id
),
attend AS (
  SELECT a.member_id, count(*)::int AS sessions_attended
  FROM public.attendance a
  JOIN public.training_sessions s ON s.id = a.session_id
  WHERE s.status = 'completed'
  GROUP BY a.member_id
)
SELECT
  pr.id AS member_id,
  pr.name,
  pr.username,
  COALESCE(played.games_played, 0) AS games_played,
  COALESCE(attend.sessions_attended, 0) AS sessions_attended,
  COALESCE(played.games_played, 0) * 2 + COALESCE(attend.sessions_attended, 0) AS points
FROM public.profiles pr
LEFT JOIN played ON played.member_id = pr.id
LEFT JOIN attend ON attend.member_id = pr.id
WHERE pr.name IS NOT NULL
  AND pr.community_visible = TRUE
ORDER BY points DESC;
GRANT SELECT ON public.community_leaderboard TO authenticated;

DROP VIEW IF EXISTS public.sport_leaderboard;
CREATE VIEW public.sport_leaderboard AS
SELECT
  pr.id AS member_id,
  pr.name,
  pr.username,
  played.sport::TEXT AS sport,
  played.games_played,
  played.games_played * 2 AS points,
  row_number() OVER (
    PARTITION BY played.sport
    ORDER BY played.games_played DESC, pr.name ASC
  ) AS rank
FROM (
  SELECT p.member_id, g.sport, count(*)::int AS games_played
  FROM public.friendly_game_participants p
  JOIN public.friendly_games g ON g.id = p.game_id
  WHERE g.status = 'completed'
    AND g.sport IS NOT NULL
    AND btrim(g.sport) <> ''
  GROUP BY p.member_id, g.sport
) played
JOIN public.profiles pr ON pr.id = played.member_id
WHERE pr.name IS NOT NULL
  AND pr.community_visible = TRUE
ORDER BY played.sport, played.games_played DESC;
GRANT SELECT ON public.sport_leaderboard TO authenticated;

-- 8. Friendly games snapshot the creator's handle alongside their name.
ALTER TABLE public.friendly_games ADD COLUMN IF NOT EXISTS creator_username TEXT;
UPDATE public.friendly_games f
SET creator_username = p.username
FROM public.profiles p
WHERE p.id = f.creator_id
  AND f.creator_username IS NULL;

-- 9. Chat snapshots the sender's handle too.
ALTER TABLE public.friendly_game_messages ADD COLUMN IF NOT EXISTS sender_username TEXT;
UPDATE public.friendly_game_messages m
SET sender_username = p.username
FROM public.profiles p
WHERE p.id = m.sender_id
  AND m.sender_username IS NULL;

CREATE OR REPLACE FUNCTION public.send_game_message(p_game_id UUID, p_body TEXT, p_message_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT;
  v_username TEXT;
  v_existing public.friendly_game_messages%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR public.is_account_blocked() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  -- Lock membership until insertion finishes so leaving cannot race this send.
  PERFORM 1 FROM public.friendly_game_participants p
    WHERE p.game_id = p_game_id AND p.member_id = v_uid FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only current game participants can send messages' USING ERRCODE = '42501';
  END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 2000 OR p_message_id IS NULL THEN
    RAISE EXCEPTION 'Message must contain 1 to 2000 characters';
  END IF;
  SELECT * INTO v_existing FROM public.friendly_game_messages WHERE id = p_message_id;
  IF FOUND THEN
    IF v_existing.sender_id = v_uid AND v_existing.game_id = p_game_id AND v_existing.body = btrim(p_body) THEN
      RETURN p_message_id;
    END IF;
    RAISE EXCEPTION 'Message identifier already used';
  END IF;
  SELECT name, username INTO v_name, v_username FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.friendly_game_messages(id, game_id, sender_id, sender_name, sender_username, body)
  VALUES (p_message_id, p_game_id, v_uid, COALESCE(NULLIF(btrim(v_name), ''), 'Member'), v_username, btrim(p_body));
  RETURN p_message_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_game_message(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_game_message(UUID, TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';