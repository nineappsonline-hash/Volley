-- is_active tracks academy membership, not permission to pay for games or plans.
-- Keep account bans and all booking-specific eligibility checks enforced.
CREATE OR REPLACE FUNCTION public.prepare_kashier_order(p_user uuid,p_request jsonb,p_mode text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k text:=p_request->>'kind'; target uuid:=nullif(p_request->>'targetId','')::uuid;
 req text:=concat_ws(':',k,target::text,p_request->>'planKind',p_request->>'plan',p_request->>'cycle');
 o public.kashier_orders%ROWTYPE; b public.academy_training_bookings%ROWTYPE; g public.friendly_games%ROWTYPE;
 part public.friendly_game_participants%ROWTYPE; uid uuid; amount numeric; aid uuid; per_player numeric; paid numeric; topup numeric;
 expiry timestamptz:=now()+interval '15 minutes'; info jsonb:='{}'; is_new_player boolean:=false;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_mode NOT IN ('test','live') OR k NOT IN ('academy','share','rent','subscription') THEN RAISE EXCEPTION 'Invalid payment'; END IF;
 PERFORM set_config('request.jwt.claim.sub',p_user::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','service_role')::text,true);
 IF public.is_account_blocked() THEN RAISE EXCEPTION 'Your account is blocked' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user) THEN RAISE EXCEPTION 'Complete your account profile before paying'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text||req,0));
 SELECT * INTO o FROM kashier_orders WHERE user_id=p_user AND request_key=req AND mode=p_mode AND status='pending' AND expires_at>now() ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN RETURN to_jsonb(o)||jsonb_build_object('is_new',false); END IF;
 IF EXISTS(SELECT 1 FROM kashier_orders WHERE user_id=p_user AND request_key=req AND status='review_required') THEN RAISE EXCEPTION 'Your earlier payment needs review. Do not pay again'; END IF;
 IF k='academy' THEN
  SELECT program_id INTO uid FROM academy_training_bookings WHERE id=target;
  PERFORM 1 FROM academy_training_programs WHERE id=uid FOR UPDATE;
  SELECT * INTO b FROM academy_training_bookings WHERE id=target AND member_id=p_user FOR UPDATE;
  IF NOT FOUND OR b.status<>'awaiting_payment' OR b.hold_until<=now() THEN RAISE EXCEPTION 'Booking is unavailable or already paid'; END IF;
  amount:=b.amount;expiry:=least(expiry,b.hold_until);info:=jsonb_build_object('label',b.details->>'program');
  UPDATE academy_training_bookings SET pay_method='kashier' WHERE id=target;
 ELSIF k IN ('share','rent') THEN
  SELECT * INTO g FROM friendly_games WHERE id=target FOR UPDATE;
  IF NOT FOUND OR g.status NOT IN ('open','full') OR (g.game_date+g.start_time) AT TIME ZONE 'Africa/Cairo'<=now() THEN RAISE EXCEPTION 'This game is no longer open'; END IF;
  expiry:=least(expiry,(g.game_date+g.start_time) AT TIME ZONE 'Africa/Cairo');
  info:=jsonb_build_object('game_id',g.id,'label',g.title);
  SELECT * INTO part FROM friendly_game_participants WHERE game_id=g.id AND member_id=p_user FOR UPDATE;
  IF k='share' THEN
   IF part.id IS NULL THEN
    IF (SELECT count(*) FROM friendly_game_participants WHERE game_id=g.id AND NOT is_waitlisted)>=g.max_players THEN RAISE EXCEPTION 'Game is full. Join the waitlist without paying'; END IF;
    PERFORM public.join_friendly_game(g.id,p_request->>'inviteCode','kashier',NULL);
    SELECT * INTO part FROM friendly_game_participants WHERE game_id=g.id AND member_id=p_user FOR UPDATE;
    is_new_player:=true;
   END IF;
   IF part.is_waitlisted OR part.pay_status NOT IN ('unpaid','rejected') THEN RAISE EXCEPTION 'No unpaid player share'; END IF;
   amount:=CASE WHEN g.host_pays AND g.creator_id=p_user THEN g.host_total WHEN g.host_pays THEN 0 ELSE g.share_price END;
   target:=part.id;info:=info||jsonb_build_object('new_player',is_new_player);
   UPDATE friendly_game_participants SET pay_status='unpaid',pay_method='kashier',share_amount=amount,pay_receipt_url=NULL WHERE id=target;
  ELSE
   IF part.id IS NULL OR part.is_waitlisted OR g.host_pays OR g.playground_hourly_rate IS NULL THEN RAISE EXCEPTION 'Join this game before paying remaining rent'; END IF;
   IF EXISTS(SELECT 1 FROM kashier_orders WHERE kind='rent' AND details->>'game_id'=g.id::text AND status='pending' AND expires_at>now()) THEN RAISE EXCEPTION 'Another rent payment is in progress'; END IF;
   per_player:=round(round(g.playground_hourly_rate*g.duration_hours,2)/greatest(2,g.min_players),2)+CASE WHEN lower(btrim(g.sport))='padel' THEN 40 ELSE 20 END;
   SELECT coalesce(sum(least(per_player,coalesce(share_amount,per_player))),0) INTO paid FROM friendly_game_participants WHERE game_id=g.id AND NOT is_waitlisted AND pay_status IN ('pending','approved');
   SELECT coalesce(sum(r.amount),0) INTO topup FROM friendly_game_rent_payments r WHERE r.game_id=g.id AND r.pay_status IN ('pending','approved');
   amount:=greatest(0,round(greatest(2,g.min_players)*per_player-paid-topup,2));
   INSERT INTO friendly_game_rent_payments(game_id,member_id,amount,pay_method,pay_status) VALUES(g.id,p_user,amount,'kashier','pending') RETURNING id INTO target;
  END IF;
 ELSIF k='subscription' THEN
  amount:=public.plan_price(p_request->>'planKind',p_request->>'plan',p_request->>'cycle');
  IF p_request->>'planKind'='academy' THEN
   SELECT academy_id INTO aid FROM profiles WHERE id=p_user AND role='admin';
   IF aid IS NULL THEN RAISE EXCEPTION 'An academy administrator is required'; END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_user AND role='member') THEN RAISE EXCEPTION 'A member account is required'; END IF;
  info:=jsonb_build_object('plan_kind',p_request->>'planKind','plan',p_request->>'plan','cycle',p_request->>'cycle','academy_id',aid,'label','Playza '||(p_request->>'plan'));
 END IF;
 IF amount IS NULL OR amount<=0 OR expiry<=now()+interval '30 seconds' THEN RAISE EXCEPTION 'No payable balance or reservation is expiring'; END IF;
 INSERT INTO kashier_orders(user_id,kind,target_id,request_key,details,amount,mode,expires_at) VALUES(p_user,k,target,req,info,amount,p_mode,expiry) RETURNING * INTO o;
 RETURN to_jsonb(o)||jsonb_build_object('is_new',true);
END $$;
REVOKE ALL ON FUNCTION public.prepare_kashier_order(uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_kashier_order(uuid,jsonb,text) TO service_role;

NOTIFY pgrst, 'reload schema';
