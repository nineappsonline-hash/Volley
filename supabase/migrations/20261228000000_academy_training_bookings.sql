-- Paid trials and 30-day academy memberships. Payment instructions/receipts use
-- the same InstaPay/e-wallet flow as games; approval is always server controlled.
-- SQL-editor installs may not have run the owner-blocked-dates migration.
-- Preserve existing blocks while supplying the prerequisite for older databases.
ALTER TABLE public.venues
 ADD COLUMN IF NOT EXISTS blocked_dates jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE public.academy_training_programs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE RESTRICT,
 sport_id uuid NOT NULL REFERENCES public.sports(id) ON DELETE RESTRICT,
 venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 100),
 monthly_sessions integer NOT NULL CHECK(monthly_sessions BETWEEN 1 AND 100),
 monthly_price numeric(10,2) NOT NULL CHECK(monthly_price >= 0 AND monthly_price < 100000000),
 trial_price numeric(10,2) NOT NULL CHECK(trial_price >= 0 AND trial_price < 100000000),
 capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 500),
 schedule jsonb NOT NULL CHECK(jsonb_typeof(schedule) = 'array'),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academy_training_programs_academy ON public.academy_training_programs(academy_id);
CREATE INDEX academy_training_programs_sport ON public.academy_training_programs(sport_id);
CREATE INDEX academy_training_programs_venue ON public.academy_training_programs(venue_id);
CREATE TABLE public.academy_training_bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 program_id uuid NOT NULL REFERENCES public.academy_training_programs(id) ON DELETE RESTRICT,
 member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('monthly','trial')),
 registered_on date NOT NULL,
 expires_on date NOT NULL,
 amount numeric(10,2) NOT NULL,
 details jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('awaiting_payment','submitted','approved','rejected','cancelled')),
 hold_until timestamptz NOT NULL DEFAULT now() + interval '24 hours',
 pay_method text CHECK(pay_method IN ('instapay','e_wallet')),
 receipt_path text,
 review_note text,
 reviewed_by uuid,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academy_training_bookings_member ON public.academy_training_bookings(member_id, created_at DESC);
CREATE INDEX academy_training_bookings_program ON public.academy_training_bookings(program_id, status);
CREATE TABLE public.academy_training_booking_sessions (
 booking_id uuid NOT NULL REFERENCES public.academy_training_bookings(id) ON DELETE CASCADE,
 program_id uuid NOT NULL REFERENCES public.academy_training_programs(id),
 session_date date NOT NULL,
 starts_at time NOT NULL,
 ends_at time NOT NULL,
 court_number integer NOT NULL CHECK(court_number > 0),
 PRIMARY KEY(booking_id, session_date, starts_at)
);
CREATE INDEX academy_training_session_capacity ON public.academy_training_booking_sessions(program_id, session_date, starts_at);
ALTER TABLE public.academy_training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_training_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_training_booking_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_training_programs, public.academy_training_bookings, public.academy_training_booking_sessions FROM anon, authenticated;
GRANT SELECT ON public.academy_training_bookings, public.academy_training_booking_sessions TO authenticated;
CREATE POLICY training_booking_read ON public.academy_training_bookings FOR SELECT TO authenticated USING (member_id = (SELECT auth.uid()) OR (SELECT public.is_super_admin()));
CREATE POLICY training_booking_session_read ON public.academy_training_booking_sessions FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.academy_training_bookings b WHERE b.id = booking_id));

