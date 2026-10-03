-- Each training program represents one named group with its own schedule.
ALTER TABLE public.academy_training_programs
 ADD COLUMN min_age integer CHECK(min_age BETWEEN 0 AND 100),
 ADD COLUMN max_age integer CHECK(max_age BETWEEN 0 AND 100),
 ADD COLUMN gender text NOT NULL DEFAULT 'mixed' CHECK(gender IN ('mixed','male','female')),
 ADD COLUMN media jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(media)='array'),
 ADD CONSTRAINT training_age_range CHECK(min_age IS NULL OR max_age IS NULL OR min_age<=max_age);

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('training-media','training-media',true,52428800,ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm'])
ON CONFLICT(id) DO NOTHING;
CREATE POLICY training_media_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='training-media' AND public.is_super_admin() AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY training_media_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='training-media');

CREATE TABLE public.training_ratings (
 program_id uuid NOT NULL REFERENCES public.academy_training_programs(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
 PRIMARY KEY(program_id,member_id)
);
ALTER TABLE public.training_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_ratings FROM anon,authenticated;
CREATE FUNCTION public.rate_training(p_program_id uuid,p_rating integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT EXISTS(
 SELECT 1 FROM public.academy_training_bookings b JOIN public.academy_training_booking_sessions s ON s.booking_id=b.id
 WHERE b.member_id=auth.uid() AND b.program_id=p_program_id AND b.status='approved'
 AND (s.session_date+s.ends_at) AT TIME ZONE 'Africa/Cairo'<now()) THEN
 RAISE EXCEPTION 'You can rate training after a confirmed session has ended'; END IF;
 INSERT INTO public.training_ratings VALUES(p_program_id,auth.uid(),p_rating)
 ON CONFLICT(program_id,member_id) DO UPDATE SET rating=excluded.rating;
END $$;
REVOKE ALL ON FUNCTION public.rate_training(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_training(uuid,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_save_training_program(p_details jsonb, p_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE aid uuid := (p_details->>'academy_id')::uuid; sid uuid; pid uuid; slot jsonb; existing public.academy_training_programs%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_details ? 'media' THEN
  IF jsonb_typeof(p_details->'media') IS DISTINCT FROM 'array' OR jsonb_array_length(p_details->'media')>12 THEN RAISE EXCEPTION 'Add at most 12 media items'; END IF;
  FOR slot IN SELECT value FROM jsonb_array_elements(p_details->'media') LOOP
   IF coalesce(slot->>'kind','') NOT IN ('image','video','youtube') OR coalesce(slot->>'url','') !~ '^https://[^[:space:]]+$' THEN RAISE EXCEPTION 'Invalid media URL'; END IF;
   IF slot->>'kind'='youtube' AND slot->>'url' !~ '^https://(www\.)?(youtube\.com/|youtu\.be/)' THEN RAISE EXCEPTION 'Invalid YouTube link'; END IF;
  END LOOP;
 END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO existing FROM public.academy_training_programs WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Program not found'; END IF;
  IF p_details ? 'active' AND (SELECT count(*) FROM jsonb_object_keys(p_details)) = 1 THEN
   UPDATE public.academy_training_programs SET active=(p_details->>'active')::boolean WHERE id=p_id; RETURN p_id;
  END IF;
  IF EXISTS(SELECT 1 FROM public.academy_training_bookings WHERE program_id=p_id) THEN
   IF existing.academy_id IS DISTINCT FROM aid OR existing.venue_id IS DISTINCT FROM (p_details->>'venue_id')::uuid
    OR existing.monthly_sessions IS DISTINCT FROM (p_details->>'monthly_sessions')::integer
    OR existing.monthly_price IS DISTINCT FROM (p_details->>'monthly_price')::numeric
    OR existing.trial_price IS DISTINCT FROM (p_details->>'trial_price')::numeric
    OR existing.capacity IS DISTINCT FROM (p_details->>'capacity')::integer
    OR existing.schedule IS DISTINCT FROM p_details->'schedule'
    OR existing.min_age IS DISTINCT FROM nullif(p_details->>'min_age','')::integer
    OR existing.max_age IS DISTINCT FROM nullif(p_details->>'max_age','')::integer
    OR existing.gender IS DISTINCT FROM coalesce(p_details->>'gender','mixed')
    OR NOT EXISTS(SELECT 1 FROM public.sports WHERE id=existing.sport_id AND name=p_details->>'sport')
   THEN RAISE EXCEPTION 'This group has bookings. Pause it and create a new group to change its terms'; END IF;
   UPDATE public.academy_training_programs SET name=p_details->>'name',media=coalesce(p_details->'media','[]'::jsonb) WHERE id=p_id;
   RETURN p_id;
  END IF;
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
 UPDATE public.academy_training_programs SET min_age=nullif(p_details->>'min_age','')::integer,max_age=nullif(p_details->>'max_age','')::integer,gender=coalesce(p_details->>'gender','mixed'),media=coalesce(p_details->'media','[]'::jsonb) WHERE id=pid;
 RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.academy_training_catalog(p_academy_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.name),'[]'::jsonb) FROM (
 SELECT p.*, a.name academy_name,a.slug academy_slug,s.name sport,v.name venue_name,v.address venue_address,v.lat venue_lat,v.lng venue_lng,v.area venue_area,v.governorate venue_governorate,
 (SELECT round(avg(r.rating),1) FROM public.training_ratings r WHERE r.program_id=p.id) rating,
 (SELECT count(*) FROM public.training_ratings r WHERE r.program_id=p.id) rating_count,
 coalesce((SELECT jsonb_agg(to_jsonb(sl)) FROM public.training_program_slots(p.id) sl),'[]'::jsonb) slots
 FROM public.academy_training_programs p JOIN public.academies a ON a.id=p.academy_id JOIN public.sports s ON s.id=p.sport_id JOIN public.venues v ON v.id=p.venue_id
 WHERE (p_academy_id IS NULL OR p.academy_id=p_academy_id) AND ((p.active AND a.is_public AND v.approval_status='approved') OR public.is_super_admin())
 ) x;
$$;

CREATE OR REPLACE FUNCTION public.reserve_academy_training(p_program_id uuid,p_kind text,p_trial_date date DEFAULT NULL,p_trial_time time DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.academy_training_programs%ROWTYPE; bid uuid; today date := (now() AT TIME ZONE 'Africa/Cairo')::date; slots jsonb; price numeric; info jsonb; slot jsonb; court integer;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='member' AND is_active) THEN RAISE EXCEPTION 'An active member account is required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.academy_training_programs WHERE id=p_program_id FOR UPDATE;
 IF NOT FOUND OR NOT p.active OR NOT EXISTS(SELECT 1 FROM public.academies WHERE id=p.academy_id AND is_public) OR NOT EXISTS(SELECT 1 FROM public.venues WHERE id=p.venue_id AND approval_status='approved') THEN RAISE EXCEPTION 'This program is not available'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=auth.uid()
 AND (p.gender='mixed' OR pr.gender=p.gender)
 AND (p.min_age IS NULL OR extract(year FROM age(today,pr.birth_date))>=p.min_age)
 AND (p.max_age IS NULL OR extract(year FROM age(today,pr.birth_date))<=p.max_age)) THEN
 RAISE EXCEPTION 'Your profile does not meet this group age or gender requirements'; END IF;
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


NOTIFY pgrst,'reload schema';
