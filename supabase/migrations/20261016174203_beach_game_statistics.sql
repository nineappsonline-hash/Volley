-- Anonymous play is supported through a narrow server API; no client has table access.
CREATE TABLE public.beach_game_sessions (
 id uuid PRIMARY KEY,
 token_hash text NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 player_points integer CHECK (player_points BETWEEN 0 AND 999),
 cpu_points integer CHECK (cpu_points BETWEEN 0 AND 999),
 CHECK ((finished_at IS NULL AND player_points IS NULL AND cpu_points IS NULL)
     OR (finished_at IS NOT NULL AND player_points IS NOT NULL AND cpu_points IS NOT NULL))
);
CREATE TABLE public.beach_game_totals (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 total_games bigint NOT NULL DEFAULT 0 CHECK(total_games>=0),
 player_wins bigint NOT NULL DEFAULT 0 CHECK(player_wins>=0),
 cpu_wins bigint NOT NULL DEFAULT 0 CHECK(cpu_wins>=0),
 draws bigint NOT NULL DEFAULT 0 CHECK(draws>=0),
 CHECK(total_games=player_wins+cpu_wins+draws)
);
INSERT INTO public.beach_game_totals(singleton) VALUES(true);
ALTER TABLE public.beach_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beach_game_totals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beach_game_sessions,public.beach_game_totals FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.beach_game_sessions TO service_role;
GRANT SELECT,UPDATE ON public.beach_game_totals TO service_role;
CREATE FUNCTION public.read_beach_game_totals() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('totalGames',total_games,'playerWins',player_wins,'cpuWins',cpu_wins,'draws',draws)
 FROM public.beach_game_totals WHERE singleton;
$$;
CREATE FUNCTION public.finish_beach_game(p_id uuid,p_token_hash text,p_player integer,p_cpu integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_session public.beach_game_sessions%ROWTYPE;
BEGIN
 IF p_player IS NULL OR p_cpu IS NULL OR p_player<0 OR p_player>999 OR p_cpu<0 OR p_cpu>999 THEN
  RAISE EXCEPTION 'Invalid score' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_session FROM public.beach_game_sessions WHERE id=p_id AND token_hash=p_token_hash FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid match token' USING ERRCODE='22023'; END IF;
 IF v_session.finished_at IS NOT NULL THEN RETURN public.read_beach_game_totals(); END IF;
 IF now()<v_session.started_at+interval '80 seconds' OR now()>v_session.started_at+interval '24 hours' THEN
  RAISE EXCEPTION 'Match is not eligible for completion' USING ERRCODE='22023';
 END IF;
 UPDATE public.beach_game_sessions SET finished_at=now(),player_points=p_player,cpu_points=p_cpu WHERE id=p_id;
 UPDATE public.beach_game_totals SET total_games=total_games+1,
  player_wins=player_wins+CASE WHEN p_player>p_cpu THEN 1 ELSE 0 END,
  cpu_wins=cpu_wins+CASE WHEN p_player<p_cpu THEN 1 ELSE 0 END,
  draws=draws+CASE WHEN p_player=p_cpu THEN 1 ELSE 0 END WHERE singleton;
 RETURN public.read_beach_game_totals();
END $$;
REVOKE ALL ON FUNCTION public.read_beach_game_totals(),public.finish_beach_game(uuid,text,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_beach_game_totals(),public.finish_beach_game(uuid,text,integer,integer) TO service_role;
