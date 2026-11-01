-- ───────────────────────────────────────────────────────────────────────────
-- Shared playgrounds
--
-- A playground can be used by several academies. `venues.academy_id` keeps its
-- existing meaning (the owning academy, or NULL for the platform pool), while
-- `academy_venues` records every academy that can use the playground.
--
-- Super-admin academy creation and editing link the selected playgrounds into
-- `academy_venues`; they only claim (set `academy_id`) playgrounds that are not
-- already owned by another academy. Existing owned playgrounds are backfilled
-- into the link table so every academy's console keeps listing them.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.academy_venues (
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (academy_id, venue_id)
);
CREATE INDEX IF NOT EXISTS academy_venues_venue ON public.academy_venues(venue_id);

ALTER TABLE public.academy_venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Academy playground links are viewable" ON public.academy_venues;
CREATE POLICY "Academy playground links are viewable" ON public.academy_venues
  FOR SELECT TO authenticated USING (
    public.is_super_admin() OR academy_id = public.current_academy_id()
  );
DROP POLICY IF EXISTS "Academy admins manage playground links" ON public.academy_venues;
CREATE POLICY "Academy admins manage playground links" ON public.academy_venues
  FOR ALL TO authenticated USING (
    public.is_super_admin() OR public.academy_can(academy_id, 'owner')
  ) WITH CHECK (
    public.is_super_admin() OR public.academy_can(academy_id, 'owner')
  );
REVOKE ALL ON public.academy_venues FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_venues TO authenticated;

-- Backfill every already-owned playground so consoles list it immediately.
INSERT INTO public.academy_venues (academy_id, venue_id)
SELECT academy_id, id FROM public.venues WHERE academy_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Playgrounds can be used by several academies. `academy_venues` is the
-- many-to-many link between an academy and the playgrounds it uses; the
-- existing `venues.academy_id` remains the owning academy (or NULL for the
-- platform pool). Links are backfilled for every already-owned playground.
--
-- This revision also makes super-admin academy creation link shared
-- playgrounds instead of moving them, while keeping the training/court hours
-- and unavailable rental slots introduced by the previous revisions.
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
  v_venue_id UUID;
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
        v_venue_id := (v_item ->> 'id')::uuid;
        IF NOT EXISTS (SELECT 1 FROM public.venues WHERE id = v_venue_id) THEN
          RAISE EXCEPTION 'Playground not found';
        END IF;
        -- Sharing: link the playground to this academy without taking it away
        -- from the academy that already owns it.
        INSERT INTO public.academy_venues (academy_id, venue_id)
        VALUES (v_aid, v_venue_id)
        ON CONFLICT DO NOTHING;
        UPDATE public.venues
        SET
          academy_id = COALESCE(academy_id, v_aid),
          court_availability = CASE
            WHEN jsonb_typeof(v_item -> 'court_availability') = 'array'
              AND jsonb_array_length(v_item -> 'court_availability') > 0
            THEN v_item -> 'court_availability'
            ELSE court_availability
          END,
          working_hours = CASE
            WHEN jsonb_typeof(v_item -> 'working_hours') = 'array'
              AND jsonb_array_length(v_item -> 'working_hours') > 0
            THEN v_item -> 'working_hours'
            ELSE working_hours
          END,
          unavailable_slots = CASE
            WHEN jsonb_typeof(v_item -> 'unavailable_slots') = 'array'
            THEN v_item -> 'unavailable_slots'
            ELSE unavailable_slots
          END
        WHERE id = v_venue_id;
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
          court_availability, unavailable_slots, working_hours, lat, lng
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
          COALESCE(v_item -> 'unavailable_slots', '[]'::jsonb),
          COALESCE(v_item -> 'working_hours', '[]'::jsonb),
          NULLIF(v_item ->> 'lat', '')::double precision,
          NULLIF(v_item ->> 'lng', '')::double precision
        )
        RETURNING id INTO v_venue_id;
        INSERT INTO public.academy_venues (academy_id, venue_id)
        VALUES (v_aid, v_venue_id)
        ON CONFLICT DO NOTHING;
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
  v_venue_id UUID;
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
      -- Drop links for playgrounds removed from this academy. The playground
      -- itself is only deleted when this academy owns it (see below), so a
      -- shared playground used by other academies survives.
      DELETE FROM public.academy_venues av
      WHERE av.academy_id = p_academy_id
        AND NOT (av.venue_id IN (
          SELECT (x ->> 'id')::uuid
          FROM jsonb_array_elements(p_payload -> 'venues') AS x
          WHERE x ? 'id'
        ));
      -- If the removed playground is still shared with another academy, keep
      -- the physical row and hand it back to the platform pool instead of
      -- deleting it out from under the other academies.
      UPDATE public.venues v
      SET academy_id = NULL
      WHERE v.academy_id = p_academy_id
        AND NOT (v.id IN (
          SELECT (x ->> 'id')::uuid
          FROM jsonb_array_elements(p_payload -> 'venues') AS x
          WHERE x ? 'id'
        ))
        AND EXISTS (
          SELECT 1 FROM public.academy_venues av WHERE av.venue_id = v.id
        );
      DELETE FROM public.venues v
      WHERE v.academy_id = p_academy_id
        AND NOT (v.id IN (
          SELECT (x ->> 'id')::uuid
          FROM jsonb_array_elements(p_payload -> 'venues') AS x
          WHERE x ? 'id'
        ))
        AND NOT EXISTS (
          SELECT 1 FROM public.academy_venues av WHERE av.venue_id = v.id
        );
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
          -- Keep a link even when the playground is owned by another academy;
          -- only unassigned playgrounds are claimed by the update above.
          INSERT INTO public.academy_venues (academy_id, venue_id)
          VALUES (p_academy_id, (v_item ->> 'id')::uuid)
          ON CONFLICT DO NOTHING;
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
          )
          RETURNING id INTO v_venue_id;
          INSERT INTO public.academy_venues (academy_id, venue_id)
          VALUES (p_academy_id, v_venue_id)
          ON CONFLICT DO NOTHING;
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


