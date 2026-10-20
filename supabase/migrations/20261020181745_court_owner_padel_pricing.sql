-- Requires the existing owner, booking and payment migrations; preserves all saved charges.
CREATE SCHEMA IF NOT EXISTS playza_private;
REVOKE ALL ON SCHEMA playza_private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.court_minimum_players(p_sport text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE lower(btrim(p_sport)) WHEN 'tennis' THEN 2 WHEN 'padel' THEN 2 WHEN 'basketball' THEN 8 WHEN 'volleyball' THEN 10 WHEN 'beach volleyball' THEN 8 ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.court_minimum_players(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.court_minimum_players(text) TO anon,authenticated,service_role;

ALTER TABLE public.sports ALTER COLUMN academy_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS court_sports_global_unique ON public.sports(lower(name)) WHERE academy_id IS NULL;
INSERT INTO public.sports(name,academy_id)
SELECT n,NULL FROM unnest(ARRAY['Tennis','Padel','Basketball','Volleyball','Beach Volleyball']) n
WHERE NOT EXISTS(SELECT 1 FROM public.sports s WHERE s.academy_id IS NULL AND s.name=n);
UPDATE public.sport_settings SET min_players=public.court_minimum_players(sport) WHERE public.court_minimum_players(sport) IS NOT NULL;

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS court_availability jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.friendly_games ADD COLUMN IF NOT EXISTS booking_total numeric;
ALTER TABLE public.friendly_games ADD COLUMN IF NOT EXISTS owner_rental_total numeric;
ALTER TABLE public.friendly_games ADD COLUMN IF NOT EXISTS pricing_version integer NOT NULL DEFAULT 1;
UPDATE public.friendly_games SET booking_total=CASE WHEN host_pays THEN host_total ELSE round(share_price*greatest(2,min_players),2) END,
 owner_rental_total=round(playground_hourly_rate*duration_hours,2) WHERE booking_total IS NULL;

-- Only allow rate reads through the explicitly authorized management projection.
CREATE OR REPLACE FUNCTION public.court_can_manage(p_venue uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND NOT public.is_account_blocked() AND EXISTS(
 SELECT 1 FROM public.venues v WHERE v.id=p_venue AND (public.is_super_admin() OR v.owner_profile_id=auth.uid()
 OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin' AND p.academy_id=v.academy_id)));
$$;
REVOKE ALL ON FUNCTION public.court_can_manage(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.court_can_manage(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.court_sports() RETURNS TABLE(id uuid,name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT DISTINCT ON(s.name) s.id,s.name FROM public.sports s WHERE public.court_minimum_players(s.name) IS NOT NULL
 ORDER BY s.name,s.academy_id NULLS FIRST,s.id;
$$;
REVOKE ALL ON FUNCTION public.court_sports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.court_sports() TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.court_booking_quote(p_venue uuid,p_hours numeric DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.venues%ROWTYPE; n integer; sport text; rental numeric;
BEGIN
 IF p_hours IS NULL OR p_hours<=0 OR p_hours>24 OR p_hours::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid duration'; END IF;
 SELECT * INTO v FROM public.venues WHERE id=p_venue AND approval_status='approved';
 IF NOT FOUND THEN RAISE EXCEPTION 'Court unavailable'; END IF;
 SELECT name INTO sport FROM public.sports WHERE id=v.sport_id;
 n:=public.court_minimum_players(sport);
 IF n IS NULL OR v.rental_cost IS NULL OR v.rental_cost<0 OR v.rental_cost::text IN ('NaN','Infinity','-Infinity') THEN RETURN NULL; END IF;
 rental:=round(v.rental_cost*p_hours,2);
 RETURN jsonb_build_object('per_player',round(rental/n,2)+25,'full_court',rental+25*n,'minimum_players',n,'hours',p_hours);
END; $$;
REVOKE ALL ON FUNCTION public.court_booking_quote(uuid,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.court_booking_quote(uuid,numeric) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.court_catalog(p_manage boolean DEFAULT false) RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT (to_jsonb(v)-'rental_cost') ||
 CASE WHEN p_manage AND public.court_can_manage(v.id) THEN jsonb_build_object('rental_cost',v.rental_cost) ELSE '{}'::jsonb END ||
 jsonb_build_object('sport',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'name',s.name) END,
 'booking_price',CASE WHEN v.approval_status='approved' THEN public.court_booking_quote(v.id,1) ELSE NULL END)
 FROM public.venues v LEFT JOIN public.sports s ON s.id=v.sport_id
 WHERE (NOT p_manage AND v.approval_status='approved') OR (p_manage AND public.court_can_manage(v.id)) ORDER BY v.name,v.id;
$$;
REVOKE ALL ON FUNCTION public.court_catalog(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.court_catalog(boolean) TO anon,authenticated,service_role;

-- Locking the venue serializes allocation across concurrent games and rentals.
CREATE OR REPLACE FUNCTION playza_private.price_court_game() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v public.venues%ROWTYPE; n integer; rental numeric; venue_sport text;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.playground_hourly_rate IS DISTINCT FROM OLD.playground_hourly_rate OR NEW.owner_rental_total IS DISTINCT FROM OLD.owner_rental_total
     OR NEW.booking_total IS DISTINCT FROM OLD.booking_total OR NEW.pricing_version IS DISTINCT FROM OLD.pricing_version
     OR NEW.share_price IS DISTINCT FROM OLD.share_price OR NEW.host_total IS DISTINCT FROM OLD.host_total
     OR NEW.host_pays IS DISTINCT FROM OLD.host_pays OR NEW.playground_id IS DISTINCT FROM OLD.playground_id
     OR NEW.duration_hours IS DISTINCT FROM OLD.duration_hours OR NEW.sport IS DISTINCT FROM OLD.sport OR NEW.min_players IS DISTINCT FROM OLD.min_players THEN
     IF public.is_super_admin() IS NOT TRUE AND current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Booking prices cannot be edited'; END IF;
   END IF;
   RETURN NEW;
 END IF;
 IF NEW.playground_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO v FROM public.venues WHERE id=NEW.playground_id FOR UPDATE;
 IF v.approval_status IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'Court unavailable'; END IF;
 SELECT name INTO venue_sport FROM public.sports WHERE id=v.sport_id;
 IF venue_sport IS NOT NULL AND lower(NEW.sport)<>lower(venue_sport) THEN RAISE EXCEPTION 'Choose a court for this sport'; END IF;
 n:=public.court_minimum_players(NEW.sport);
 IF n IS NULL THEN RETURN NEW; END IF;
 IF NEW.min_players<n OR NEW.max_players<NEW.min_players THEN RAISE EXCEPTION 'Minimum players required: %',n; END IF;
 IF v.rental_cost IS NULL OR v.rental_cost<0 THEN RAISE EXCEPTION 'Court price not configured'; END IF;
 IF NEW.duration_hours IS NULL OR NEW.duration_hours<=0 OR NEW.duration_hours>24 OR NEW.duration_hours::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid duration'; END IF;
 NEW.court_number:=public.pick_free_court(v.id,NEW.game_date,NEW.start_time,round(NEW.duration_hours*60)::integer,NULL,NEW.id);
 IF NEW.court_number IS NULL THEN RAISE EXCEPTION 'No court available for this time'; END IF;
 rental:=round(v.rental_cost*NEW.duration_hours,2);
 NEW.playground_hourly_rate:=v.rental_cost; NEW.owner_rental_total:=rental; NEW.pricing_version:=2;
 NEW.share_price:=CASE WHEN NEW.host_pays THEN 0 ELSE round(rental/n,2)+25 END;
 NEW.host_total:=CASE WHEN NEW.host_pays THEN rental+25*n ELSE NULL END;
 NEW.booking_total:=CASE WHEN NEW.host_pays THEN NEW.host_total ELSE round(NEW.share_price*n,2) END;
 RETURN NEW;
END; $$;
CREATE TRIGGER price_court_game BEFORE INSERT OR UPDATE ON public.friendly_games FOR EACH ROW EXECUTE FUNCTION playza_private.price_court_game();

CREATE OR REPLACE FUNCTION playza_private.price_court_participant() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g public.friendly_games%ROWTYPE;
BEGIN
 SELECT * INTO g FROM public.friendly_games WHERE id=NEW.game_id;
 IF g.pricing_version=2 AND NOT NEW.is_waitlisted THEN
 NEW.share_amount:=CASE WHEN g.host_pays THEN CASE WHEN NEW.role='organizer' THEN g.host_total ELSE 0 END ELSE g.share_price END;
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER price_court_participant BEFORE INSERT ON public.friendly_game_participants FOR EACH ROW EXECUTE FUNCTION playza_private.price_court_participant();

CREATE TABLE public.court_owner_payouts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), game_id uuid NOT NULL UNIQUE REFERENCES public.friendly_games(id),
 venue_id uuid NOT NULL REFERENCES public.venues(id),owner_id uuid NOT NULL REFERENCES public.profiles(id),
 rental_amount numeric NOT NULL CHECK(rental_amount>=0),due_date date NOT NULL,
 paid_at timestamptz,paid_by uuid REFERENCES public.profiles(id),payment_reference text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((paid_at IS NULL AND paid_by IS NULL AND payment_reference IS NULL) OR (paid_at IS NOT NULL AND paid_by IS NOT NULL AND length(btrim(payment_reference))>0))
);
CREATE INDEX court_payouts_owner_due ON public.court_owner_payouts(owner_id,due_date);
CREATE INDEX court_payouts_unpaid_due ON public.court_owner_payouts(due_date) WHERE paid_at IS NULL;
ALTER TABLE public.court_owner_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner and platform payout visibility" ON public.court_owner_payouts FOR SELECT TO authenticated
 USING(NOT public.is_account_blocked() AND (owner_id=(SELECT auth.uid()) OR public.is_super_admin()));
GRANT SELECT ON public.court_owner_payouts TO authenticated;
GRANT ALL ON public.court_owner_payouts TO service_role;

CREATE OR REPLACE FUNCTION playza_private.court_paid(p_game uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT g.status<>'cancelled' AND g.booking_total IS NOT NULL AND
 coalesce((SELECT sum(least(greatest(coalesce(p.share_amount,CASE WHEN g.host_pays THEN g.host_total ELSE g.share_price END),0),CASE WHEN g.host_pays THEN g.host_total ELSE g.share_price END)) FROM public.friendly_game_participants p
 WHERE p.game_id=g.id AND NOT p.is_waitlisted AND p.pay_status='approved' AND (NOT g.host_pays OR p.role='organizer')),0)
 +coalesce((SELECT sum(r.amount) FROM public.friendly_game_rent_payments r WHERE r.game_id=g.id AND r.pay_status='approved'),0)>=g.booking_total
 FROM public.friendly_games g WHERE g.id=p_game;
$$;
CREATE OR REPLACE FUNCTION playza_private.refresh_court_payout() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE gid uuid;
BEGIN
 IF TG_TABLE_NAME='friendly_games' THEN gid:=NEW.id; ELSE gid:=NEW.game_id; END IF;
 IF playza_private.court_paid(gid) THEN
 INSERT INTO public.court_owner_payouts(game_id,venue_id,owner_id,rental_amount,due_date)
 SELECT g.id,g.playground_id,v.owner_profile_id,g.owner_rental_total,g.game_date FROM public.friendly_games g JOIN public.venues v ON v.id=g.playground_id
 WHERE g.id=gid AND v.owner_profile_id IS NOT NULL AND g.owner_rental_total IS NOT NULL
 ON CONFLICT(game_id) DO UPDATE SET due_date=EXCLUDED.due_date WHERE court_owner_payouts.paid_at IS NULL;
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER refresh_court_payout_share AFTER INSERT OR UPDATE ON public.friendly_game_participants FOR EACH ROW EXECUTE FUNCTION playza_private.refresh_court_payout();
CREATE TRIGGER refresh_court_payout_rent AFTER INSERT OR UPDATE ON public.friendly_game_rent_payments FOR EACH ROW EXECUTE FUNCTION playza_private.refresh_court_payout();
CREATE TRIGGER refresh_court_payout_game AFTER UPDATE ON public.friendly_games FOR EACH ROW EXECUTE FUNCTION playza_private.refresh_court_payout();

CREATE OR REPLACE FUNCTION public.court_payout_ledger() RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT to_jsonb(p)||jsonb_build_object('venue_name',v.name,'game_title',g.title,'sport',g.sport,'start_time',g.start_time,
 'court_number',g.court_number,'hours',g.duration_hours,'owner_name',o.name,'owner_phone',o.phone,'payable',playza_private.court_paid(g.id))
 FROM public.court_owner_payouts p JOIN public.venues v ON v.id=p.venue_id JOIN public.friendly_games g ON g.id=p.game_id JOIN public.profiles o ON o.id=p.owner_id
 WHERE auth.uid() IS NOT NULL AND NOT public.is_account_blocked() AND (p.owner_id=auth.uid() OR public.is_super_admin()) ORDER BY p.due_date,p.id;
$$;
REVOKE ALL ON FUNCTION public.court_payout_ledger() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.court_payout_ledger() TO authenticated;
CREATE OR REPLACE FUNCTION public.record_court_payout(p_id uuid,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p public.court_owner_payouts%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE OR public.is_account_blocked() THEN RAISE EXCEPTION 'Super admin required'; END IF;
 IF length(btrim(coalesce(p_reference,''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Payment reference required'; END IF;
 SELECT * INTO p FROM public.court_owner_payouts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR p.paid_at IS NOT NULL THEN RAISE EXCEPTION 'Payout unavailable or already paid'; END IF;
 IF p.due_date>(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Payout is scheduled for the booking date'; END IF;
 IF playza_private.court_paid(p.game_id) IS NOT TRUE THEN RAISE EXCEPTION 'Full approved payment required'; END IF;
 UPDATE public.court_owner_payouts SET paid_at=now(),paid_by=auth.uid(),payment_reference=btrim(p_reference) WHERE id=p.id;
END; $$;
REVOKE ALL ON FUNCTION public.record_court_payout(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_court_payout(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pay_rent_remaining(p_game_id uuid, p_pay_method text, p_pay_receipt_url text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_game       public.friendly_games%ROWTYPE;
  v_min_players INTEGER;
  v_fee        NUMERIC;
  v_per_player NUMERIC;
  v_basis      NUMERIC;
  v_paid       NUMERIC;
  v_topup      NUMERIC;
  v_remaining  NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  IF v_game.status NOT IN ('open', 'full') THEN
    RAISE EXCEPTION 'This game is no longer open';
  END IF;
  IF v_game.host_pays THEN
    RAISE EXCEPTION 'The reservation is already fully paid';
  END IF;
  IF v_game.playground_hourly_rate IS NULL OR v_game.playground_hourly_rate < 0 THEN
    RAISE EXCEPTION 'No rental price on this playground';
  END IF;

  -- The balance is measured on the players' side, matching the booking deposit:
  -- min_players × per-player price (rent share + fee) minus what has been paid.
  PERFORM 1 FROM public.friendly_games WHERE id=p_game_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.friendly_game_participants WHERE game_id=p_game_id AND member_id=auth.uid() AND NOT is_waitlisted) THEN RAISE EXCEPTION 'Join this game before paying'; END IF;
  v_per_player := v_game.share_price;
  v_basis := v_game.booking_total;

  -- Count shares that have been submitted (pending or approved, non-waitlisted).
  SELECT COALESCE(SUM(LEAST(v_per_player, COALESCE(share_amount, v_per_player))), 0) INTO v_paid
  FROM public.friendly_game_participants
  WHERE game_id = p_game_id
    AND is_waitlisted = FALSE
    AND pay_status IN ('pending', 'approved');

  -- Count top-ups already submitted or approved.
  SELECT COALESCE(SUM(amount), 0) INTO v_topup
  FROM public.friendly_game_rent_payments
  WHERE game_id = p_game_id
    AND pay_status IN ('pending', 'approved');

  v_remaining := round(v_basis - v_paid - v_topup, 2);
  IF v_remaining < 0 THEN v_remaining := 0; END IF;
  IF v_remaining > v_basis THEN v_remaining := v_basis; END IF;
  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'The reservation is already covered';
  END IF;

  IF p_pay_method IS NULL OR p_pay_method NOT IN ('instapay', 'e_wallet') THEN
    RAISE EXCEPTION 'A valid payment method is required';
  END IF;
  IF p_pay_receipt_url IS NULL OR btrim(p_pay_receipt_url) = '' THEN
    RAISE EXCEPTION 'A receipt is required to confirm your payment';
  END IF;

  -- Prevent duplicate pending top-ups from the same member.
  IF EXISTS (
    SELECT 1 FROM public.friendly_game_rent_payments
    WHERE game_id = p_game_id
      AND member_id = auth.uid()
      AND pay_status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending rent payment for this game';
  END IF;

  INSERT INTO public.friendly_game_rent_payments
    (game_id, member_id, amount, pay_method, pay_receipt_url, pay_status)
  VALUES
    (p_game_id, auth.uid(), v_remaining, p_pay_method, btrim(p_pay_receipt_url), 'pending');

  RETURN v_remaining;
END;
$function$;


CREATE OR REPLACE FUNCTION public.prepare_kashier_order(p_user uuid, p_request jsonb, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 IF FOUND THEN
 IF coalesce(o.details->'guests','[]'::jsonb) IS DISTINCT FROM coalesce(p_request->'guests','[]'::jsonb) THEN RAISE EXCEPTION 'A checkout with different guests is already open. Finish it or wait for it to expire'; END IF;
 RETURN to_jsonb(o)||jsonb_build_object('is_new',false); END IF;
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
    is_new_player:=true; PERFORM public.add_game_guests(g.id,coalesce(p_request->'guests','[]'::jsonb));
   END IF;
   IF part.is_waitlisted OR part.pay_status NOT IN ('unpaid','rejected') THEN RAISE EXCEPTION 'No unpaid player share'; END IF;
   amount:=CASE WHEN g.host_pays AND g.creator_id=p_user THEN g.host_total WHEN g.host_pays THEN 0 ELSE g.share_price END;
   target:=part.id;info:=info||jsonb_build_object('new_player',is_new_player); info:=info||jsonb_build_object('guests',coalesce(p_request->'guests','[]'::jsonb));
   UPDATE friendly_game_participants SET pay_status='unpaid',pay_method='kashier',share_amount=amount,pay_receipt_url=NULL WHERE id=target; SELECT amount+coalesce(sum(share_amount),0) INTO amount FROM friendly_game_participants WHERE sponsor_participant_id=target;
  ELSE
   IF part.id IS NULL OR part.is_waitlisted OR g.host_pays OR g.playground_hourly_rate IS NULL THEN RAISE EXCEPTION 'Join this game before paying remaining rent'; END IF;
   IF EXISTS(SELECT 1 FROM kashier_orders WHERE kind='rent' AND details->>'game_id'=g.id::text AND status='pending' AND expires_at>now()) THEN RAISE EXCEPTION 'Another rent payment is in progress'; END IF;
   per_player:=g.share_price;
   SELECT coalesce(sum(least(per_player,coalesce(share_amount,per_player))),0) INTO paid FROM friendly_game_participants WHERE game_id=g.id AND NOT is_waitlisted AND pay_status IN ('pending','approved');
   SELECT coalesce(sum(r.amount),0) INTO topup FROM friendly_game_rent_payments r WHERE r.game_id=g.id AND r.pay_status IN ('pending','approved');
   amount:=greatest(0,round(g.booking_total-paid-topup,2));
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
END $function$;


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          owner_profile_id, sport_id, contact_phone, location_link, photos, court_count, name, address, capacity, school_name,
          rental_cost, rental_hours, country, governorate, area
        )
        VALUES (
          NEW.id,
          (SELECT id FROM public.sports WHERE lower(name)=lower(v_venue->>'sport') ORDER BY academy_id NULLS FIRST,id LIMIT 1),
          NEW.raw_user_meta_data->>'phone',NULLIF(v_venue->>'location_link',''),COALESCE(v_venue->'photos','[]'::jsonb),COALESCE((v_venue->>'court_count')::integer,1),
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
$function$;


CREATE OR REPLACE FUNCTION public.pick_free_court(p_venue_id uuid, p_date date, p_start_time time without time zone, p_duration_minutes integer, p_exclude_rental uuid DEFAULT NULL::uuid, p_exclude_game uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_courts INTEGER;
  v_court  INTEGER;
  v_start  INTEGER := public.minutes_of_day(p_start_time);
  v_end    INTEGER := v_start + p_duration_minutes;
  v_free   BOOLEAN;
BEGIN
  SELECT court_count INTO v_courts FROM public.venues WHERE id = p_venue_id FOR UPDATE;
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
      -- The booking must fit the venue hours and this court's own weekly windows.
      SELECT (jsonb_array_length(coalesce(v.working_hours,'[]'))=0 OR EXISTS(
        SELECT 1 FROM jsonb_array_elements(v.working_hours) w WHERE (w->>'weekday')::integer=extract(dow from p_date)::integer
        AND public.minutes_of_day((w->>'start')::time)<=v_start AND public.minutes_of_day((w->>'end')::time)>=v_end))
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(v.unavailable_slots,'[]')) w
        WHERE (w->>'weekday')::integer=extract(dow from p_date)::integer
        AND public.minutes_of_day((w->>'start')::time)<v_end AND v_start<public.minutes_of_day((w->>'end')::time))
      AND (jsonb_array_length(v.court_availability)=0 OR EXISTS(
        SELECT 1 FROM jsonb_array_elements(v.court_availability) w WHERE (w->>'court_number')::integer=v_court
        AND (w->>'weekday')::integer=extract(dow from p_date)::integer
        AND public.minutes_of_day((w->>'start')::time)<=v_start AND public.minutes_of_day((w->>'end')::time)>=v_end))
      INTO v_free FROM public.venues v WHERE v.id=p_venue_id;
    END IF;
    IF v_free THEN
      RETURN v_court;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$function$;


CREATE OR REPLACE FUNCTION public.guard_venue_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_super_admin() IS TRUE OR auth.role() = 'service_role' THEN
    IF TG_OP = 'INSERT' THEN NEW.approval_status := 'approved'; END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      NEW.approval_status := 'pending';
    ELSE
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
        RAISE EXCEPTION 'Only a super admin can review playgrounds' USING ERRCODE = '42501';
      END IF;
      -- Changed listings are resubmitted for review, including rejected ones.
      IF (to_jsonb(NEW)-'working_hours'-'unavailable_slots'-'blocked_dates'-'court_availability')
       IS DISTINCT FROM (to_jsonb(OLD)-'working_hours'-'unavailable_slots'-'blocked_dates'-'court_availability') THEN NEW.approval_status := 'pending'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION playza_private.guard_court_details() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE w jsonb;
BEGIN
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL AND public.is_super_admin() IS NOT TRUE THEN
   IF NOT public.court_can_manage(OLD.id) OR NEW.owner_profile_id IS DISTINCT FROM OLD.owner_profile_id OR NEW.academy_id IS DISTINCT FROM OLD.academy_id THEN RAISE EXCEPTION 'Court management permission required'; END IF;
 END IF;
 IF NEW.court_count IS NULL OR NEW.court_count NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Court count must be between 1 and 100'; END IF;
 IF NEW.rental_cost IS NOT NULL AND (NEW.rental_cost<0 OR NEW.rental_cost::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Invalid rental price'; END IF;
 IF jsonb_typeof(NEW.court_availability) IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.court_availability)>700 THEN RAISE EXCEPTION 'Invalid court availability'; END IF;
 FOR w IN SELECT * FROM jsonb_array_elements(NEW.court_availability) LOOP
   IF NOT (w ?& ARRAY['court_number','weekday','start','end']) OR (w->>'court_number') !~ '^[0-9]+$' OR (w->>'weekday') !~ '^[0-6]$'
     OR (w->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR (w->>'end') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Invalid court availability'; END IF;
   IF (w->>'court_number')::integer NOT BETWEEN 1 AND NEW.court_count OR (w->>'start')>=(w->>'end') THEN RAISE EXCEPTION 'Invalid court availability range'; END IF;
 END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_court_details BEFORE INSERT OR UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION playza_private.guard_court_details();

-- Capture already fully paid future bookings without changing their charges.
INSERT INTO public.court_owner_payouts(game_id,venue_id,owner_id,rental_amount,due_date)
SELECT g.id,v.id,v.owner_profile_id,g.owner_rental_total,g.game_date FROM public.friendly_games g JOIN public.venues v ON v.id=g.playground_id
WHERE g.game_date>=(now() AT TIME ZONE 'Africa/Cairo')::date AND v.owner_profile_id IS NOT NULL AND g.owner_rental_total IS NOT NULL
AND playza_private.court_paid(g.id) ON CONFLICT(game_id) DO NOTHING;

