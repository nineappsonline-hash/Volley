-- Optional map/navigation link for a playground. Surfaced to members as a
-- "Directions" button next to the playground's name.
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS location_link TEXT;
-- Column-level SELECT was granted per-column (table-level was revoked by the
-- private contacts migration), so a brand-new column is invisible to members
-- unless explicitly granted.
GRANT SELECT (location_link) ON public.venues TO anon, authenticated;
NOTIFY pgrst, 'reload schema';