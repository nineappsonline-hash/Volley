-- Playground assignment to academies.
--
-- A playground (venue) can exist as an unassigned platform pool (academy_id
-- NULL). The platform admin can attach pool playgrounds to academies, and an
-- academy owner can claim an existing pool playground or create a new one
-- while signing up a new academy.

-- Unassigned playgrounds are no longer forced into an academy.
ALTER TABLE public.venues ALTER COLUMN academy_id DROP NOT NULL;

-- Unassigned playgrounds are selectable by the public so academy owners can
-- pick one during signup. Contact columns stay column-restricted (admin API
-- only).
DROP POLICY IF EXISTS "Unassigned playgrounds are viewable" ON public.venues;
CREATE POLICY "Unassigned playgrounds are viewable" ON public.venues
  FOR SELECT USING (academy_id IS NULL);

-- Academy signup now attaches playgrounds: an existing unassigned playground
-- can be claimed by id, or new ones are created from the provided details.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_name TEXT := trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_name', ''));
  v_new_country TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_country', '')), '');
  v_new_governorate TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_governorate', '')), '');
  v_new_area TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_area', '')), '');
  v_code TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'academy_code', '')), '');
  v_academy UUID;
  v_venue JSONB;
BEGIN
  IF v_new_name <> '' THEN
    -- A phone number is mandatory to create an academy account. Reject the
    -- whole signup (user + academy) if it is missing or blank.
    IF NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Phone number is required to create an academy account';
    END IF;

    INSERT INTO public.academies (name, slug, country, governorate, area, is_public, is_trial, trial_ends_at, plan)
    VALUES (
      left(v_new_name, 60),
      lower(regexp_replace(left(v_new_name, 40), '[^a-zA-Z0-9]+', '-', 'g'))
        || '-' || left(md5(random()::text), 4),
      v_new_country,
      v_new_governorate,
      v_new_area,
      TRUE,
      TRUE,
      NOW() + INTERVAL '30 days',
      'elite'
    )
    RETURNING id INTO v_academy;

    INSERT INTO public.membership_plans (academy_id, name, sessions_count)
    VALUES (v_academy, 'Full', 8), (v_academy, 'Half', 4);

    -- Seed only the sports the admin chose at signup so pickers list supported sports.
    INSERT INTO public.sports (academy_id, name)
    SELECT v_academy, trim(az.name)
    FROM unnest(string_to_array(COALESCE(NEW.raw_user_meta_data ->> 'sports', ''), ',')) AS az(name)
    WHERE trim(az.name) <> ''
    ON CONFLICT (academy_id, name) DO NOTHING;

    INSERT INTO public.profiles (id, email, role, name, phone, country, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'admin',
      COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
      COALESCE(v_new_country, NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'country', '')), '')),
      CURRENT_DATE, v_academy, TRUE
    )
    ON CONFLICT (id) DO NOTHING;

    -- Attach the chosen playgrounds to the new academy: an unassigned pool
    -- playground can be claimed by id, or new ones are created from details.
    FOR v_venue IN
      SELECT value FROM jsonb_array_elements(
        COALESCE(NEW.raw_user_meta_data -> 'new_academy_venues', '[]'::jsonb)
      )
    LOOP
      IF v_venue ? 'id' THEN
        UPDATE public.venues
        SET academy_id = v_academy
        WHERE id = (v_venue ->> 'id')::uuid AND academy_id IS NULL;
      ELSE
        INSERT INTO public.venues (
          academy_id, name, address, capacity, school_name,
          rental_cost, rental_hours, country, governorate, area
        )
        VALUES (
          v_academy,
          trim(v_venue ->> 'name'),
          NULLIF(v_venue ->> 'address', ''),
          NULLIF(v_venue ->> 'capacity', '')::integer,
          NULLIF(v_venue ->> 'school_name', ''),
          NULLIF(v_venue ->> 'rental_cost', '')::numeric,
          COALESCE(NULLIF(v_venue ->> 'rental_hours', '')::numeric, 1),
          COALESCE(v_new_country, NULLIF(v_venue ->> 'country', '')),
          COALESCE(v_new_governorate, NULLIF(v_venue ->> 'governorate', '')),
          COALESCE(v_new_area, NULLIF(v_venue ->> 'area', ''))
        );
      END IF;
    END LOOP;
  ELSE
    IF v_code IS NOT NULL THEN
      SELECT id INTO v_academy FROM public.academies WHERE UPPER(invite_code) = UPPER(v_code);
    END IF;

    INSERT INTO public.profiles (id, email, role, name, phone, country, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'member',
      COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'country', '')), ''),
      CURRENT_DATE, v_academy, FALSE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- The admin console may attach unassigned pool playgrounds to an academy:
-- updating an existing pool venue now assigns it to this academy.
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

  -- Sports roster: a supplied List replaces the current list entirely.
  IF p_payload ? 'sports' THEN
    DELETE FROM public.sports WHERE academy_id = p_academy_id;
    INSERT INTO public.sports (academy_id, name)
    SELECT p_academy_id, trim(az.name)
    FROM jsonb_array_elements_text(COALESCE(p_payload -> 'sports', '[]'::jsonb)) AS az(name)
    WHERE trim(az.name) <> ''
    ON CONFLICT (academy_id, name) DO NOTHING;
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