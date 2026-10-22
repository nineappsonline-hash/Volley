-- Basketball games and court bookings require at least 8 players.
-- The built-in default already resolves to 8 (SPORT_DEFAULT_MIN and
-- court_minimum_players), but a stale super-admin override in sport_settings
-- could still lower it; pin the basketball row to the required minimum so the
-- create-game dialog, the booking trigger and the quote all agree.
INSERT INTO public.sport_settings (sport, min_players) VALUES
  ('Basketball', 8)
ON CONFLICT (sport) DO UPDATE SET min_players = EXCLUDED.min_players, updated_at = NOW();
