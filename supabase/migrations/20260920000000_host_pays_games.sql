-- Friendly games: let the creator cover the whole reservation (host pays).
--
-- When a creator opts in, they cover the full venue rental for the slot plus
-- the hidden platform fee — scene cost = (rental × duration) + 20 EGP (or just
-- 20 EGP when the playground has no price). Everyone else then joins for free:
-- share_price is 0 and joining needs no payment method or receipt. The
-- creator's own participant row carries the full amount and goes through the
-- existing receipt-verification flow (pay_game_share → review_participant_share).

ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS host_pays BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS host_total NUMERIC
    CHECK (host_total IS NULL OR (host_total >= 0 AND host_total <> 'NaN'::numeric));

-- Re-declare create_friendly_game with the p_host_pays flag.
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, NUMERIC);
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
  v_code   TEXT;
  v_share  NUMERIC;
  v_host_total NUMERIC;
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
  -- There is no game-creation fee; participants pay when they join (or the
  -- host covers the whole reservation), so the game can be created freely.
  IF p_playground_id IS NOT NULL THEN
    SELECT * INTO v_venue
    FROM public.venues
    WHERE id = p_playground_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Playground not available';
    END IF;
  END IF;

  -- Pricing:
  --  * host pays: the creator covers the whole reservation — full venue rental
  --    for the slot plus the hidden platform fee; players join for free.
  --  * split: per-player share = playground portion (rental × duration ÷ min
  --    players) plus the hidden platform fee, folded into a single price.
  IF p_host_pays THEN
    IF v_venue.rental_cost IS NOT NULL AND v_venue.rental_cost >= 0 THEN
      v_host_total := round(v_venue.rental_cost * p_duration_hours, 2) + 20;
    ELSE
      v_host_total := 20;
    END IF;
    v_share := 0;
  ELSIF v_venue.rental_cost IS NOT NULL AND v_venue.rental_cost >= 0 THEN
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

  -- The creator is always the organizer participant. In host-pays games they
  -- owe the whole reservation amount; otherwise they owe their own share.
  INSERT INTO public.friendly_game_participants
    (game_id, member_id, role, player_name, share_amount, pay_status)
  VALUES (v_game, v_member, 'organizer', v_name,
          CASE WHEN p_host_pays THEN v_host_total ELSE v_share END,
          'unpaid');

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
  INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, NUMERIC, BOOLEAN
) TO authenticated;

-- joining a host-pays game is free: no payment method or receipt required.
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
  v_name   TEXT;
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

  v_name := public.player_display_name(
    (SELECT p FROM public.profiles p WHERE p.id = v_member)
  );

  IF v_game.host_pays THEN
    -- The host covers the reservation: joining is free, no receipt needed.
    INSERT INTO public.friendly_game_participants
      (game_id, member_id, role, player_name, share_amount, pay_status)
    VALUES (p_game_id, v_member, 'player', v_name, 0, 'approved');
  ELSE
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
    VALUES (p_game_id, v_member, 'player', v_name,
            v_game.share_price, p_pay_method, btrim(p_pay_receipt_url), 'pending');
  END IF;

  -- Tell everyone already in the game someone new joined (skip anyone who
  -- blocked the joiner so they don't get bothered).
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT DISTINCT p.member_id,
         'game_join',
         'Someone joined your game',
         v_name || ' joined ' || btrim(v_game.title) || '.',
         '/games'
  FROM public.friendly_game_participants p
  WHERE p.game_id = p_game_id
    AND p.member_id <> v_member
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE b.blocker_id = p.member_id AND b.blocked_id = v_member
    );

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

-- The organizer (or any already-joined participant) pays their outstanding
-- amount: unpaid -> pending (super admin verifies the receipt). In host-pays
-- games the organizer settles the whole reservation total.
CREATE OR REPLACE FUNCTION public.pay_game_share(
  p_game_id UUID,
  p_pay_method TEXT,
  p_pay_receipt_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game friendly_games;
  v_pid  UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  IF v_game.status NOT IN ('open', 'full') THEN
    RAISE EXCEPTION 'This game is no longer open';
  END IF;

  SELECT id INTO v_pid
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND member_id = auth.uid() AND pay_status = 'unpaid';
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Nothing to pay';
  END IF;

  IF p_pay_method IS NULL OR p_pay_method NOT IN ('instapay', 'e_wallet') THEN
    RAISE EXCEPTION 'A valid payment method is required';
  END IF;
  IF p_pay_receipt_url IS NULL OR btrim(p_pay_receipt_url) = '' THEN
    RAISE EXCEPTION 'A receipt is required to confirm your share payment';
  END IF;

  UPDATE public.friendly_game_participants
  SET share_amount = CASE WHEN v_game.host_pays THEN v_game.host_total ELSE v_game.share_price END,
      pay_method = p_pay_method,
      pay_receipt_url = btrim(p_pay_receipt_url),
      pay_status = 'pending'
  WHERE id = v_pid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pay_game_share(UUID, TEXT, TEXT) TO authenticated;

-- Recurring series: child instances inherit the pricing mode so free joins
-- and the host's reservation amount stay consistent week after week.
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
           status, source_game_id, recurrence, playground_id, min_players, duration_hours, playground_hourly_rate,
           share_price, host_pays, host_total)
        VALUES
          (v_parent.creator_id, v_parent.creator_name, v_parent.creator_nickname, v_parent.sport,
           v_parent.title, v_parent.description, v_parent.area, v_parent.location,
           v_parent.lat, v_parent.lng, v_dt, v_parent.start_time,
           v_parent.max_players, v_parent.skill_level, v_parent.is_public,
           'open', v_parent.id, 'weekly', v_parent.playground_id, v_parent.min_players, v_parent.duration_hours, v_parent.playground_hourly_rate,
           v_parent.share_price, v_parent.host_pays, v_parent.host_total)
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

        -- In host-pays children the organizer still owes the reservation total.
        IF v_parent.host_pays THEN
          UPDATE public.friendly_game_participants
          SET share_amount = v_parent.host_total, pay_status = 'unpaid'
          WHERE game_id = v_new_id AND role = 'organizer';
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