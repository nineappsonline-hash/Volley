-- Academy follow: members can follow a public academy without joining it,
-- so they keep seeing its events (tournaments) and updates (announcements).

-- ── followers table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.academy_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, academy_id)
);
CREATE INDEX IF NOT EXISTS idx_academy_follows_academy
  ON public.academy_follows(academy_id);

ALTER TABLE public.academy_follows ENABLE ROW LEVEL SECURITY;

-- Anyone (public included) can see who follows which academy, matching the
-- "Anyone can view academy ratings" precedent.
DROP POLICY IF EXISTS "Anyone can view academy follows" ON public.academy_follows;
CREATE POLICY "Anyone can view academy follows" ON public.academy_follows
  FOR SELECT USING (TRUE);

-- Only the authenticated member records their own follow, and only for
-- public academies (members never follow a private academy).
DROP POLICY IF EXISTS "Members follow academies" ON public.academy_follows;
CREATE POLICY "Members follow academies" ON public.academy_follows
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = member_id
    AND EXISTS (
      SELECT 1 FROM public.academies a
      WHERE a.id = academy_id AND a.is_public = TRUE
    )
  );

DROP POLICY IF EXISTS "Members unfollow academies" ON public.academy_follows;
CREATE POLICY "Members unfollow academies" ON public.academy_follows
  FOR DELETE TO authenticated
  USING (auth.uid() = member_id);

-- ── announcements visible to followers ───────────────────────────────────────

-- Followers of an academy can read its announcements (its "updates") without
-- joining. Writing stays restricted to the academy's own members via the
-- existing "Members manage announcements" policy.
DROP POLICY IF EXISTS "Followers read announcements" ON public.announcements;
CREATE POLICY "Followers read announcements" ON public.announcements
  FOR SELECT TO authenticated
  USING (
    academy_id IN (
      SELECT f.academy_id FROM public.academy_follows f
      WHERE f.member_id = auth.uid()
    )
  );

-- ── realtime helper ─────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.academy_follows;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';