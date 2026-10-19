-- Repair existing owner scheduling. No historical sessions are removed or rewritten.
ALTER TABLE public.training_sessions ALTER COLUMN academy_id SET DEFAULT public.current_academy_id();
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS recurring_schedule_id uuid REFERENCES public.recurring_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurring_occurrence_date date,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 1 AND 1440),
  ADD COLUMN IF NOT EXISTS court_number integer CHECK (court_number > 0);
CREATE UNIQUE INDEX IF NOT EXISTS training_recurring_occurrence ON public.training_sessions(recurring_schedule_id,recurring_occurrence_date);
ALTER TABLE public.recurring_schedules ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 1 AND 1440);

-- Old permissive policies must not allow academy members to write staff schedules.
DROP POLICY IF EXISTS "Members manage sessions" ON public.training_sessions;
DROP POLICY IF EXISTS "Members manage recurring" ON public.recurring_schedules;

CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.guard_owner_training_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE start_min integer; end_min integer; courts integer; candidate integer;
BEGIN
 IF auth.uid() IS NOT NULL AND (public.is_account_blocked() OR NOT (
   public.is_super_admin() OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin' AND p.is_active AND p.academy_id=NEW.academy_id)
 )) THEN RAISE EXCEPTION 'An active academy administrator is required' USING ERRCODE='42501'; END IF;
 IF NEW.academy_id IS NULL THEN RAISE EXCEPTION 'Academy is required'; END IF;
 IF NEW.sport_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sports WHERE id=NEW.sport_id AND academy_id=NEW.academy_id) THEN RAISE EXCEPTION 'Sport belongs to another academy'; END IF;
 IF NEW.coach_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.coaches WHERE id=NEW.coach_id AND academy_id=NEW.academy_id) THEN RAISE EXCEPTION 'Coach belongs to another academy'; END IF;
 IF NEW.recurring_schedule_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.recurring_schedules WHERE id=NEW.recurring_schedule_id AND academy_id=NEW.academy_id) THEN RAISE EXCEPTION 'Schedule belongs to another academy'; END IF;
 IF NEW.venue_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.venues WHERE id=NEW.venue_id AND approval_status='approved' AND (academy_id IS NULL OR academy_id=NEW.academy_id)) THEN RAISE EXCEPTION 'Choose an approved venue available to your academy'; END IF;
 IF NEW.status='canceled' THEN RETURN NEW; END IF;
 start_min:=public.minutes_of_day(NEW.time); end_min:=start_min+NEW.duration_minutes;
 IF end_min>1440 THEN RAISE EXCEPTION 'Session must end on the same day'; END IF;
 -- Serialize occupancy checks, including direct game/rental/training-booking writes.
 PERFORM pg_advisory_xact_lock(hashtextextended('playza-owner-training-occupancy',0));
 IF NEW.coach_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.training_sessions s WHERE s.id IS DISTINCT FROM NEW.id AND s.coach_id=NEW.coach_id AND s.date=NEW.date AND s.status<>'canceled' AND public.minutes_of_day(s.time)<end_min AND start_min<public.minutes_of_day(s.time)+s.duration_minutes) THEN RAISE EXCEPTION 'Coach already has an overlapping session'; END IF;
 IF NEW.venue_id IS NULL THEN NEW.court_number:=NULL; RETURN NEW; END IF;
 SELECT greatest(coalesce(court_count,1),1) INTO courts FROM public.venues WHERE id=NEW.venue_id;
 IF NEW.court_number IS NOT NULL AND NEW.court_number>courts THEN RAISE EXCEPTION 'Court number is outside venue capacity'; END IF;
 FOR candidate IN 1..courts LOOP
  IF NEW.court_number IS NOT NULL AND NEW.court_number<>candidate THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.training_sessions s WHERE s.id IS DISTINCT FROM NEW.id AND s.venue_id=NEW.venue_id AND s.date=NEW.date AND s.status<>'canceled' AND coalesce(s.court_number,1)=candidate AND public.minutes_of_day(s.time)<end_min AND start_min<public.minutes_of_day(s.time)+s.duration_minutes)
   AND NOT EXISTS(SELECT 1 FROM public.venue_rentals r WHERE r.venue_id=NEW.venue_id AND r.rental_date=NEW.date AND coalesce(r.court_number,1)=candidate AND public.minutes_of_day(r.start_time)<end_min AND start_min<public.minutes_of_day(r.start_time)+r.hours*60)
   AND NOT EXISTS(SELECT 1 FROM public.friendly_games g WHERE g.playground_id=NEW.venue_id AND g.game_date=NEW.date AND g.status<>'cancelled' AND coalesce(g.court_number,1)=candidate AND public.minutes_of_day(g.start_time)<end_min AND start_min<public.minutes_of_day(g.start_time)+coalesce(g.duration_hours,1)*60)
   AND NOT EXISTS(SELECT 1 FROM public.academy_training_booking_sessions bs JOIN public.academy_training_bookings b ON b.id=bs.booking_id JOIN public.academy_training_programs p ON p.id=bs.program_id WHERE p.venue_id=NEW.venue_id AND bs.session_date=NEW.date AND bs.court_number=candidate AND public.minutes_of_day(bs.starts_at)<end_min AND start_min<public.minutes_of_day(bs.ends_at) AND (b.status IN ('approved','submitted') OR (b.status='awaiting_payment' AND b.hold_until>now())))
  THEN NEW.court_number:=candidate; RETURN NEW; END IF;
 END LOOP;
 RAISE EXCEPTION 'No court is available for this session time';