CREATE FUNCTION public.admin_create_training_academy(p_details jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE aid uuid := gen_random_uuid();
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_details->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Academy name is required'; END IF;
 INSERT INTO public.academies(id,name,slug,description,country,governorate,area,is_public,is_trial)
 VALUES(aid,btrim(p_details->>'name'),'academy-'||aid::text,p_details->>'description',p_details->>'country',p_details->>'governorate',p_details->>'area',true,false);
 RETURN aid;
END $$;

CREATE FUNCTION public.admin_save_training_program(p_details jsonb, p_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE aid uuid := (p_details->>'academy_id')::uuid; sid uuid; pid uuid; slot jsonb; existing public.academy_training_programs%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO existing FROM public.academy_training_programs WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Program not found'; END IF;
  IF p_details ? 'active' AND (SELECT count(*) FROM jsonb_object_keys(p_details)) = 1 THEN
   UPDATE public.academy_training_programs SET active=(p_details->>'active')::boolean WHERE id=p_id; RETURN p_id;
  END IF;
  IF EXISTS(SELECT 1 FROM public.academy_training_bookings WHERE program_id=p_id) THEN RAISE EXCEPTION 'This program has bookings. Pause it and create a new program to change its terms'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.academies WHERE id=aid) THEN RAISE EXCEPTION 'Academy not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.venues WHERE id=(p_details->>'venue_id')::uuid AND approval_status='approved') THEN RAISE EXCEPTION 'Choose an approved playground'; END IF;
 IF nullif(btrim(p_details->>'sport'),'') IS NULL OR length(p_details->>'sport')>100 THEN RAISE EXCEPTION 'Sport is required'; END IF;
 -- Serialize sport creation for this academy.
 PERFORM 1 FROM public.academies WHERE id=aid FOR UPDATE;
 SELECT id INTO sid FROM public.sports WHERE academy_id=aid AND lower(name)=lower(btrim(p_details->>'sport')) LIMIT 1;
 IF sid IS NULL THEN INSERT INTO public.sports(academy_id,name) VALUES(aid,btrim(p_details->>'sport')) RETURNING id INTO sid; END IF;
 IF jsonb_typeof(p_details->'schedule') IS DISTINCT FROM 'array' OR jsonb_array_length(p_details->'schedule') NOT BETWEEN 1 AND 14 THEN RAISE EXCEPTION 'Add 1 to 14 weekly session times'; END IF;
 FOR slot IN SELECT value FROM jsonb_array_elements(p_details->'schedule') LOOP
  IF coalesce(slot->>'weekday','') !~ '^[0-6]$' OR coalesce(slot->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(slot->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Invalid session day or time'; END IF;
  IF (slot->>'start')::time >= (slot->>'end')::time THEN RAISE EXCEPTION 'Session end must be after start'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_details->'schedule') other WHERE other->>'weekday'=slot->>'weekday' AND (other->>'start')::time < (slot->>'end')::time AND (other->>'end')::time > (slot->>'start')::time)>1 THEN RAISE EXCEPTION 'Weekly sessions overlap'; END IF;
 END LOOP;
 INSERT INTO public.academy_training_programs(id,academy_id,sport_id,venue_id,name,monthly_sessions,monthly_price,trial_price,capacity,schedule)
 VALUES(coalesce(p_id,gen_random_uuid()),aid,sid,(p_details->>'venue_id')::uuid,p_details->>'name',(p_details->>'monthly_sessions')::integer,(p_details->>'monthly_price')::numeric,(p_details->>'trial_price')::numeric,(p_details->>'capacity')::integer,p_details->'schedule')
 ON CONFLICT(id) DO UPDATE SET academy_id=excluded.academy_id,sport_id=excluded.sport_id,venue_id=excluded.venue_id,name=excluded.name,monthly_sessions=excluded.monthly_sessions,monthly_price=excluded.monthly_price,trial_price=excluded.trial_price,capacity=excluded.capacity,schedule=excluded.schedule
 RETURNING id INTO pid;
 RETURN pid;
END $$;

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
      -- Owner-blocked dates: whole-day entries block any time; window entries
      -- only the stated range. Malformed or reversed ranges are ignored.
      SELECT NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          (SELECT COALESCE(blocked_dates, '[]'::jsonb) FROM public.venues WHERE id = p_venue_id)
        ) blk
        WHERE blk ->> 'date' = to_char(p_date, 'YYYY-MM-DD')
          AND (
            blk ->> 'all_day' = 'true'
            OR (
              (blk ->> 'start') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
              AND (blk ->> 'end') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
              AND (blk ->> 'start') < (blk ->> 'end')
              AND public.minutes_of_day((blk ->> 'start')::time) < v_end
              AND v_start < public.minutes_of_day((blk ->> 'end')::time)
            )
          )
      ) INTO v_free;
    END IF;
    IF v_free THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM public.academy_training_booking_sessions bs
        JOIN public.academy_training_bookings b ON b.id=bs.booking_id
        JOIN public.academy_training_programs p ON p.id=bs.program_id
        WHERE p.venue_id=p_venue_id AND bs.session_date=p_date AND bs.court_number=v_court
          AND public.minutes_of_day(bs.starts_at)<v_end AND v_start<public.minutes_of_day(bs.ends_at)
          AND (b.status IN ('submitted','approved') OR (b.status='awaiting_payment' AND b.hold_until>now()))
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


