-- Player nicknames for games and tournaments.
--
-- A nickname is an optional, free-form display name (e.g. "الصقر", "Bebo")
-- shown wherever a member appears as a *participant*: friendly-game rosters,
-- game chat, tournament team rosters. It is deliberately NOT unique and NOT
-- the @username handle: the handle stays the technical identifier, the
-- nickname is what teammates actually call you. Falls back to profile name
-- when unset.
--
-- Resolution order everywhere: nickname → name.

-- 1. The column (family members without logins get one too, via the RPCs).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname TEXT;

-- Backfill: none — nickname starts empty for everyone; name remains shown
-- until a member chooses one.

-- 2. Single resolution helper so every surface agrees on the display name.
CREATE OR REPLACE FUNCTION public.player_display_name(p_profile public.profiles)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(btrim(COALESCE(p_profile.nickname, '')), ''),
    NULLIF(btrim(COALESCE(p_profile.name, '')), ''),
    'Member'
  );
$$;

-- 3. Friendly games: snapshot the creator's display name at creation.
--    (Snapshots keep rosters readable without cross-academy profile reads —
--    the same reason chat already snapshots sender_name.)
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS creator_nickname TEXT;

UPDATE public.friendly_games f
SET creator_nickname = p.nickname
FROM public.profiles p
WHERE p.id = f.creator_id AND f.creator_nickname IS NULL;

-- 4. Participants: snapshot the player's display name when they join.
--    This is the column rosters render; it needs no profile lookup at read
--    time, so rosters work for any authenticated member regardless of the
--    per-academy profile RLS.
ALTER TABLE public.friendly_game_participants
  ADD COLUMN IF NOT EXISTS player_name TEXT;

UPDATE public.friendly_game_participants fp
SET player_name = public.player_display_name(p)
FROM public.profiles p
WHERE p.id = fp.member_id AND fp.player_name IS NULL;

