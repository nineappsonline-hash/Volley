-- Illustrated avatars upgrade. profiles.avatar_id moves from flat emoji
-- characters to a compact config string "<style>:<seed>:<bg>" that the
-- client renders as a DiceBear illustration (src/lib/avatars.ts):
--   style  – adventurer | lorelei | openPeeps | micah | bottts | notionists
--   seed   – 8 lowercase hex chars (deterministic face/outfit)
--   bg     – 6-digit hex, no '#'
-- Keep the style keys, seed length and background palette in sync with the
-- client + schema.sql.

-- 1. Replace the minting function: new rows (and the default) now produce
-- illustrated config strings instead of emojis.
CREATE OR REPLACE FUNCTION public.random_avatar_id()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT (ARRAY['adventurer', 'lorelei', 'openPeeps', 'micah', 'bottts', 'notionists'])[1 + floor(random() * 6)::int]
    || ':' || left(md5(random()::text), 8)
    || ':' || (ARRAY['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdbb8', 'b9e4c9', 'c9e4ff', 'ffd8be'])[1 + floor(random() * 8)::int];
$$;
GRANT EXECUTE ON FUNCTION public.random_avatar_id() TO authenticated;

-- 2. Re-mint legacy emoji ids (and any nulls). Emojis don't match the
-- "<style>:<seed>:<bg>" shape, so the regex is a reliable discriminator.
UPDATE public.profiles
SET avatar_id = public.random_avatar_id()
WHERE avatar_id IS NULL
   OR avatar_id !~ '^[a-z]+:[a-f0-9]{8}:[0-9a-f]{6}$';

NOTIFY pgrst, 'reload schema';