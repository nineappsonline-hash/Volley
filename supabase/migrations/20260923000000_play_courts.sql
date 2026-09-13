-- Play courts: a playground can have more than one court. Each booking (rental
-- or friendly game) takes exactly one court. Bookings are auto-assigned to the
-- first free court; once every court is taken for a period the playground shows
-- as unavailable. A database guard rejects any attempt to double-book the same
-- court at the same time.

-- How many courts the playground has (default 1 = previous behaviour).
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS court_count INTEGER NOT NULL DEFAULT 1 CHECK (court_count >= 1);

-- Which court a rental occupies. Inserted automatically; kept on manual edits.
ALTER TABLE public.venue_rentals
  ADD COLUMN IF NOT EXISTS court_number INTEGER NOT NULL DEFAULT 1 CHECK (court_number >= 1);

-- Which court a friendly game occupies (NULL when the game has no playground).
ALTER TABLE public.friendly_games
  ADD COLUMN IF NOT EXISTS court_number INTEGER CHECK (court_number IS NULL OR court_number >= 1);

CREATE INDEX IF NOT EXISTS idx_venue_rentals_court
  ON public.venue_rentals(venue_id, court_number, rental_date);
CREATE INDEX IF NOT EXISTS idx_friendly_games_court
  ON public.friendly_games(playground_id, court_number, game_date);

-- Minutes-of-day for interval overlap math.
CREATE OR REPLACE FUNCTION public.minutes_of_day(p_time TIME)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT date_part('hour', p_time)::int * 60 + date_part('minute', p_time)::int
$$;

-- First free court for a slot, counting both rentals and friendly games.
-- Returns NULL when the venue has no free court (or doesn't exist).
-- p_exclude_rental / p_exclude_game ignore the row being edited.
CREATE OR REPLACE FUNCTION public.pick_free_court(
  p_venue_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_duration_minutes INTEGER,
  p_exclude_rental UUID DEFAULT NULL,
  p_exclude_game UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_courts INTEGER;
  v_court  INTEGER;
  v_start  INTEGER := public.minutes_of_day(p_start_time);
  v_end    INTEGER := v_start + p_duration_minutes;
  v_free   BOOLEAN;
BEGIN
  SELECT court_count INTO v_courts FROM public.venues WHERE id = p_venue_id;
  IF v_courts IS NULL OR v_courts <= 0 THEN
    RETURN NULL;
  END IF;

  FOR v_court IN 1..v_courts LOOP
    -- A rental with no court number yet is treated as court 1 (legacy rows).
    SELECT NOT EXISTS (
      SELECT 1 FROM public.venue_rentals r
      WHERE r.venue_id = p_venue_id
        AND r.rental_date = p_date
        AND public.minutes_of_day(r.start_time) < v_end
        AND v_start < public.minutes_of_day(r.start_time) + r.hours * 60
        AND (r.court_number = v_court OR (v_court = 1 AND r.court_number IS NULL))
        AND r.id IS DISTINCT FROM p_exclude_rental
    ) INTO v_free;
    IF v_free THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM public.friendly_games f
        WHERE f.playground_id = p_venue_id
          AND f.game_date = p_date
          AND f.status <> 'cancelled'
          AND public.minutes_of_day(f.start_time) < v_end
          AND v_start < public.minutes_of_day(f.start_time) + COALESCE(f.duration_hours, 1) * 60
          AND (f.court_number = v_court OR (v_court = 1 AND f.court_number IS NULL))
          AND f.id IS DISTINCT FROM p_exclude_game
      ) INTO v_free;
    END IF;
    IF v_free THEN
      RETURN v_court;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pick_free_court(UUID, DATE, TIME, INTEGER, UUID, UUID) TO authenticated;

-- Atomic booking for venue rentals: assigns the first free court server-side and
-- raises when every court is already taken for the slot. Supersedes the direct
-- client insert so duplicates can never be written.
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
  v_id     UUID := p_id;
  v_court  INTEGER;
  v_owner  UUID;
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
    SELECT academy_id INTO v_owner FROM public.venues WHERE id = p_venue_id;
    IF v_owner IS NULL OR v_owner <> public.current_academy_id() THEN
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

-- Hard guarantee at the database level: one court cannot hold two bookings at
-- the same time — even outside the booking function above.
CREATE OR REPLACE FUNCTION public.guard_venue_rental_court()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.venue_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.venue_rentals r
    WHERE r.id IS DISTINCT FROM NEW.id
      AND r.venue_id = NEW.venue_id
      AND r.rental_date = NEW.rental_date
      AND r.court_number = NEW.court_number
      AND public.minutes_of_day(r.start_time) <
          public.minutes_of_day(NEW.start_time) + NEW.hours * 60
      AND public.minutes_of_day(NEW.start_time) <
          public.minutes_of_day(r.start_time) + r.hours * 60
  ) THEN
    RAISE EXCEPTION 'This court is already booked for that time';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_venue_rental_court ON public.venue_rentals;
