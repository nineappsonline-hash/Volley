-- ────────────────────────────────────────────────────────────
-- Game waitlists + clean leave/cancel with share refunds.
--
-- Joining a full game now places the player on the waitlist instead
-- of failing. The oldest waitlisted player is promoted automatically
-- the moment a real spot frees up (someone leaves, or a share payment
-- is rejected by a super admin). Cancelling or leaving reverts every
-- outstanding share so nobody is charged for a game that never
-- happened.
-- ────────────────────────────────────────────────────────────

-- join_friendly_game now returns TRUE when the caller was placed on
-- the waitlist and FALSE when they took a real spot. The 4-argument
-- signature is unchanged, so existing clients keep working.
CREATE OR REPLACE FUNCTION public.join_friendly_game(
  p_game_id UUID,
  p_invite_code TEXT DEFAULT NULL,
  p_pay_method TEXT DEFAULT NULL,
  p_pay_receipt_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member     UUID;
  v_game       friendly_games;
  v_count      INTEGER;
  v_waitlisted BOOLEAN;
  v_prof       profiles%ROWTYPE;
  v_age        INTEGER;
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

  -- Already a participant? The waitlist and the roster share the same
  -- unique (game, member) row, so both states are checked here.
  SELECT is_waitlisted INTO v_waitlisted
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND member_id = v_member;
  IF FOUND THEN
    IF v_waitlisted THEN
      RAISE EXCEPTION 'You are already on the waitlist';
    END IF;
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

  -- How many real spots are taken right now (waitlisted players don't count).
  SELECT COUNT(*) INTO v_count
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND NOT is_waitlisted;

  -- The game is full: take the waitlist. No payment is collected until the
  -- player is actually promoted into a real spot.
  IF v_count >= v_game.max_players THEN
    INSERT INTO public.friendly_game_participants
      (game_id, member_id, role, player_name, is_waitlisted, share_amount, pay_status)
    VALUES (p_game_id, v_member, 'player',
            (SELECT public.player_display_name(p) FROM public.profiles p WHERE p.id = v_member),
            TRUE, 0, 'unpaid');

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.creator_id,
      'game_alert',
      'Waitlist spot requested',
      (SELECT public.player_display_name(pp) FROM public.profiles pp WHERE pp.id = v_member)
        || ' joined the waitlist for ' || btrim(v_game.title) || '.',
      '/games'
    );

    RETURN TRUE;
  END IF;

  -- A real spot is available: the host pays the whole reservation in
  -- host-pays games (free join, no payment method/receipt needed). In split
  -- games every player pays their share upfront, uploads a receipt and the
  -- spot is removed again if the payment turns out fake. Waitlisted players
  -- never reach this branch — they only pay once promoted.
  IF v_game.host_pays THEN
    INSERT INTO public.friendly_game_participants
      (game_id, member_id, role, player_name, share_amount, pay_status)
    VALUES (p_game_id, v_member, 'player',
            (SELECT public.player_display_name(p) FROM public.profiles p WHERE p.id = v_member),
            0, 'approved');
  ELSE
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
  END IF;

  -- Tell everyone already in the game someone new joined (skip anyone who
  -- blocked the joiner so they don't get bothered).
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT DISTINCT p.member_id,
         'game_join',
         'Someone joined your game',
         (SELECT public.player_display_name(pp) FROM public.profiles pp WHERE pp.id = v_member)
           || ' joined ' || btrim(v_game.title) || '.',
         '/games'
  FROM public.friendly_game_participants p
  WHERE p.game_id = p_game_id
    AND p.member_id <> v_member
    AND NOT p.is_waitlisted
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE b.blocker_id = p.member_id AND b.blocked_id = v_member
    );

  -- Flip the game to full once the last real seat is taken (and let the
  -- host know).
  SELECT COUNT(*) INTO v_count
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND NOT is_waitlisted;
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

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_friendly_game(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- promote_waitlisted_player()
-- Moves the oldest waitlisted player into a free spot (when one exists),
-- applies the game's share pricing to them and notifies both the player
-- and the organizer. Always leaves open/full accurate. Returns TRUE when
-- someone was promoted. SECURITY DEFINER so the schedule/leave/review
-- paths can call it without extra RLS.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.promote_waitlisted_player(p_game_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game      friendly_games%ROWTYPE;
  v_wait      friendly_game_participants%ROWTYPE;
  v_count     INTEGER;
  v_promoted  BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND OR v_game.status IN ('cancelled', 'completed') THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND NOT is_waitlisted;

  IF v_count < v_game.max_players THEN
    SELECT * INTO v_wait FROM public.friendly_game_participants
    WHERE game_id = p_game_id AND is_waitlisted
    ORDER BY joined_at ASC, id ASC
    LIMIT 1;
    IF FOUND THEN
      -- The promoted player owes their share exactly like a fresh join
      -- (free seat in host-pays games).
      UPDATE public.friendly_game_participants
      SET is_waitlisted = FALSE,
          share_amount  = CASE WHEN v_game.host_pays THEN 0 ELSE v_game.share_price END,
          pay_status    = CASE WHEN v_game.host_pays THEN 'approved' ELSE 'unpaid' END
      WHERE id = v_wait.id;

      INSERT INTO public.notifications (recipient_id, type, title, body, link)
      VALUES (
        v_wait.member_id,
        'game_alert',
        'A spot opened up!',
        'You were moved from the waitlist into the roster of "' || btrim(v_game.title) || '".',
        '/games'
      );

      INSERT INTO public.notifications (recipient_id, type, title, body, link)
      VALUES (
        v_game.creator_id,
        'game_alert',
        'Waitlist promoted',
        public.player_display_name(
          (SELECT p FROM public.profiles p WHERE p.id = v_wait.member_id)
        ) || ' moved from the waitlist into your game ' || btrim(v_game.title) || '.',
        '/games'
      );

      v_count := v_count + 1;
      v_promoted := TRUE;
    END IF;
  END IF;

  -- Keep open/full accurate: full when no real seats remain.
  UPDATE public.friendly_games
  SET status = CASE WHEN v_count >= v_game.max_players THEN 'full' ELSE 'open' END
  WHERE id = p_game_id;

  RETURN v_promoted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_waitlisted_player(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- leave_friendly_game()
-- The organizer leaving cancels the game and releases every participant's
-- share. A normal player leaving frees their spot (their share row is
-- deleted with them, which releases the charge) and the oldest waitlisted
-- player is promoted into it.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.leave_friendly_game(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member        UUID;
  v_game          friendly_games;
  v_was_waitlisted BOOLEAN := FALSE;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  -- The organizer quitting cancels the game (no ownership transfer) and
  -- releases every participant's share so nobody is charged.
  IF v_game.creator_id = v_member THEN
    UPDATE public.friendly_games SET status = 'cancelled' WHERE id = p_game_id;
    UPDATE public.friendly_game_participants
    SET share_amount = 0, pay_method = NULL, pay_receipt_url = NULL, pay_status = 'unpaid'
    WHERE game_id = p_game_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    SELECT
      member_id,
      'game_cancelled',
      'Game cancelled',
      btrim(v_game.title) || ' was cancelled by the organizer. Any outstanding shares were released.',
      '/community'
    FROM public.friendly_game_participants WHERE game_id = p_game_id;
    RETURN;
  END IF;

  SELECT COALESCE(is_waitlisted, FALSE) INTO v_was_waitlisted
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND member_id = v_member;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not part of this game';
  END IF;

  -- Deleting the row releases the share: no payment is left outstanding.
  DELETE FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND member_id = v_member;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_game.creator_id,
    'game_left',
    'Someone left your game',
    (SELECT name FROM public.profiles WHERE id = v_member) || ' left ' || btrim(v_game.title) || '.',
    '/community'
  );

  -- Only a confirmed player leaving frees a seat worth filling.
  IF NOT v_was_waitlisted THEN
    PERFORM public.promote_waitlisted_player(p_game_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_friendly_game(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- review_participant_share()
-- Approving confirms the payment; rejecting removes the participant (which
-- releases their share) and promotes the oldest waitlisted player.
-- ────────────────────────────────────────────────────────────
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
    -- Fill the freed spot from the waitlist (also keeps open/full accurate).
    PERFORM public.promote_waitlisted_player(v_row.game_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_participant_share(UUID, BOOLEAN) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- cancel_friendly_game()
-- Cancelling also reverts every participant's outstanding share so nobody is
-- charged for a game that isn't happening.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_friendly_game(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_game   friendly_games;
BEGIN
  v_member := auth.uid();
  IF v_member IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF v_game.creator_id <> v_member THEN
    RAISE EXCEPTION 'Only the organizer can cancel this game';
  END IF;

  IF v_game.status = 'cancelled' THEN RETURN; END IF;
  UPDATE public.friendly_games SET status = 'cancelled' WHERE id = p_game_id;

  -- Release every outstanding share bound to this game.
  UPDATE public.friendly_game_participants
  SET share_amount = 0, pay_method = NULL, pay_receipt_url = NULL, pay_status = 'unpaid'
  WHERE game_id = p_game_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT
    member_id,
    'game_cancelled',
    'Game cancelled',
    btrim(v_game.title) || ' was cancelled by the organizer. Any outstanding shares were released.',
    '/community'
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_friendly_game(UUID) TO authenticated;

-- Weekly materialization only carries over confirmed players — a waitlisted
-- member shouldn't silently rejoin next week while actually not playing.
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
           status, source_game_id, recurrence)
        VALUES
          (v_parent.creator_id, v_parent.creator_name, v_parent.creator_nickname, v_parent.sport,
           v_parent.title, v_parent.description, v_parent.area, v_parent.location,
           v_parent.lat, v_parent.lng, v_dt, v_parent.start_time,
           v_parent.max_players, v_parent.skill_level, v_parent.is_public,
           'open', v_parent.id, 'weekly')
        RETURNING id INTO v_new_id;

        -- Carry the roster over from the most recent past occurrence,
        -- skipping anyone who only sat on the waitlist.
        SELECT MAX(f2.id) INTO v_anchor
        FROM public.friendly_games f2
        WHERE (f2.source_game_id = v_parent.id OR f2.id = v_parent.id)
          AND f2.game_date < v_dt AND f2.status <> 'cancelled';
        IF v_anchor IS NOT NULL THEN
          INSERT INTO public.friendly_game_participants (game_id, member_id, role, player_name)
          SELECT v_new_id, member_id, role, player_name
          FROM public.friendly_game_participants
          WHERE game_id = v_anchor
            AND NOT is_waitlisted
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