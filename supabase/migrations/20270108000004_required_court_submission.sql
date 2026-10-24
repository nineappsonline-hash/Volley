-- Generated with the CLI and ordered after the signup migrations it extends.
-- Preserve all existing account signup logic; retain complete academy court details.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          rental_cost, rental_hours, court_count, location_link, photos,
          contact_phone, country, governorate, area, court_availability, working_hours
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
          COALESCE(NULLIF(trim(v_venue ->> 'contact_phone'), ''), NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), '')),
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
          rental_cost, rental_hours, court_count, location_link, country, governorate, area,
          contact_phone, photos, court_availability, working_hours
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
          COALESCE(NULLIF(v_venue ->> 'country', ''), v_new_country),
          COALESCE(NULLIF(v_venue ->> 'governorate', ''), v_new_governorate),
          COALESCE(NULLIF(v_venue ->> 'area', ''), v_new_area),
          COALESCE(NULLIF(trim(v_venue ->> 'contact_phone'), ''), NULLIF(trim(NEW.raw_user_meta_data ->> 'phone'), '')),
          COALESCE(v_venue -> 'photos', '[]'::jsonb),
          COALESCE(v_venue -> 'court_availability', '[]'::jsonb),
          COALESCE(v_venue -> 'working_hours', '[]'::jsonb)
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
$function$;


-- New courts must be reviewable. Existing listings and selected-field corrections
-- are intentionally unaffected; missing legacy information remains visible to admins.
CREATE OR REPLACE FUNCTION playza_private.require_complete_new_court()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE missing text[]:='{}'; slot jsonb;
BEGIN
 IF NULLIF(btrim(NEW.name),'') IS NULL THEN missing:=array_append(missing,'name'); END IF;
 IF NEW.sport_id IS NULL THEN missing:=array_append(missing,'sport'); END IF;
 IF NULLIF(btrim(NEW.address),'') IS NULL THEN missing:=array_append(missing,'address'); END IF;
 IF NULLIF(btrim(NEW.country),'') IS NULL OR NULLIF(btrim(NEW.governorate),'') IS NULL OR NULLIF(btrim(NEW.area),'') IS NULL THEN missing:=array_append(missing,'country, governorate and city'); END IF;
 IF NEW.location_link IS NULL OR NEW.location_link !~* '^https?://[^[:space:]]+$' THEN missing:=array_append(missing,'map link'); END IF;
 IF NEW.contact_phone IS NULL OR NEW.contact_phone !~ '^[+()0-9 .-]+$' OR length(regexp_replace(NEW.contact_phone,'[^0-9]','','g')) NOT BETWEEN 7 AND 15 THEN missing:=array_append(missing,'contact phone'); END IF;
 IF NEW.rental_cost IS NULL OR NEW.rental_cost<0 OR NEW.rental_cost::text IN ('NaN','Infinity','-Infinity') OR NEW.rental_hours IS NULL OR NEW.rental_hours<=0 OR NEW.rental_hours::text IN ('NaN','Infinity','-Infinity') THEN missing:=array_append(missing,'rental price and duration'); END IF;
 IF NEW.court_count IS NULL OR NEW.court_count NOT BETWEEN 1 AND 100 THEN missing:=array_append(missing,'court count'); END IF;
 IF (NEW.cover_url IS NULL OR NEW.cover_url !~* '^https?://[^[:space:]]+$') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(NEW.photos)='array' THEN NEW.photos ELSE '[]'::jsonb END) url WHERE url ~* '^https?://[^[:space:]]+$') THEN missing:=array_append(missing,'court photos'); END IF;
 IF jsonb_typeof(NEW.court_availability) IS DISTINCT FROM 'array' THEN missing:=array_append(missing,'working hours');
 ELSIF jsonb_array_length(NEW.court_availability)=0 THEN missing:=array_append(missing,'working hours');
 ELSE
   FOR slot IN SELECT * FROM jsonb_array_elements(NEW.court_availability) LOOP
     IF jsonb_typeof(slot) IS DISTINCT FROM 'object' OR NOT (slot ?& ARRAY['court_number','weekday','start','end']) OR COALESCE((slot->>'court_number') ~ '^[0-9]+$',false) IS NOT TRUE OR COALESCE((slot->>'weekday') ~ '^[0-6]$',false) IS NOT TRUE OR COALESCE((slot->>'start') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$',false) IS NOT TRUE OR COALESCE((slot->>'end') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$',false) IS NOT TRUE THEN RAISE EXCEPTION 'Valid court working hours are required'; END IF;
     IF (slot->>'court_number')::integer NOT BETWEEN 1 AND NEW.court_count OR (slot->>'start')>=(slot->>'end') THEN RAISE EXCEPTION 'Valid court working hours are required'; END IF;
   END LOOP;
 END IF;
 IF cardinality(missing)>0 THEN RAISE EXCEPTION 'Required court information: %',array_to_string(missing,', '); END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION playza_private.require_complete_new_court() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS zzzz_require_complete_new_court ON public.venues;
CREATE TRIGGER zzzz_require_complete_new_court BEFORE INSERT ON public.venues
FOR EACH ROW EXECUTE FUNCTION playza_private.require_complete_new_court();
NOTIFY pgrst,'reload schema';

-- Anonymous signup photos are uploaded by the bounded server endpoint, never by
-- granting anonymous Storage writes. Only hashed network fingerprints are stored.
CREATE TABLE IF NOT EXISTS playza_private.court_signup_photo_limits (
  key text NOT NULL, window_start timestamptz NOT NULL, uploads integer NOT NULL DEFAULT 0,
  PRIMARY KEY(key,window_start)
);
ALTER TABLE playza_private.court_signup_photo_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct client quota access" ON playza_private.court_signup_photo_limits;
CREATE POLICY "No direct client quota access" ON playza_private.court_signup_photo_limits
FOR ALL TO anon,authenticated USING(false) WITH CHECK(false);
REVOKE ALL ON playza_private.court_signup_photo_limits FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.reserve_court_signup_photo(p_fingerprint text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE day_start timestamptz:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'; hour_start timestamptz:=date_trunc('hour',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Server upload permission required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(731920415);
 DELETE FROM playza_private.court_signup_photo_limits WHERE window_start < now()-interval '2 days';
 IF COALESCE((SELECT uploads FROM playza_private.court_signup_photo_limits WHERE key=p_fingerprint AND window_start=day_start),0)>=20
 OR COALESCE((SELECT uploads FROM playza_private.court_signup_photo_limits WHERE key='global' AND window_start=hour_start),0)>=200 THEN RAISE EXCEPTION 'Court photo upload limit reached'; END IF;
 INSERT INTO playza_private.court_signup_photo_limits(key,window_start,uploads) VALUES(p_fingerprint,day_start,1),('global',hour_start,1)
 ON CONFLICT(key,window_start) DO UPDATE SET uploads=playza_private.court_signup_photo_limits.uploads+1;
END; $$;
REVOKE ALL ON FUNCTION public.reserve_court_signup_photo(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_court_signup_photo(text) TO service_role;
NOTIFY pgrst,'reload schema';