CREATE TRIGGER trg_guard_venue_rental_court
  BEFORE INSERT OR UPDATE OF venue_id, court_number, rental_date, start_time, hours
  ON public.venue_rentals
  FOR EACH ROW EXECUTE FUNCTION public.guard_venue_rental_court();

-- Friendly games also occupy one court each. Re-declare create_friendly_game
-- with automatic court assignment (same signature, no new parameters).
DROP FUNCTION IF EXISTS public.create_friendly_game(TEXT, TEXT, DATE, TIME, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, NUMERIC, BOOLEAN);
CREATE OR REPLACE FUNCTION public.create_friendly_game(
  p_title          TEXT,
  p_sport          TEXT,
  p_game_date      DATE,
  p_start_time     TIME,
  p_playground_id  UUID DEFAULT NULL,
  p_area           TEXT DEFAULT NULL,
  p_location       TEXT DEFAULT NULL,
  p_lat            DOUBLE PRECISION DEFAULT NULL,
  p_lng            DOUBLE PRECISION DEFAULT NULL,
  p_max_players    INTEGER DEFAULT 12,
  p_skill_level    TEXT DEFAULT NULL,
  p_description    TEXT DEFAULT NULL,
  p_is_public      BOOLEAN DEFAULT TRUE,
  p_recurrence     TEXT DEFAULT NULL,
  p_gender         TEXT DEFAULT 'mixed',
  p_min_age        INTEGER DEFAULT NULL,
  p_max_age        INTEGER DEFAULT NULL,
  p_invite_code    TEXT DEFAULT NULL,
  p_min_players    INTEGER DEFAULT 2,
  p_duration_hours NUMERIC DEFAULT 1,
  p_host_pays      BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member UUID;
  v_game   UUID;
  v_name   TEXT;
  v_username TEXT;
  v_venue  public.venues%ROWTYPE;
  v_court  INTEGER;
  v_code   TEXT;
  v_share  NUMERIC;
  v_host_total NUMERIC;
BEGIN
  IF p_min_players IS NULL OR p_max_players IS NULL OR p_min_players < 2 OR p_max_players < p_min_players THEN
    RAISE EXCEPTION 'Minimum players must be at least 2 and no greater than maximum players';
  END IF;
  IF p_duration_hours IS NULL OR p_duration_hours <= 0 OR p_duration_hours > 24 OR p_duration_hours = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Duration must be greater than zero and at most 24 hours';
  END IF;
  v_member := auth.uid();
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  IF p_sport IS NULL OR btrim(p_sport) = '' THEN
    RAISE EXCEPTION 'Sport is required';
  END IF;
  IF p_game_date IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Date and time are required';
  END IF;

  -- Playground must be a selectable venue (pool or academy playground).
  -- Games take one court each: assign the first free court, or refuse when
  -- every court is already booked for the slot.
  IF p_playground_id IS NOT NULL THEN
    SELECT * INTO v_venue
    FROM public.venues
    WHERE id = p_playground_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Playground not available';
    END IF;
    v_court := public.pick_free_court(
      p_playground_id, p_game_date, p_start_time, round(p_duration_hours * 60)::int, NULL, NULL
    );
    IF v_court IS NULL THEN
      RAISE EXCEPTION 'All courts are booked for this time — pick another time or playground';
    END IF;
  END IF;

  IF p_host_pays THEN
    IF v_venue.rental_cost IS NOT NULL AND v_venue.rental_cost >= 0 THEN
      v_host_total := round(v_venue.rental_cost * p_duration_hours, 2) + 20;
    ELSE
      v_host_total := 20;
    END IF;
    v_share := 0;
  ELSIF v_venue.rental_cost IS NOT NULL AND v_venue.rental_cost >= 0 THEN
    v_share := round((v_venue.rental_cost * p_duration_hours) / p_min_players, 2) + 20;
  ELSE
    v_share := 20;
  END IF;

  IF p_gender IS NULL OR p_gender NOT IN ('male', 'female', 'mixed') THEN
    RAISE EXCEPTION 'Invalid gender criteria';
  END IF;
  IF (p_min_age IS NOT NULL AND (p_min_age < 0 OR p_min_age > 120))
     OR (p_max_age IS NOT NULL AND (p_max_age < 0 OR p_max_age > 120)) THEN
    RAISE EXCEPTION 'Invalid age range';
  END IF;
  IF p_min_age IS NOT NULL AND p_max_age IS NOT NULL AND p_min_age > p_max_age THEN
    RAISE EXCEPTION 'Invalid age range';
  END IF;

  SELECT name, username INTO v_name, v_username FROM public.profiles WHERE id = v_member;
  v_name := public.player_display_name(
    (SELECT p FROM public.profiles p WHERE p.id = v_member)
  );

  IF p_is_public = FALSE THEN
    v_code := upper(btrim(COALESCE(p_invite_code, '')));
    IF v_code = '' THEN
      LOOP
        v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.friendly_games WHERE invite_code = v_code
        );
      END LOOP;
    END IF;
    IF v_code !~ '^[A-Z0-9]{4,16}$' THEN
      RAISE EXCEPTION 'Invalid invite code';
    END IF;
  END IF;

  INSERT INTO public.friendly_games
    (creator_id, creator_name, creator_username, creator_nickname, sport, title, description, area, location, lat, lng,
     playground_id, court_number, game_date, start_time, max_players, min_players, duration_hours, playground_hourly_rate, share_price, skill_level, is_public,
     recurrence, invite_code, gender, min_age, max_age, host_pays, host_total)
  VALUES
    (v_member,
     v_name,
     v_username,
     NULLIF(btrim(COALESCE((SELECT nickname FROM public.profiles WHERE id = v_member), '')), ''),
     btrim(p_sport),
     btrim(p_title),
     NULLIF(btrim(COALESCE(p_description, '')), ''),
     COALESCE(NULLIF(btrim(COALESCE(p_area, '')), ''), v_venue.area),
     COALESCE(NULLIF(btrim(COALESCE(p_location, '')), ''), v_venue.name),
     CASE WHEN v_venue.lat IS NOT NULL THEN v_venue.lat
          WHEN p_lat BETWEEN -90 AND 90 THEN p_lat ELSE NULL END,
     CASE WHEN v_venue.lng IS NOT NULL THEN v_venue.lng
          WHEN p_lng BETWEEN -180 AND 180 THEN p_lng ELSE NULL END,
     p_playground_id,
     v_court,
     p_game_date,
     p_start_time,
     p_max_players,
     p_min_players,
     p_duration_hours,
     CASE WHEN v_venue.rental_cost >= 0 THEN v_venue.rental_cost ELSE NULL END,
     v_share,
     CASE WHEN p_skill_level IN ('beginner', 'intermediate', 'advanced')
          THEN p_skill_level ELSE NULL END,
     COALESCE(p_is_public, TRUE),
     CASE WHEN p_recurrence IN ('weekly') THEN p_recurrence ELSE NULL END,
     v_code,
     p_gender,
     p_min_age,
     p_max_age,
     p_host_pays,
     CASE WHEN p_host_pays THEN v_host_total ELSE NULL END)
  RETURNING id INTO v_game;

  INSERT INTO public.friendly_game_participants
    (game_id, member_id, role, player_name, share_amount, pay_status)
  VALUES (v_game, v_member, 'organizer', v_name,
          CASE WHEN p_host_pays THEN v_host_total ELSE v_share END,
          'unpaid');

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT
    p.id,
    'game_alert',
    'New ' || btrim(p_sport) || ' game',
    btrim(p_title),
    '/games'
  FROM public.profiles p
  WHERE p.id <> v_member
    AND p.notify_game_alerts = TRUE
    AND p.interested_sports @> ARRAY[btrim(p_sport)]
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE b.blocker_id = p.id AND b.blocked_id = v_member
    )
  LIMIT 100;

  RETURN v_game;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_friendly_game(
  TEXT, TEXT, DATE, TIME, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION,
  INTEGER, TEXT, TEXT, BOOLEAN, TEXT, TEXT, INTEGER, INTEGER, TEXT, INTEGER, NUMERIC, BOOLEAN
) TO authenticated;

