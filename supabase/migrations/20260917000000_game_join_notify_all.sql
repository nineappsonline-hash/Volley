-- ────────────────────────────────────────────────────────────
-- Notify ALL participants of a friendly game when someone new joins
-- (previously only the organizer was told). The push flow is the same:
-- inserting into public.notifications fires notify_push_on_insert →
-- notify-push Edge Function → in-app bell + PWA push.
-- Anyone who blocked the joiner is skipped.
-- ────────────────────────────────────────────────────────────

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