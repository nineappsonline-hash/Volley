-- These columns were added after venues switched to column-level read grants.
-- Missing either grant makes the member playground query fail as a whole.
GRANT SELECT (court_count, unavailable_slots) ON public.venues TO anon, authenticated;

-- Change only this published game's visibility. Existing participants remain.
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
  IF NOT FOUND OR v_game.creator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the game creator can change visibility' USING ERRCODE = '42501';
  END IF;

  UPDATE public.friendly_games
  SET is_public = p_is_public,
      invite_code = CASE
        WHEN p_is_public THEN NULL
        ELSE COALESCE(v_game.invite_code, upper(replace(gen_random_uuid()::text, '-', '')))
      END
  WHERE id = p_game_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_friendly_game_visibility(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_friendly_game_visibility(UUID, BOOLEAN) TO authenticated;