-- Recurring children keep the parent's court each week.
DROP FUNCTION IF EXISTS public.materialize_recurring_games();
CREATE OR REPLACE FUNCTION public.materialize_recurring_games()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent    public.friendly_games%ROWTYPE;
  v_dt        DATE;
  v_new_id    UUID;
  v_anchor    UUID;
  v_created   INTEGER := 0;
  v_horizon   DATE := CURRENT_DATE + 56;
BEGIN
  FOR v_parent IN
    SELECT fg.* FROM public.friendly_games fg
    WHERE fg.recurrence = 'weekly'
      AND fg.source_game_id IS NULL
      AND fg.status IN ('open', 'full')
  LOOP
    v_dt := v_parent.game_date + 1;
    IF v_dt < CURRENT_DATE THEN v_dt := CURRENT_DATE; END IF;
    WHILE v_dt <= v_horizon LOOP
      IF date_part('isodow', v_dt) = date_part('isodow', v_parent.game_date)
         AND NOT EXISTS (
           SELECT 1 FROM public.friendly_games f
           WHERE f.source_game_id = v_parent.id AND f.game_date = v_dt
         )
      THEN
        INSERT INTO public.friendly_games
          (creator_id, creator_name, creator_nickname, sport, title, description, area, location,
           lat, lng, game_date, start_time, max_players, skill_level, is_public,
           status, source_game_id, recurrence, playground_id, court_number, min_players, duration_hours, playground_hourly_rate,
           share_price, host_pays, host_total)
        VALUES
          (v_parent.creator_id, v_parent.creator_name, v_parent.creator_nickname, v_parent.sport,
           v_parent.title, v_parent.description, v_parent.area, v_parent.location,
           v_parent.lat, v_parent.lng, v_dt, v_parent.start_time,
           v_parent.max_players, v_parent.skill_level, v_parent.is_public,
           'open', v_parent.id, 'weekly', v_parent.playground_id, v_parent.court_number, v_parent.min_players, v_parent.duration_hours, v_parent.playground_hourly_rate,
           v_parent.share_price, v_parent.host_pays, v_parent.host_total)
        RETURNING id INTO v_new_id;

        SELECT f2.id INTO v_anchor
        FROM public.friendly_games f2
        WHERE (f2.source_game_id = v_parent.id OR f2.id = v_parent.id)
          AND f2.game_date < v_dt AND f2.status <> 'cancelled'
        ORDER BY f2.game_date DESC, f2.id DESC LIMIT 1;
        IF v_anchor IS NOT NULL THEN
          INSERT INTO public.friendly_game_participants (game_id, member_id, role, player_name)
          SELECT v_new_id, member_id, role, player_name
          FROM public.friendly_game_participants
          WHERE game_id = v_anchor
          ON CONFLICT DO NOTHING;
        END IF;

        IF v_parent.host_pays THEN
          UPDATE public.friendly_game_participants
          SET share_amount = v_parent.host_total, pay_status = 'unpaid'
          WHERE game_id = v_new_id AND role = 'organizer';
        END IF;

        v_created := v_created + 1;
      END IF;
      v_dt := v_dt + 1;
    END LOOP;
  END LOOP;
  RETURN v_created;
END;
$$;
GRANT EXECUTE ON FUNCTION public.materialize_recurring_games() TO authenticated;

NOTIFY pgrst, 'reload schema';