-- Academy media: logo + photo gallery for academies and their playgrounds.
-- Uploaded during the academy setup wizard (or later from Settings);
-- skipped at signup, everything is available here.

ALTER TABLE public.academies ADD COLUMN IF NOT EXISTS logo_url TEXT;

CREATE TABLE IF NOT EXISTS public.academy_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academy_photos_academy ON public.academy_photos(academy_id);

ALTER TABLE public.academy_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Academy photos: public view" ON public.academy_photos;
CREATE POLICY "Academy photos: public view" ON public.academy_photos
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Academy photos: manage" ON public.academy_photos;
CREATE POLICY "Academy photos: manage" ON public.academy_photos
  FOR ALL USING (academy_id = public.current_academy_id())
  WITH CHECK (academy_id = public.current_academy_id());

-- Public bucket for academy logo + gallery photos (same pattern as
-- session-photos: public bucket, authenticated uploads, links in <img> tags).
INSERT INTO storage.buckets (id, name, public)
VALUES ('academy-media', 'academy-media', TRUE)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Academy media: upload" ON storage.objects;
CREATE POLICY "Academy media: upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'academy-media');

DROP POLICY IF EXISTS "Academy media: read" ON storage.objects;
CREATE POLICY "Academy media: read" ON storage.objects
  FOR SELECT USING (bucket_id = 'academy-media');