-- Super-admin academy creation with the same seeded data as self-serve signup:
-- academy identity/subscription, membership plans, sports, playgrounds, and the
-- founder's admin profile. The auth account is created by the API route first
-- (invite or password) and passed in as p_admin_id.
CREATE OR REPLACE FUNCTION public.platform_create_academy(
  p_details JSONB,
  p_admin_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aid UUID;
  v_name TEXT := NULLIF(trim(COALESCE(p_details ->> 'name', '')), '');
  v_plan TEXT := COALESCE(NULLIF(p_details ->> 'plan', ''), 'elite');
  v_is_trial BOOLEAN := COALESCE((p_details ->> 'is_trial')::boolean, TRUE);
  v_trial_ends TIMESTAMPTZ;
  v_sessions INTEGER := NULLIF(p_details ->> 'monthly_sessions', '')::integer;
  v_price NUMERIC := NULLIF(p_details ->> 'monthly_price', '')::numeric;
  v_tryout NUMERIC := NULLIF(p_details ->> 'tryout_price', '')::numeric;
  v_slug TEXT;
  v_base_slug TEXT;
  v_item JSONB;
  v_sport_id UUID;
  v_username TEXT := NULLIF(lower(btrim(COALESCE(p_details ->> 'admin_username', ''))), '');
  v_admin_email TEXT := NULLIF(trim(COALESCE(p_details ->> 'admin_email', '')), '');
  v_admin_name TEXT := NULLIF(trim(COALESCE(p_details ->> 'admin_name', '')), '');
  v_admin_phone TEXT := NULLIF(trim(COALESCE(p_details ->> 'admin_phone', '')), '');
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Academy name is required';
  END IF;
  IF v_plan NOT IN ('starter', 'plus', 'elite') THEN
    v_plan := 'elite';
  END IF;

  -- A monthly price only makes sense with a session count (DB check).
  IF (v_sessions IS NULL) <> (v_price IS NULL) THEN
    v_sessions := NULL;
    v_price := NULL;
  END IF;

  v_trial_ends := CASE
    WHEN NOT v_is_trial THEN NULL
    WHEN NULLIF(p_details ->> 'trial_ends_at', '') IS NOT NULL
      THEN (p_details ->> 'trial_ends_at')::timestamptz
    ELSE NOW() + INTERVAL '30 days'
  END;

  v_base_slug := lower(regexp_replace(left(v_name, 40), '[^a-zA-Z0-9]+', '-', 'g'));
  IF v_base_slug IS NULL OR trim(v_base_slug, '-') = '' THEN
    v_base_slug := 'academy';
  END IF;
  v_slug := v_base_slug || '-' || left(md5(random()::text), 4);
  WHILE EXISTS (SELECT 1 FROM public.academies WHERE slug = v_slug) LOOP
    v_slug := v_base_slug || '-' || left(md5(random()::text), 4);
  END LOOP;

  INSERT INTO public.academies (
    name, slug, description, country, governorate, area,
    is_public, is_trial, trial_ends_at, plan,
    monthly_sessions, monthly_price, tryout_price
  ) VALUES (
    left(v_name, 60),
    v_slug,
    NULLIF(p_details ->> 'description', ''),
    NULLIF(trim(COALESCE(p_details ->> 'country', '')), ''),
    NULLIF(trim(COALESCE(p_details ->> 'governorate', '')), ''),
    NULLIF(trim(COALESCE(p_details ->> 'area', '')), ''),
    COALESCE((p_details ->> 'is_public')::boolean, TRUE),
    v_is_trial,
    v_trial_ends,
    v_plan,
    v_sessions,
    v_price,
    v_tryout
  )
  RETURNING id INTO v_aid;

  -- Membership plans: the console can pass its own list, otherwise mirror the
  -- Full/Half seeds that self-serve signup creates.
  IF jsonb_typeof(p_details -> 'membership_plans') = 'array'
     AND jsonb_array_length(p_details -> 'membership_plans') > 0 THEN
    INSERT INTO public.membership_plans (academy_id, name, sessions_count, price)
    SELECT
      v_aid,
      trim(item ->> 'name'),
      (item ->> 'sessions_count')::integer,
      NULLIF(item ->> 'price', '')::numeric
    FROM jsonb_array_elements(p_details -> 'membership_plans') AS item
    WHERE trim(COALESCE(item ->> 'name', '')) <> ''
      AND COALESCE(item ->> 'sessions_count', '') ~ '^[0-9]+$'
      AND (item ->> 'sessions_count')::integer > 0;
  ELSE
    INSERT INTO public.membership_plans (academy_id, name, sessions_count)
    VALUES (v_aid, 'Full', 8), (v_aid, 'Half', 4);
  END IF;

  -- Sports chosen in the console, plus any sport referenced by a playground.
  IF jsonb_typeof(p_details -> 'sports') = 'array' THEN
    INSERT INTO public.sports (academy_id, name)
    SELECT v_aid, trim(value)
    FROM jsonb_array_elements_text(p_details -> 'sports')
    WHERE trim(value) <> ''
    ON CONFLICT (academy_id, name) DO NOTHING;
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_details -> 'venues', '[]'::jsonb))
  LOOP
    IF NULLIF(trim(COALESCE(v_item ->> 'sport', '')), '') IS NOT NULL THEN
      INSERT INTO public.sports (academy_id, name)
      VALUES (v_aid, trim(v_item ->> 'sport'))
      ON CONFLICT (academy_id, name) DO NOTHING;
    END IF;
  END LOOP;

  -- Playgrounds: claim an unassigned pool court by id, or create one with the
  -- complete court details required by the submission trigger.
  IF jsonb_typeof(p_details -> 'venues') = 'array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_details -> 'venues') LOOP
      IF NULLIF(v_item ->> 'id', '') IS NOT NULL THEN
        UPDATE public.venues
        SET academy_id = v_aid
        WHERE id = (v_item ->> 'id')::uuid
          AND academy_id IS NULL
          AND owner_profile_id IS NULL;
      ELSE
        SELECT id INTO v_sport_id
        FROM public.sports
        WHERE academy_id = v_aid
          AND lower(name) = lower(trim(v_item ->> 'sport'))
        LIMIT 1;

        INSERT INTO public.venues (
          academy_id, name, address, capacity, sport_id, school_name,
          rental_cost, rental_hours, court_count, location_link,
          photos, cover_url, contact_phone, contact_person,
          country, governorate, area,
          court_availability, working_hours, lat, lng
        ) VALUES (
          v_aid,
          trim(v_item ->> 'name'),
          NULLIF(v_item ->> 'address', ''),
          NULLIF(v_item ->> 'capacity', '')::integer,
          v_sport_id,
          NULLIF(v_item ->> 'school_name', ''),
          NULLIF(v_item ->> 'rental_cost', '')::numeric,
          COALESCE(NULLIF(v_item ->> 'rental_hours', '')::numeric, 1),
          COALESCE(NULLIF(v_item ->> 'court_count', '')::integer, 1),
          NULLIF(v_item ->> 'location_link', ''),
          COALESCE(v_item -> 'photos', '[]'::jsonb),
          NULLIF(v_item ->> 'cover_url', ''),
          NULLIF(v_item ->> 'contact_phone', ''),
          NULLIF(v_item ->> 'contact_person', ''),
          NULLIF(v_item ->> 'country', ''),
          NULLIF(v_item ->> 'governorate', ''),
          NULLIF(v_item ->> 'area', ''),
          COALESCE(v_item -> 'court_availability', '[]'::jsonb),
          COALESCE(v_item -> 'working_hours', '[]'::jsonb),
          NULLIF(v_item ->> 'lat', '')::double precision,
          NULLIF(v_item ->> 'lng', '')::double precision
        );
      END IF;
    END LOOP;
  END IF;

  -- The founder account is created by the API route; make its profile the
  -- academy admin. handle_new_user() already inserted a member profile, so this
  -- is normally an update.
  IF p_admin_id IS NOT NULL THEN
    ALTER TABLE public.profiles DISABLE TRIGGER guard_profile_update;
    BEGIN
      UPDATE public.profiles SET
        academy_id = v_aid,
        role = 'admin',
        name = COALESCE(v_admin_name, name),
        email = COALESCE(v_admin_email, email),
        phone = COALESCE(v_admin_phone, phone),
        country = COALESCE(NULLIF(trim(COALESCE(p_details ->> 'country', '')), ''), country),
        join_date = COALESCE(join_date, CURRENT_DATE),
        is_active = TRUE
      WHERE id = p_admin_id;

      IF NOT FOUND THEN
        IF v_username IS NOT NULL THEN
          INSERT INTO public.profiles (
            id, email, role, name, username, phone, country, join_date, academy_id, is_active
          ) VALUES (
            p_admin_id, v_admin_email, 'admin',
            COALESCE(v_admin_name, split_part(COALESCE(v_admin_email, ''), '@', 1)),
            v_username, v_admin_phone,
            NULLIF(trim(COALESCE(p_details ->> 'country', '')), ''),
            CURRENT_DATE, v_aid, TRUE
          );
        ELSE
          INSERT INTO public.profiles (
            id, email, role, name, phone, country, join_date, academy_id, is_active
          ) VALUES (
            p_admin_id, v_admin_email, 'admin',
            COALESCE(v_admin_name, split_part(COALESCE(v_admin_email, ''), '@', 1)),
            v_admin_phone,
            NULLIF(trim(COALESCE(p_details ->> 'country', '')), ''),
            CURRENT_DATE, v_aid, TRUE
          );
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      ALTER TABLE public.profiles ENABLE TRIGGER guard_profile_update;
      RAISE;
    END;
    ALTER TABLE public.profiles ENABLE TRIGGER guard_profile_update;
  END IF;

  RETURN v_aid;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_create_academy(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_create_academy(JSONB, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