END; $$;
REVOKE ALL ON FUNCTION private.guard_owner_training_session() FROM PUBLIC;
DROP TRIGGER IF EXISTS owner_training_session_guard ON public.training_sessions;
CREATE TRIGGER owner_training_session_guard BEFORE INSERT OR UPDATE OF academy_id,date,time,duration_minutes,court_number,venue_id,coach_id,sport_id,status,recurring_schedule_id ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION private.guard_owner_training_session();

CREATE OR REPLACE FUNCTION private.guard_owner_recurring_schedule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND (public.is_account_blocked() OR NOT (
   public.is_super_admin() OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin' AND p.is_active AND p.academy_id=NEW.academy_id)
 )) THEN RAISE EXCEPTION 'An active academy administrator is required' USING ERRCODE='42501'; END IF;
 IF NEW.academy_id IS NULL OR nullif(btrim(NEW.name),'') IS NULL THEN RAISE EXCEPTION 'Academy and schedule name are required'; END IF;
 IF NEW.end_date<NEW.start_date OR NEW.end_date-NEW.start_date>366 THEN RAISE EXCEPTION 'Choose a date range of up to one year'; END IF;
 IF public.minutes_of_day(NEW.time)+NEW.duration_minutes>1440 THEN RAISE EXCEPTION 'Session must end on the same day'; END IF;
 IF NEW.sport_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sports WHERE id=NEW.sport_id AND academy_id=NEW.academy_id) THEN RAISE EXCEPTION 'Sport belongs to another academy'; END IF;
 IF NEW.coach_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.coaches WHERE id=NEW.coach_id AND academy_id=NEW.academy_id) THEN RAISE EXCEPTION 'Coach belongs to another academy'; END IF;
 IF NEW.venue_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.venues WHERE id=NEW.venue_id AND approval_status='approved' AND (academy_id IS NULL OR academy_id=NEW.academy_id)) THEN RAISE EXCEPTION 'Choose an approved venue available to your academy'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_owner_recurring_schedule() FROM PUBLIC;
DROP TRIGGER IF EXISTS owner_recurring_schedule_guard ON public.recurring_schedules;
CREATE TRIGGER owner_recurring_schedule_guard BEFORE INSERT OR UPDATE ON public.recurring_schedules FOR EACH ROW EXECUTE FUNCTION private.guard_owner_recurring_schedule();

