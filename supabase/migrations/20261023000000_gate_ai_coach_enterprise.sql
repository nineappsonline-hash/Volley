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
-- lookup per request instead of one per row. Triggers are only created for
-- tables that exist, so this migration is safe to run before/after
-- 20260918000000_ai_coach_assistant.sql.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'ai_training_plans',
    'ai_training_plan_sections',
    'training_exercises',
    'training_plan_versions',
    'training_plan_assignments',
    'post_session_reports',
    'player_development_plans',
    'player_development_goals'
  ])
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS guard_ai_coach_plan ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER guard_ai_coach_plan
           BEFORE INSERT OR UPDATE OR DELETE ON public.%I
           FOR EACH STATEMENT EXECUTE FUNCTION public.guard_ai_coach_plan()', t);
    END IF;
  END LOOP;
END
$$;
