-- ────────────────────────────────────────────────────────────
-- 7.5.x  RENT REMAINING PAYMENTS (cover the court-rent gap)
-- ────────────────────────────────────────────────────────────
-- Members can top up the remaining court rent so the reservation is
-- confirmed even when fewer than the billable headcount has paid.

CREATE TABLE IF NOT EXISTS public.friendly_game_rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.friendly_games(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0 AND amount <> 'NaN'::numeric),
  pay_method TEXT CHECK (pay_method IN ('instapay', 'e_wallet')),
  pay_receipt_url TEXT,
  pay_status TEXT NOT NULL DEFAULT 'pending' CHECK (pay_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fgrp_game ON public.friendly_game_rent_payments(game_id);
CREATE INDEX IF NOT EXISTS idx_fgrp_member ON public.friendly_game_rent_payments(member_id);

ALTER TABLE public.friendly_game_rent_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rent payments read" ON public.friendly_game_rent_payments;
CREATE POLICY "Rent payments read" ON public.friendly_game_rent_payments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.friendly_games g
      WHERE g.id = game_id AND (
        g.is_public = TRUE
        OR g.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friendly_game_participants p
          WHERE p.game_id = g.id AND p.member_id = auth.uid()
        )
      )
    )
  );

-- Pays the remaining court rent for a split game so the reservation is
-- confirmed regardless of how many players ultimately join.
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
  v_game      public.friendly_games%ROWTYPE;
  v_billable  INTEGER;
  v_rent      NUMERIC;
  v_share     NUMERIC;
  v_paid      NUMERIC;
  v_topup     NUMERIC;
  v_remaining NUMERIC;
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

  v_billable := CASE
    WHEN btrim(lower(v_game.sport)) IN ('football', 'volleyball') THEN 10
    WHEN btrim(lower(v_game.sport)) = 'padel' THEN 4
    ELSE COALESCE(v_game.min_players, 2) END;

  v_rent  := round(v_game.playground_hourly_rate * v_game.duration_hours, 2);
  v_share := round(v_rent / v_billable, 2);

  -- Count shares that have been submitted (pending or approved, non-waitlisted).
  SELECT COALESCE(SUM(v_share), 0) INTO v_paid
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id
    AND is_waitlisted = FALSE
    AND pay_status IN ('pending', 'approved');

  -- Count top-ups already submitted or approved.
  SELECT COALESCE(SUM(amount), 0) INTO v_topup
  FROM public.friendly_game_rent_payments
  WHERE game_id = p_game_id
    AND pay_status IN ('pending', 'approved');

  v_remaining := round(v_rent - v_paid - v_topup, 2);
  IF v_remaining < 0 THEN v_remaining := 0; END IF;
  IF v_remaining > v_rent THEN v_remaining := v_rent; END IF;
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

-- Super admin reviews a rent-payment receipt. Approving confirms the top-up;
-- rejecting frees the remaining credit so someone else can still cover it.
CREATE OR REPLACE FUNCTION public.review_rent_payment(
  p_payment_id UUID,
  p_approve    BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row    public.friendly_game_rent_payments%ROWTYPE;
  v_member UUID;
  v_title  TEXT;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_row FROM public.friendly_game_rent_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  v_member := v_row.member_id;

  UPDATE public.friendly_game_rent_payments
  SET pay_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
  WHERE id = p_payment_id;

  SELECT title INTO v_title FROM public.friendly_games WHERE id = v_row.game_id;
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_member,
    'game_fee_reviewed',
    'Court rent payment ' || CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    COALESCE(v_title, 'Your game') || ': your court rent payment was ' || CASE WHEN p_approve THEN 'approved' ELSE 'not verified' END || '.',
    '/games'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_rent_payment(UUID, BOOLEAN) TO authenticated;