-- Only anonymous capacity counts are exposed; names and receipts stay private.
CREATE FUNCTION public.training_program_slots(p_id uuid) RETURNS TABLE(session_date date, starts_at time, ends_at time, seats_left bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 SELECT d::date,(s->>'start')::time,(s->>'end')::time,
 CASE WHEN
  (jsonb_array_length(coalesce(v.working_hours,'[]'::jsonb))=0 OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(v.working_hours) wh WHERE wh->>'weekday'=extract(dow FROM d)::integer::text
    AND wh->>'start'<=s->>'start' AND wh->>'end'>=s->>'end'
  )) AND NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(coalesce(v.unavailable_slots,'[]'::jsonb)) blk
   WHERE blk->>'weekday'=extract(dow FROM d)::integer::text
    AND (blk->>'all_day'='true' OR (blk->>'start'<s->>'end' AND blk->>'end'>s->>'start'))
  ) AND NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(coalesce(v.blocked_dates,'[]'::jsonb)) blk
   WHERE blk->>'date'=to_char(d,'YYYY-MM-DD')
    AND (blk->>'all_day'='true' OR (blk->>'start'<s->>'end' AND blk->>'end'>s->>'start'))
  ) AND (
   EXISTS(SELECT 1 FROM public.academy_training_booking_sessions bs JOIN public.academy_training_bookings b ON b.id=bs.booking_id
    WHERE bs.program_id=p.id AND bs.session_date=d::date AND bs.starts_at=(s->>'start')::time
     AND (b.status IN ('submitted','approved') OR (b.status='awaiting_payment' AND b.hold_until>now())))
   OR public.pick_free_court(p.venue_id,d::date,(s->>'start')::time,(extract(epoch FROM ((s->>'end')::time-(s->>'start')::time))/60)::integer) IS NOT NULL
  ) THEN greatest(0,p.capacity-(SELECT count(*) FROM public.academy_training_booking_sessions bs JOIN public.academy_training_bookings b ON b.id=bs.booking_id
 WHERE bs.program_id=p.id AND bs.session_date=d::date AND bs.starts_at=(s->>'start')::time AND (b.status IN ('submitted','approved') OR (b.status='awaiting_payment' AND b.hold_until>now())))) ELSE 0 END
 FROM public.academy_training_programs p JOIN public.academies a ON a.id=p.academy_id JOIN public.venues v ON v.id=p.venue_id,
 generate_series((now() AT TIME ZONE 'Africa/Cairo')::date::timestamp, ((now() AT TIME ZONE 'Africa/Cairo')::date+29)::timestamp, interval '1 day') d,
 jsonb_array_elements(p.schedule) s
 WHERE p.id=p_id AND ((p.active AND a.is_public AND v.approval_status='approved') OR public.is_super_admin())
 AND extract(dow FROM d)::integer=(s->>'weekday')::integer
 AND (d::date+(s->>'start')::time) AT TIME ZONE 'Africa/Cairo'>now()
 ORDER BY d,(s->>'start')::time;
$$;
CREATE FUNCTION public.academy_training_catalog(p_academy_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.name),'[]'::jsonb) FROM (
 SELECT p.*, a.name academy_name,a.slug academy_slug,s.name sport,v.name venue_name,v.address venue_address,
 coalesce((SELECT jsonb_agg(to_jsonb(sl)) FROM public.training_program_slots(p.id) sl),'[]'::jsonb) slots
 FROM public.academy_training_programs p JOIN public.academies a ON a.id=p.academy_id JOIN public.sports s ON s.id=p.sport_id JOIN public.venues v ON v.id=p.venue_id
 WHERE (p_academy_id IS NULL OR p.academy_id=p_academy_id) AND ((p.active AND a.is_public AND v.approval_status='approved') OR public.is_super_admin())
 ) x;
$$;

