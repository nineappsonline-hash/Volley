-- Weekly working hours for a playground. Reservations (sub-rentals and
-- friendly games) are only allowed on the listed days and within the listed
-- hour windows; days without an entry are treated as closed. An empty list
-- means the playground has no working-hours restriction (always open), which
-- keeps pre-existing venues behaving as before.
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS working_hours JSONB NOT NULL DEFAULT '[]'::jsonb;
-- Column-level SELECT was granted per-column (table-level was revoked by the
-- private contacts migration), so a brand-new column is invisible to members
-- unless explicitly granted.
GRANT SELECT (working_hours) ON public.venues TO anon, authenticated;
NOTIFY pgrst, 'reload schema';