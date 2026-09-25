-- Super admins may add a member to (or remove a member from) a friendly game.
-- Adding bypasses the public join flow: the game must be open/full, duplicates
-- are refused, and when every real seat is taken the member is added to the
-- waitlist instead (share 0 / unpaid, exactly like a normal waitlist join so a
-- later promotion applies the real share). Removing deletes the participant
-- row — releasing any outstanding share — and the oldest waitlisted player is
-- promoted into the freed seat. The organizer can never be removed.

CREATE OR REPLACE FUNCTION public.admin_add_friendly_game_member(
  p_game_id   UUID,
  p_member_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game      public.friendly_games%ROWTYPE;
  v_count     INTEGER;
  v_waitlist  BOOLEAN := FALSE;
  v_name      TEXT;
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only a super admin can manage game members' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_game.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'A finished or cancelled game cannot be edited' USING ERRCODE = 'P0001';
  END IF;

  SELECT public.player_display_name(p) INTO v_name FROM public.profiles p WHERE p.id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendly_game_participants
    WHERE game_id = p_game_id AND member_id = p_member_id
  ) THEN
    RAISE EXCEPTION 'This member is already in the game' USING ERRCODE = '23505';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND NOT is_waitlisted;

  IF v_count >= v_game.max_players THEN
    v_waitlist := TRUE;
  END IF;

  INSERT INTO public.friendly_game_participants
    (game_id, member_id, role, player_name, is_waitlisted, share_amount, pay_status)
  VALUES
    (p_game_id, p_member_id, 'player', v_name, v_waitlist,
     CASE WHEN v_waitlist THEN 0
          WHEN v_game.host_pays THEN 0
          ELSE v_game.share_price END,
     CASE WHEN v_waitlist THEN 'unpaid' ELSE 'approved' END);

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    p_member_id,
    'game_join',
    CASE WHEN v_waitlist THEN 'You joined the waitlist' ELSE 'You were added to a game' END,
    CASE WHEN v_waitlist
         THEN 'You were added to the waitlist for ' || btrim(v_game.title) || '.'
         ELSE 'You were added to ' || btrim(v_game.title) || '.' END,
    '/games'
  );
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_game.creator_id,
    'game_join',
    'Someone joined your game',
    v_name || CASE WHEN v_waitlist THEN ' joined the waitlist for ' ELSE ' was added to ' END
      || btrim(v_game.title) || '.',
    '/games'
  );

  -- Flip the game to full once the last real seat is taken.
  IF NOT v_waitlist THEN
    v_count := v_count + 1;
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
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_add_friendly_game_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_friendly_game_member(UUID, UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- admin_remove_friendly_game_member()
-- Removes a member from the game roster or waitlist. The organizer can never
-- be removed. Deleting the row releases any outstanding share and a freed
-- real seat promotes the oldest waitlisted player (which also keeps the
-- open/full status accurate).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_remove_friendly_game_member(
  p_game_id   UUID,
  p_member_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game         public.friendly_games%ROWTYPE;
  v_was_waitlist BOOLEAN := FALSE;
  v_name         TEXT;
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only a super admin can manage game members' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_game.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'A finished or cancelled game cannot be edited' USING ERRCODE = 'P0001';
  END IF;
  IF p_member_id = v_game.creator_id THEN
    RAISE EXCEPTION 'The game organizer cannot be removed' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(is_waitlisted, FALSE), COALESCE(player_name, 'Member')
  INTO v_was_waitlist, v_name
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND member_id = p_member_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This member is not part of the game' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND member_id = p_member_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    p_member_id,
    'game_left',
    'You were removed from a game',
    'You were removed from ' || btrim(v_game.title) || '.',
    '/games'
  );
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  VALUES (
    v_game.creator_id,
    'game_left',
    'Someone left your game',
    v_name || ' left ' || btrim(v_game.title) || '.',
    '/community'
  );

  IF NOT v_was_waitlist THEN
    PERFORM public.promote_waitlisted_player(p_game_id);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_friendly_game_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_friendly_game_member(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';