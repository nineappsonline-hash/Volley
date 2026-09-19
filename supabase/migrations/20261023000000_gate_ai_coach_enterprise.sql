-- ═══════════════════════════════════════════════════════════════
-- AI Coach Assistant is an Enterprise (elite) feature.
--
-- The AI training-session suggestion feature (/coach-ai): AI-generated
-- training plans, player development plans and post-session reports.
-- Starter and Plus academies can still view existing AI coach content
-- (read policies are unchanged) but cannot create or modify it:
--   • academy on Enterprise (elite)  → allowed
--   • Starter / Plus / no plan       → blocked
--   • platform admin (no academy)    → allowed (manages any data)
--
-- Enforcement is on the AI coach tables themselves (the RPCs in
-- 20260918000000_ai_coach_assistant.sql are the only write path), so
-- the gate also holds for direct client writes.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_ai_coach_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
BEGIN
  -- The platform admin has no academy; they manage everything.
  IF public.is_super_admin() THEN
    RETURN NULL;
  END IF;

  SELECT plan INTO v_plan FROM public.academies
  WHERE id = public.current_academy_id();
  -- No academy row (e.g. synthetic family profiles): treated as no plan.
  IF COALESCE(v_plan, 'starter') <> 'elite' THEN
    RAISE EXCEPTION 'The AI Coach Assistant requires the Enterprise plan.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END;
$$;

-- One statement-level trigger per table keeps the gate to a single plan
-- lookup per request instead of one per row.
DROP TRIGGER IF EXISTS guard_ai_coach_plan_plans ON public.ai_training_plans;
CREATE TRIGGER guard_ai_coach_plan_plans
  BEFORE INSERT OR UPDATE OR DELETE ON public.ai_training_plans
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_ai_coach_plan();

DROP TRIGGER IF EXISTS guard_ai_coach_plan_sections ON public.ai_training_plan_sections;
CREATE TRIGGER guard_ai_coach_plan_sections
  BEFORE INSERT OR UPDATE OR DELETE ON public.ai_training_plan_sections
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_ai_coach_plan();

DROP TRIGGER IF EXISTS guard_ai_coach_plan_exercises ON public.training_exercises;
CREATE TRIGGER guard_ai_coach_plan_exercises
  BEFORE INSERT OR UPDATE OR DELETE ON public.training_exercises
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_ai_coach_plan();

DROP TRIGGER IF EXISTS guard_ai_coach_plan_versions ON public.training_plan_versions;
CREATE TRIGGER guard_ai_coach_plan_versions
  BEFORE INSERT OR UPDATE OR DELETE ON public.training_plan_versions
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_ai_coach_plan();

DROP TRIGGER IF EXISTS guard_ai_coach_plan_assignments ON public.training_plan_assignments;
CREATE TRIGGER guard_ai_coach_plan_assignments
  BEFORE INSERT OR UPDATE OR DELETE ON public.training_plan_assignments
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_ai_coach_plan();

DROP TRIGGER IF EXISTS guard_ai_coach_plan_reports ON public.post_session_reports;
CREATE TRIGGER guard_ai_coach_plan_reports
  BEFORE INSERT OR UPDATE OR DELETE ON public.post_session_reports
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_ai_coach_plan();

DROP TRIGGER IF EXISTS guard_ai_coach_plan_dev ON public.player_development_plans;
CREATE TRIGGER guard_ai_coach_plan_dev
  BEFORE INSERT OR UPDATE OR DELETE ON public.player_development_plans
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_ai_coach_plan();

DROP TRIGGER IF EXISTS guard_ai_coach_plan_dev_goals ON public.player_development_goals;
CREATE TRIGGER guard_ai_coach_plan_dev_goals
  BEFORE INSERT OR UPDATE OR DELETE ON public.player_development_goals
  FOR EACH STATEMENT EXECUTE FUNCTION public.guard_ai_coach_plan();
