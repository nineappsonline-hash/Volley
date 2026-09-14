-- Playground photo gallery. A venue can hold several photos; the first entry
-- is the cover shown on the playground's card and as the primary gallery
-- image. Replaces the single-photo photo_url column added in
-- 20260931000000_venue_photos.sql (which never carried real data) with a
-- JSONB list of public URLs.
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]'::jsonb;
-- Column-level SELECT was granted per-column (table-level was revoked by the
-- private contacts migration), so a brand-new column is invisible to members
-- unless explicitly granted.
GRANT SELECT (photos) ON public.venues TO anon, authenticated;
ALTER TABLE public.venues DROP COLUMN IF EXISTS photo_url;

-- Storage bucket for playground photos. Public bucket so images load in <img>
-- tags; uploads come from any authenticated account (the super admin).
INSERT INTO storage.buckets (id, name, public)
VALUES ('venue-photos', 'venue-photos', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Venue photos: upload" ON storage.objects;
CREATE POLICY "Venue photos: upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'venue-photos');

DROP POLICY IF EXISTS "Venue photos: read" ON storage.objects;
CREATE POLICY "Venue photos: read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'venue-photos');

NOTIFY pgrst, 'reload schema';