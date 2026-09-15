-- Friendly game pricing: the per-player fee and the share divisor are
-- sport-aware. Padel carries a 40 EGP fee and divides by 4; Football and
-- Volleyball divide by a fixed billable headcount of 10 (regardless of the
-- minimum players the organizer picks) and other sports use the chosen minimum.
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
  p_duration_hours NUMERIC DEFAULT 1,
  p_host_pays      BOOLEAN DEFAULT FALSE
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
  v_court  INTEGER;
  v_code   TEXT;
  v_share  NUMERIC;
  v_host_total NUMERIC;
  v_fee    NUMERIC;
  v_billable INTEGER;
BEGIN
  v_fee := CASE WHEN btrim(lower(p_sport)) = 'padel' THEN 40 ELSE 20 END;
  v_billable := CASE
    WHEN btrim(lower(p_sport)) IN ('football', 'volleyball') THEN 10
    WHEN btrim(lower(p_sport)) = 'padel' THEN 4
    ELSE p_min_players END;
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

  IF p_playground_id IS NOT NULL THEN
    SELECT * INTO v_venue
    FROM public.venues
    WHERE id = p_playground_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Playground not available';
    END IF;
    v_court := public.pick_free_court(
      p_playground_id, p_game_date, p_start_time, round(p_duration_hours * 60)::int, NULL, NULL
    );
    IF v_court IS NULL THEN
      RAISE EXCEPTION 'All courts are booked for this time — pick another time or playground';
    END IF;
  END IF;

  -- Padel bills 4 players by default and carries a 40 EGP per-player fee;
  -- everything else uses a 20 EGP fee. Split shares are always divided by the
  -- sport's billable headcount (Football/Volleyball 10, Padel 4) regardless of
  -- the minimum players the organizer picks; other sports use the chosen min.
  IF p_host_pays THEN
    IF v_venue.rental_cost IS NOT NULL AND v_venue.rental_cost >= 0 THEN
      v_host_total := round(v_venue.rental_cost * p_duration_hours, 2) + v_fee;
    ELSE
      v_host_total := v_fee;
    END IF;
    v_share := 0;
  ELSIF v_venue.rental_cost IS NOT NULL AND v_venue.rental_cost >= 0 THEN
    v_share := round((v_venue.rental_cost * p_duration_hours) / v_billable, 2) + v_fee;
  ELSE
    v_share := v_fee;
  END IF;

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
     playground_id, court_number, game_date, start_time, max_players, min_players, duration_hours, playground_hourly_rate, share_price, skill_level, is_public,
     recurrence, invite_code, gender, min_age, max_age, host_pays, host_total)
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
     v_court,
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
     p_max_age,
     p_host_pays,
     CASE WHEN p_host_pays THEN v_host_total ELSE NULL END)
  RETURNING id INTO v_game;

  INSERT INTO public.friendly_game_participants
    (game_id, member_id, role, player_name, share_amount, pay_status)
  VALUES (v_game, v_member, 'organizer', v_name,
          CASE WHEN p_host_pays THEN v_host_total ELSE v_share END,
          'unpaid');

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
  INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, NUMERIC, BOOLEAN
) TO authenticated;

