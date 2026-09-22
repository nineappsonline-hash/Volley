-- ═══════════════════════════════════════════════════════════════════════════
-- Playground owner module
--
-- A playground owner signs up, is reviewed by the platform super admin, then
-- manages their own playgrounds (venues), sees their schedule/bookings and
-- earns the venue's rental cost per booking while Playza keeps the participant
-- fee (the difference between the booking price and the venue rental cost).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Allow the role used for owner dashboards.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'member', 'playground_owner'));

-- 2. Playground owner applications (approval gate for the module itself).
CREATE TABLE IF NOT EXISTS public.playground_owners (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  business_name TEXT,
  phone         TEXT,
  country       TEXT,
  governorate   TEXT,
  area          TEXT,
  review_note   TEXT,
  approved_by   UUID REFERENCES public.profiles(id),
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS playground_owners_pending
  ON public.playground_owners(created_at) WHERE status = 'pending';

ALTER TABLE public.playground_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner views own application" ON public.playground_owners;
CREATE POLICY "Owner views own application" ON public.playground_owners
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Owner edits own pending application" ON public.playground_owners;
CREATE POLICY "Owner edits own pending application" ON public.playground_owners
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND status = 'pending')
  WITH CHECK (profile_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Super admin manages owner applications" ON public.playground_owners;
CREATE POLICY "Super admin manages owner applications" ON public.playground_owners
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

GRANT SELECT, INSERT, UPDATE ON public.playground_owners TO authenticated;

-- 3. Playgrounds can be owned by a profile (independent of any academy).
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS owner_profile_id UUID REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS venues_owner_idx ON public.venues(owner_profile_id);
GRANT SELECT (owner_profile_id) ON public.venues TO authenticated;

-- Owners may create, edit and remove their own playgrounds.
DROP POLICY IF EXISTS "Playground owners insert their playgrounds" ON public.venues;
CREATE POLICY "Playground owners insert their playgrounds" ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR (owner_profile_id = auth.uid() AND academy_id IS NULL));

DROP POLICY IF EXISTS "Playground owners update their playgrounds" ON public.venues;
CREATE POLICY "Playground owners update their playgrounds" ON public.venues
  FOR UPDATE TO authenticated
  USING (owner_profile_id = auth.uid())
  WITH CHECK (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS "Playground owners delete their playgrounds" ON public.venues;
CREATE POLICY "Playground owners delete their playgrounds" ON public.venues
  FOR DELETE TO authenticated USING (owner_profile_id = auth.uid());

-- An owner always sees their own playgrounds, even while they are pending.
DROP POLICY IF EXISTS "Approved playground visibility" ON public.venues;
CREATE POLICY "Approved playground visibility" ON public.venues AS RESTRICTIVE
FOR SELECT TO anon, authenticated USING (
  approval_status = 'approved' OR public.is_super_admin()
  OR (academy_id = public.current_academy_id() AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ))
  OR owner_profile_id = auth.uid()
);

-- 4. Owner bookings: they can manage rentals recorded against their own venues.
DROP POLICY IF EXISTS "Playground owners manage their venue rentals" ON public.venue_rentals;
CREATE POLICY "Playground owners manage their venue rentals" ON public.venue_rentals
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id = venue_rentals.venue_id AND v.owner_profile_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.venues v
    WHERE v.id = venue_rentals.venue_id AND v.owner_profile_id = auth.uid()
  ));

