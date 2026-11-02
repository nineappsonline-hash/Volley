-- Super admins need to review every friendly game, including private games
-- they neither created nor joined. The admin records API uses the service
-- role, but game lists backed by the caller's session (community/dashboard)
-- still apply the "Community games read" RLS policy.
DROP POLICY IF EXISTS "Community games read" ON public.friendly_games;
CREATE POLICY "Community games read" ON public.friendly_games
  FOR SELECT TO authenticated USING (
    public.is_super_admin()
    OR is_public = TRUE
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friendly_game_participants p
      WHERE p.game_id = friendly_games.id AND p.member_id = auth.uid()
    )
  );

-- Rent payments inherit the game's visibility, so super admins must see the
-- rent rows of private games as well.
DROP POLICY IF EXISTS "Rent payments read" ON public.friendly_game_rent_payments;
CREATE POLICY "Rent payments read" ON public.friendly_game_rent_payments
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.friendly_games g
      WHERE g.id = game_id AND (
        public.is_super_admin()
        OR g.is_public = TRUE
        OR g.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.friendly_game_participants p
          WHERE p.game_id = g.id AND p.member_id = auth.uid()
        )
      )
    )
  );
