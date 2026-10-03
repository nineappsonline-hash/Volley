-- All prices and fulfillment are server controlled. Only the service role can
-- create card orders or settle them after verifying Kashier outside Postgres.
CREATE TABLE public.kashier_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN ('academy','share','rent','subscription')),
 target_id uuid,
 request_key text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}',
 amount numeric(10,2) NOT NULL CHECK(amount>0 AND amount<100000000),
 currency text NOT NULL DEFAULT 'EGP' CHECK(currency='EGP'),
 mode text NOT NULL CHECK(mode IN ('test','live')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','review_required')),
 session_id text UNIQUE,
 session_url text,
 transaction_id text UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kashier_order_lookup ON public.kashier_orders(user_id,request_key,created_at DESC);
CREATE INDEX kashier_order_target ON public.kashier_orders(kind,target_id);
ALTER TABLE public.kashier_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kashier_orders FROM anon,authenticated;
GRANT SELECT ON public.kashier_orders TO authenticated;
GRANT ALL ON public.kashier_orders TO service_role;
CREATE POLICY kashier_order_read ON public.kashier_orders FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR (SELECT public.is_super_admin()));
ALTER TABLE public.academy_training_bookings DROP CONSTRAINT academy_training_bookings_pay_method_check;
ALTER TABLE public.academy_training_bookings ADD CHECK(pay_method IN ('instapay','e_wallet','kashier'));
ALTER TABLE public.friendly_game_rent_payments DROP CONSTRAINT friendly_game_rent_payments_pay_method_check;
ALTER TABLE public.friendly_game_rent_payments ADD CHECK(pay_method IN ('instapay','e_wallet','kashier'));
-- Financial writes use existing security-definer RPCs, never client table writes.
REVOKE INSERT,UPDATE,DELETE ON public.plan_subscriptions,public.friendly_game_participants,public.friendly_game_rent_payments FROM anon,authenticated;

-- Keep existing eligibility/invitation/notification behavior, adding only a
-- service-only unpaid card reservation. Remove the premature receipt dispatch.
DO $$ DECLARE f text; BEGIN
 f:=pg_get_functiondef('public.join_friendly_game(uuid,text,text,text)'::regprocedure);
 f:=replace(f,'SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id;','SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id FOR UPDATE;');
 f:=replace(f,$txt$p_pay_method NOT IN ('instapay', 'e_wallet')$txt$,$txt$(p_pay_method NOT IN ('instapay', 'e_wallet') AND NOT (p_pay_method = 'kashier' AND auth.role() = 'service_role'))$txt$);
 f:=replace(f,$txt$IF p_pay_receipt_url IS NULL OR btrim(p_pay_receipt_url) = '' THEN$txt$,$txt$IF p_pay_method <> 'kashier' AND (p_pay_receipt_url IS NULL OR btrim(p_pay_receipt_url) = '') THEN$txt$);
 f:=replace(f,$txt$v_game.share_price, p_pay_method, btrim(p_pay_receipt_url), 'pending'$txt$,$txt$v_game.share_price, p_pay_method, btrim(p_pay_receipt_url), CASE WHEN p_pay_method='kashier' THEN 'unpaid' ELSE 'pending' END$txt$);
 f:=regexp_replace(f,'PERFORM public.notify_email_forward\(jsonb_build_object\([[:space:]]*''event'', ''receipt''[\s\S]*?\)\);','','g');
 EXECUTE f;
END $$;

CREATE FUNCTION public.prepare_kashier_order(p_user uuid,p_request jsonb,p_mode text) RETURNS jsonb
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
 IF public.is_account_blocked() OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_user AND is_active) THEN RAISE EXCEPTION 'An active account is required'; END IF;
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

