-- ────────────────────────────────────────────────────────────
-- SPORT SETTINGS (platform-level per-sport game rules)
-- ────────────────────────────────────────────────────────────
-- Platform-wide overrides for community game rules, keyed by sport name
-- (matches friendly_games.sport and COMMUNITY_SPORTS strings). Currently
-- stores the minimum players a game must have before it can start.
-- Managed by the super admin in the platform panel (Sports tab).
--
-- RLS: every signed-in member can read the effective rules (the create-game
-- dialogs pre-fill minimum players from them). Writes are restricted to the
-- platform admin via the same is_super_admin() check used by the other
-- platform tables.

CREATE TABLE IF NOT EXISTS public.sport_settings (
  sport TEXT PRIMARY KEY,
  min_players INTEGER NOT NULL CHECK (min_players >= 2 AND min_players <= 30),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sport_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sport_settings'
      AND policyname = 'sport_settings_select_all'
  ) THEN
    CREATE POLICY sport_settings_select_all ON public.sport_settings
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'sport_settings'
      AND policyname = 'sport_settings_write_super_admin'
  ) THEN
    CREATE POLICY sport_settings_write_super_admin ON public.sport_settings
      FOR ALL TO authenticated
      USING (public.is_super_admin())
      WITH CHECK (public.is_super_admin());
  END IF;
END
$$;

-- Seed the sport-specific minimums that previously lived only in app code.
-- Existing rows keep their values when this file re-runs.
INSERT INTO public.sport_settings (sport, min_players) VALUES
  ('Beach Volleyball', 8),
  ('Basketball', 8)
ON CONFLICT (sport) DO NOTHING;
