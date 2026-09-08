-- Friendly-games hub v2:
-- + members can attach a friendly game to a pool playground (venues.academy_id NULL)
-- + private games join via a shareable invite code link
-- + organizers set join criteria by gender and/or age range
-- + game creation fee now uses the same 3 payment methods as plan subscriptions
--   (instapay / e_wallet / kashier) with the same "auto-live, cancelled if the
--   receipt turns out fake" rule: rejection now cancels the game and notifies.
-- + members expose gender + birth_date on their profile so criteria can be enforced.

-- ── Profile: gender + birth date (needed so join criteria can be enforced) ──
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')),
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- ── friendly_games: playground, private share code, criteria ──
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS playground_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_code TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'mixed'
    CHECK (gender IN ('male', 'female', 'mixed')),
  ADD COLUMN IF NOT EXISTS min_age INTEGER,
  ADD COLUMN IF NOT EXISTS max_age INTEGER,
  ADD CONSTRAINT friendly_games_age_range CHECK (
    min_age IS NULL OR (min_age BETWEEN 0 AND 120)
  ),
  ADD CONSTRAINT friendly_games_age_order CHECK (
    min_age IS NULL OR max_age IS NULL OR min_age <= max_age
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_friendly_games_invite_code
  ON public.friendly_games(invite_code)
  WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_friendly_games_playground
  ON public.friendly_games(playground_id);
CREATE INDEX IF NOT EXISTS idx_friendly_games_gender
  ON public.friendly_games(gender);

-- Allow 'kashier' (same methods as plan subscriptions); keep 'visa' for legacy rows.
ALTER TABLE public.friendly_games
  DROP CONSTRAINT IF EXISTS friendly_games_fee_method_check;
ALTER TABLE public.friendly_games
  ADD CONSTRAINT friendly_games_fee_method_check
  CHECK (fee_method IN ('instapay', 'e_wallet', 'kashier', 'visa'));

-- RLS: members who joined a game must be able to read it (needed so private
-- games surface on "my games" once a member is in the roster).
DROP POLICY IF EXISTS "Community games read" ON public.friendly_games;
CREATE POLICY "Community games read" ON public.friendly_games
  FOR SELECT TO authenticated USING (
    is_public = TRUE
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friendly_game_participants p
      WHERE p.game_id = friendly_games.id AND p.member_id = auth.uid()
    )
  );

-- ── Create friendly game (updated) ──────────────────────────────────────────
-- Old signatures are dropped so only the new one exists.
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, TEXT, TEXT, INTEGER, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, BOOLEAN);
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
  p_invite_code    TEXT DEFAULT NULL
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
     playground_id, game_date, start_time, max_players, skill_level, is_public,
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
     GREATEST(p_max_players, 2),
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
  INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT
) TO authenticated;

-- ── Resolve a private game by its invite code (for the shared link) ─────────
-- SECURITY DEFINER so a non-participant with a valid code can see the game;
-- the code is the secret that unlocks the private game.
CREATE OR REPLACE FUNCTION public.get_game_by_invite(p_code TEXT)
RETURNS SETOF public.friendly_games
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.friendly_games
  WHERE invite_code = upper(btrim(COALESCE(p_code, '')))
    AND status <> 'cancelled'
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_game_by_invite(TEXT) TO authenticated;

-- ── Join game (updated: invite code + gender/age criteria) ──────────────────
DROP FUNCTION IF EXISTS public.join_friendly_game(UUID);
CREATE OR REPLACE FUNCTION public.join_friendly_game(p_game_id UUID, p_invite_code TEXT DEFAULT NULL)
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

  INSERT INTO public.friendly_game_participants (game_id, member_id, role)
  VALUES (p_game_id, v_member, 'player');

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

GRANT EXECUTE ON FUNCTION public.join_friendly_game(UUID, TEXT) TO authenticated;

-- ── Review game fee: same rule as subscriptions ─────────────────────────────
-- Approving confirms the payment; rejecting means the receipt was not real and
-- the game is cancelled (participants and the organizer are notified).
CREATE OR REPLACE FUNCTION public.review_game_fee(p_game_id UUID, p_approve BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game friendly_games;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF p_approve THEN
    UPDATE public.friendly_games
    SET fee_status = 'approved', creation_fee_paid = TRUE
    WHERE id = p_game_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.creator_id,
      'game_fee_reviewed',
      'Game fee approved',
      'The ' || btrim(v_game.title) || ' creation fee was verified.',
      '/games'
    );
  ELSE
    -- Fake / unverified payment: cancel the game and tell everyone.
    UPDATE public.friendly_games
    SET fee_status = 'rejected', creation_fee_paid = FALSE, status = 'cancelled'
    WHERE id = p_game_id;
    UPDATE public.friendly_game_participants
    SET is_waitlisted = FALSE WHERE game_id = p_game_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    SELECT
      member_id,
      'game_fee_reviewed',
      'Game cancelled — payment not verified',
      btrim(v_game.title) ||
        ' was cancelled because the creation fee could not be verified.',
      '/games'
    FROM public.friendly_game_participants WHERE game_id = p_game_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_game_fee(UUID, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';