CREATE FUNCTION public.reserve_academy_training(p_program_id uuid,p_kind text,p_trial_date date DEFAULT NULL,p_trial_time time DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.academy_training_programs%ROWTYPE; bid uuid; today date := (now() AT TIME ZONE 'Africa/Cairo')::date; slots jsonb; price numeric; info jsonb; slot jsonb; court integer;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='member' AND is_active) THEN RAISE EXCEPTION 'An active member account is required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.academy_training_programs WHERE id=p_program_id FOR UPDATE;
 IF NOT FOUND OR NOT p.active OR NOT EXISTS(SELECT 1 FROM public.academies WHERE id=p.academy_id AND is_public) OR NOT EXISTS(SELECT 1 FROM public.venues WHERE id=p.venue_id AND approval_status='approved') THEN RAISE EXCEPTION 'This program is not available'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('monthly','trial') THEN RAISE EXCEPTION 'Choose monthly or trial'; END IF;
 IF EXISTS(SELECT 1 FROM public.academy_training_bookings b WHERE b.program_id=p.id AND b.member_id=auth.uid() AND b.expires_on>today AND (b.status IN ('submitted','approved') OR (b.status='awaiting_payment' AND b.hold_until>now())) AND (b.kind='monthly' OR p_kind='monthly' OR EXISTS(SELECT 1 FROM public.academy_training_booking_sessions bs WHERE bs.booking_id=b.id AND bs.session_date=p_trial_date AND bs.starts_at=p_trial_time))) THEN RAISE EXCEPTION 'You already have an overlapping booking. Use your existing booking'; END IF;
 PERFORM 1 FROM public.venues WHERE id=p.venue_id FOR UPDATE;
 SELECT jsonb_agg(to_jsonb(q)) INTO slots FROM (SELECT * FROM public.training_program_slots(p.id) WHERE seats_left>0 AND (p_kind='monthly' OR (session_date=p_trial_date AND starts_at=p_trial_time)) ORDER BY session_date,starts_at LIMIT CASE WHEN p_kind='monthly' THEN p.monthly_sessions ELSE 1 END) q;
 IF coalesce(jsonb_array_length(slots),0) <> (CASE WHEN p_kind='monthly' THEN p.monthly_sessions ELSE 1 END) THEN RAISE EXCEPTION 'Not enough available sessions within the next 30 days'; END IF;
 price := CASE WHEN p_kind='monthly' THEN p.monthly_price ELSE p.trial_price END;
 SELECT jsonb_build_object('program',p.name,'academy',a.name,'academy_slug',a.slug,'sport',s.name,'playground',v.name,'address',v.address,'member',pr.name,'sessions',slots) INTO info FROM public.academies a,public.sports s,public.venues v,public.profiles pr WHERE a.id=p.academy_id AND s.id=p.sport_id AND v.id=p.venue_id AND pr.id=auth.uid();
 INSERT INTO public.academy_training_bookings(program_id,member_id,kind,registered_on,expires_on,amount,details,status,hold_until)
 VALUES(p.id,auth.uid(),p_kind,today,CASE WHEN p_kind='monthly' THEN today+30 ELSE p_trial_date+1 END,price,info,CASE WHEN price=0 THEN 'approved' ELSE 'awaiting_payment' END,least(now()+interval '24 hours', ((slots->0->>'session_date')::date+(slots->0->>'starts_at')::time) AT TIME ZONE 'Africa/Cairo')) RETURNING id INTO bid;
 FOR slot IN SELECT value FROM jsonb_array_elements(slots) LOOP
  SELECT bs.court_number INTO court FROM public.academy_training_booking_sessions bs JOIN public.academy_training_bookings b ON b.id=bs.booking_id
  WHERE bs.program_id=p.id AND bs.session_date=(slot->>'session_date')::date AND bs.starts_at=(slot->>'starts_at')::time
   AND (b.status IN ('submitted','approved') OR (b.status='awaiting_payment' AND b.hold_until>now())) LIMIT 1;
  IF court IS NULL THEN
   court := public.pick_free_court(p.venue_id,(slot->>'session_date')::date,(slot->>'starts_at')::time,
     (extract(epoch FROM ((slot->>'ends_at')::time-(slot->>'starts_at')::time))/60)::integer);
  END IF;
  IF court IS NULL THEN RAISE EXCEPTION 'The playground is unavailable for one of these sessions. Choose another program or trial time'; END IF;
  INSERT INTO public.academy_training_booking_sessions(booking_id,program_id,session_date,starts_at,ends_at,court_number)
  VALUES(bid,p.id,(slot->>'session_date')::date,(slot->>'starts_at')::time,(slot->>'ends_at')::time,court);
 END LOOP;
 RETURN bid;
END $$;

