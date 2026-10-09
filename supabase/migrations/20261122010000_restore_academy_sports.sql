-- Restore the sport catalog and playground links, and stop the academy-edit
-- function from destroying them on re-save.
--
-- Symptom: the whole `sports` table was reduced to a single "Volleyball" row,
-- so every sport picker (playgrounds, teams, sessions, tournaments) only lists
-- Volleyball, and playgrounds that referenced a deleted sport lost their sport
-- without warning (venues.sport_id is ON DELETE SET NULL).
--
-- This migration:
--   1. Re-seeds the full supported sport catalog for every academy (missing
--      names only — it never removes or duplicates).
--   2. Restores playgrounds whose sport link was wiped: it prefers the sport of
--      the venue's most recent non-cancelled friendly game, falling back to the
--      academy's default (Volleyball).
--   3. Hardens super_admin_update_academy so re-saving an academy no longer
--      deletes and recreates its sports with fresh UUIDs (which detaches every
--      playground via ON DELETE SET NULL). Kept names reuse their existing
--      rows; only names removed from the selection are deleted.

-- 1) Re-seed the full catalog per academy so every dropdown lists all sports.
INSERT INTO public.sports (academy_id, name)
SELECT a.id, az.name
FROM public.academies a
CROSS JOIN (VALUES
  ('Football'), ('Basketball'), ('Handball'), ('Volleyball'), ('Beach Volleyball'), ('Tennis'),
  ('Swimming'), ('Padel'), ('Squash'), ('Table Tennis'), ('Badminton'),
  ('Gymnastics'), ('Karate'), ('Boxing'), ('Athletics'), ('Kung Fu'),
  ('Taekwondo'), ('CrossFit'), ('Judo'), ('Kickboxing'), ('Wrestling'),
  ('Archery'), ('Fencing'), ('Equestrian'), ('Cycling'), ('Weightlifting'), ('Parkour')
) AS az(name)
ON CONFLICT (academy_id, name) DO NOTHING;

-- 2) Restore playgrounds whose sport_id was wiped. Prefer the sport of the
--    venue's most recent non-cancelled game; otherwise default to the
--    academy's primary sport (Volleyball).
--
--    guard_venue_approval resubmits any changed listing for review (it flips
--    approval_status to 'pending'), which would hide a restored playground from
--    members. Disable it for this backfill so only sport_id changes and the
--    playground's existing approval is preserved.
ALTER TABLE public.venues DISABLE TRIGGER guard_venue_approval;
UPDATE public.venues v
SET sport_id = s.id
FROM public.sports s
WHERE v.sport_id IS NULL
  AND s.academy_id = COALESCE(
    v.academy_id,
    (SELECT id FROM public.academies ORDER BY created_at LIMIT 1)
  )
  AND s.name = COALESCE(
    (SELECT fg.sport
     FROM public.friendly_games fg
     WHERE fg.playground_id = v.id
       AND fg.sport IS NOT NULL
       AND fg.sport <> ''
       AND fg.status <> 'cancelled'
     ORDER BY fg.game_date DESC NULLS LAST, fg.created_at DESC NULLS LAST
     LIMIT 1),
    'Volleyball'
  );
ALTER TABLE public.venues ENABLE TRIGGER guard_venue_approval;

