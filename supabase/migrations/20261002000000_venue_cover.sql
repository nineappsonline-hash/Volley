-- Explicit card photo for a playground. Members' game cards show this photo
-- as the thumbnail (falling back to the first entry of the photos gallery).
-- Chosen by the super admin from the venue photo editor.
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS cover_url TEXT;
-- Column-level SELECT was granted per-column (table-level was revoked by the
-- private contacts migration), so a brand-new column is invisible to members
-- unless explicitly granted.
GRANT SELECT (cover_url) ON public.venues TO anon, authenticated;
NOTIFY pgrst, 'reload schema';