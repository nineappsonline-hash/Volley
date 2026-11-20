-- Gender-aware automatic Playza avatars.
-- Male: 01,03,04,06,10,11,13,15,16,20
-- Female: 02,05,12,14
-- Neutral: 07,08,09,17,18,19
-- Do not overwrite existing avatars: their origin was not previously tracked.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_is_custom boolean NOT NULL DEFAULT false;

-- Existing choices have unknown provenance; treat them as user-selected to
-- avoid silently replacing photos or manually selected characters.
UPDATE public.profiles
SET avatar_is_custom = true
WHERE (avatar_id IS NOT NULL OR avatar_url IS NOT NULL)
  AND avatar_is_custom = false;

CREATE OR REPLACE FUNCTION public.random_avatar_for_gender(p_gender text)
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public
AS $$
DECLARE
  choices text[];
BEGIN
  IF p_gender = 'male' THEN
    choices := ARRAY['char-01','char-03','char-04','char-06','char-07','char-08','char-09','char-10','char-11','char-13','char-15','char-16','char-17','char-18','char-19','char-20'];
  ELSIF p_gender = 'female' THEN
    choices := ARRAY['char-02','char-05','char-07','char-08','char-09','char-12','char-14','char-17','char-18','char-19'];
  ELSE
    choices := ARRAY['char-07','char-08','char-09','char-17','char-18','char-19'];
  END IF;
  RETURN choices[1 + floor(random() * array_length(choices, 1))::integer];
END;
$$;

-- The trigger replaces the gender-blind column default on INSERT and
-- refreshes auto-assigned avatars only when gender changes.
CREATE OR REPLACE FUNCTION public.assign_gender_avatar()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.avatar_url IS NOT NULL THEN
      NEW.avatar_is_custom := true;
    ELSIF NEW.avatar_is_custom IS TRUE THEN
      -- Explicitly marked custom by the caller.
      NULL;
    ELSE
      NEW.avatar_id := public.random_avatar_for_gender(NEW.gender::text);
      NEW.avatar_is_custom := false;
    END IF;
  ELSE
    -- Explicit photo upload or preset change is a custom choice.
    IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
       AND NEW.avatar_url IS NOT NULL THEN
      NEW.avatar_is_custom := true;
    ELSIF NEW.avatar_id IS DISTINCT FROM OLD.avatar_id
       AND NEW.gender IS NOT DISTINCT FROM OLD.gender
       AND (OLD.avatar_id IS NOT NULL OR NEW.avatar_is_custom IS TRUE) THEN
      NEW.avatar_is_custom := true;
    ELSIF NEW.gender IS DISTINCT FROM OLD.gender
       AND OLD.avatar_is_custom IS FALSE
       AND NEW.avatar_is_custom IS FALSE
       AND NEW.avatar_url IS NULL
       AND NEW.avatar_id IS NOT DISTINCT FROM OLD.avatar_id THEN
      NEW.avatar_id := public.random_avatar_for_gender(NEW.gender::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_gender_avatar_assignment ON public.profiles;
CREATE TRIGGER profiles_gender_avatar_assignment
BEFORE INSERT OR UPDATE OF gender, avatar_id, avatar_url ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_gender_avatar();

-- Fill only genuinely missing profile avatars; preserve all existing choices.
UPDATE public.profiles
SET avatar_id = public.random_avatar_for_gender(gender::text)
WHERE avatar_id IS NULL AND avatar_url IS NULL AND avatar_is_custom IS FALSE;

NOTIFY pgrst, 'reload schema';
