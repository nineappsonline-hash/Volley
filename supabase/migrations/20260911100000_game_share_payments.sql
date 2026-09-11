-- Friendly-game payments: drop the 50 EGP game-creation fee and replace it
-- with a per-player share paid upfront to join. The share is
--   (playground hourly rent × duration_hours ÷ min_players) + 20 EGP,
-- folded into a single price (the 20 EGP platform fee is NOT shown as a fee).

-- Add a per-player share snapshot to the game.
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS share_price NUMERIC
  CHECK (share_price >= 0 AND share_price <> 'NaN'::numeric);

-- Per-participant share payment columns.
ALTER TABLE public.friendly_game_participants
  ADD COLUMN IF NOT EXISTS share_amount NUMERIC
    CHECK (share_amount >= 0 AND share_amount <> 'NaN'::numeric),
  ADD COLUMN IF NOT EXISTS pay_method TEXT
    CHECK (pay_method IN ('instapay', 'e_wallet', 'visa', 'kashier')),
  ADD COLUMN IF NOT EXISTS pay_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS pay_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (pay_status IN ('unpaid', 'pending', 'approved', 'rejected'));

-- Creating a game is now free; the share is computed and stored at creation.
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, NUMERIC);
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
     playground_id, game_date, start_time, max_players, min_players, duration_hours, playground_hourly_rate, share_price, skill_level, is_public,
     recurrence, invite_code, gender, min_age, max_age)
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
    (game_id, member_id, role, share_amount, pay_status)
  VALUES (v_game, v_member, 'organizer', v_share, 'unpaid');

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

-- Joining now requires an upfront share payment (method + receipt).
DROP FUNCTION IF EXISTS public.join_friendly_game(UUID, TEXT);
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

  -- Every player pays their share upfront, then uploads a receipt for
  -- super-admin verification. The spot counts right away and is removed again
  -- if the payment turns out fake.
  IF p_pay_method IS NULL OR p_pay_method NOT IN ('instapay', 'e_wallet') THEN
    RAISE EXCEPTION 'A payment method is required to join a friendly game';
  END IF;
  IF p_pay_receipt_url IS NULL OR btrim(p_pay_receipt_url) = '' THEN
    RAISE EXCEPTION 'A receipt is required to confirm your share payment';
  END IF;

  INSERT INTO public.friendly_game_participants
    (game_id, member_id, role, share_amount, pay_method, pay_receipt_url, pay_status)
  VALUES (p_game_id, v_member, 'player', v_game.share_price, p_pay_method,
          btrim(p_pay_receipt_url), 'pending');

  -- Tell the organizer someone joined (unless it's their own game).
  IF v_game.creator_id <> v_member THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.creator_id,
      'game_join',
      'Someone joined your game',
      (SELECT name FROM public.profiles WHERE id = v_member) || ' joined ' || btrim(v_game.title) || '.',
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

-- The organizer (or any already-joined participant) pays their outstanding
-- share: unpaid -> pending (super admin verifies the receipt).
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
  SET share_amount = v_game.share_price,
      pay_method = p_pay_method,
      pay_receipt_url = btrim(p_pay_receipt_url),
      pay_status = 'pending'
  WHERE id = v_pid;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pay_game_share(UUID, TEXT, TEXT) TO authenticated;

-- Super admin verifies a participant's share payment. Approving confirms it;
-- rejecting removes the participant (frees the spot).
CREATE OR REPLACE FUNCTION public.review_participant_share(p_participant_id UUID, p_approve BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row    friendly_game_participants%ROWTYPE;
  v_member UUID;
  v_title  TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_row FROM public.friendly_game_participants WHERE id = p_participant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;
  v_member := v_row.member_id;

  IF p_approve THEN
    UPDATE public.friendly_game_participants SET pay_status = 'approved'
    WHERE id = p_participant_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_member,
      'game_fee_reviewed',
      'Game share payment approved',
      'Your share payment for a friendly game was verified.',
      '/games'
    );
  ELSE
    DELETE FROM public.friendly_game_participants WHERE id = p_participant_id;
    SELECT title INTO v_title FROM public.friendly_games WHERE id = v_row.game_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_member,
      'game_fee_reviewed',
      'Removed from game — payment not verified',
      COALESCE(v_title, 'Your game') || ': your share payment could not be verified, so you were removed from the game.',
      '/games'
    );
    UPDATE public.friendly_games SET status = 'open'
    WHERE id = v_row.game_id AND status = 'full';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_participant_share(UUID, BOOLEAN) TO authenticated;