-- 3) Academy edit: keep stable sport row IDs (upsert by name) instead of
--    delete-then-reinsert, so playground sport links survive a re-save.
CREATE OR REPLACE FUNCTION public.super_admin_update_academy(
  p_academy_id UUID,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_email TEXT := NULLIF(trim(COALESCE(p_payload ->> 'admin_email', '')), '');
  v_trial_active BOOLEAN;
  v_item JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_academy_id IS NULL THEN
    RAISE EXCEPTION 'Missing academy id';
  END IF;

  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE academy_id = p_academy_id AND role = 'admin'
  ORDER BY created_at LIMIT 1;

  -- Will the academy be inside a trial after this update?
  v_trial_active := COALESCE(
    (p_payload ->> 'is_trial')::boolean,
    (SELECT is_trial FROM public.academies WHERE id = p_academy_id)
  );

  -- Academy identity / location / visibility / subscription. A trial with a
  -- blank date is calculated automatically as 1 month from account creation.
  UPDATE public.academies SET
    name           = COALESCE(NULLIF(trim(COALESCE(p_payload ->> 'name', '')), ''), name),
    description    = COALESCE(NULLIF(p_payload ->> 'description', ''), description),
    country        = COALESCE(NULLIF(p_payload ->> 'country', ''), country),
    governorate    = COALESCE(NULLIF(p_payload ->> 'governorate', ''), governorate),
    area           = COALESCE(NULLIF(p_payload ->> 'area', ''), area),
    cover_url      = COALESCE(NULLIF(p_payload ->> 'cover_url', ''), cover_url),
    is_public      = COALESCE((p_payload ->> 'is_public')::boolean, is_public),
    is_trial       = v_trial_active,
    plan           = CASE
                       WHEN p_payload ? 'plan'
                         AND p_payload ->> 'plan' IN ('starter', 'plus', 'elite')
                         THEN p_payload ->> 'plan'
                       ELSE plan
                     END,
    trial_ends_at  = CASE
                       WHEN p_payload ? 'trial_ends_at'
                         AND NULLIF(p_payload ->> 'trial_ends_at', '') IS NOT NULL
                         THEN NULLIF(p_payload ->> 'trial_ends_at', '')::timestamptz
                       WHEN v_trial_active
                         THEN (SELECT created_at FROM public.academies WHERE id = p_academy_id)
                            + INTERVAL '1 month'
                       ELSE trial_ends_at
                     END
  WHERE id = p_academy_id;

  -- Sports roster: a supplied list replaces the current list entirely, but
  -- kept names reuse their existing rows (IDs stay stable so playground
  -- sport links survive). Only names no longer selected are deleted; the old
  -- delete-then-reinsert pattern created fresh UUIDs and silently detached
  -- every venue via ON DELETE SET NULL.
  IF p_payload ? 'sports' THEN
    INSERT INTO public.sports (academy_id, name)
    SELECT p_academy_id, trim(az.name)
    FROM jsonb_array_elements_text(COALESCE(p_payload -> 'sports', '[]'::jsonb)) AS az(name)
    WHERE trim(az.name) <> ''
    ON CONFLICT (academy_id, name) DO NOTHING;

    DELETE FROM public.sports s
    WHERE s.academy_id = p_academy_id
      AND s.name NOT IN (
        SELECT trim(az.name)
        FROM jsonb_array_elements_text(COALESCE(p_payload -> 'sports', '[]'::jsonb)) AS az(name)
        WHERE trim(az.name) <> ''
      );
  END IF;

  -- Playgrounds (venues): rows with an id are updated in place, rows without
  -- one are added, and existing rows that disappear are removed. Updating an
  -- unassigned pool playground assigns it to this academy. The console is not
  -- bound by the per-plan venue limits. Removed rows are deleted first so rows
  -- added in the same call are never mistaken for removals.
  IF p_payload ? 'venues' THEN
    ALTER TABLE public.venues DISABLE TRIGGER guard_venue_limit_on_insert;
    BEGIN
      DELETE FROM public.venues
      WHERE academy_id = p_academy_id
        AND NOT (id IN (
          SELECT (x ->> 'id')::uuid
          FROM jsonb_array_elements(p_payload -> 'venues') AS x
          WHERE x ? 'id'
        ));
      FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'venues') LOOP
        IF v_item ? 'id' THEN
          UPDATE public.venues SET
            academy_id    = p_academy_id,
            name         = COALESCE(NULLIF(trim(COALESCE(v_item ->> 'name', '')), ''), name),
            address      = CASE WHEN v_item ? 'address' THEN NULLIF(v_item ->> 'address', '') ELSE address END,
            capacity     = CASE WHEN v_item ? 'capacity' THEN NULLIF(v_item ->> 'capacity', '')::integer ELSE capacity END,
            school_name  = CASE WHEN v_item ? 'school_name' THEN NULLIF(v_item ->> 'school_name', '') ELSE school_name END,
            rental_cost  = CASE WHEN v_item ? 'rental_cost' THEN NULLIF(v_item ->> 'rental_cost', '')::numeric ELSE rental_cost END,
            rental_hours = CASE WHEN v_item ? 'rental_hours'
                                THEN COALESCE(NULLIF(v_item ->> 'rental_hours', '')::numeric, 1)
                                ELSE rental_hours END,
            sport_id     = CASE WHEN v_item ? 'sport'
                                THEN (SELECT id FROM public.sports
                                      WHERE academy_id = p_academy_id
                                        AND name = v_item ->> 'sport' LIMIT 1)
                                ELSE sport_id END
          WHERE id = (v_item ->> 'id')::uuid
            AND (academy_id = p_academy_id OR academy_id IS NULL);
        ELSE
          INSERT INTO public.venues (
            academy_id, name, address, capacity, sport_id, school_name,
            rental_cost, rental_hours
          )
          VALUES (
            p_academy_id,
            trim(v_item ->> 'name'),
            NULLIF(v_item ->> 'address', ''),
            NULLIF(v_item ->> 'capacity', '')::integer,
            (SELECT id FROM public.sports
             WHERE academy_id = p_academy_id
               AND name = v_item ->> 'sport' LIMIT 1),
            NULLIF(v_item ->> 'school_name', ''),
            NULLIF(v_item ->> 'rental_cost', '')::numeric,
            COALESCE(NULLIF(v_item ->> 'rental_hours', '')::numeric, 1)
          );
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE public.venues ENABLE TRIGGER guard_venue_limit_on_insert;
      RAISE;
    END;
    ALTER TABLE public.venues ENABLE TRIGGER guard_venue_limit_on_insert;
  END IF;

  -- Coaches: same incremental pattern. The console is not bound by the
  -- per-plan coach limits.
  IF p_payload ? 'coaches' THEN
    ALTER TABLE public.coaches DISABLE TRIGGER guard_coach_limit_on_insert;
    BEGIN
      DELETE FROM public.coaches
      WHERE academy_id = p_academy_id
        AND NOT (id IN (
          SELECT (x ->> 'id')::uuid
          FROM jsonb_array_elements(p_payload -> 'coaches') AS x
          WHERE x ? 'id'
        ));
      FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload -> 'coaches') LOOP
        IF v_item ? 'id' THEN
          UPDATE public.coaches SET
            name           = COALESCE(NULLIF(trim(COALESCE(v_item ->> 'name', '')), ''), name),
            phone          = CASE WHEN v_item ? 'phone' THEN NULLIF(v_item ->> 'phone', '') ELSE phone END,
            specialty      = CASE WHEN v_item ? 'specialty' THEN NULLIF(v_item ->> 'specialty', '') ELSE specialty END,
            monthly_salary = CASE WHEN v_item ? 'monthly_salary'
                                  THEN NULLIF(v_item ->> 'monthly_salary', '')::numeric
                                  ELSE monthly_salary END,
            is_active      = COALESCE((v_item ->> 'is_active')::boolean, is_active)
          WHERE id = (v_item ->> 'id')::uuid AND academy_id = p_academy_id;
        ELSE
          INSERT INTO public.coaches (academy_id, name, phone, specialty, monthly_salary, is_active)
          VALUES (
            p_academy_id,
            trim(v_item ->> 'name'),
            NULLIF(v_item ->> 'phone', ''),
            NULLIF(v_item ->> 'specialty', ''),
            NULLIF(v_item ->> 'monthly_salary', '')::numeric,
            COALESCE((v_item ->> 'is_active')::boolean, TRUE)
          );
        END IF;
      END LOOP;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE public.coaches ENABLE TRIGGER guard_coach_limit_on_insert;
      RAISE;
    END;
    ALTER TABLE public.coaches ENABLE TRIGGER guard_coach_limit_on_insert;
  END IF;

  -- Contact details live on the founder's profile (and auth email when given).
  IF v_admin_id IS NOT NULL AND (
    p_payload ? 'admin_email' OR p_payload ? 'admin_name' OR p_payload ? 'admin_phone'
  ) THEN
    -- Bypass the self-guard trigger so the console may change a foreign profile.
    ALTER TABLE public.profiles DISABLE TRIGGER guard_profile_update;
    BEGIN
      IF v_email IS NOT NULL
         AND v_email <> (SELECT email FROM public.profiles WHERE id = v_admin_id) THEN
        UPDATE auth.users SET email = v_email WHERE id = v_admin_id;
      END IF;
      UPDATE public.profiles SET
        email = COALESCE(v_email, email),
        name  = COALESCE(NULLIF(trim(COALESCE(p_payload ->> 'admin_name', '')), ''), name),
        phone = CASE
                  WHEN p_payload ? 'admin_phone'
                    THEN NULLIF(p_payload ->> 'admin_phone', '')
                  ELSE phone
                END
      WHERE id = v_admin_id;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE public.profiles ENABLE TRIGGER guard_profile_update;
      RAISE;
    END;
    ALTER TABLE public.profiles ENABLE TRIGGER guard_profile_update;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.super_admin_update_academy(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_update_academy(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';