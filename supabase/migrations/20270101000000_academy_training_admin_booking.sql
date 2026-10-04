-- Let academy admins and platform admins book their own training plans.
--
-- reserve_academy_training previously required role='member', so the booking
-- buttons were hidden from anyone else and a signed-in academy admin saw
-- "Sign in as a member to book" on their own academy's plans. Only the role
-- whitelist changes here: the active-account check, the public/active program
-- checks and the slot, age and gender rules are all unchanged.
--
-- playground_owner stays excluded: it is not an academy-facing role.
CREATE OR REPLACE FUNCTION public.reserve_academy_training(p_program_id uuid,p_kind text,p_trial_date date DEFAULT NULL,p_trial_time time DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.academy_training_programs%ROWTYPE; bid uuid; today date := (now() AT TIME ZONE 'Africa/Cairo')::date; slots jsonb; price numeric; info jsonb; slot jsonb; court integer;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('member','admin','super_admin') AND is_active) THEN RAISE EXCEPTION 'An active member, academy admin or platform admin account is required' USING ERRCODE='42501'; END IF;
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

-- CREATE OR REPLACE keeps the existing grants, but re-assert them so the
-- security posture survives even if the function is ever dropped and recreated.
REVOKE ALL ON FUNCTION public.reserve_academy_training(uuid,text,date,time) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reserve_academy_training(uuid,text,date,time) TO authenticated;


NOTIFY pgrst,'reload schema';
