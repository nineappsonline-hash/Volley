-- Teams can be attached to the playground where they train. The playground must
-- belong to the team's academy or be shared with it through academy_venues.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_teams_venue ON public.teams(venue_id);

CREATE OR REPLACE FUNCTION public.guard_team_venue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.venue_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id = NEW.venue_id
      AND (
        v.academy_id = NEW.academy_id
        OR EXISTS (
          SELECT 1 FROM public.academy_venues av
          WHERE av.academy_id = NEW.academy_id AND av.venue_id = v.id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Choose a playground for this academy';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_team_venue ON public.teams;
CREATE TRIGGER guard_team_venue
  BEFORE INSERT OR UPDATE OF venue_id, academy_id ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.guard_team_venue();

NOTIFY pgrst, 'reload schema';
