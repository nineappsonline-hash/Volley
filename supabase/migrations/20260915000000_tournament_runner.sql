-- ═══════════════════════════════════════════════════════════════
-- Tournament runner: participants pool → named teams → fixtures →
-- scores → standings / knockout progression.
--
-- A tournament can be run as KNOCKOUT or LEAGUE (round-robin):
--  1. The organizer builds a pool of participating members.
--  2. They create named teams and add pool members to each team.
--  3. "Generate fixtures" creates the matches:
--     - knockout: seeded single-elimination bracket; winners auto-
--       advance as scores are entered (byes resolved automatically)
--     - league: single round-robin via the circle method
--  4. Scores are entered per match; standings track played/won/
--     drawn/lost, points (3/1/0) and goals for/against/difference.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS format TEXT CHECK (format IN ('knockout', 'league'));

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS goals_a INTEGER,
  ADD COLUMN IF NOT EXISTS goals_b INTEGER,
  -- Bracket wiring (knockout only): which earlier matches feed this one,
  -- and which position (1 = first leg / round-1 order) for scheduling.
  ADD COLUMN IF NOT EXISTS prev_match_a_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prev_match_b_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS slot INTEGER;

CREATE INDEX IF NOT EXISTS idx_tmatch_next_a ON public.tournament_matches(prev_match_a_id);
CREATE INDEX IF NOT EXISTS idx_tmatch_next_b ON public.tournament_matches(prev_match_b_id);

-- A team cannot play itself.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_teams_distinct'
  ) THEN
    ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_teams_distinct
      CHECK (team_a_id IS NULL OR team_b_id IS NULL OR team_a_id <> team_b_id);
  END IF;
END $$;

-- ── 1. Participants pool ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament
  ON public.tournament_participants(tournament_id);

-- ── 2. Tournament-scoped teams (independent from academy teams) ─
CREATE TABLE IF NOT EXISTS public.tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, name)
);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament
  ON public.tournament_teams(tournament_id);

-- Roster of a tournament team, drawn from the pool.
CREATE TABLE IF NOT EXISTS public.tournament_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.tournament_teams(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.tournament_participants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_tt_members_team
  ON public.tournament_team_members(team_id);

-- ── 3. RLS (same academy scoping as tournaments/matches) ───────
DROP POLICY IF EXISTS "Members manage tournament participants" ON public.tournament_participants;
CREATE POLICY "Members manage tournament participants" ON public.tournament_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.academy_id = public.current_academy_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.academy_id = public.current_academy_id()
    )
  );

DROP POLICY IF EXISTS "Members manage tournament teams" ON public.tournament_teams;
CREATE POLICY "Members manage tournament teams" ON public.tournament_teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.academy_id = public.current_academy_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id AND t.academy_id = public.current_academy_id()
    )
  );

DROP POLICY IF EXISTS "Members manage tournament team members" ON public.tournament_team_members;
CREATE POLICY "Members manage tournament team members" ON public.tournament_team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.tournament_teams tt
      JOIN public.tournaments t ON t.id = tt.tournament_id
      WHERE tt.id = team_id AND t.academy_id = public.current_academy_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tournament_teams tt
      JOIN public.tournaments t ON t.id = tt.tournament_id
      WHERE tt.id = team_id AND t.academy_id = public.current_academy_id()
    )
  );

-- ── 4. Score entry + knockout advancement ──────────────────────
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
  SELECT * INTO v_match FROM public.tournament_matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- Authorization: the tournament's academy, or the platform admin.
  IF NOT public.is_tournament_organizer(v_match.tournament_id)
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT format INTO v_format FROM public.tournaments WHERE id = v_match.tournament_id;

  IF p_score_a IS NULL OR p_score_b IS NULL
     OR p_score_a < 0 OR p_score_b < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative numbers';
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

-- ── 5. Fixture generation (knockout bracket / league schedule) ──
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
  IF NOT public.is_tournament_organizer(p_tournament_id)
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT format INTO v_format FROM public.tournaments WHERE id = p_tournament_id;
  IF v_format IS NULL THEN
    RAISE EXCEPTION 'Choose a format (knockout or league) first';
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
        IF v_round = 1 THEN
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
