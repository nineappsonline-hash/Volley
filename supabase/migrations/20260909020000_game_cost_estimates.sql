-- Estimates snapshot the playground hourly price at creation, excluding platform fees.
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS min_players INTEGER NOT NULL DEFAULT 2 CHECK (min_players >= 2),
  ADD COLUMN IF NOT EXISTS duration_hours NUMERIC NOT NULL DEFAULT 1 CHECK (duration_hours > 0 AND duration_hours <= 24),
  ADD COLUMN IF NOT EXISTS playground_hourly_rate NUMERIC CHECK (playground_hourly_rate >= 0 AND playground_hourly_rate <> 'NaN'::numeric);
ALTER TABLE public.friendly_games DROP CONSTRAINT IF EXISTS friendly_games_player_range;
ALTER TABLE public.friendly_games ADD CONSTRAINT friendly_games_player_range CHECK (min_players <= max_players);
-- Older games keep an unknown price: their original duration/quote was not captured.
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT);
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
  p_fee_method     TEXT DEFAULT NULL,
  p_fee_receipt_url TEXT DEFAULT NULL,
  p_gender         TEXT DEFAULT 'mixed',
  p_min_age        INTEGER DEFAULT NULL,
  p_max_age        INTEGER DEFAULT NULL,
  p_invite_code    TEXT DEFAULT NULL,
  p_min_players INTEGER DEFAULT 2,
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
  v_venue  public.venues%ROWTYPE;
  v_code   TEXT;
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

  -- Playground must be one of the platform's selectable pool venues.
  IF p_playground_id IS NOT NULL THEN
    SELECT * INTO v_venue
    FROM public.venues
    WHERE id = p_playground_id AND academy_id IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Playground not available';
    END IF;
  END IF;

  -- Payment: same three methods as subscriptions; kashier is not live yet.
  IF p_fee_method IS NULL OR p_fee_method NOT IN ('instapay', 'e_wallet', 'kashier') THEN
    RAISE EXCEPTION 'A payment method is required to create a friendly game';
  END IF;
  IF p_fee_method = 'kashier' THEN
    RAISE EXCEPTION 'Kashier gateway is not available yet';
  END IF;
  IF p_fee_receipt_url IS NULL OR btrim(p_fee_receipt_url) = '' THEN
    RAISE EXCEPTION 'A receipt is required to confirm the game creation fee';
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

  SELECT name INTO v_name FROM public.profiles WHERE id = v_member;
  v_name := COALESCE(NULLIF(btrim(v_name), ''), 'Member');

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
    (creator_id, creator_name, sport, title, description, area, location, lat, lng,
     playground_id, game_date, start_time, max_players, min_players, duration_hours, playground_hourly_rate, skill_level, is_public,
     recurrence, invite_code, gender, min_age, max_age,
     creation_fee_paid, fee_status, fee_method, fee_receipt_url)
  VALUES
    (v_member,
     v_name,
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
     CASE WHEN p_skill_level IN ('beginner', 'intermediate', 'advanced')
          THEN p_skill_level ELSE NULL END,
     COALESCE(p_is_public, TRUE),
     CASE WHEN p_recurrence IN ('weekly') THEN p_recurrence ELSE NULL END,
     v_code,
     p_gender,
     p_min_age,
     p_max_age,
     FALSE,
     'pending',
     p_fee_method,
     p_fee_receipt_url)
  RETURNING id INTO v_game;

  INSERT INTO public.friendly_game_participants (game_id, member_id, role)
  VALUES (v_game, v_member, 'organizer');

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
  INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, NUMERIC
) TO authenticated;


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
          (creator_id, creator_name, sport, title, description, area, location,
           lat, lng, game_date, start_time, max_players, skill_level, is_public,
           status, source_game_id, recurrence, playground_id, min_players, duration_hours, playground_hourly_rate)
        VALUES
          (v_parent.creator_id, v_parent.creator_name, v_parent.sport,
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
          INSERT INTO public.friendly_game_participants (game_id, member_id, role)
          SELECT v_new_id, member_id, role
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
