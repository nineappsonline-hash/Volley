-- Members who have committed a share (pay_status pending/approved) can only
-- cancel their participation more than 24 hours before the game's scheduled
-- start. Inside that window their seat is locked. Waitlisted members and free
-- host-pays joiners (share_amount = 0) can always leave.

CREATE OR REPLACE FUNCTION public.leave_friendly_game(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member         UUID;
  v_game           friendly_games;
  v_share          NUMERIC;
  v_pay_status     TEXT;
  v_is_waitlisted  BOOLEAN := FALSE;
  v_game_start     TIMESTAMP;
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

  SELECT COALESCE(share_amount, 0), pay_status, COALESCE(is_waitlisted, FALSE)
  INTO v_share, v_pay_status, v_is_waitlisted
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND member_id = v_member;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not part of this game';
  END IF;

  -- A paid member has a financial commitment: they can only leave more than
  -- 24 hours before the game starts. Free seats (host-pays) and the waitlist
  -- carry no commitment and are always cancellable.
  IF NOT v_is_waitlisted
     AND v_share > 0
     AND v_pay_status IN ('pending', 'approved') THEN
    v_game_start := (v_game.game_date + v_game.start_time)::timestamp;
    IF now() >= v_game_start - interval '24 hours' THEN
      RAISE EXCEPTION 'You can no longer cancel this game — it starts within 24 hours. Your share stays reserved for the game.'
        USING ERRCODE = 'P0001';
    END IF;
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
  IF NOT v_is_waitlisted THEN
    PERFORM public.promote_waitlisted_player(p_game_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.leave_friendly_game(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_friendly_game(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';