-- Ensure every profile without a selected avatar has a persistent random Playza character.
-- Existing custom uploads are preserved; users can replace the character at any time.
CREATE OR REPLACE FUNCTION public.random_avatar_id()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public
AS $$
  SELECT 'char-' || lpad((1 + floor(random() * 20))::int::text, 2, '0');
$$;

ALTER TABLE public.profiles
  ALTER COLUMN avatar_id SET DEFAULT public.random_avatar_id();

UPDATE public.profiles
SET avatar_id = public.random_avatar_id()
WHERE avatar_id IS NULL AND avatar_url IS NULL;