CREATE OR REPLACE FUNCTION public.generate_recurring_training_sessions(p_schedule_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE schedule public.recurring_schedules%ROWTYPE; created integer;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO schedule FROM public.recurring_schedules WHERE id=p_schedule_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin' AND p.is_active AND p.academy_id=schedule.academy_id) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF NOT schedule.is_active THEN RAISE EXCEPTION 'Schedule is inactive'; END IF;
 IF schedule.end_date<schedule.start_date OR schedule.end_date-schedule.start_date>366 THEN RAISE EXCEPTION 'Choose a date range of up to one year'; END IF;
 INSERT INTO public.training_sessions(academy_id,recurring_schedule_id,recurring_occurrence_date,date,time,duration_minutes,notes,sport_id,venue_id,coach_id,age_group,skill_level,status,is_completed)
 SELECT schedule.academy_id,schedule.id,d::date,d::date,schedule.time,schedule.duration_minutes,'Generated from: '||schedule.name,schedule.sport_id,schedule.venue_id,schedule.coach_id,schedule.age_group,schedule.skill_level,'scheduled',false
 FROM generate_series(schedule.start_date::timestamp,schedule.end_date::timestamp,interval '1 day') d
 WHERE extract(dow FROM d)=schedule.weekday
 AND NOT EXISTS(SELECT 1 FROM public.training_sessions s WHERE s.recurring_schedule_id=schedule.id AND s.recurring_occurrence_date=d::date)
 ON CONFLICT(recurring_schedule_id,recurring_occurrence_date) DO NOTHING;
 GET DIAGNOSTICS created=ROW_COUNT;
 RETURN created;
END; $$;
REVOKE ALL ON FUNCTION public.generate_recurring_training_sessions(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_recurring_training_sessions(uuid) TO authenticated;

-- Prevent other booking paths from taking a court already used by an owner session.
CREATE OR REPLACE FUNCTION private.guard_owner_training_court_use() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE venue uuid; day date; starts integer; ends integer; court integer;
BEGIN
 IF TG_TABLE_NAME='friendly_games' THEN
  IF NEW.status='cancelled' THEN RETURN NEW; END IF;
  venue:=NEW.playground_id; day:=NEW.game_date; starts:=public.minutes_of_day(NEW.start_time); ends:=starts+coalesce(NEW.duration_hours,1)*60; court:=coalesce(NEW.court_number,1);
 ELSIF TG_TABLE_NAME='venue_rentals' THEN
  venue:=NEW.venue_id; day:=NEW.rental_date; starts:=public.minutes_of_day(NEW.start_time); ends:=starts+NEW.hours*60; court:=coalesce(NEW.court_number,1);
 ELSE
  SELECT p.venue_id INTO venue FROM public.academy_training_programs p WHERE p.id=NEW.program_id;
  day:=NEW.session_date; starts:=public.minutes_of_day(NEW.starts_at); ends:=public.minutes_of_day(NEW.ends_at); court:=NEW.court_number;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('playza-owner-training-occupancy',0));
 IF EXISTS(SELECT 1 FROM public.training_sessions s WHERE s.venue_id=venue AND s.date=day AND s.status<>'canceled' AND coalesce(s.court_number,1)=court AND public.minutes_of_day(s.time)<ends AND starts<public.minutes_of_day(s.time)+s.duration_minutes) THEN RAISE EXCEPTION 'Court is reserved for an academy session'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_owner_training_court_use() FROM PUBLIC;
DROP TRIGGER IF EXISTS owner_session_guard_games ON public.friendly_games;
CREATE TRIGGER owner_session_guard_games BEFORE INSERT OR UPDATE OF playground_id,game_date,start_time,duration_hours,court_number,status ON public.friendly_games FOR EACH ROW EXECUTE FUNCTION private.guard_owner_training_court_use();
DROP TRIGGER IF EXISTS owner_session_guard_rentals ON public.venue_rentals;
CREATE TRIGGER owner_session_guard_rentals BEFORE INSERT OR UPDATE OF venue_id,rental_date,start_time,hours,court_number ON public.venue_rentals FOR EACH ROW EXECUTE FUNCTION private.guard_owner_training_court_use();
DROP TRIGGER IF EXISTS owner_session_guard_bookings ON public.academy_training_booking_sessions;
CREATE TRIGGER owner_session_guard_bookings BEFORE INSERT OR UPDATE ON public.academy_training_booking_sessions FOR EACH ROW EXECUTE FUNCTION private.guard_owner_training_court_use();

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
      SELECT NOT EXISTS(SELECT 1 FROM public.training_sessions s
        WHERE s.venue_id=p_venue_id AND s.date=p_date AND s.status<>'canceled'
          AND coalesce(s.court_number,1)=v_court AND public.minutes_of_day(s.time)<v_end
          AND v_start<public.minutes_of_day(s.time)+s.duration_minutes) INTO v_free;
    END IF;
    IF v_free THEN
      RETURN v_court;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pick_free_court(UUID, DATE, TIME, INTEGER, UUID, UUID) TO authenticated;



NOTIFY pgrst, 'reload schema';
