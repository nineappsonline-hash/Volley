-- Super-admin assignments use the existing booking/capacity and receipt pipeline.
-- Unpaid assignments keep the normal 24-hour hold (or until the first session).
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.academy_training_bookings'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%pay_method%' LOOP
  EXECUTE format('ALTER TABLE public.academy_training_bookings DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE public.academy_training_bookings ADD CONSTRAINT academy_training_pay_method_check CHECK(pay_method IN ('instapay','e_wallet','kashier','admin_recorded'));

CREATE FUNCTION public.admin_assign_training(p_member_id uuid,p_program_id uuid,p_sessions integer,p_paid boolean,p_expected_amount numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.academy_training_programs%ROWTYPE; bid uuid; today date := (now() AT TIME ZONE 'Africa/Cairo')::date; slots jsonb; price numeric; info jsonb; slot jsonb; court integer; p_kind text := CASE WHEN p_sessions=1 THEN 'trial' ELSE 'monthly' END;
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE OR public.is_account_blocked() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_sessions IS NULL OR p_sessions NOT IN (1,4,8) OR p_paid IS NULL THEN RAISE EXCEPTION 'Choose 8, 4 or a single session and a payment status'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_member_id AND role='member' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
 SELECT * INTO p FROM public.academy_training_programs WHERE id=p_program_id FOR UPDATE;
 IF NOT FOUND OR NOT p.active OR NOT EXISTS(SELECT 1 FROM public.academies WHERE id=p.academy_id AND is_public) OR NOT EXISTS(SELECT 1 FROM public.venues WHERE id=p.venue_id AND approval_status='approved') THEN RAISE EXCEPTION 'This program is not available'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=p_member_id
 AND (p.gender='mixed' OR pr.gender=p.gender)
 AND (p.min_age IS NULL OR extract(year FROM age(today,pr.birth_date))>=p.min_age)
 AND (p.max_age IS NULL OR extract(year FROM age(today,pr.birth_date))<=p.max_age)) THEN
 RAISE EXCEPTION 'Your profile does not meet this group age or gender requirements'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('monthly','trial') THEN RAISE EXCEPTION 'Choose monthly or trial'; END IF;
 IF EXISTS(SELECT 1 FROM public.academy_training_bookings b WHERE b.program_id=p.id AND b.member_id=p_member_id AND b.expires_on>today AND (b.status IN ('submitted','approved') OR (b.status='awaiting_payment' AND b.hold_until>now()))) THEN RAISE EXCEPTION 'This member already has an active booking in this group'; END IF;
 PERFORM 1 FROM public.venues WHERE id=p.venue_id FOR UPDATE;
 SELECT jsonb_agg(to_jsonb(q)) INTO slots FROM (SELECT * FROM public.training_program_slots(p.id) WHERE seats_left>0 ORDER BY session_date,starts_at LIMIT p_sessions) q;
 IF coalesce(jsonb_array_length(slots),0) <> (p_sessions) THEN RAISE EXCEPTION 'Not enough available sessions within the next 30 days'; END IF;
 price := CASE WHEN p_sessions=1 THEN p.trial_price ELSE round(p.monthly_price*p_sessions/p.monthly_sessions,2) END;
 IF p_expected_amount IS DISTINCT FROM price THEN RAISE EXCEPTION 'The group price changed. Refresh and confirm the new amount'; END IF;
 SELECT jsonb_build_object('program',p.name,'academy',a.name,'academy_slug',a.slug,'sport',s.name,'playground',v.name,'address',v.address,'member',pr.name,'sessions',slots,'admin_assigned',true,'session_count',p_sessions) INTO info FROM public.academies a,public.sports s,public.venues v,public.profiles pr WHERE a.id=p.academy_id AND s.id=p.sport_id AND v.id=p.venue_id AND pr.id=p_member_id;
 INSERT INTO public.academy_training_bookings(program_id,member_id,kind,registered_on,expires_on,amount,details,status,hold_until,pay_method,reviewed_by,reviewed_at)
 VALUES(p.id,p_member_id,p_kind,today,CASE WHEN p_kind='monthly' THEN today+30 ELSE (slots->0->>'session_date')::date+1 END,price,info,CASE WHEN p_paid OR price=0 THEN 'approved' ELSE 'awaiting_payment' END,least(now()+interval '24 hours', ((slots->0->>'session_date')::date+(slots->0->>'starts_at')::time) AT TIME ZONE 'Africa/Cairo'),CASE WHEN p_paid THEN 'admin_recorded' END,auth.uid(),CASE WHEN p_paid THEN now() END) RETURNING id INTO bid;
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
 UPDATE public.profiles SET academy_id=p.academy_id,subscription_sessions=p_sessions,is_active=true WHERE id=p_member_id;
 RETURN bid;
END $$;


REVOKE ALL ON FUNCTION public.admin_assign_training(uuid,uuid,integer,boolean,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_training(uuid,uuid,integer,boolean,numeric) TO authenticated;

CREATE FUNCTION public.admin_confirm_training_payment(p_booking_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.academy_training_bookings%ROWTYPE; pid uuid;
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE OR public.is_account_blocked() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT program_id INTO pid FROM public.academy_training_bookings WHERE id=p_booking_id;
 PERFORM 1 FROM public.academy_training_programs WHERE id=pid FOR UPDATE;
 SELECT * INTO b FROM public.academy_training_bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND OR b.details->>'admin_assigned' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Choose an admin assignment'; END IF;
 IF b.status='approved' THEN RETURN; END IF;
 IF b.status<>'awaiting_payment' OR b.hold_until<=now() THEN RAISE EXCEPTION 'This booking is no longer awaiting payment. Refresh and review it'; END IF;
 -- The existing card-payment guard also prevents overriding an active checkout.
 UPDATE public.academy_training_bookings SET status='approved',pay_method='admin_recorded',reviewed_by=auth.uid(),reviewed_at=now() WHERE id=b.id;
END $$;
REVOKE ALL ON FUNCTION public.admin_confirm_training_payment(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_training_payment(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
