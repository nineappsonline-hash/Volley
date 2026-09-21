-- Restore super-admin cancellation on databases with the older organizer-only RPC.
-- ── Rent top-ups can be voided when a game is cancelled ──────────────────────
ALTER TABLE public.friendly_game_rent_payments
  DROP CONSTRAINT IF EXISTS friendly_game_rent_payments_pay_status_check;
ALTER TABLE public.friendly_game_rent_payments
  ADD CONSTRAINT friendly_game_rent_payments_pay_status_check
  CHECK (pay_status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- ── Shared refund helper (internal — not callable by clients) ────────────────
-- Releases every outstanding participant share and voids pending/approved rent
-- top-ups so nobody is charged for a game that isn't happening.
CREATE OR REPLACE FUNCTION public.release_game_charges(p_game_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.friendly_game_participants
  SET share_amount = 0, pay_method = NULL, pay_receipt_url = NULL, pay_status = 'unpaid'
  WHERE game_id = p_game_id;

  UPDATE public.friendly_game_rent_payments
  SET pay_status = 'cancelled'
  WHERE game_id = p_game_id AND pay_status IN ('pending', 'approved');
END;
$$;
REVOKE ALL ON FUNCTION public.release_game_charges(UUID) FROM PUBLIC, anon, authenticated;

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

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF v_game.creator_id <> v_member AND public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only the organizer or an admin can cancel this game';
  END IF;

  -- Once another player has committed, the creator can no longer pull the game.
  -- It will be cancelled + refunded automatically after the scheduled time if it
  -- never reaches the minimum number of players.
  IF v_game.creator_id = v_member AND public.is_super_admin() IS NOT TRUE THEN
    IF EXISTS (
      SELECT 1 FROM public.friendly_game_participants p
      WHERE p.game_id = p_game_id
        AND p.member_id <> v_member
        AND NOT p.is_waitlisted
        AND p.pay_status IN ('pending', 'approved')
    ) THEN
      RAISE EXCEPTION 'Other players already joined this game. It will be cancelled and refunded automatically after the scheduled time.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_game.status = 'cancelled' THEN RETURN; END IF;
  UPDATE public.friendly_games SET status = 'cancelled' WHERE id = p_game_id;

  PERFORM public.release_game_charges(p_game_id);

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT
    member_id,
    'game_cancelled',
    'Game cancelled',
    btrim(v_game.title) || ' was cancelled. Any outstanding shares were released.',
    '/games'
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_friendly_game(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_friendly_game(UUID) TO authenticated;