-- Drop the old per-game fee columns now that fees are per-player.
ALTER TABLE public.friendly_games
  DROP COLUMN IF EXISTS creation_fee_paid,
  DROP COLUMN IF EXISTS fee_status,
  DROP COLUMN IF EXISTS fee_method,
  DROP COLUMN IF EXISTS fee_receipt_url;

ALTER TABLE public.friendly_game_participants
  DROP COLUMN IF EXISTS fee_method,
  DROP COLUMN IF EXISTS fee_receipt_url;

-- Update super-admin stats to compute game fees from per-player share payments.
CREATE OR REPLACE FUNCTION public.get_super_admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total',     (SELECT count(*) FROM public.academies),
    'trial',     (SELECT count(*) FROM public.academies WHERE is_trial),
    'approved',  (SELECT count(*) FROM public.academies WHERE NOT is_trial),
    'by_plan', jsonb_build_object(
      'starter', (SELECT count(*) FROM public.academies WHERE plan = 'starter'),
      'plus',    (SELECT count(*) FROM public.academies WHERE plan = 'plus'),
      'elite',   (SELECT count(*) FROM public.academies WHERE plan = 'elite')
    ),
    'by_month', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', m, 'count', c) ORDER BY m)
      FROM (SELECT to_char(created_at, 'YYYY-MM') AS m, count(*) AS c
            FROM public.academies GROUP BY 1) s), '[]'::jsonb),
    'fees', jsonb_build_object(
      'session_total', COALESCE((SELECT sum(platform_fee) FROM public.session_bookings WHERE status <> 'cancelled'), 0),
      'session_count', (SELECT count(*) FROM public.session_bookings WHERE status <> 'cancelled'),
      'session_by_month', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', m, 'total', t, 'count', c) ORDER BY m)
        FROM (SELECT to_char(booked_at, 'YYYY-MM') AS m, sum(platform_fee) AS t, count(*) AS c
              FROM public.session_bookings WHERE status <> 'cancelled' GROUP BY 1) s), '[]'::jsonb),
      'game_count', (SELECT count(*) FROM public.friendly_game_participants p
                     JOIN public.friendly_games g ON g.id = p.game_id
                     WHERE p.pay_status = 'approved' AND g.status = 'accepted'),
      'game_by_month', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', m, 'count', c) ORDER BY m)
        FROM (SELECT to_char(g.created_at, 'YYYY-MM') AS m, count(*) AS c
              FROM public.friendly_game_participants p
              JOIN public.friendly_games g ON g.id = p.game_id
              WHERE p.pay_status = 'approved' AND g.status = 'accepted' GROUP BY 1) s), '[]'::jsonb),
      'payments_total', COALESCE((SELECT sum(amount) FROM public.payments), 0),
      'payments_count', (SELECT count(*) FROM public.payments),
      'payments_by_month', COALESCE((SELECT jsonb_agg(jsonb_build_object('month', m, 'total', t, 'count', c) ORDER BY m)
        FROM (SELECT to_char(payment_date, 'YYYY-MM') AS m, sum(amount) AS t, count(*) AS c
              FROM public.payments GROUP BY 1) s), '[]'::jsonb)
    )
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- Also update review_game_fee to delegate to review_participant_share (backwards compat).
-- No longer needed; callers should use review_participant_share directly.
DROP FUNCTION IF EXISTS public.review_game_fee(UUID, BOOLEAN);

NOTIFY pgrst, 'reload schema';