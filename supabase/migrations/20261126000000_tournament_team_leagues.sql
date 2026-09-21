-- Complete organizer permissions and support tournament-scoped teams.
CREATE OR REPLACE FUNCTION public.is_tournament_organizer(p_tournament_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (COALESCE(public.is_super_admin(), false) OR EXISTS (
    SELECT 1 FROM public.tournaments t WHERE t.id = p_tournament_id
    AND t.academy_id = public.current_academy_id()
    AND auth.jwt()->'app_metadata'->>'role' = 'admin'
  ));
$$;
REVOKE ALL ON FUNCTION public.is_tournament_organizer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tournament_organizer(UUID) TO authenticated;

ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_participants TO authenticated;
DROP POLICY IF EXISTS "Members manage tournament participants" ON public.tournament_participants;
DROP POLICY IF EXISTS "Members read tournament participants" ON public.tournament_participants;
CREATE POLICY "Members read tournament participants" ON public.tournament_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members manage tournament participants" ON public.tournament_participants FOR ALL TO authenticated USING (public.is_tournament_organizer(tournament_id)) WITH CHECK (public.is_tournament_organizer(tournament_id));

ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_teams TO authenticated;
DROP POLICY IF EXISTS "Members manage tournament teams" ON public.tournament_teams;
DROP POLICY IF EXISTS "Members read tournament teams" ON public.tournament_teams;
CREATE POLICY "Members read tournament teams" ON public.tournament_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members manage tournament teams" ON public.tournament_teams FOR ALL TO authenticated USING (public.is_tournament_organizer(tournament_id)) WITH CHECK (public.is_tournament_organizer(tournament_id));

ALTER TABLE public.tournament_team_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_team_members TO authenticated;
DROP POLICY IF EXISTS "Members manage tournament team members" ON public.tournament_team_members;
DROP POLICY IF EXISTS "Members read tournament team members" ON public.tournament_team_members;
CREATE POLICY "Members read tournament team members" ON public.tournament_team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members manage tournament team members" ON public.tournament_team_members FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.tournament_teams tt WHERE tt.id = team_id AND public.is_tournament_organizer(tt.tournament_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.tournament_teams tt WHERE tt.id = team_id AND public.is_tournament_organizer(tt.tournament_id)));

-- Keep existing academy-team matches working as well as new named teams.
ALTER TABLE public.tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_team_a_id_fkey;
ALTER TABLE public.tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_team_b_id_fkey;
CREATE OR REPLACE FUNCTION public.validate_tournament_match_teams()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE team UUID;
BEGIN
  FOREACH team IN ARRAY ARRAY[NEW.team_a_id, NEW.team_b_id] LOOP
    IF team IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tournament_teams tt WHERE tt.id = team AND tt.tournament_id = NEW.tournament_id)
      AND NOT EXISTS (SELECT 1 FROM public.teams at JOIN public.tournaments t ON t.academy_id = at.academy_id WHERE at.id = team AND t.id = NEW.tournament_id) THEN
      RAISE EXCEPTION 'Team must belong to this tournament or its academy';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_tournament_match_teams ON public.tournament_matches;
CREATE TRIGGER validate_tournament_match_teams BEFORE INSERT OR UPDATE ON public.tournament_matches FOR EACH ROW EXECUTE FUNCTION public.validate_tournament_match_teams();

CREATE OR REPLACE FUNCTION public.validate_tournament_roster()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tid UUID;
BEGIN
  SELECT tournament_id INTO tid FROM public.tournament_participants WHERE id = NEW.participant_id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.tournament_teams WHERE id = NEW.team_id AND tournament_id = tid) THEN
    RAISE EXCEPTION 'Participant and team must belong to the same tournament';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_team_members WHERE participant_id = NEW.participant_id AND id <> NEW.id) THEN
    RAISE EXCEPTION 'This participant is already assigned to a team';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validate_tournament_roster ON public.tournament_team_members;