CREATE FUNCTION public.manage_academy_training_payment(p_booking_id uuid,p_action text,p_method text DEFAULT NULL,p_receipt text DEFAULT NULL,p_note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.academy_training_bookings%ROWTYPE; pid uuid;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT program_id INTO pid FROM public.academy_training_bookings WHERE id=p_booking_id;
 PERFORM 1 FROM public.academy_training_programs WHERE id=pid FOR UPDATE;
 SELECT * INTO b FROM public.academy_training_bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
 IF p_action IN ('approve','reject') THEN
  IF public.is_super_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Only super admins can review payments' USING ERRCODE='42501'; END IF;
  IF b.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted payments can be reviewed'; END IF;
  UPDATE public.academy_training_bookings SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,review_note=nullif(btrim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now() WHERE id=b.id;
 ELSE
  IF b.member_id<>auth.uid() THEN RAISE EXCEPTION 'Not your booking' USING ERRCODE='42501'; END IF;
  IF b.status<>'awaiting_payment' THEN RAISE EXCEPTION 'This booking cannot be changed'; END IF;
  IF p_action='cancel' THEN UPDATE public.academy_training_bookings SET status='cancelled' WHERE id=b.id;
  ELSIF p_action='submit' THEN
   IF b.hold_until<=now() OR b.expires_on<=(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Reservation expired. Book again before paying'; END IF;
   IF p_method IS NULL OR p_method NOT IN ('instapay','e_wallet') OR p_receipt IS NULL OR split_part(p_receipt,'/',1)<>auth.uid()::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='game-fee-receipts' AND name=p_receipt) THEN RAISE EXCEPTION 'Choose an existing payment method and upload your receipt'; END IF;
   IF EXISTS(SELECT 1 FROM public.academy_training_bookings WHERE receipt_path=p_receipt AND id<>b.id) THEN RAISE EXCEPTION 'This receipt is already used for another academy booking'; END IF;
   UPDATE public.academy_training_bookings SET status='submitted',pay_method=p_method,receipt_path=p_receipt WHERE id=b.id;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;
 END IF;
END $$;
CREATE UNIQUE INDEX academy_training_receipt_unique ON public.academy_training_bookings(receipt_path) WHERE receipt_path IS NOT NULL;
REVOKE ALL ON FUNCTION public.admin_create_training_academy(jsonb),public.admin_save_training_program(jsonb,uuid),public.reserve_academy_training(uuid,text,date,time),public.manage_academy_training_payment(uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_create_training_academy(jsonb),public.admin_save_training_program(jsonb,uuid),public.reserve_academy_training(uuid,text,date,time),public.manage_academy_training_payment(uuid,text,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.training_program_slots(uuid),public.academy_training_catalog(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.training_program_slots(uuid),public.academy_training_catalog(uuid) TO anon,authenticated;
NOTIFY pgrst, 'reload schema';


-- Recheck academy occupancy under the same venue lock even when a game/rental
-- chose its court before a concurrent academy reservation committed.
CREATE FUNCTION public.guard_academy_court_reservations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid; d date; t time; duration numeric; court integer;
BEGIN
 IF TG_TABLE_NAME='friendly_games' THEN
  IF NEW.status='cancelled' THEN RETURN NEW; END IF;
  v:=NEW.playground_id; d:=NEW.game_date; t:=NEW.start_time; duration:=coalesce(NEW.duration_hours,1); court:=coalesce(NEW.court_number,1);
 ELSE
  v:=NEW.venue_id; d:=NEW.rental_date; t:=NEW.start_time; duration:=NEW.hours; court:=coalesce(NEW.court_number,1);
 END IF;
 IF v IS NULL THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.venues WHERE id=v FOR UPDATE;
 IF EXISTS (
  SELECT 1 FROM public.academy_training_booking_sessions bs
  JOIN public.academy_training_bookings b ON b.id=bs.booking_id
  JOIN public.academy_training_programs p ON p.id=bs.program_id
  WHERE p.venue_id=v AND bs.session_date=d AND bs.court_number=court
   AND public.minutes_of_day(bs.starts_at)<public.minutes_of_day(t)+duration*60
   AND public.minutes_of_day(t)<public.minutes_of_day(bs.ends_at)
   AND (b.status IN ('submitted','approved') OR (b.status='awaiting_payment' AND b.hold_until>now()))
 ) THEN RAISE EXCEPTION 'This court is reserved for an academy training session'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER academy_court_guard_games BEFORE INSERT OR UPDATE OF playground_id,game_date,start_time,duration_hours,court_number,status ON public.friendly_games FOR EACH ROW EXECUTE FUNCTION public.guard_academy_court_reservations();
CREATE TRIGGER academy_court_guard_rentals BEFORE INSERT OR UPDATE OF venue_id,rental_date,start_time,hours,court_number ON public.venue_rentals FOR EACH ROW EXECUTE FUNCTION public.guard_academy_court_reservations();
NOTIFY pgrst, 'reload schema';