-- 5. create_friendly_game: snapshot creator display name + nickname, and
--    stamp the organizer's player_name on their participant row.
--    (Full re-declaration: only the name-resolution lines changed.)
CREATE OR REPLACE FUNCTION public.create_friendly_game(
  p_title          TEXT,
  p_sport          TEXT,
  p_game_date      DATE,
  p_start_time     TIME,
  p_playground_id  UUID DEFAULT NULL,
  p_area           TEXT DEFAULT NULL,
  p_location       TEXT DEFAULT NULL,
  p_lat            DOUBLE PRECISION DEFAULT NULL,
  p_lng            DOUBLE PRECISION DEFAULT NULL,
  p_max_players    INTEGER DEFAULT 12,
  p_skill_level    TEXT DEFAULT NULL,
  p_description    TEXT DEFAULT NULL,
  p_is_public      BOOLEAN DEFAULT TRUE,
  p_recurrence     TEXT DEFAULT NULL,
  p_gender         TEXT DEFAULT 'mixed',
  p_min_age        INTEGER DEFAULT NULL,
  p_max_age        INTEGER DEFAULT NULL,
  p_invite_code    TEXT DEFAULT NULL,
  p_min_players    INTEGER DEFAULT 2,
  p_duration_hours NUMERIC DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_game   UUID;
  v_name   TEXT;
  v_username TEXT;
  v_venue  public.venues%ROWTYPE;
  v_code   TEXT;
  v_share  NUMERIC;
BEGIN
  IF p_min_players IS NULL OR p_max_players IS NULL OR p_min_players < 2 OR p_max_players < p_min_players THEN
    RAISE EXCEPTION 'Minimum players must be at least 2 and no greater than maximum players';
  END IF;
  IF p_duration_hours IS NULL OR p_duration_hours <= 0 OR p_duration_hours > 24 OR p_duration_hours = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Duration must be greater than zero and at most 24 hours';
  END IF;
  v_member := auth.uid();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  IF p_sport IS NULL OR btrim(p_sport) = '' THEN
    RAISE EXCEPTION 'Sport is required';
  END IF;
  IF p_game_date IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Date and time are required';
  END IF;

  -- Playground must be a selectable venue (pool or academy playground).
  -- There is no game-creation fee; each participant pays their share upfront
  -- when they join, so the game can be created freely.
  IF p_playground_id IS NOT NULL THEN
    SELECT * INTO v_venue
    FROM public.venues
    WHERE id = p_playground_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Playground not available';
    END IF;
  END IF;

  -- Per-player share = playground portion (rental × duration ÷ min players)
  -- plus the hidden platform fee, folded into a single price.
  IF v_venue.rental_cost IS NOT NULL AND v_venue.rental_cost >= 0 THEN
    v_share := round((v_venue.rental_cost * p_duration_hours) / p_min_players, 2) + 20;
  ELSE
    v_share := 20;
  END IF;

  -- Join criteria.
  IF p_gender IS NULL OR p_gender NOT IN ('male', 'female', 'mixed') THEN
    RAISE EXCEPTION 'Invalid gender criteria';
  END IF;
  IF (p_min_age IS NOT NULL AND (p_min_age < 0 OR p_min_age > 120))
     OR (p_max_age IS NOT NULL AND (p_max_age < 0 OR p_max_age > 120)) THEN
    RAISE EXCEPTION 'Invalid age range';
  END IF;
  IF p_min_age IS NOT NULL AND p_max_age IS NOT NULL AND p_min_age > p_max_age THEN
    RAISE EXCEPTION 'Invalid age range';
  END IF;

  SELECT name, username INTO v_name, v_username FROM public.profiles WHERE id = v_member;
  v_name := public.player_display_name(
    (SELECT p FROM public.profiles p WHERE p.id = v_member)
  );

  -- Private games get a shareable invite code (generated when not provided).
  IF p_is_public = FALSE THEN
    v_code := upper(btrim(COALESCE(p_invite_code, '')));
    IF v_code = '' THEN
      LOOP
        v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.friendly_games WHERE invite_code = v_code
        );
      END LOOP;
    END IF;
    IF v_code !~ '^[A-Z0-9]{4,16}$' THEN
      RAISE EXCEPTION 'Invalid invite code';
    END IF;
  END IF;

  INSERT INTO public.friendly_games
    (creator_id, creator_name, creator_username, creator_nickname, sport, title, description, area, location, lat, lng,
     playground_id, game_date, start_time, max_players, min_players, duration_hours, playground_hourly_rate, share_price, skill_level, is_public,
     recurrence, invite_code, gender, min_age, max_age)
  VALUES
    (v_member,
     v_name,
     v_username,
     NULLIF(btrim(COALESCE((SELECT nickname FROM public.profiles WHERE id = v_member), '')), ''),
     btrim(p_sport),
     btrim(p_title),
     NULLIF(btrim(COALESCE(p_description, '')), ''),
     COALESCE(NULLIF(btrim(COALESCE(p_area, '')), ''), v_venue.area),
     COALESCE(NULLIF(btrim(COALESCE(p_location, '')), ''), v_venue.name),
     CASE WHEN v_venue.lat IS NOT NULL THEN v_venue.lat
          WHEN p_lat BETWEEN -90 AND 90 THEN p_lat ELSE NULL END,
     CASE WHEN v_venue.lng IS NOT NULL THEN v_venue.lng
          WHEN p_lng BETWEEN -180 AND 180 THEN p_lng ELSE NULL END,
     p_playground_id,
     p_game_date,
     p_start_time,
     p_max_players,
     p_min_players,
     p_duration_hours,
     CASE WHEN v_venue.rental_cost >= 0 THEN v_venue.rental_cost ELSE NULL END,
     v_share,
     CASE WHEN p_skill_level IN ('beginner', 'intermediate', 'advanced')
          THEN p_skill_level ELSE NULL END,
     COALESCE(p_is_public, TRUE),
     CASE WHEN p_recurrence IN ('weekly') THEN p_recurrence ELSE NULL END,
     v_code,
     p_gender,
     p_min_age,
     p_max_age)
  RETURNING id INTO v_game;

  -- The creator is always the organizer participant; they owe their share too.
  INSERT INTO public.friendly_game_participants
    (game_id, member_id, role, player_name, share_amount, pay_status)
  VALUES (v_game, v_member, 'organizer', v_name, v_share, 'unpaid');

  -- Alert members who opted in to matching-sport game alerts (capped).
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT
    p.id,
    'game_alert',
    'New ' || btrim(p_sport) || ' game',
    btrim(p_title),
    '/games'
  FROM public.profiles p
  WHERE p.id <> v_member
    AND p.notify_game_alerts = TRUE
    AND p.interested_sports @> ARRAY[btrim(p_sport)]
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE b.blocker_id = p.id AND b.blocked_id = v_member
    )
  LIMIT 100;

  RETURN v_game;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_friendly_game(
  TEXT, TEXT, DATE, TIME, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION,
  INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, NUMERIC
) TO authenticated;

