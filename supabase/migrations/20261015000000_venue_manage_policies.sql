-- Only an academy may modify or delete its own playgrounds.
--
-- Previously the only venue write policy ("Members manage venues") lived in the
-- baseline schema dump, not in a migration, so the live DB had no guaranteed
-- INSERT/UPDATE/DELETE enforcement. Pool venues (academy_id NULL, created by the
-- super admin) and other academies' venues were therefore editable/deletable via
-- any authenticated client with table grants.
--
-- Enforce ownership at the row level: an authenticated user may insert, update
-- or delete a venue only if it belongs to their current academy AND they are an
-- academy admin (or the platform super admin). Reads stay open so games and
-- rentals can still list any playground.

DROP POLICY IF EXISTS "Members manage venues" ON public.venues;
DROP POLICY IF EXISTS "Academy inserts own venues" ON public.venues;
DROP POLICY IF EXISTS "Academy updates own venues" ON public.venues;
DROP POLICY IF EXISTS "Academy deletes own venues" ON public.venues;

CREATE POLICY "Academy inserts own venues" ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      academy_id = public.current_academy_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.academy_id = academy_id
          AND p.role = 'admin'
      )
    )
  );

CREATE POLICY "Academy updates own venues" ON public.venues
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      academy_id = public.current_academy_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.academy_id = academy_id
          AND p.role = 'admin'
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      academy_id = public.current_academy_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.academy_id = academy_id
          AND p.role = 'admin'
      )
    )
  );

CREATE POLICY "Academy deletes own venues" ON public.venues
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      academy_id = public.current_academy_id()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.academy_id = academy_id
          AND p.role = 'admin'
      )
    )
  );

NOTIFY pgrst, 'reload schema';