CREATE TRIGGER validate_tournament_roster BEFORE INSERT OR UPDATE ON public.tournament_team_members FOR EACH ROW EXECUTE FUNCTION public.validate_tournament_roster();
CREATE OR REPLACE FUNCTION public.protect_tournament_team()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tournament_matches WHERE team_a_id = OLD.id OR team_b_id = OLD.id) THEN
    RAISE EXCEPTION 'This team has fixtures and cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS protect_tournament_team ON public.tournament_teams;
CREATE TRIGGER protect_tournament_team BEFORE DELETE ON public.tournament_teams FOR EACH ROW EXECUTE FUNCTION public.protect_tournament_team();
CREATE OR REPLACE FUNCTION public.submit_tournament_score(
  p_match_id UUID,
  p_score_a INTEGER,
  p_score_b INTEGER,
  p_goals_a INTEGER DEFAULT NULL,
  p_goals_b INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.tournament_matches%ROWTYPE;
  v_format public.tournaments.format%TYPE;
  v_winner UUID;
  v_next_id UUID;
BEGIN
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- Authorization: the tournament's academy, or the platform admin.
  IF public.is_tournament_organizer(v_match.tournament_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT format INTO v_format FROM public.tournaments WHERE id = v_match.tournament_id;

  IF p_score_a IS NULL OR p_score_b IS NULL
     OR p_score_a < 0 OR p_score_b < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative numbers';
  END IF;
  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL OR v_match.status = 'canceled' THEN
    RAISE EXCEPTION 'Only a fixture with two teams can be scored';
  END IF;
  IF v_format = 'knockout' THEN
    IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
      RAISE EXCEPTION 'Both teams must be decided before entering a score';
    END IF;
    IF p_score_a = p_score_b THEN
      RAISE EXCEPTION 'Knockout matches cannot end in a draw';
    END IF;
  END IF;

  UPDATE public.tournament_matches SET
    score_a = p_score_a,
    score_b = p_score_b,
    goals_a = COALESCE(p_goals_a, p_score_a),
    goals_b = COALESCE(p_goals_b, p_score_b),
    status = 'completed'
  WHERE id = p_match_id;

  -- Knockout: the winner fills the next-round slot that points at us.
  IF v_format = 'knockout' THEN
    v_winner := CASE WHEN p_score_a > p_score_b
                     THEN v_match.team_a_id ELSE v_match.team_b_id END;

    SELECT m.id INTO v_next_id
    FROM public.tournament_matches m
    WHERE m.prev_match_a_id = p_match_id OR m.prev_match_b_id = p_match_id
    LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE public.tournament_matches SET
        team_a_id = CASE WHEN prev_match_a_id = p_match_id THEN v_winner ELSE team_a_id END,
        team_b_id = CASE WHEN prev_match_b_id = p_match_id THEN v_winner ELSE team_b_id END
      WHERE id = v_next_id;
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_tournament_score(UUID, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_tournament_fixtures(p_tournament_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_format   public.tournaments.format%TYPE;
  v_team     RECORD;
  v_team_ids UUID[];
  v_seats    UUID[];
  v_n        INTEGER;
  v_padded   INTEGER;
  v_span     INTEGER;
  v_rounds   INTEGER;
  v_round    INTEGER;
  v_slot     INTEGER;
  v_match_no INTEGER := 0;
  v_a        UUID;
  v_b        UUID;
  v_name     TEXT;
  v_id       UUID;
  v_created  INTEGER := 0;
  v_i        INTEGER;
  v_j        INTEGER;
  v_next_id  UUID;
  v_winner   UUID;
  v_pass     INTEGER;
BEGIN
  IF public.is_tournament_organizer(p_tournament_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT format INTO v_format FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF v_format IS NULL THEN
    RAISE EXCEPTION 'Choose a format (knockout or league) first';
  END IF;

  IF EXISTS (SELECT 1 FROM public.tournament_matches WHERE tournament_id = p_tournament_id AND status = 'completed') THEN
    RAISE EXCEPTION 'Fixtures cannot be regenerated after scores have been recorded';
  END IF;
  -- Regeneration: clear previous matches (teams and rosters are kept).
  DELETE FROM public.tournament_matches WHERE tournament_id = p_tournament_id;

  SELECT array_agg(id ORDER BY created_at, id) INTO v_team_ids
  FROM public.tournament_teams
  WHERE tournament_id = p_tournament_id;
  v_n := COALESCE(array_length(v_team_ids, 1), 0);
  IF v_n < 2 THEN
    RAISE EXCEPTION 'Add at least 2 teams before generating fixtures';
  END IF;

  -- ── Knockout: seeded single-elimination bracket ──
  IF v_format = 'knockout' THEN
    v_padded := 2 ^ ceil(log(2, v_n::numeric))::int;  -- next power of two
    v_rounds := ceil(log(2, v_padded::numeric))::int;

    -- (round, slot) → match id scratch table for wiring the bracket.
    CREATE TEMP TABLE _bracket ON COMMIT DROP AS
      SELECT NULL::INTEGER AS round, NULL::INTEGER AS slot, NULL::UUID AS id
      WHERE false;

    -- Build from the final down to round 1; leafs get the seeded teams.
    FOR v_round IN REVERSE v_rounds..1 LOOP
      FOR v_slot IN 1..(2 ^ (v_round - 1)) LOOP
        v_a := NULL;
        v_b := NULL;
        IF v_round = v_rounds THEN
          -- Slot s plays leaf positions 2s-1 vs 2s (1-indexed).
          IF (2 * v_slot - 1) <= v_n THEN v_a := v_team_ids[2 * v_slot - 1]; END IF;
          IF (2 * v_slot)     <= v_n THEN v_b := v_team_ids[2 * v_slot];     END IF;
        END IF;

        v_span := (v_padded / (2 ^ (v_round - 1)))::INTEGER;
        v_name := CASE v_span
          WHEN 2 THEN 'Final'
          WHEN 4 THEN 'Semi-final'
          WHEN 8 THEN 'Quarter-final'
          ELSE 'Round of ' || v_span
        END;

        -- Round 1 pairs play in slot order; later rounds wait for both feeds.
        INSERT INTO public.tournament_matches
          (tournament_id, round_name, team_a_id, team_b_id, prev_match_a_id, prev_match_b_id, slot, status)
        VALUES
          (p_tournament_id, v_name, v_a, v_b,
           CASE WHEN v_round < v_rounds THEN NULL ELSE NULL END,  -- wired below
           NULL, v_slot, 'scheduled')
        RETURNING id INTO v_id;

        INSERT INTO _bracket (round, slot, id) VALUES (v_round, v_slot, v_id);
        v_created := v_created + 1;
      END LOOP;
    END LOOP;

    -- Wire prev_match_a/b: match (r, s) is fed by (r+1, 2s-1) and (r+1, 2s).
    FOR v_round IN 1..(v_rounds - 1) LOOP
      FOR v_slot IN 1..(2 ^ (v_round - 1)) LOOP
        SELECT id INTO v_id FROM _bracket WHERE round = v_round AND slot = v_slot;
        UPDATE public.tournament_matches SET
          prev_match_a_id = (SELECT id FROM _bracket WHERE round = v_round + 1 AND slot = 2 * v_slot - 1),
          prev_match_b_id = (SELECT id FROM _bracket WHERE round = v_round + 1 AND slot = 2 * v_slot)
        WHERE id = v_id;
      END LOOP;
    END LOOP;

    -- Resolve byes: first, round-1 leaves with no teams at all (double
    -- byes, e.g. a 5-team 8-bracket) are dead matches — cancel them.
    UPDATE public.tournament_matches
    SET status = 'canceled', notes = 'bye'
    WHERE tournament_id = p_tournament_id
      AND prev_match_a_id IS NULL AND prev_match_b_id IS NULL
      AND team_a_id IS NULL AND team_b_id IS NULL;

    -- Then walk over one-sided leaves (a real team vs a bye): the winner
    -- advances and the bye leg is canceled. Repeat: advancing can make the
    -- next round one-sided too (cascading byes up to the final).
    FOR v_pass IN 1..v_rounds LOOP
      FOR v_match_no IN 1..v_created LOOP
        SELECT * INTO v_team FROM public.tournament_matches
        WHERE tournament_id = p_tournament_id
          AND status = 'scheduled'
          AND (team_a_id IS NULL) <> (team_b_id IS NULL)
          AND NOT EXISTS (SELECT 1 FROM public.tournament_matches feeder
            WHERE feeder.id IN (tournament_matches.prev_match_a_id, tournament_matches.prev_match_b_id)
            AND feeder.status = 'scheduled')
        LIMIT 1;
        EXIT WHEN NOT FOUND;
        v_winner := COALESCE(v_team.team_a_id, v_team.team_b_id);
        UPDATE public.tournament_matches
        SET status = 'canceled', notes = 'bye'
        WHERE id = v_team.id;
        SELECT id INTO v_next_id
        FROM public.tournament_matches
        WHERE prev_match_a_id = v_team.id OR prev_match_b_id = v_team.id
        LIMIT 1;
        IF v_next_id IS NOT NULL THEN
          UPDATE public.tournament_matches SET
            team_a_id = CASE WHEN prev_match_a_id = v_team.id THEN v_winner ELSE team_a_id END,
            team_b_id = CASE WHEN prev_match_b_id = v_team.id THEN v_winner ELSE team_b_id END
          WHERE id = v_next_id;
        END IF;
      END LOOP;
    END LOOP;

  -- ── League: round-robin via the circle method (each pair plays ONCE) ──
  ELSE
    -- Odd number of teams → add a NULL "bye" pseudo-team.
    IF v_n % 2 = 1 THEN
      v_team_ids := array_append(v_team_ids, NULL);
      v_n := v_n + 1;
    END IF;

    -- Circle method: seat 1 is fixed, seats 2..n rotate one step per round.
    -- Seating in round r (0-based): seats[k] = rotating team (k - 2 + r) mod (n-1) + 2.
    FOR v_round IN 0..(v_n - 2) LOOP
      v_seats[1] := v_team_ids[1];
      FOR v_i IN 2..v_n LOOP
        v_seats[v_i] := v_team_ids[(((v_i - 2 + v_round) % (v_n - 1)) + 2)];
      END LOOP;
      FOR v_i IN 1..(v_n / 2) LOOP
        v_j := v_n + 1 - v_i;
        v_a := v_seats[v_i];
        v_b := v_seats[v_j];
        IF v_a IS NULL OR v_b IS NULL THEN CONTINUE; END IF;
        v_match_no := v_match_no + 1;
        INSERT INTO public.tournament_matches
          (tournament_id, round_name, team_a_id, team_b_id, slot, status)
        VALUES
          (p_tournament_id, 'Matchday ' || (v_round + 1), v_a, v_b, v_match_no, 'scheduled');
        v_created := v_created + 1;
      END LOOP;
    END LOOP;
  END IF;

  RETURN v_created;
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_tournament_fixtures(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

REVOKE ALL ON FUNCTION public.submit_tournament_score(UUID, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_tournament_fixtures(UUID) FROM PUBLIC, anon;

-- Preserve the previous academy-team deletion behavior for legacy fixtures.
CREATE OR REPLACE FUNCTION public.clear_legacy_tournament_team()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.tournament_matches SET team_a_id = NULL WHERE team_a_id = OLD.id;
  UPDATE public.tournament_matches SET team_b_id = NULL WHERE team_b_id = OLD.id;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS clear_legacy_tournament_team ON public.teams;
CREATE TRIGGER clear_legacy_tournament_team BEFORE DELETE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.clear_legacy_tournament_team();
