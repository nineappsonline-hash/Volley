-- Measure the remaining court balance on the same basis as the booking
-- deposit: min_players × per-player price (rent share + fee) minus what has
-- already been paid, instead of the raw court rent.

CREATE OR REPLACE FUNCTION public.pay_rent_remaining(
  p_game_id         UUID,
  p_pay_method      TEXT,
  p_pay_receipt_url TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game       public.friendly_games%ROWTYPE;
  v_min_players INTEGER;
  v_fee        NUMERIC;
  v_per_player NUMERIC;
  v_basis      NUMERIC;
  v_paid       NUMERIC;
  v_topup      NUMERIC;
  v_remaining  NUMERIC;
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
  IF v_game.host_pays THEN
    RAISE EXCEPTION 'The reservation is already fully paid';
  END IF;
  IF v_game.playground_hourly_rate IS NULL OR v_game.playground_hourly_rate < 0 THEN
    RAISE EXCEPTION 'No rental price on this playground';
  END IF;

  -- The balance is measured on the players' side, matching the booking deposit:
  -- min_players × per-player price (rent share + fee) minus what has been paid.
  v_min_players := GREATEST(2, COALESCE(v_game.min_players, 2));
  v_fee := CASE WHEN btrim(lower(v_game.sport)) = 'padel' THEN 40 ELSE 20 END;
  v_per_player := round(v_game.playground_hourly_rate * v_game.duration_hours, 2) / v_min_players;
  v_per_player := round(v_per_player, 2) + v_fee;
  v_basis := round(v_min_players * v_per_player, 2);

  -- Count shares that have been submitted (pending or approved, non-waitlisted).
  SELECT COALESCE(SUM(LEAST(v_per_player, COALESCE(share_amount, v_per_player))), 0) INTO v_paid
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id
    AND is_waitlisted = FALSE
    AND pay_status IN ('pending', 'approved');

  -- Count top-ups already submitted or approved.
  SELECT COALESCE(SUM(amount), 0) INTO v_topup
  FROM public.friendly_game_rent_payments
  WHERE game_id = p_game_id
    AND pay_status IN ('pending', 'approved');

  v_remaining := round(v_basis - v_paid - v_topup, 2);
  IF v_remaining < 0 THEN v_remaining := 0; END IF;
  IF v_remaining > v_basis THEN v_remaining := v_basis; END IF;
  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'The reservation is already covered';
  END IF;

  IF p_pay_method IS NULL OR p_pay_method NOT IN ('instapay', 'e_wallet') THEN
    RAISE EXCEPTION 'A valid payment method is required';
  END IF;
  IF p_pay_receipt_url IS NULL OR btrim(p_pay_receipt_url) = '' THEN
    RAISE EXCEPTION 'A receipt is required to confirm your payment';
  END IF;

  -- Prevent duplicate pending top-ups from the same member.
  IF EXISTS (
    SELECT 1 FROM public.friendly_game_rent_payments
    WHERE game_id = p_game_id
      AND member_id = auth.uid()
      AND pay_status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending rent payment for this game';
  END IF;

  INSERT INTO public.friendly_game_rent_payments
    (game_id, member_id, amount, pay_method, pay_receipt_url, pay_status)
  VALUES
    (p_game_id, auth.uid(), v_remaining, p_pay_method, btrim(p_pay_receipt_url), 'pending');

  RETURN v_remaining;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pay_rent_remaining(UUID, TEXT, TEXT) TO authenticated;