-- 6. join_friendly_game: snapshot the joiner's display name on their row and
--    use it in the organizer notification.
CREATE OR REPLACE FUNCTION public.join_friendly_game(
  p_game_id UUID,
  p_invite_code TEXT DEFAULT NULL,
  p_pay_method TEXT DEFAULT NULL,
  p_pay_receipt_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_game   friendly_games;
  v_count  INTEGER;
  v_prof   profiles%ROWTYPE;
  v_age    INTEGER;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- Private games require the invite code from the shared link.
  IF NOT v_game.is_public THEN
    IF p_invite_code IS NULL
       OR upper(btrim(p_invite_code)) <> v_game.invite_code THEN
      RAISE EXCEPTION 'This game is private — use the invite link to join';
    END IF;
  END IF;

  IF v_game.status NOT IN ('open', 'full') THEN
    RAISE EXCEPTION 'This game is no longer open';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendly_game_participants
    WHERE game_id = p_game_id AND member_id = v_member
  ) THEN
    RAISE EXCEPTION 'You already joined this game';
  END IF;

  -- Gender criteria.
  IF v_game.gender IN ('male', 'female') THEN
    SELECT * INTO v_prof FROM public.profiles WHERE id = v_member;
    IF v_prof.gender IS NULL THEN
      RAISE EXCEPTION 'Add your gender to your profile to join this game';
    END IF;
    IF v_prof.gender <> v_game.gender THEN
      RAISE EXCEPTION 'This game is for % players only', v_game.gender;
    END IF;
  END IF;

  -- Age criteria.
  IF v_game.min_age IS NOT NULL OR v_game.max_age IS NOT NULL THEN
    IF v_prof.id IS NULL THEN
      SELECT * INTO v_prof FROM public.profiles WHERE id = v_member;
    END IF;
    IF v_prof.birth_date IS NULL THEN
      RAISE EXCEPTION 'Add your birth date to your profile to join this game';
    END IF;
    v_age := date_part('year', age(current_date, v_prof.birth_date))::INTEGER;
    IF v_game.min_age IS NOT NULL AND v_age < v_game.min_age THEN
      RAISE EXCEPTION 'This game is for ages % and up', v_game.min_age;
    END IF;
    IF v_game.max_age IS NOT NULL AND v_age > v_game.max_age THEN
      RAISE EXCEPTION 'This game is for ages up to %', v_game.max_age;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
  IF v_count >= v_game.max_players THEN
    RAISE EXCEPTION 'This game is full';
  END IF;

  -- Every player pays their share (playground portion + hidden platform fee)
  -- upfront, then uploads a receipt for super-admin verification. The spot
  -- counts right away and is removed again if the payment turns out fake.
  IF p_pay_method IS NULL OR p_pay_method NOT IN ('instapay', 'e_wallet') THEN
    RAISE EXCEPTION 'A payment method is required to join a friendly game';
  END IF;
  IF p_pay_receipt_url IS NULL OR btrim(p_pay_receipt_url) = '' THEN
    RAISE EXCEPTION 'A receipt is required to confirm your share payment';
  END IF;

  INSERT INTO public.friendly_game_participants
    (game_id, member_id, role, player_name, share_amount, pay_method, pay_receipt_url, pay_status)
  VALUES (p_game_id, v_member, 'player',
          (SELECT public.player_display_name(p) FROM public.profiles p WHERE p.id = v_member),
          v_game.share_price, p_pay_method, btrim(p_pay_receipt_url), 'pending');

  -- Tell the organizer someone joined (unless it's their own game).
  IF v_game.creator_id <> v_member THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.creator_id,
      'game_join',
      'Someone joined your game',
      (SELECT public.player_display_name(p) FROM public.profiles p WHERE p.id = v_member)
        || ' joined ' || btrim(v_game.title) || '.',
      '/games'
    );
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
  IF v_count >= v_game.max_players AND v_game.status = 'open' THEN
    UPDATE public.friendly_games SET status = 'full' WHERE id = p_game_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.creator_id,
      'game_filled',
      'Your game is full',
      btrim(v_game.title) || ' just filled up — get ready to play!',
      '/games'
    );
  END IF;

  RETURN p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_friendly_game(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 7. send_game_message: chat shows the nickname too.
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
  -- Chat shows the nickname (falls back to name) like every other surface.
  v_name := public.player_display_name(
    (SELECT p FROM public.profiles p WHERE p.id = v_uid)
  );
  INSERT INTO public.friendly_game_messages(id, game_id, sender_id, sender_name, sender_username, body)
  VALUES (p_message_id, p_game_id, v_uid, v_name, v_username, btrim(p_body));
  RETURN p_message_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_game_message(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_game_message(UUID, TEXT, UUID) TO authenticated;

-- 8. Keep creator_nickname fresh on the game row when the member changes it.
CREATE OR REPLACE FUNCTION public.sync_participant_display_names()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.friendly_game_participants fp
  SET player_name = public.player_display_name(p)
  FROM public.profiles p
  WHERE p.id = fp.member_id AND fp.member_id = NEW.id;

  UPDATE public.friendly_games g
  SET creator_nickname = NULLIF(btrim(COALESCE(NEW.nickname, '')), ''),
      creator_name = public.player_display_name(NEW)
  WHERE g.creator_id = NEW.id;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_sync_display_names_trigger ON public.profiles;
CREATE TRIGGER profiles_sync_display_names_trigger
AFTER UPDATE OF nickname, name ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_participant_display_names();

-- 9. add/update family member RPCs: parents can set a child's nickname.
--    (Faithful re-declaration of the existing RPCs; nickname param appended.)
DROP FUNCTION IF EXISTS public.add_family_member(TEXT, TEXT, DATE, TEXT, TEXT, INTEGER, DATE);
CREATE OR REPLACE FUNCTION public.add_family_member(
  p_name                   TEXT,
  p_gender                 TEXT DEFAULT NULL,
  p_birth_date             DATE DEFAULT NULL,
  p_phone                  TEXT DEFAULT NULL,
  p_membership_type        TEXT DEFAULT 'full',
  p_subscription_sessions  INTEGER DEFAULT 0,
  p_join_date              DATE DEFAULT CURRENT_DATE,
  p_nickname               TEXT DEFAULT NULL
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
    id, academy_id, email, role, name, nickname, phone, gender, birth_date, join_date,
    membership_type, subscription_sessions, is_active,
    community_visible, notify_game_alerts, guardian_id
  ) VALUES (
    v_id, v_academy, NULL, 'member', btrim(p_name),
    NULLIF(btrim(COALESCE(p_nickname, '')), ''), NULLIF(p_phone, ''),
    NULLIF(p_gender, ''), p_birth_date, COALESCE(p_join_date, CURRENT_DATE),
    p_membership_type, p_subscription_sessions, TRUE,
    FALSE, FALSE, v_uid
  );

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.add_family_member(TEXT, TEXT, DATE, TEXT, TEXT, INTEGER, DATE, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.update_family_member(UUID, TEXT, TEXT, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.update_family_member(
  p_child_id    UUID,
  p_name        TEXT DEFAULT NULL,
  p_gender      TEXT DEFAULT NULL,
  p_birth_date  DATE DEFAULT NULL,
  p_phone       TEXT DEFAULT NULL,
  p_nickname    TEXT DEFAULT NULL
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
    name       = btrim(p_name),
    nickname   = CASE
      WHEN p_nickname IS NULL THEN nickname        -- param omitted → keep
      WHEN btrim(p_nickname) = '' THEN NULL        -- empty string → clear
      ELSE btrim(p_nickname)                        -- set
    END,
    gender     = NULLIF(p_gender, ''),
    birth_date = p_birth_date,
    phone      = NULLIF(p_phone, '')
  WHERE id = p_child_id AND guardian_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Family member not found';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_family_member(UUID, TEXT, TEXT, DATE, TEXT, TEXT) TO authenticated;

-- 10. Community views show the nickname too (fallback order handled above).
DROP VIEW IF EXISTS public.community_members;
CREATE VIEW public.community_members AS
SELECT
  p.id,
  p.name,
  p.username,
  public.player_display_name(p) AS display_name,
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

-- 11. Recurring series: child instances inherit the creator's nickname and
--      carried-over roster rows keep the snapshotted player_name.
CREATE OR REPLACE FUNCTION public.materialize_recurring_games()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent    public.friendly_games%ROWTYPE;
  v_dt        DATE;
  v_new_id    UUID;
  v_anchor    UUID;
  v_created   INTEGER := 0;
  v_horizon   DATE := CURRENT_DATE + 56;
BEGIN
  FOR v_parent IN
    SELECT fg.* FROM public.friendly_games fg
    WHERE fg.recurrence = 'weekly'
      AND fg.source_game_id IS NULL
      AND fg.status IN ('open', 'full')
  LOOP
    v_dt := v_parent.game_date + 1;
    -- Fill any missed slots between today and the horizon.
    IF v_dt < CURRENT_DATE THEN v_dt := CURRENT_DATE; END IF;
    WHILE v_dt <= v_horizon LOOP
      IF date_part('isodow', v_dt) = date_part('isodow', v_parent.game_date)
         AND NOT EXISTS (
           SELECT 1 FROM public.friendly_games f
           WHERE f.source_game_id = v_parent.id AND f.game_date = v_dt
         )
      THEN
        INSERT INTO public.friendly_games
          (creator_id, creator_name, creator_nickname, sport, title, description, area, location,
           lat, lng, game_date, start_time, max_players, skill_level, is_public,
           status, source_game_id, recurrence, playground_id, min_players, duration_hours, playground_hourly_rate)
        VALUES
          (v_parent.creator_id, v_parent.creator_name, v_parent.creator_nickname, v_parent.sport,
           v_parent.title, v_parent.description, v_parent.area, v_parent.location,
           v_parent.lat, v_parent.lng, v_dt, v_parent.start_time,
           v_parent.max_players, v_parent.skill_level, v_parent.is_public,
           'open', v_parent.id, 'weekly', v_parent.playground_id, v_parent.min_players, v_parent.duration_hours, v_parent.playground_hourly_rate)
        RETURNING id INTO v_new_id;

        -- Carry the roster over from the most recent past occurrence.
        SELECT f2.id INTO v_anchor
        FROM public.friendly_games f2
        WHERE (f2.source_game_id = v_parent.id OR f2.id = v_parent.id)
          AND f2.game_date < v_dt AND f2.status <> 'cancelled'
        ORDER BY f2.game_date DESC, f2.id DESC LIMIT 1;
        IF v_anchor IS NOT NULL THEN
          INSERT INTO public.friendly_game_participants (game_id, member_id, role, player_name)
          SELECT v_new_id, member_id, role, player_name
          FROM public.friendly_game_participants
          WHERE game_id = v_anchor
          ON CONFLICT DO NOTHING;
        END IF;

        v_created := v_created + 1;
      END IF;
      v_dt := v_dt + 1;
    END LOOP;
  END LOOP;
  RETURN v_created;
END;
$$;
GRANT EXECUTE ON FUNCTION public.materialize_recurring_games() TO authenticated;

NOTIFY pgrst, 'reload schema';
