-- Playground photos. Optional cover image for a venue, uploaded by the super
-- admin from the venue create/edit dialog and shown in the playground's
-- details. Stored as a public URL; objects live in the public "venue-photos"
-- bucket.
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS photo_url TEXT;
-- Column-level SELECT was granted per-column (table-level was revoked by the
-- private contacts migration), so a brand-new column is invisible to members
-- unless explicitly granted.
GRANT SELECT (photo_url) ON public.venues TO anon, authenticated;

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