-- Owners can set a Country / Governorate / City per playground during signup.
-- handle_new_user() previously preferred the account-level location and only
-- fell back to the per-venue values, which made the per-playground dropdowns
-- ineffective. Flip the order so each venue's own location wins (still falling
-- back to the owner's account location when a field is blank).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_mode BOOLEAN := COALESCE((NEW.raw_user_meta_data ->> 'owner_mode')::boolean, false);
  v_business   TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'business_name', '')), '');
  v_new_name TEXT := trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_name', ''));
  v_new_country TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_country', '')), '');
  v_new_governorate TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_governorate', '')), '');
  v_new_area TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'new_academy_area', '')), '');
  v_code TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'academy_code', '')), '');
  v_gender TEXT := NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'gender', '')), '');
  v_birth_date DATE := NULLIF(NEW.raw_user_meta_data ->> 'birth_date', '')::date;
  v_academy UUID;
  v_venue JSONB;
BEGIN
  IF v_owner_mode THEN
    -- A phone number is mandatory to become a playground owner.
    IF NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), '') IS NULL THEN
      RAISE EXCEPTION 'Phone number is required to become a playground owner';
    END IF;

    INSERT INTO public.profiles (id, email, role, name, username, phone, country, gender, birth_date, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'playground_owner',
      COALESCE(v_business, NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      NULLIF(lower(btrim(COALESCE(NEW.raw_user_meta_data ->> 'username', ''))), ''),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
      COALESCE(v_new_country, NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'country', '')), '')),
      v_gender, v_birth_date,
      CURRENT_DATE, NULL, TRUE
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.playground_owners (
      profile_id, business_name, phone, country, governorate, area, status
    )
    VALUES (
      NEW.id,
      v_business,
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
      v_new_country,
      v_new_governorate,
      v_new_area,
      'pending'
    )
    ON CONFLICT (profile_id) DO NOTHING;

    -- Seed the owner's first playgrounds; each still needs super admin approval.
    FOR v_venue IN
      SELECT value FROM jsonb_array_elements(
        COALESCE(NEW.raw_user_meta_data -> 'new_owner_venues', '[]'::jsonb)
      )
    LOOP
      IF v_venue ? 'id' THEN
        UPDATE public.venues
        SET owner_profile_id = NEW.id
        WHERE id = (v_venue ->> 'id')::uuid
          AND owner_profile_id IS NULL AND academy_id IS NULL;
      ELSE
        INSERT INTO public.venues (
          owner_profile_id, name, address, sport_id,
          rental_cost, rental_hours, court_count, location_link, photos, country, governorate, area, court_availability, working_hours
        )
        VALUES (
          NEW.id,
          COALESCE(NULLIF(trim(v_venue ->> 'name'), ''), v_business),
          NULLIF(v_venue ->> 'address', ''),
          (SELECT id FROM public.sports WHERE lower(name) = lower(trim(v_venue ->> 'sport')) LIMIT 1),
          NULLIF(v_venue ->> 'rental_cost', '')::numeric,
          COALESCE(NULLIF(v_venue ->> 'rental_hours', '')::numeric, 1),
          COALESCE(NULLIF(v_venue ->> 'court_count', '')::integer, 1),
          NULLIF(v_venue ->> 'location_link', ''),
          COALESCE(v_venue -> 'photos', '[]'::jsonb),
          COALESCE(NULLIF(v_venue ->> 'country', ''), v_new_country),
          COALESCE(NULLIF(v_venue ->> 'governorate', ''), v_new_governorate),
          COALESCE(NULLIF(v_venue ->> 'area', ''), v_new_area),
          COALESCE(v_venue -> 'court_availability', '[]'::jsonb),
          COALESCE(v_venue -> 'working_hours', '[]'::jsonb)
        );
      END IF;
    END LOOP;
  ELSIF v_new_name <> '' THEN
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
      -- New academies start on a 1-month trial of the top (Enterprise/elite)
      -- plan so the whole product is usable during the trial period.
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

    INSERT INTO public.profiles (id, email, role, name, username, phone, country, gender, birth_date, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'admin',
      COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      NULLIF(lower(btrim(COALESCE(NEW.raw_user_meta_data ->> 'username', ''))), ''),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
      COALESCE(v_new_country, NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'country', '')), '')),
      v_gender, v_birth_date,
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
        WHERE id = (v_venue ->> 'id')::uuid
          AND academy_id IS NULL AND owner_profile_id IS NULL;
      ELSE
        INSERT INTO public.venues (
          academy_id, name, address, capacity, sport_id, school_name,
          rental_cost, rental_hours, court_count, location_link, country, governorate, area
        )
        VALUES (
          v_academy,
          trim(v_venue ->> 'name'),
          NULLIF(v_venue ->> 'address', ''),
          NULLIF(v_venue ->> 'capacity', '')::integer,
          (SELECT id FROM public.sports WHERE lower(name) = lower(trim(v_venue ->> 'sport')) LIMIT 1),
          NULLIF(v_venue ->> 'school_name', ''),
          NULLIF(v_venue ->> 'rental_cost', '')::numeric,
          COALESCE(NULLIF(v_venue ->> 'rental_hours', '')::numeric, 1),
          COALESCE(NULLIF(v_venue ->> 'court_count', '')::integer, 1),
          NULLIF(v_venue ->> 'location_link', ''),
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

    INSERT INTO public.profiles (id, email, role, name, username, phone, country, gender, birth_date, join_date, academy_id, is_active)
    VALUES (
      NEW.id, NEW.email, 'member',
      COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      NULLIF(lower(btrim(COALESCE(NEW.raw_user_meta_data ->> 'username', ''))), ''),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
      NULLIF(trim(COALESCE(NEW.raw_user_meta_data ->> 'country', '')), ''),
      v_gender, v_birth_date,
      CURRENT_DATE, v_academy, FALSE
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
