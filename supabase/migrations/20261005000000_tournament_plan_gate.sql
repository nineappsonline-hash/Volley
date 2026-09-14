-- ═══════════════════════════════════════════════════════════════
-- Tournament creation requires the Plus or Enterprise (elite) plan.
--
-- The original `guard_tournament_plan` (Elite-only) trigger was removed
-- during the visibility work; that left every plan able to create
-- tournaments. This restores a paid-plan gate:
--   • academy on Plus (plus)  or Enterprise (elite)  → allowed
--   • academy on free Starter (starter)              → blocked
--   • platform admin (no academy, academy_id NULL)   → allowed
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_tournament_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
BEGIN
  -- Platform-wide tournaments have no academy; only the platform admin.
  IF NEW.academy_id IS NULL THEN
    IF public.is_super_admin() THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'A tournament must belong to an academy.';
  END IF;

  SELECT plan INTO v_plan FROM public.academies WHERE id = NEW.academy_id;
  IF COALESCE(v_plan, 'starter') NOT IN ('plus', 'elite') THEN
    RAISE EXCEPTION 'Organizing tournaments requires the Plus or Enterprise plan.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tournament_plan ON public.tournaments;
CREATE TRIGGER guard_tournament_plan
  BEFORE INSERT ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_plan();