-- Builtin character avatar gallery: 20 original flat-vector SVG mascots.
-- Drops DiceBear illustration configs entirely, re-minting every non-slot
-- avatar_id so it becomes a stable "char-01" … "char-20" id that maps to a
-- bundled asset at /images/avatars/char-NN.svg. New rows keep receiving a
-- char slot via the column default public.random_avatar_id().

-- ── helpers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.random_avatar_id()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'char-' || lpad((1 + floor(random() * 20))::int::text, 2, '0');
$$;

-- ── backfill ───────────────────────────────────────────────────────────────

-- Randomly re-mint any avatar_id that is NOT already a valid char slot.
UPDATE public.profiles
SET    avatar_id = public.random_avatar_id()
WHERE  avatar_id IS DISTINCT FROM NULL
  AND  avatar_id !~ '^char-[0-9]{2}$';

-- ── realtime helper ────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';