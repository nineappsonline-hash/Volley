-- Academy teams can be tagged by category (boys / girls / mixed) and by the
-- age range they are meant for. Existing teams default to mixed; their
-- free-text age_group is preserved for older records.
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'mixed',
  ADD COLUMN IF NOT EXISTS min_age INTEGER,
  ADD COLUMN IF NOT EXISTS max_age INTEGER;

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_gender_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_gender_check
  CHECK (gender IN ('boys', 'girls', 'mixed'));

ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_age_range_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_age_range_check
  CHECK (
    (min_age IS NULL OR (min_age >= 0 AND min_age <= 120))
    AND (max_age IS NULL OR (max_age >= 0 AND max_age <= 120))
    AND (min_age IS NULL OR max_age IS NULL OR max_age >= min_age)
  );

NOTIFY pgrst, 'reload schema';
