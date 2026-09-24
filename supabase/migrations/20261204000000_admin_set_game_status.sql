-- Super admins can now set a game's status explicitly (open/full/completed/
-- cancelled). The auto status recompute only applies when no status was sent.

CREATE OR REPLACE FUNCTION public.admin_update_friendly_game(p_game_id UUID, p_changes JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.friendly_games%ROWTYPE;
  v_new public.friendly_games%ROWTYPE;
  v_count INTEGER;
  v_courts INTEGER;
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only a super admin can edit game settings' USING ERRCODE = '42501';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' THEN
    RAISE EXCEPTION 'Game settings must be an object';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) AS k(key)
    WHERE NOT (key = ANY(ARRAY['title','description','sport','game_date','start_time','duration_hours','min_players','max_players','playground_id','court_number','area','location','lat','lng','skill_level','gender','min_age','max_age','is_public','recurrence','playground_hourly_rate','share_price','host_pays','host_total','status']))) THEN
    RAISE EXCEPTION 'Unsupported game setting';
  END IF;
  SELECT * INTO v_old FROM public.friendly_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  SELECT * INTO v_new FROM jsonb_populate_record(v_old, p_changes);
  IF COALESCE(btrim(v_new.title), '') = '' OR COALESCE(btrim(v_new.sport), '') = '' THEN
    RAISE EXCEPTION 'Title and sport are required';
  END IF;
  IF v_new.game_date IS NULL OR v_new.start_time IS NULL THEN RAISE EXCEPTION 'Date and time are required'; END IF;
  IF v_new.min_players IS NULL OR v_new.max_players IS NULL OR v_new.min_players < 2 OR v_new.max_players < v_new.min_players THEN
    RAISE EXCEPTION 'Minimum players must be at least 2 and no greater than maximum players';
  END IF;
  IF v_new.duration_hours IS NULL OR v_new.duration_hours <= 0 OR v_new.duration_hours > 24
     OR public.minutes_of_day(v_new.start_time) + v_new.duration_hours * 60 > 1440 THEN
    RAISE EXCEPTION 'Game duration must be positive and end by midnight';
  END IF;
  IF v_new.is_public IS NULL OR v_new.host_pays IS NULL THEN RAISE EXCEPTION 'Visibility and payment mode are required'; END IF;
  IF v_new.gender IS NULL OR v_new.gender NOT IN ('male','female','mixed')
     OR (v_new.skill_level IS NOT NULL AND v_new.skill_level NOT IN ('beginner','intermediate','advanced'))
     OR (v_new.recurrence IS NOT NULL AND v_new.recurrence <> 'weekly') THEN RAISE EXCEPTION 'Invalid game criteria'; END IF;
  IF v_new.min_age < 0 OR v_new.max_age > 120 OR v_new.min_age > 120 OR v_new.max_age < 0 OR v_new.min_age > v_new.max_age THEN
    RAISE EXCEPTION 'Invalid age range';
  END IF;
  IF v_new.lat NOT BETWEEN -90 AND 90 OR v_new.lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Invalid coordinates'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(ARRAY[v_new.playground_hourly_rate, v_new.share_price, v_new.host_total]) AS x(value)
    WHERE value < 0 OR value::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Prices must be finite and nonnegative'; END IF;
  IF v_new.host_pays AND COALESCE(v_new.share_price, 0) <> 0 THEN RAISE EXCEPTION 'Host-paid games must have a zero player share'; END IF;
  IF p_changes ? 'status' AND (v_new.status IS NULL OR v_new.status NOT IN ('open','full','completed','cancelled')) THEN
    RAISE EXCEPTION 'Invalid game status';
  END IF;
  SELECT count(*) INTO v_count FROM public.friendly_game_participants WHERE game_id = p_game_id AND NOT is_waitlisted;
  IF v_new.max_players < v_count THEN RAISE EXCEPTION 'Maximum players cannot be below the current participant count'; END IF;

  IF v_new.playground_id IS NULL THEN
    v_new.court_number := NULL;
  ELSIF (v_new.playground_id, v_new.court_number, v_new.game_date, v_new.start_time, v_new.duration_hours)
     IS DISTINCT FROM (v_old.playground_id, v_old.court_number, v_old.game_date, v_old.start_time, v_old.duration_hours) THEN
    SELECT court_count INTO v_courts FROM public.venues WHERE id = v_new.playground_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Playground not found'; END IF;
    IF v_new.court_number IS NULL THEN
      v_new.court_number := public.pick_free_court(v_new.playground_id, v_new.game_date, v_new.start_time, ceil(v_new.duration_hours * 60)::integer, NULL, p_game_id);
    END IF;
    IF v_new.court_number IS NULL OR v_new.court_number < 1 OR v_new.court_number > v_courts THEN RAISE EXCEPTION 'No valid court available'; END IF;
    IF v_old.status IN ('open','full') AND (
      EXISTS (SELECT 1 FROM public.friendly_games g WHERE g.id <> p_game_id AND g.playground_id = v_new.playground_id
        AND g.game_date = v_new.game_date AND g.status <> 'cancelled' AND COALESCE(g.court_number,1) = v_new.court_number
        AND public.minutes_of_day(g.start_time) < public.minutes_of_day(v_new.start_time) + v_new.duration_hours*60
        AND public.minutes_of_day(v_new.start_time) < public.minutes_of_day(g.start_time) + g.duration_hours*60)
      OR EXISTS (SELECT 1 FROM public.venue_rentals r WHERE r.venue_id = v_new.playground_id AND r.rental_date = v_new.game_date
        AND COALESCE(r.court_number,1) = v_new.court_number
        AND public.minutes_of_day(r.start_time) < public.minutes_of_day(v_new.start_time) + v_new.duration_hours*60
        AND public.minutes_of_day(v_new.start_time) < public.minutes_of_day(r.start_time) + r.hours*60)
    ) THEN RAISE EXCEPTION 'This court is already booked for the selected time'; END IF;
  END IF;
  UPDATE public.friendly_games SET
    title = v_new.title,
    description = v_new.description,
    sport = v_new.sport,
    game_date = v_new.game_date,
    start_time = v_new.start_time,
    duration_hours = v_new.duration_hours,
    min_players = v_new.min_players,
    max_players = v_new.max_players,
    playground_id = v_new.playground_id,
    court_number = v_new.court_number,
    area = v_new.area,
    location = v_new.location,
    lat = v_new.lat,
    lng = v_new.lng,
    skill_level = v_new.skill_level,
    gender = v_new.gender,
    min_age = v_new.min_age,
    max_age = v_new.max_age,
    is_public = v_new.is_public,
    recurrence = v_new.recurrence,
    playground_hourly_rate = v_new.playground_hourly_rate,
    share_price = v_new.share_price,
    host_pays = v_new.host_pays,
    host_total = v_new.host_total,
    status = CASE WHEN p_changes ? 'status' THEN v_new.status
                  WHEN v_old.status IN ('open','full') THEN CASE WHEN v_count >= v_new.max_players THEN 'full' ELSE 'open' END
                  ELSE v_old.status END
  WHERE id = p_game_id;
  INSERT INTO public.notifications(recipient_id, type, title, body, link)
  SELECT DISTINCT member_id, 'game_updated', 'Game details updated', v_new.title || ': the game settings have changed. Please check the latest details.',
    '/games?join=' || v_old.invite_code
  FROM public.friendly_game_participants WHERE game_id = p_game_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_friendly_game(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_friendly_game(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';