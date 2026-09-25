-- A game's organizer (or a platform super admin) can edit the maximum number
-- of players. Only the player limit changes; the open/full status recomputes so
-- freeing spots un-fulls a full game and filling every spot marks it full.

CREATE OR REPLACE FUNCTION public.organizer_update_friendly_game_max_players(
  p_game_id UUID,
  p_max_players INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game  public.friendly_games%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_game.creator_id IS DISTINCT FROM auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the game organizer or an admin can change the player limit'
      USING ERRCODE = '42501';
  END IF;
  IF v_game.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'A finished or cancelled game cannot be edited' USING ERRCODE = 'P0001';
  END IF;
  IF p_max_players IS NULL OR p_max_players < 2 OR p_max_players > 30 THEN
    RAISE EXCEPTION 'Maximum players must be between 2 and 30' USING ERRCODE = '22023';
  END IF;
  IF p_max_players < GREATEST(COALESCE(v_game.min_players, 2), 2) THEN
    RAISE EXCEPTION 'Maximum players cannot be below the minimum players' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id AND NOT is_waitlisted;
  IF p_max_players < v_count THEN
    RAISE EXCEPTION 'Maximum players cannot be below the current number of participants'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.friendly_games
  SET max_players = p_max_players,
      status = CASE WHEN v_game.status IN ('open', 'full')
                    THEN CASE WHEN v_count >= p_max_players THEN 'full' ELSE 'open' END
                    ELSE v_game.status END
  WHERE id = p_game_id;
END;
$$;
REVOKE ALL ON FUNCTION public.organizer_update_friendly_game_max_players(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organizer_update_friendly_game_max_players(UUID, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';