-- Editing a friendly game (visibility) and cancelling it are now restricted to
-- the game creator and platform super admins. Cancelling is only allowed by the
-- creator while they are the only committed player; otherwise the game runs and
-- an under-filled game is cancelled + refunded automatically after its day.

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

-- ── Visibility: creator or super admin; keep the shareable code for every game ─
CREATE OR REPLACE FUNCTION public.set_friendly_game_visibility(
  p_game_id UUID,
  p_is_public BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game public.friendly_games%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_is_public IS NULL THEN
    RAISE EXCEPTION 'Visibility is required' USING ERRCODE = '22004';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games
  WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_game.creator_id IS DISTINCT FROM auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the game creator or an admin can change visibility'
      USING ERRCODE = '42501';
  END IF;

  -- Every game keeps its invite code (see 20261016000000_all_games_shareable);
  -- visibility only decides whether the game is listed to everyone.
  UPDATE public.friendly_games
  SET is_public = p_is_public,
      invite_code = COALESCE(
        v_game.invite_code,
        upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
      )
  WHERE id = p_game_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_friendly_game_visibility(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_friendly_game_visibility(UUID, BOOLEAN) TO authenticated;

-- ── Cancel: creator until others opt in, or a super admin at any time ─────────
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
  IF v_game.creator_id <> v_member AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the organizer or an admin can cancel this game';
  END IF;

  -- Once another player has committed, the creator can no longer pull the game.
  -- It will be cancelled + refunded automatically after the scheduled time if it
  -- never reaches the minimum number of players.
  IF v_game.creator_id = v_member AND NOT public.is_super_admin() THEN
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
    '/community'
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_friendly_game(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_friendly_game(UUID) TO authenticated;

-- ── Auto-resolve past games: complete filled ones, cancel + refund the rest ───
CREATE OR REPLACE FUNCTION public.auto_resolve_stale_games()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game      public.friendly_games%ROWTYPE;
  v_active    INTEGER;
  v_min       INTEGER;
  v_cancelled INTEGER := 0;
BEGIN
  FOR v_game IN
    SELECT * FROM public.friendly_games
    WHERE status IN ('open', 'full') AND game_date < CURRENT_DATE
    FOR UPDATE
  LOOP
    SELECT count(*) INTO v_active
    FROM public.friendly_game_participants
    WHERE game_id = v_game.id AND NOT is_waitlisted;

    v_min := GREATEST(COALESCE(v_game.min_players, 2), 2);

    IF v_active < v_min THEN
      UPDATE public.friendly_games SET status = 'cancelled' WHERE id = v_game.id;
      PERFORM public.release_game_charges(v_game.id);
      INSERT INTO public.notifications (recipient_id, type, title, body, link)
      SELECT
        member_id,
        'game_cancelled',
        'Game cancelled',
        btrim(v_game.title) || ' didn''t reach the minimum number of players and was cancelled. Any outstanding shares were released.',
        '/community'
      FROM public.friendly_game_participants WHERE game_id = v_game.id;
      v_cancelled := v_cancelled + 1;
    ELSE
      UPDATE public.friendly_games SET status = 'completed' WHERE id = v_game.id;
    END IF;
  END LOOP;

  RETURN v_cancelled;
END;
$$;
REVOKE ALL ON FUNCTION public.auto_resolve_stale_games() FROM PUBLIC, anon, authenticated;

-- Replace the previous "mark everything completed" housekeeping with the
-- cancel-and-refund aware routine (idempotent re-schedule).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_class WHERE relname = 'job') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'volley-daily-housekeeping') THEN
      PERFORM cron.unschedule('volley-daily-housekeeping');
    END IF;
    PERFORM cron.schedule('volley-daily-housekeeping', '0 3 * * *', $job$
      SELECT public.auto_resolve_stale_games();
    $job$);
  END IF;
END
$do$;

NOTIFY pgrst, 'reload schema';