CREATE OR REPLACE FUNCTION public.academy_workspace(p_branch uuid DEFAULT NULL,p_day date DEFAULT CURRENT_DATE) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid:=public.current_academy_id(); caps jsonb; result jsonb; BEGIN
 IF NOT public.academy_can(aid,'read') THEN RAISE EXCEPTION 'Academy staff access required' USING ERRCODE='42501'; END IF;
 IF p_branch IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.academy_branches WHERE id=p_branch AND academy_id=aid) THEN RAISE EXCEPTION 'Branch belongs to another academy'; END IF;
 SELECT jsonb_object_agg(cap,public.academy_can(aid,cap)) INTO caps FROM unnest(ARRAY['owner','training','bookings','attendance','members','finance','leads','audit']) cap;
 SELECT jsonb_build_object(
 'academy',jsonb_build_object('id',a.id,'name',a.name,'slug',a.slug,'is_public',a.is_public),
 'capabilities',caps,
 'setup',jsonb_build_object('identity',a.logo_url IS NOT NULL AND a.name<>'','sports',EXISTS(SELECT 1 FROM public.sports WHERE academy_id=aid),'branches',EXISTS(SELECT 1 FROM public.academy_branches WHERE academy_id=aid),'venue',EXISTS(SELECT 1 FROM public.venues v WHERE v.approval_status='approved' AND (v.academy_id=aid OR EXISTS(SELECT 1 FROM public.academy_venues av WHERE av.venue_id=v.id AND av.academy_id=aid))),'coach',EXISTS(SELECT 1 FROM public.coaches WHERE academy_id=aid),'prices',EXISTS(SELECT 1 FROM public.academy_training_programs WHERE academy_id=aid),'training',EXISTS(SELECT 1 FROM public.academy_training_programs WHERE academy_id=aid AND active),'schedule',EXISTS(SELECT 1 FROM public.training_sessions WHERE academy_id=aid AND date>=CURRENT_DATE AND status='scheduled') OR EXISTS(SELECT 1 FROM public.academy_training_programs p WHERE p.academy_id=aid AND p.active AND EXISTS(SELECT 1 FROM public.training_program_slots(p.id) sl WHERE sl.seats_left>0)),'public',a.is_public AND a.slug IS NOT NULL),
 'branches',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'name',b.name)) FROM public.academy_branches b WHERE b.academy_id=aid),'[]'),
 'members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'has_account',p.email IS NOT NULL,'email',CASE WHEN public.academy_can(aid,'members') THEN coalesce(p.email,d.contact_email) END,'phone',CASE WHEN public.academy_can(aid,'members') THEN p.phone END,'guardian_id',p.guardian_id,'branch_id',p.branch_id,'frozen_until',p.training_frozen_until,'sessions',p.subscription_sessions,'details',CASE WHEN public.academy_can(aid,'members') THEN to_jsonb(d)-'updated_by'-'academy_id' WHEN public.academy_can(aid,'attendance') THEN jsonb_build_object('emergency_name',d.emergency_name,'emergency_phone',d.emergency_phone,'consent_status',d.consent_status) ELSE '{}' END) ORDER BY p.name) FROM public.profiles p LEFT JOIN public.academy_member_details d ON d.member_id=p.id WHERE p.academy_id=aid AND p.role='member' AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]'),
 'programs',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'branch_id',p.branch_id,'active',p.active,'venue_id',p.venue_id)) FROM public.academy_training_programs p WHERE p.academy_id=aid AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]'),
 'bookings',CASE WHEN public.academy_can(aid,'bookings') OR public.academy_can(aid,'finance') THEN coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC) FROM public.academy_training_bookings b JOIN public.academy_training_programs p ON p.id=b.program_id WHERE p.academy_id=aid AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'agenda',CASE WHEN public.academy_can(aid,'attendance') OR public.academy_can(aid,'bookings') THEN coalesce((SELECT jsonb_agg(jsonb_build_object('booking_id',b.id,'member_id',m.id,'member',m.name,'program',p.name,'program_id',p.id,'venue',v.name,'date',s.session_date,'time',s.starts_at,'end',s.ends_at,'present',c.is_present,'frozen_until',m.training_frozen_until,'branch_id',p.branch_id,'court',s.court_number) ORDER BY s.session_date,s.starts_at,m.name) FROM public.academy_training_booking_sessions s JOIN public.academy_training_bookings b ON b.id=s.booking_id AND b.status='approved' JOIN public.academy_training_programs p ON p.id=b.program_id JOIN public.profiles m ON m.id=b.member_id JOIN public.venues v ON v.id=p.venue_id LEFT JOIN public.academy_booking_checkins c ON c.booking_id=s.booking_id AND c.session_date=s.session_date AND c.starts_at=s.starts_at WHERE p.academy_id=aid AND s.session_date BETWEEN p_day AND p_day+30 AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'sessions',CASE WHEN public.academy_can(aid,'training') THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'date',date,'time',time,'branch_id',branch_id)) FROM public.training_sessions WHERE academy_id=aid AND date BETWEEN p_day AND p_day+30 AND (p_branch IS NULL OR branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'credit_balance',CASE WHEN public.academy_can(aid,'finance') THEN coalesce((SELECT sum(amount) FROM public.academy_member_ledger WHERE academy_id=aid AND kind IN ('credit','credit_used')),0) ELSE 0 END,
 'payments',CASE WHEN public.academy_can(aid,'finance') THEN coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.payment_date DESC) FROM public.payments p WHERE p.academy_id=aid AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'renewal_requests',CASE WHEN public.academy_can(aid,'finance') THEN coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM public.renewal_requests r JOIN public.profiles p ON p.id=r.member_id WHERE r.academy_id=aid AND r.status='pending' AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'ledger',CASE WHEN public.academy_can(aid,'finance') THEN coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC) FROM public.academy_member_ledger l WHERE l.academy_id=aid AND (p_branch IS NULL OR l.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'staff',CASE WHEN public.academy_can(aid,'owner') THEN coalesce((SELECT jsonb_agg(jsonb_build_object('profile_id',s.profile_id,'name',p.name,'role',s.role,'active',s.active)) FROM public.academy_staff s JOIN public.profiles p ON p.id=s.profile_id WHERE s.academy_id=aid),'[]') ELSE '[]'::jsonb END,
 'leads',CASE WHEN public.academy_can(aid,'leads') THEN coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.updated_at DESC) FROM public.academy_leads l WHERE l.academy_id=aid AND (p_branch IS NULL OR l.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'renewals',CASE WHEN public.academy_can(aid,'leads') THEN coalesce((SELECT jsonb_agg(jsonb_build_object('member_id',p.id,'name',p.name,'has_account',p.email IS NOT NULL,'remaining',greatest(p.subscription_sessions-coalesce((SELECT count(*) FROM public.attendance t JOIN public.training_sessions s ON s.id=t.session_id WHERE t.member_id=p.id AND t.is_present AND s.status<>'canceled' AND s.date>=coalesce((SELECT max(payment_date) FROM public.payments WHERE member_id=p.id),p.join_date)),0),0),'last_reminder',(SELECT max(created_at) FROM public.academy_outreach WHERE academy_id=aid AND member_id=p.id),'pending_request',EXISTS(SELECT 1 FROM public.renewal_requests r WHERE r.member_id=p.id AND r.academy_id=aid AND r.status='pending'))) FROM public.profiles p WHERE p.academy_id=aid AND p.role='member' AND p.is_active AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'audit',CASE WHEN public.academy_can(aid,'audit') THEN coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM (SELECT * FROM public.academy_audit_log WHERE academy_id=aid ORDER BY created_at DESC LIMIT 200) l),'[]') ELSE '[]'::jsonb END
 ) INTO result FROM public.academies a WHERE a.id=aid;
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.platform_create_academy(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_create_academy(JSONB, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.super_admin_update_academy(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_admin_update_academy(UUID, JSONB) TO authenticated;
REVOKE ALL ON FUNCTION public.academy_workspace(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academy_workspace(UUID, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
