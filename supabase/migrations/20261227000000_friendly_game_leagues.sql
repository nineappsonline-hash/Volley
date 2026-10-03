-- A game-local league, independent of academy tournaments. All writes use the
-- locked, versioned RPC; no client may write directly to league storage.
CREATE TABLE public.friendly_game_leagues (
  game_id uuid PRIMARY KEY REFERENCES public.friendly_games(id) ON DELETE CASCADE,
  teams jsonb NOT NULL DEFAULT '[]'::jsonb,
  matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.friendly_game_leagues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.friendly_game_leagues FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.manage_friendly_game_league(
  p_game_id uuid,
  p_action text DEFAULT 'read',
  p_revision integer DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  g public.friendly_games%ROWTYPE;
  l public.friendly_game_leagues%ROWTYPE;
  roster jsonb;
  team jsonb;
  player jsonb;
  teams jsonb;
  matches jsonb;
  ids uuid[] := ARRAY[]::uuid[];
  names text[] := ARRAY[]::text[];
  assigned uuid[] := ARRAY[]::uuid[];
  rotation uuid[];
  a uuid; b uuid; tail uuid;
  n integer; r integer; i integer; idx integer;
  score_a integer; score_b integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to manage teams' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO g FROM public.friendly_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF g.creator_id <> auth.uid() AND public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only the game creator or super admin can manage teams' USING ERRCODE = '42501';
  END IF;
  IF g.status = 'cancelled' THEN RAISE EXCEPTION 'This game is cancelled'; END IF;
  -- Game dates/times are venue-local Egyptian time, including daylight saving.
  IF (g.game_date + g.start_time) AT TIME ZONE 'Africa/Cairo' > now() THEN
    RAISE EXCEPTION 'Teams become available when the game starts';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.player_name) ORDER BY p.player_name, p.id), '[]'::jsonb)
    INTO roster FROM public.friendly_game_participants p
    WHERE p.game_id = p_game_id AND NOT p.is_waitlisted;
  SELECT * INTO l FROM public.friendly_game_leagues WHERE game_id = p_game_id;
  IF NOT FOUND THEN
    l.game_id := p_game_id; l.teams := '[]'; l.matches := '[]'; l.revision := 0;
  END IF;
  IF p_action = 'read' THEN
    RETURN jsonb_build_object('teams', l.teams, 'matches', l.matches, 'revision', l.revision, 'roster', roster);
  END IF;
  IF p_revision IS DISTINCT FROM l.revision THEN
    RAISE EXCEPTION 'The league changed. Reload it before saving.' USING ERRCODE = '40001';
  END IF;
  IF p_action = 'setup' THEN
    IF jsonb_array_length(l.matches) > 0 THEN RAISE EXCEPTION 'Teams are locked after fixtures are generated'; END IF;
    teams := p_payload->'teams';
    IF jsonb_typeof(teams) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid teams'; END IF;
    IF jsonb_array_length(teams) > 32 THEN RAISE EXCEPTION 'Maximum 32 teams'; END IF;
    l.teams := '[]';
    FOR team IN SELECT value FROM jsonb_array_elements(teams) LOOP
      a := (team->>'id')::uuid;
      IF a IS NULL OR a = ANY(ids) THEN RAISE EXCEPTION 'Invalid or duplicate team ID'; END IF;
      IF nullif(btrim(team->>'name'), '') IS NULL OR length(btrim(team->>'name')) > 60 THEN
        RAISE EXCEPTION 'Team names must contain 1 to 60 characters';
      END IF;
      IF lower(btrim(team->>'name')) = ANY(names) THEN RAISE EXCEPTION 'Team names must be different'; END IF;
      IF jsonb_typeof(team->'players') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid players'; END IF;
      FOR player IN SELECT value FROM jsonb_array_elements(team->'players') LOOP
        b := (player #>> '{}')::uuid;
        IF b IS NULL OR b = ANY(assigned) OR NOT EXISTS (
          SELECT 1 FROM public.friendly_game_participants p WHERE p.id = b AND p.game_id = p_game_id AND NOT p.is_waitlisted
        ) THEN RAISE EXCEPTION 'Each active player can belong to only one team in this game'; END IF;
        assigned := array_append(assigned, b);
      END LOOP;
      ids := array_append(ids, a); names := array_append(names, lower(btrim(team->>'name')));
      l.teams := l.teams || jsonb_build_array(jsonb_build_object('id', a, 'name', btrim(team->>'name'), 'players', team->'players'));
    END LOOP;
  ELSIF p_action = 'generate' THEN
    IF jsonb_array_length(l.matches) > 0 THEN RAISE EXCEPTION 'Fixtures already exist'; END IF;
    IF jsonb_array_length(l.teams) < 2 THEN RAISE EXCEPTION 'Add at least two teams'; END IF;
    FOR team IN SELECT value FROM jsonb_array_elements(l.teams) LOOP
      IF jsonb_array_length(team->'players') = 0 THEN RAISE EXCEPTION 'Each team needs at least one player'; END IF;
      ids := array_append(ids, (team->>'id')::uuid);
      FOR player IN SELECT value FROM jsonb_array_elements(team->'players') LOOP
        b := (player #>> '{}')::uuid;
        IF NOT EXISTS (SELECT 1 FROM public.friendly_game_participants p WHERE p.id = b AND p.game_id = p_game_id AND NOT p.is_waitlisted) THEN
          RAISE EXCEPTION 'The roster changed. Update team assignments first';
        END IF;
        assigned := array_append(assigned, b);
      END LOOP;
    END LOOP;
    IF cardinality(assigned) <> jsonb_array_length(roster) THEN RAISE EXCEPTION 'Assign every active player before generating fixtures'; END IF;
    rotation := ids;
    IF cardinality(rotation) % 2 = 1 THEN rotation := array_append(rotation, NULL::uuid); END IF;
    n := cardinality(rotation); matches := '[]'; idx := 0;
    -- Circle method: each pair plays once; odd team counts receive a bye.
    FOR r IN 1..n-1 LOOP
      FOR i IN 1..n/2 LOOP
        a := rotation[i]; b := rotation[n+1-i];
        IF a IS NOT NULL AND b IS NOT NULL THEN
          idx := idx + 1;
          matches := matches || jsonb_build_array(jsonb_build_object('id', idx, 'round', r, 'a', a, 'b', b, 'score_a', NULL, 'score_b', NULL));
        END IF;
      END LOOP;
      tail := rotation[n]; rotation := ARRAY[rotation[1], tail] || rotation[2:n-1];
    END LOOP;
    l.matches := matches;
  ELSIF p_action = 'score' THEN
    IF coalesce(p_payload->>'score_a', '') !~ '^[0-9]{1,4}$' OR coalesce(p_payload->>'score_b', '') !~ '^[0-9]{1,4}$' THEN
      RAISE EXCEPTION 'Scores must be whole numbers between 0 and 9999';
    END IF;
    score_a := (p_payload->>'score_a')::integer; score_b := (p_payload->>'score_b')::integer;
    SELECT ordinality::integer - 1 INTO idx FROM jsonb_array_elements(l.matches) WITH ORDINALITY
      WHERE value->>'id' = p_payload->>'match_id';
    IF idx IS NULL THEN RAISE EXCEPTION 'Match not found'; END IF;
    l.matches := jsonb_set(l.matches, ARRAY[idx::text], (l.matches->idx) || jsonb_build_object('score_a', score_a, 'score_b', score_b));
  ELSE RAISE EXCEPTION 'Unknown league action';
  END IF;
  INSERT INTO public.friendly_game_leagues(game_id, teams, matches, revision)
    VALUES(p_game_id, l.teams, l.matches, l.revision + 1)
    ON CONFLICT(game_id) DO UPDATE SET teams = excluded.teams, matches = excluded.matches,
      revision = excluded.revision, updated_at = now();
  RETURN jsonb_build_object('teams', l.teams, 'matches', l.matches, 'revision', l.revision + 1, 'roster', roster);
END;
$$;
REVOKE ALL ON FUNCTION public.manage_friendly_game_league(uuid, text, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_friendly_game_league(uuid, text, integer, jsonb) TO authenticated;
