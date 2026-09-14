-- ═══════════════════════════════════════════════════════════════
-- Tournament visibility for the whole platform.
--
-- 1. Every authenticated member can now READ every tournament (and its
--    matches) — tournaments are shared across academies.
-- 2. Creating / editing / deleting stays restricted to admins of the
--    hosting academy (JWT role = admin) and the platform super admin.
-- 3. The Enterprise-plan guard is removed: any academy can organize a
--    tournament (RLS still decides who may write).
-- 4. Hosting academy becomes optional so the platform admin can announce
--    platform-wide tournaments that belong to no single academy.
-- 5. New tournaments are announced to ALL active members (in-app bell +
--    push via the existing notify_push_on_insert trigger), not just the
--    hosting academy.
-- ═══════════════════════════════════════════════════════════════

-- 1. Remove the Enterprise-plan gate.
DROP TRIGGER IF EXISTS guard_tournament_plan ON public.tournaments;
DROP FUNCTION IF EXISTS public.guard_tournament_plan();

-- 2. Academy becomes optional (platform-managed tournaments).
ALTER TABLE public.tournaments ALTER COLUMN academy_id DROP NOT NULL;

-- 3. Tournaments RLS: read-all for members, write only for hosting
--    academy admins + the platform admin.
DROP POLICY IF EXISTS "Members manage tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Members read tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins manage tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Super admin manages tournaments" ON public.tournaments;

CREATE POLICY "Members read tournaments" ON public.tournaments
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Admins manage tournaments" ON public.tournaments
  FOR ALL TO authenticated
  USING (
    academy_id = public.current_academy_id()
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    academy_id = public.current_academy_id()
    AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE POLICY "Super admin manages tournaments" ON public.tournaments
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 4. Matches: readable by every member; managed by the hosting academy's
--    admins or the platform admin.
DROP POLICY IF EXISTS "Members manage tournament matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Members read tournament matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Admins manage tournament matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Super admin manages tournament matches" ON public.tournament_matches;

CREATE POLICY "Members read tournament matches" ON public.tournament_matches
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id
    )
  );

CREATE POLICY "Admins manage tournament matches" ON public.tournament_matches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND t.academy_id = public.current_academy_id()
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id = tournament_id
        AND t.academy_id = public.current_academy_id()
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    )
  );

CREATE POLICY "Super admin manages tournament matches" ON public.tournament_matches
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 5. Announce new tournaments to EVERY active member.
CREATE OR REPLACE FUNCTION public.announce_tournament_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT
    p.id,
    'tournament_announced',
    'New tournament announced',
    'A new tournament "' || NEW.name || '" has been announced. Register your team!'
      || CASE WHEN NEW.prize IS NOT NULL AND btrim(NEW.prize) <> ''
              THEN ' Prize: ' || btrim(NEW.prize) || '.'
              ELSE '' END,
    '/tournaments'
  FROM public.profiles p
  WHERE p.is_active = TRUE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_tournament_created ON public.tournaments;
CREATE TRIGGER on_tournament_created
  AFTER INSERT ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.announce_tournament_created();