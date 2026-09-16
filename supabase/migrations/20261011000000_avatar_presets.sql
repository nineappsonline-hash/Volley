-- Preset avatars: every profile gets a random emoji avatar (avatar_id) until
-- the member uploads a photo (avatar_url) or picks one of the presets. The
-- preset id IS the emoji character itself, so clients render it directly
-- without a lookup table. Keep the 20 emojis here in sync with the client
-- gallery in src/lib/avatars.ts.

-- 1. Helper returning a random preset. VOLATILE because it calls random().
-- The array appears in column order — the element is the visual, not a label.
CREATE OR REPLACE FUNCTION public.random_avatar_id()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT (ARRAY[
    '🦁', '🐯', '🐼', '🐸', '🦊', '🐻', '🐨', '🐶', '🐱', '🐰',
    '🦄', '🐙', '🦋', '🐢', '🦖', '🦅', '🐺', '🦉', '🐵', '🐷'
  ])[1 + floor(random() * 20)::int];
$$;
GRANT EXECUTE ON FUNCTION public.random_avatar_id() TO authenticated;

-- 2. Column WITHOUT a default first so the backfill evaluates random() per
-- row (a column default would apply the same value to every existing row).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_id TEXT;

-- 3. Give every existing row a random preset.
UPDATE public.profiles SET avatar_id = public.random_avatar_id() WHERE avatar_id IS NULL;

-- 4. New profiles (signups, family members, admin-created accounts) get a
-- random preset automatically; the column still allows NULL writes so the
-- upload path can clear it.
ALTER TABLE public.profiles ALTER COLUMN avatar_id SET DEFAULT public.random_avatar_id();

-- 5. Community views expose the preset so member-facing avatars render it.
DROP VIEW IF EXISTS public.community_members;
CREATE VIEW public.community_members AS
SELECT
  p.id,
  p.name,
  p.username,
  public.player_display_name(p) AS display_name,
  p.avatar_url,
  p.avatar_id,
  p.bio,
  p.academy_id,
  a.name AS academy_name,
  COALESCE(a.area, a.governorate) AS area,
  p.skill_level,
  p.position,
  p.availability_days,
  p.interested_sports,
  p.lat,
  p.lng
FROM public.profiles p
LEFT JOIN public.academies a ON a.id = p.academy_id
WHERE p.community_visible = TRUE
  AND p.name IS NOT NULL;
GRANT SELECT ON public.community_members TO authenticated;

DROP VIEW IF EXISTS public.community_leaderboard;
CREATE VIEW public.community_leaderboard AS
WITH played AS (
  SELECT p.member_id, count(*)::int AS games_played
  FROM public.friendly_game_participants p
  JOIN public.friendly_games g ON g.id = p.game_id
  WHERE g.status = 'completed'
  GROUP BY p.member_id
),
attend AS (
  SELECT a.member_id, count(*)::int AS sessions_attended
  FROM public.attendance a
  JOIN public.training_sessions s ON s.id = a.session_id
  WHERE s.status = 'completed'
  GROUP BY a.member_id
)
SELECT
  pr.id AS member_id,
  pr.name,
  pr.username,
  pr.avatar_id,
  COALESCE(played.games_played, 0) AS games_played,
  COALESCE(attend.sessions_attended, 0) AS sessions_attended,
  COALESCE(played.games_played, 0) * 2 + COALESCE(attend.sessions_attended, 0) AS points
FROM public.profiles pr
LEFT JOIN played ON played.member_id = pr.id
LEFT JOIN attend ON attend.member_id = pr.id
WHERE pr.name IS NOT NULL
  AND pr.community_visible = TRUE
ORDER BY points DESC;
GRANT SELECT ON public.community_leaderboard TO authenticated;

DROP VIEW IF EXISTS public.sport_leaderboard;
CREATE VIEW public.sport_leaderboard AS
SELECT
  pr.id AS member_id,
  pr.name,
  pr.username,
  pr.avatar_id,
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