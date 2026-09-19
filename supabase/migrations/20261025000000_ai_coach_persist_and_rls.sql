-- ────────────────────────────────────────────────────────────
-- AI COACH ASSISTANT — persistence & read-scope fixes
--
-- 1. save_ai_training_plan now persists the AI provenance + cost that the
--    generator reports (ai_provider / ai_model / ai_estimated_cost) instead
--    of discarding them, so academy admins can audit what the feature cost.
-- 2. save_post_session_report stops accumulating duplicate rows when the
--    same plan's report is saved again with no session_id (Postgres treats
--    NULLs as distinct in UNIQUE(plan_id, session_id)); it now upserts by
--    (plan_id, session_id).
-- 3. "PDP goals read" no longer hands every academy member every goal row;
--    only academy staff, the plan's player, or a parent of that player can
--    read goals (matches the parent development-plan policies).
-- ────────────────────────────────────────────────────────────

-- ── 1. Persist AI provenance / estimated cost on training plans ──
CREATE OR REPLACE FUNCTION public.save_ai_training_plan(p_plan JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_team_id UUID;
  v_version INTEGER;
  v_created_by UUID;
  v_section JSONB;
  v_section_id UUID;
  v_exercise JSONB;
  v_can_edit TEXT;
  v_academy UUID;
BEGIN
  IF auth.uid() IS NULL OR public.is_academy_staff() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only academy staff can save training plans' USING ERRCODE = '42501';
  END IF;
  IF p_plan IS NULL OR jsonb_typeof(p_plan) <> 'object' THEN
    RAISE EXCEPTION 'Plan payload must be an object';
  END IF;

  v_academy := public.current_academy_id();
  v_team_id := NULLIF(p_plan ->> 'team_id', '')::UUID;
  v_created_by := auth.uid();

  -- Team scoping: coaches may only attach plans to their own teams.
  IF public.is_academy_admin() IS NOT TRUE AND v_team_id IS NOT NULL
     AND v_team_id <> ALL (public.current_coach_team_ids()) THEN
    RAISE EXCEPTION 'You can only create plans for teams assigned to you';
  END IF;

  v_id := NULLIF(p_plan ->> 'id', '')::UUID;

  IF v_id IS NULL THEN
    -- ── CREATE ───────────────────────────────────────────────
    INSERT INTO public.ai_training_plans (
      academy_id, branch_id, team_id, session_id, sport_id, sport, title,
      main_objective, secondary_objectives, skill_focus, intensity_theme,
      session_duration_min, num_players, num_coaches, age_group, skill_level,
      gender, equipment, space, notes, status, ai_provider, ai_model,
      ai_generation_id, ai_estimated_cost, created_by, updated_by
    ) VALUES (
      v_academy,
      NULLIF(p_plan ->> 'branch_id', '')::UUID,
      v_team_id,
      NULLIF(p_plan ->> 'session_id', '')::UUID,
      NULLIF(p_plan ->> 'sport_id', '')::UUID,
      NULLIF(p_plan ->> 'sport', ''),
      NULLIF(btrim(p_plan ->> 'title'), ''),
      NULLIF(p_plan ->> 'main_objective', ''),
      COALESCE(p_plan -> 'secondary_objectives', '[]'::JSONB),
      COALESCE(p_plan -> 'skill_focus', '[]'::JSONB),
      COALESCE(NULLIF(p_plan ->> 'intensity_theme', ''), 'moderate'),
      COALESCE((p_plan ->> 'session_duration_min')::INTEGER, 60),
      COALESCE((p_plan ->> 'num_players')::INTEGER, 0),
      COALESCE((p_plan ->> 'num_coaches')::INTEGER, 1),
      NULLIF(p_plan ->> 'age_group', ''),
      NULLIF(p_plan ->> 'skill_level', ''),
      NULLIF(p_plan ->> 'gender', ''),
      COALESCE(p_plan -> 'equipment', '[]'::JSONB),
      NULLIF(p_plan ->> 'space', ''),
      NULLIF(p_plan ->> 'notes', ''),
      'draft',
      NULLIF(p_plan ->> 'ai_provider', ''),
      NULLIF(p_plan ->> 'ai_model', ''),
      NULLIF(p_plan ->> 'ai_generation_id', ''),
      COALESCE((p_plan ->> 'ai_estimated_cost')::NUMERIC, 0),
      v_created_by, v_created_by
    )
    RETURNING id INTO v_id;
    v_version := 1;
  ELSE
    -- ── EDIT ─────────────────────────────────────────────────
    SELECT status, version, created_by, academy_id INTO v_can_edit, v_version,
      v_created_by, v_academy
    FROM public.ai_training_plans WHERE id = v_id;
    IF v_can_edit IS NULL THEN
      RAISE EXCEPTION 'Plan not found';
    END IF;
    IF v_academy <> public.current_academy_id() THEN
      RAISE EXCEPTION 'Plan belongs to another academy' USING ERRCODE = '42501';
    END IF;
    -- Content is locked after approval; only status/navigation actions allowed.
    IF v_can_edit IN ('approved', 'archived') THEN
      RAISE EXCEPTION 'This plan is % and its content is locked', v_can_edit;
    END IF;
    IF public.is_academy_admin() IS NOT TRUE AND v_created_by <> auth.uid() THEN
      RAISE EXCEPTION 'Only the plan author or an admin can edit this plan' USING ERRCODE = '42501';
    END IF;

    UPDATE public.ai_training_plans SET
      branch_id = NULLIF(p_plan ->> 'branch_id', '')::UUID,
      team_id = NULLIF(p_plan ->> 'team_id', '')::UUID,
      session_id = NULLIF(p_plan ->> 'session_id', '')::UUID,
      sport_id = NULLIF(p_plan ->> 'sport_id', '')::UUID,
      sport = NULLIF(p_plan ->> 'sport', ''),
      title = NULLIF(btrim(p_plan ->> 'title'), ''),
      main_objective = NULLIF(p_plan ->> 'main_objective', ''),
      secondary_objectives = COALESCE(p_plan -> 'secondary_objectives', '[]'::JSONB),
      skill_focus = COALESCE(p_plan -> 'skill_focus', '[]'::JSONB),
      intensity_theme = COALESCE(NULLIF(p_plan ->> 'intensity_theme', ''), 'moderate'),
      session_duration_min = COALESCE((p_plan ->> 'session_duration_min')::INTEGER, 60),
      num_players = COALESCE((p_plan ->> 'num_players')::INTEGER, 0),
      num_coaches = COALESCE((p_plan ->> 'num_coaches')::INTEGER, 1),
      age_group = NULLIF(p_plan ->> 'age_group', ''),
      skill_level = NULLIF(p_plan ->> 'skill_level', ''),
      gender = NULLIF(p_plan ->> 'gender', ''),
      equipment = COALESCE(p_plan -> 'equipment', '[]'::JSONB),
      space = NULLIF(p_plan ->> 'space', ''),
      notes = NULLIF(p_plan ->> 'notes', ''),
      ai_provider = COALESCE(NULLIF(p_plan ->> 'ai_provider', ''), ai_provider),
      ai_model = COALESCE(NULLIF(p_plan ->> 'ai_model', ''), ai_model),
      ai_generation_id = COALESCE(NULLIF(p_plan ->> 'ai_generation_id', ''), ai_generation_id),
      ai_estimated_cost = COALESCE((p_plan ->> 'ai_estimated_cost')::NUMERIC, ai_estimated_cost),
      version = version + 1,
      updated_by = auth.uid(),
      updated_at = NOW()
    WHERE id = v_id;
    v_version := v_version + 1;

    -- Replace sections & exercises wholesale (child tables cascade on delete
    -- of the plan only, so we delete explicitly by ids).
    DELETE FROM public.ai_training_plan_sections WHERE plan_id = v_id;
  END IF;

  -- Insert sections & exercises.
  IF jsonb_typeof(p_plan -> 'sections') = 'array' THEN
    FOR v_section IN SELECT * FROM jsonb_array_elements(p_plan -> 'sections') LOOP
      INSERT INTO public.ai_training_plan_sections (
        plan_id, section_type, title, purpose, duration_min, skill_focus, order_index
      ) VALUES (
        v_id,
        COALESCE(NULLIF(v_section ->> 'section_type', ''), 'technical'),
        NULLIF(btrim(v_section ->> 'title'), ''),
        NULLIF(v_section ->> 'purpose', ''),
        COALESCE((v_section ->> 'duration_min')::INTEGER, 10),
        COALESCE(v_section -> 'skill_focus', '[]'::JSONB),
        COALESCE((v_section ->> 'order_index')::INTEGER, 0)
      )
      RETURNING id INTO v_section_id;

      IF jsonb_typeof(v_section -> 'exercises') = 'array' THEN
        FOR v_exercise IN SELECT * FROM jsonb_array_elements(v_section -> 'exercises') LOOP
          INSERT INTO public.training_exercises (
            section_id, name, purpose, duration_min, num_players, equipment,
            setup, instructions, coaching_points, difficulty, order_index,
            ai_generated
          ) VALUES (
            v_section_id,
            NULLIF(btrim(v_exercise ->> 'name'), ''),
            NULLIF(v_exercise ->> 'purpose', ''),
            COALESCE((v_exercise ->> 'duration_min')::INTEGER, 5),
            NULLIF(v_exercise ->> 'num_players', '')::INTEGER,
            COALESCE(v_exercise -> 'equipment', '[]'::JSONB),
            NULLIF(v_exercise ->> 'setup', ''),
            COALESCE(v_exercise -> 'instructions', '[]'::JSONB),
            COALESCE(v_exercise -> 'coaching_points', '[]'::JSONB),
            NULLIF(v_exercise ->> 'difficulty', ''),
            COALESCE((v_exercise ->> 'order_index')::INTEGER, 0),
            COALESCE((v_exercise ->> 'ai_generated')::BOOLEAN, FALSE)
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- Snapshot the version.
  INSERT INTO public.training_plan_versions (plan_id, version, editor_id, action, snapshot)
  VALUES (
    v_id,
    v_version,
    auth.uid(),
    CASE WHEN (p_plan -> 'sections') IS NOT NULL THEN 'edited' ELSE 'generated' END,
    coalesce(p_plan, '{}'::jsonb)
  );

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_ai_training_plan(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_ai_training_plan(JSONB) TO authenticated;

-- ── 2. Save a post-session report once per (plan, session) ──
CREATE OR REPLACE FUNCTION public.save_post_session_report(p_report JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_plan_id UUID;
  v_session_id UUID;
  v_academy UUID;
BEGIN
  IF auth.uid() IS NULL OR public.is_academy_staff() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only academy staff can save reports' USING ERRCODE = '42501';
  END IF;
  IF p_report IS NULL OR jsonb_typeof(p_report) <> 'object' THEN
    RAISE EXCEPTION 'Report payload must be an object';
  END IF;

  v_plan_id := NULLIF(p_report ->> 'plan_id', '')::UUID;
  IF v_plan_id IS NOT NULL THEN
    SELECT academy_id INTO v_academy FROM public.ai_training_plans WHERE id = v_plan_id;
    IF v_academy IS NOT NULL AND v_academy <> public.current_academy_id() THEN
      RAISE EXCEPTION 'Plan belongs to another academy' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_id := NULLIF(p_report ->> 'id', '')::UUID;
  v_session_id := NULLIF(p_report ->> 'session_id', '')::UUID;

  -- Without an explicit id, upsert by (plan_id, session_id) instead of
  -- inserting a fresh row every save (NULLs are distinct under PostgreSQL's
  -- UNIQUE(plan_id, session_id), so the constraint alone can't dedupe).
  IF v_id IS NULL AND v_plan_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.post_session_reports
    WHERE academy_id = public.current_academy_id()
      AND plan_id = v_plan_id
      AND session_id IS NOT DISTINCT FROM v_session_id
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.post_session_reports (
      academy_id, plan_id, session_id, team_id, coach_id, completed,
      actual_duration_min, exercises_performance, performance_rating,
      intensity_rating, engagement_rating, skills_improved, skills_need_work,
      injuries, notes, player_notes, created_by
    ) VALUES (
      public.current_academy_id(),
      v_plan_id,
      v_session_id,
      NULLIF(p_report ->> 'team_id', '')::UUID,
      COALESCE(NULLIF(p_report ->> 'coach_id', '')::UUID, auth.uid()),
      COALESCE((p_report ->> 'completed')::BOOLEAN, TRUE),
      NULLIF(p_report ->> 'actual_duration_min', '')::INTEGER,
      COALESCE(p_report -> 'exercises_performance', '[]'::JSONB),
      NULLIF(p_report ->> 'performance_rating', '')::INTEGER,
      NULLIF(p_report ->> 'intensity_rating', '')::INTEGER,
      NULLIF(p_report ->> 'engagement_rating', '')::INTEGER,
      COALESCE(p_report -> 'skills_improved', '[]'::JSONB),
      COALESCE(p_report -> 'skills_need_work', '[]'::JSONB),
      COALESCE(p_report -> 'injuries', '[]'::JSONB),
      NULLIF(p_report ->> 'notes', ''),
      COALESCE(p_report -> 'player_notes', '[]'::JSONB),
      auth.uid()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.post_session_reports SET
      plan_id = v_plan_id,
      session_id = NULLIF(p_report ->> 'session_id', '')::UUID,
      team_id = NULLIF(p_report ->> 'team_id', '')::UUID,
      coach_id = COALESCE(NULLIF(p_report ->> 'coach_id', '')::UUID, auth.uid()),
      completed = COALESCE((p_report ->> 'completed')::BOOLEAN, TRUE),
      actual_duration_min = NULLIF(p_report ->> 'actual_duration_min', '')::INTEGER,
      exercises_performance = COALESCE(p_report -> 'exercises_performance', '[]'::JSONB),
      performance_rating = NULLIF(p_report ->> 'performance_rating', '')::INTEGER,
      intensity_rating = NULLIF(p_report ->> 'intensity_rating', '')::INTEGER,
      engagement_rating = NULLIF(p_report ->> 'engagement_rating', '')::INTEGER,
      skills_improved = COALESCE(p_report -> 'skills_improved', '[]'::JSONB),
      skills_need_work = COALESCE(p_report -> 'skills_need_work', '[]'::JSONB),
      injuries = COALESCE(p_report -> 'injuries', '[]'::JSONB),
      notes = NULLIF(p_report ->> 'notes', ''),
      player_notes = COALESCE(p_report -> 'player_notes', '[]'::JSONB),
      updated_at = NOW()
    WHERE id = v_id
      AND academy_id = public.current_academy_id();
    IF NOT FOUND THEN RAISE EXCEPTION 'Report not found or belongs to another academy'; END IF;
  END IF;

  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_post_session_report(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_post_session_report(JSONB) TO authenticated;

-- ── 3. PDP goals: only staff / the player / a parent may read goals ──
-- Guarded by to_regclass so this migration is safe to run before the AI coach
-- tables are created (a plain DROP POLICY fails with 42P01 when the table is
-- missing, even with IF EXISTS).
DO $$
BEGIN
  IF to_regclass('public.player_development_goals') IS NOT NULL THEN
    DROP POLICY IF EXISTS "PDP goals read" ON public.player_development_goals;
    CREATE POLICY "PDP goals read" ON public.player_development_goals
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.player_development_plans p
          WHERE p.id = plan_id
            AND (
              -- Academy staff (admin + any linked coach) may read goals for the
              -- plans they can already see through the parent-plan policies.
              (p.academy_id = public.current_academy_id() AND public.is_academy_staff())
              -- The player themself, once the plan is released to them.
              OR (p.player_id = auth.uid() AND p.visibility IN ('player', 'parent'))
              -- The parent of the player, when the plan is shared with them.
              OR (
                p.visibility = 'parent'
                AND EXISTS (
                  SELECT 1 FROM public.profiles child
                  WHERE child.id = p.player_id AND child.guardian_id = auth.uid()
                )
              )
            )
        )
      );
  END IF;
END
$$;