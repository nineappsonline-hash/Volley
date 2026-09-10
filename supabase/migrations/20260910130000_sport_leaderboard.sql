-- Per-sport community ranking.
-- Friendly games carry a sport; training sessions do not, so per-sport points
-- come from completed friendly games only (same weighting as the overall
-- community_leaderboard view). Rank is computed per sport.

DROP VIEW IF EXISTS public.sport_leaderboard;
CREATE VIEW public.sport_leaderboard AS
SELECT
  pr.id AS member_id,
  pr.name,
  played.sport::TEXT AS sport,
  played.games_played,
  played.games_played * 2 AS points,
  row_number() OVER (
    PARTITION BY played.sport
    ORDER BY played.games_played DESC, pr.name ASC
  ) AS rank
FROM (
  SELECT p.member_id, g.sport, count(*)::int AS games_played
  FROM public.friendly_game_participants p
  JOIN public.friendly_games g ON g.id = p.game_id
  WHERE g.status = 'completed'
    AND g.sport IS NOT NULL
    AND btrim(g.sport) <> ''
  GROUP BY p.member_id, g.sport
) played
JOIN public.profiles pr ON pr.id = played.member_id
WHERE pr.name IS NOT NULL
  AND pr.community_visible = TRUE
ORDER BY played.sport, played.games_played DESC;

GRANT SELECT ON public.sport_leaderboard TO authenticated;

NOTIFY pgrst, 'reload schema';