CREATE FUNCTION public.settle_kashier_order(p_order uuid,p_transaction text,p_amount numeric,p_currency text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.kashier_orders%ROWTYPE; valid boolean:=false; n integer; sub_id uuid; b public.academy_training_bookings%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO o FROM kashier_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.amount IS DISTINCT FROM p_amount OR o.currency IS DISTINCT FROM p_currency OR nullif(p_transaction,'') IS NULL THEN RAISE EXCEPTION 'Payment mismatch'; END IF;
 IF o.status IN ('paid','review_required') THEN
  IF o.transaction_id IS DISTINCT FROM p_transaction THEN RAISE EXCEPTION 'Transaction mismatch'; END IF;
  RETURN;
 END IF;
 -- Late/cancelled reservations are retained for reconciliation, never silently
 -- reactivated: their court or player capacity may already have been released.
 IF o.kind='academy' THEN
  SELECT * INTO b FROM academy_training_bookings WHERE id=o.target_id;
  PERFORM 1 FROM academy_training_programs WHERE id=b.program_id FOR UPDATE;
  UPDATE academy_training_bookings SET status='approved',pay_method='kashier',reviewed_at=now()
   WHERE id=o.target_id AND member_id=o.user_id AND status='awaiting_payment' AND hold_until>now() AND amount=o.amount;
  valid:=FOUND;
 ELSIF o.kind IN ('share','rent') THEN
  PERFORM 1 FROM friendly_games WHERE id=(o.details->>'game_id')::uuid AND status IN ('open','full') FOR UPDATE;
  IF FOUND AND o.expires_at>now() THEN
   IF o.kind='share' THEN
    UPDATE friendly_game_participants SET pay_status='approved',pay_method='kashier' WHERE id=o.target_id AND member_id=o.user_id AND NOT is_waitlisted AND pay_status='unpaid' AND share_amount=o.amount;
   ELSE
    UPDATE friendly_game_rent_payments SET pay_status='approved' WHERE id=o.target_id AND member_id=o.user_id AND pay_status='pending' AND pay_method='kashier' AND amount=o.amount;
   END IF;
   valid:=FOUND;
  END IF;
 ELSE
  n:=CASE o.details->>'cycle' WHEN 'monthly' THEN 1 WHEN 'semi' THEN 6 WHEN 'yearly' THEN 12 END;
  INSERT INTO plan_subscriptions(user_id,academy_id,kind,plan,billing_cycle,amount,method,receipt_status,reviewed_at)
  VALUES(o.user_id,(o.details->>'academy_id')::uuid,o.details->>'plan_kind',o.details->>'plan',o.details->>'cycle',o.amount,'kashier','verified',now()) RETURNING id INTO sub_id;
  IF o.details->>'plan_kind'='member' THEN
   UPDATE profiles SET member_plan='premium',premium_expires_at=greatest(coalesce(premium_expires_at,now()),now())+make_interval(months=>n) WHERE id=o.user_id;
  ELSE
   UPDATE academies SET plan=o.details->>'plan',is_trial=false,trial_ends_at=NULL WHERE id=(o.details->>'academy_id')::uuid;
  END IF;
  valid:=FOUND;
  UPDATE kashier_orders SET target_id=sub_id WHERE id=o.id;
 END IF;
 UPDATE kashier_orders SET status=CASE WHEN valid THEN 'paid' ELSE 'review_required' END,transaction_id=p_transaction,paid_at=now() WHERE id=o.id;
END $$;
REVOKE ALL ON FUNCTION public.settle_kashier_order(uuid,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_kashier_order(uuid,text,numeric,text) TO service_role;

-- Do not allow receipt-upload/review RPCs to override an active card checkout.
CREATE FUNCTION public.guard_card_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k text; BEGIN
 IF auth.role()='service_role' THEN RETURN NEW; END IF;
 k:=CASE TG_TABLE_NAME WHEN 'academy_training_bookings' THEN 'academy' WHEN 'friendly_game_participants' THEN 'share' ELSE 'rent' END;
 IF EXISTS(SELECT 1 FROM kashier_orders WHERE kind=k AND target_id=OLD.id AND (status IN ('paid','review_required') OR (status='pending' AND expires_at>now()))) THEN
 RAISE EXCEPTION 'Card checkout is in progress or already paid. Wait for the payment result'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_academy_card BEFORE UPDATE OF status,pay_method,amount ON public.academy_training_bookings FOR EACH ROW EXECUTE FUNCTION public.guard_card_payment();
CREATE TRIGGER guard_share_card BEFORE UPDATE OF pay_status,pay_method,share_amount,pay_receipt_url ON public.friendly_game_participants FOR EACH ROW EXECUTE FUNCTION public.guard_card_payment();
CREATE TRIGGER guard_rent_card BEFORE UPDATE OF pay_status,pay_method,amount,pay_receipt_url ON public.friendly_game_rent_payments FOR EACH ROW EXECUTE FUNCTION public.guard_card_payment();

-- Success-only durable email outbox. Never use user-supplied payment amounts.
CREATE TABLE public.confirmed_payment_emails(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source text NOT NULL UNIQUE,member_id uuid NOT NULL REFERENCES public.profiles(id),
 amount numeric NOT NULL,item text NOT NULL,method text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz
);
ALTER TABLE public.confirmed_payment_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.confirmed_payment_emails FROM anon,authenticated;
GRANT SELECT,UPDATE ON public.confirmed_payment_emails TO service_role;
CREATE INDEX confirmed_email_pending ON public.confirmed_payment_emails(created_at) WHERE sent_at IS NULL;
CREATE FUNCTION public.queue_confirmed_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb:=to_jsonb(NEW); prev jsonb; st text; uid uuid; amt numeric; method text; item text; eid uuid;
BEGIN
 IF TG_OP='UPDATE' THEN prev:=to_jsonb(OLD); END IF;
 st:=coalesce(r->>'pay_status',r->>'receipt_status',r->>'status');
 IF TG_TABLE_NAME='payments' THEN
  -- Subscription ledgers used to be inserted on receipt upload, before review.
  IF coalesce(r->>'notes','') ~* '(subscription|academy.*plan)' THEN RETURN NEW; END IF;
 ELSE
  IF st NOT IN ('approved','verified','paid','review_required') OR st IS NULL THEN RETURN NEW; END IF;
  IF coalesce(prev->>'pay_status',prev->>'receipt_status',prev->>'status') IN ('approved','verified','paid','review_required') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME<>'kashier_orders' AND coalesce(r->>'pay_method',r->>'method')='kashier' THEN RETURN NEW; END IF;
 END IF;
 uid:=coalesce(r->>'member_id',r->>'user_id')::uuid;
 amt:=coalesce(r->>'amount',r->>'share_amount')::numeric;
 method:=coalesce(r->>'pay_method',r->>'method','kashier');
 item:=CASE WHEN TG_TABLE_NAME='kashier_orders' THEN coalesce(r->'details'->>'label','Card payment')||CASE WHEN st='review_required' THEN ' — payment received; booking requires review' ELSE '' END ELSE 'Payment confirmed' END;
 IF uid IS NULL OR coalesce(amt,0)<=0 THEN RETURN NEW; END IF;
 INSERT INTO confirmed_payment_emails(source,member_id,amount,item,method) VALUES(TG_TABLE_NAME||':'||(r->>'id'),uid,amt,item,method) ON CONFLICT(source) DO NOTHING RETURNING id INTO eid;
 IF eid IS NOT NULL THEN
  BEGIN PERFORM public.notify_email_forward(jsonb_build_object('event','confirmed_payment','queue_id',eid));
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Payment receipt queued; email dispatch will retry'; END;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS email_receipt_on_payment ON public.payments;
CREATE TRIGGER confirmed_ledger_email AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.queue_confirmed_payment();
CREATE TRIGGER confirmed_share_email AFTER INSERT OR UPDATE ON public.friendly_game_participants FOR EACH ROW EXECUTE FUNCTION public.queue_confirmed_payment();
CREATE TRIGGER confirmed_rent_email AFTER INSERT OR UPDATE ON public.friendly_game_rent_payments FOR EACH ROW EXECUTE FUNCTION public.queue_confirmed_payment();
CREATE TRIGGER confirmed_plan_email AFTER INSERT OR UPDATE ON public.plan_subscriptions FOR EACH ROW EXECUTE FUNCTION public.queue_confirmed_payment();
CREATE TRIGGER confirmed_academy_email AFTER INSERT OR UPDATE ON public.academy_training_bookings FOR EACH ROW EXECUTE FUNCTION public.queue_confirmed_payment();
CREATE TRIGGER confirmed_card_email AFTER UPDATE ON public.kashier_orders FOR EACH ROW EXECUTE FUNCTION public.queue_confirmed_payment();
DROP TRIGGER IF EXISTS game_share_review_email ON public.friendly_game_participants;
DROP TRIGGER IF EXISTS game_rent_review_email ON public.friendly_game_rent_payments;
CREATE FUNCTION public.retry_confirmed_payment_emails() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q record; BEGIN
 FOR q IN SELECT id FROM confirmed_payment_emails WHERE sent_at IS NULL AND created_at>now()-interval '23 hours' ORDER BY created_at LIMIT 50 LOOP
  PERFORM public.notify_email_forward(jsonb_build_object('event','confirmed_payment','queue_id',q.id));
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.retry_confirmed_payment_emails() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retry_confirmed_payment_emails() TO service_role;
NOTIFY pgrst,'reload schema';

-- Expired unpaid checkouts must release provisional game seats and rent holds.
CREATE FUNCTION public.expire_kashier_holds() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o record; BEGIN
 FOR o IN SELECT * FROM kashier_orders WHERE status='pending' AND expires_at<=now() AND kind IN ('share','rent') AND details->>'hold_released' IS DISTINCT FROM 'true' ORDER BY created_at LIMIT 100 LOOP
  IF o.kind='rent' THEN
   UPDATE friendly_game_rent_payments SET pay_status='rejected' WHERE id=o.target_id AND pay_status='pending' AND pay_method='kashier';
  ELSIF o.details->>'new_player'='true' THEN
   DELETE FROM friendly_game_participants WHERE id=o.target_id AND pay_status='unpaid' AND pay_method='kashier'
    AND NOT EXISTS(SELECT 1 FROM kashier_orders newer WHERE newer.target_id=o.target_id AND newer.status='pending' AND newer.expires_at>now());
   UPDATE friendly_games g SET status='open' WHERE g.id=(o.details->>'game_id')::uuid AND g.status='full'
    AND (SELECT count(*) FROM friendly_game_participants p WHERE p.game_id=g.id AND NOT p.is_waitlisted)<g.max_players;
  END IF;
  UPDATE kashier_orders SET details=details||jsonb_build_object('hold_released',true) WHERE id=o.id;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.expire_kashier_holds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_kashier_holds() TO service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('confirmed-payment-email-retry','*/5 * * * *','SELECT public.retry_confirmed_payment_emails()');
  PERFORM cron.schedule('expire-card-holds','* * * * *','SELECT public.expire_kashier_holds()');
 END IF;
END $$;
