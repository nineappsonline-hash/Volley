-- Organizing tournaments (teams, fixtures, scoreboard) is an Enterprise (Elite) feature.
-- Non-Elite academies cannot create tournaments; existing tournaments stay readable.
CREATE OR REPLACE FUNCTION public.guard_tournament_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan TEXT;
BEGIN
  SELECT plan INTO v_plan FROM public.academies WHERE id = NEW.academy_id;
  IF COALESCE(v_plan, 'starter') <> 'elite' THEN
    RAISE EXCEPTION 'Organizing tournaments requires the Enterprise plan.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_tournament_plan ON public.tournaments;
CREATE TRIGGER guard_tournament_plan
  BEFORE INSERT ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_plan();