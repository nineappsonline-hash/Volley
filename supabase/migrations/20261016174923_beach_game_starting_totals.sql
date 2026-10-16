-- Apply the requested starting totals once, preserving any newly recorded matches.
ALTER TABLE public.beach_game_totals
  ADD COLUMN IF NOT EXISTS starting_totals_applied boolean NOT NULL DEFAULT false;

UPDATE public.beach_game_totals
SET total_games = total_games + 232,
    player_wins = player_wins + 29,
    cpu_wins = cpu_wins + 166,
    draws = draws + 37,
    starting_totals_applied = true
WHERE singleton = true AND starting_totals_applied = false;