-- 5. `save_venue_rental` accepts both academy-owned and owner-owned venues.
CREATE OR REPLACE FUNCTION public.save_venue_rental(
  p_id              UUID DEFAULT NULL,
  p_venue_id        UUID DEFAULT NULL,
  p_customer_name   TEXT DEFAULT NULL,
  p_customer_phone  TEXT DEFAULT NULL,
  p_customer_email  TEXT DEFAULT NULL,
  p_price           NUMERIC DEFAULT 0,
  p_hours           NUMERIC DEFAULT 1,
  p_rental_date     DATE DEFAULT NULL,
  p_start_time      TIME DEFAULT NULL,
  p_is_paid         BOOLEAN DEFAULT FALSE,
  p_payment_method  TEXT DEFAULT NULL,
  p_notes           TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id             UUID := p_id;
  v_court          INTEGER;
  v_owner          UUID;
  v_owner_profile  UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_customer_name IS NULL OR btrim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF p_rental_date IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Date and time are required';
  END IF;
  IF p_hours IS NULL OR p_hours <= 0 OR p_hours > 24 OR p_hours = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Hours must be greater than zero and at most 24';
  END IF;

  IF p_venue_id IS NOT NULL THEN
    SELECT academy_id, owner_profile_id
    INTO v_owner, v_owner_profile
    FROM public.venues WHERE id = p_venue_id;
    IF public.is_super_admin() IS NOT TRUE
       AND (v_owner IS NULL OR v_owner IS DISTINCT FROM public.current_academy_id())
       AND (v_owner_profile IS NULL OR v_owner_profile IS DISTINCT FROM auth.uid()) THEN
      RAISE EXCEPTION 'You can only book your own playground';
    END IF;
    v_court := public.pick_free_court(
      p_venue_id, p_rental_date, p_start_time, round(p_hours * 60)::int, p_id, NULL
    );
    IF v_court IS NULL THEN
      RAISE EXCEPTION 'All courts are booked for this time';
    END IF;
  END IF;

  INSERT INTO public.venue_rentals
    (id, academy_id, venue_id, customer_name, customer_phone, customer_email,
     price, hours, rental_date, start_time, court_number, is_paid, payment_method, notes)
  VALUES
    (COALESCE(v_id, gen_random_uuid()), public.current_academy_id(), p_venue_id,
     btrim(p_customer_name), NULLIF(btrim(COALESCE(p_customer_phone, '')), ''),
     NULLIF(btrim(COALESCE(p_customer_email, '')), ''), p_price, p_hours, p_rental_date,
     p_start_time, COALESCE(v_court, 1), p_is_paid,
     CASE WHEN p_payment_method IN ('cash', 'bank_transfer', 'e_wallet')
          THEN p_payment_method ELSE NULL END,
     NULLIF(btrim(COALESCE(p_notes, '')), ''))
  ON CONFLICT (id) DO UPDATE SET
    academy_id      = EXCLUDED.academy_id,
    venue_id        = EXCLUDED.venue_id,
    customer_name   = EXCLUDED.customer_name,
    customer_phone  = EXCLUDED.customer_phone,
    customer_email  = EXCLUDED.customer_email,
    price           = EXCLUDED.price,
    hours           = EXCLUDED.hours,
    rental_date     = EXCLUDED.rental_date,
    start_time      = EXCLUDED.start_time,
    court_number    = EXCLUDED.court_number,
    is_paid         = EXCLUDED.is_paid,
    payment_method  = EXCLUDED.payment_method,
    notes           = EXCLUDED.notes
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_venue_rental(
  UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, DATE, TIME, BOOLEAN, TEXT, TEXT
) TO authenticated;

-- 6. Super admin reviews owner applications.
CREATE OR REPLACE FUNCTION public.review_playground_owner(
  p_owner_id UUID,
  p_approve  BOOLEAN,
  p_note     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only a super admin can review playground owners' USING ERRCODE = '42501';
  END IF;
  IF p_approve IS NULL THEN RAISE EXCEPTION 'A review decision is required'; END IF;
  UPDATE public.playground_owners
  SET status      = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      approved_by = auth.uid(),
      approved_at = now(),
      review_note = COALESCE(NULLIF(btrim(COALESCE(p_note, '')), ''), review_note)
  WHERE id = p_owner_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Owner application is no longer awaiting review'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_playground_owner(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_playground_owner(UUID, BOOLEAN, TEXT) TO authenticated;

-- 7. Owner signup: created by the auth trigger (mirrors academy signup), with
--    their first playgrounds seeded straight into their own account.
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
          owner_profile_id, name, address, capacity, school_name,
          rental_cost, rental_hours, country, governorate, area
        )
        VALUES (
          NEW.id,
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