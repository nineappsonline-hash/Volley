-- Applied in production. Safe late share reconciliation and recording proof after a manual merchant confirmation.
CREATE OR REPLACE FUNCTION public.settle_kashier_order(p_order uuid, p_transaction text, p_amount numeric, p_currency text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.kashier_orders%ROWTYPE; valid boolean:=false; n integer; sub_id uuid; b public.academy_training_bookings%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO o FROM kashier_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.amount IS DISTINCT FROM p_amount OR o.currency IS DISTINCT FROM p_currency OR nullif(p_transaction,'') IS NULL THEN RAISE EXCEPTION 'Payment mismatch'; END IF;
 IF o.status IN ('paid','review_required') THEN
  -- A manually approved share can receive a late, independently verified
  -- gateway transaction. Record proof and finalize without charging again.
  IF o.status='review_required' AND o.transaction_id IS NULL
     AND o.kind='share' AND o.details->>'admin_review'='approved' THEN
    UPDATE public.kashier_orders SET status='paid',transaction_id=p_transaction,paid_at=now() WHERE id=o.id;
    RETURN;
  END IF;
  IF o.transaction_id IS DISTINCT FROM p_transaction THEN RAISE EXCEPTION 'Transaction mismatch'; END IF;
  RETURN;
 END IF;
 -- Late/cancelled reservations are retained for reconciliation, never silently
 -- reactivated: their court or player capacity may already have been released.
 IF o.kind='shop' THEN PERFORM public.expire_shop_orders();
  UPDATE public.shop_orders SET status='paid',reviewed_at=now() WHERE id=o.target_id AND member_id IS NOT DISTINCT FROM o.user_id AND total=o.amount AND status='awaiting_payment' AND hold_until>now() AND pay_method='kashier';
  valid:=FOUND;
  IF NOT valid THEN UPDATE public.shop_orders SET status='review_required' WHERE id=o.target_id AND member_id IS NOT DISTINCT FROM o.user_id AND status NOT IN ('paid','fulfilled'); END IF;
 ELSIF o.kind='academy' THEN
  SELECT * INTO b FROM academy_training_bookings WHERE id=o.target_id;
  PERFORM 1 FROM academy_training_programs WHERE id=b.program_id FOR UPDATE;
  UPDATE academy_training_bookings SET status='approved',pay_method='kashier',reviewed_at=now()
   WHERE id=o.target_id AND member_id IS NOT DISTINCT FROM o.user_id AND status='awaiting_payment' AND hold_until>now() AND amount=o.amount;
  valid:=FOUND;
 ELSIF o.kind IN ('share','rent') THEN
  PERFORM 1 FROM friendly_games WHERE id=(o.details->>'game_id')::uuid AND status IN ('open','full') FOR UPDATE;
  IF FOUND AND ((o.kind='share' AND EXISTS(SELECT 1 FROM public.friendly_games fg WHERE fg.id=(o.details->>'game_id')::uuid AND fg.game_date + fg.start_time > (now() AT TIME ZONE 'Africa/Cairo'))) OR (o.expires_at > now() - interval '20 minutes' AND o.details->>'hold_released' IS DISTINCT FROM 'true')) THEN
   IF o.kind='share' THEN
    UPDATE friendly_game_participants SET pay_status='approved',pay_method='kashier' WHERE id=o.target_id AND member_id IS NOT DISTINCT FROM o.user_id AND pay_status='unpaid' AND share_amount+(SELECT coalesce(sum(guest.share_amount),0) FROM public.friendly_game_participants guest WHERE guest.sponsor_participant_id=o.target_id)=o.amount;
   ELSE
    UPDATE friendly_game_rent_payments SET pay_status='approved' WHERE id=o.target_id AND member_id IS NOT DISTINCT FROM o.user_id AND pay_status='pending' AND pay_method='kashier' AND amount=o.amount;
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
 
 IF o.details->>'admin_review'='approved' THEN
   IF o.kind='shop' THEN PERFORM public.expire_shop_orders(); valid:=EXISTS(SELECT 1 FROM public.shop_orders WHERE id=o.target_id AND member_id IS NOT DISTINCT FROM o.user_id AND total=o.amount AND status IN ('paid','fulfilled'));
   ELSIF o.kind='rent' THEN valid:=EXISTS(SELECT 1 FROM friendly_game_rent_payments WHERE id=o.target_id AND member_id IS NOT DISTINCT FROM o.user_id AND pay_status='approved' AND amount=o.amount);
   ELSIF o.kind='share' THEN valid:=EXISTS(SELECT 1 FROM friendly_game_participants WHERE id=o.target_id AND member_id IS NOT DISTINCT FROM o.user_id AND pay_status='approved');
   END IF;
 END IF;
 UPDATE kashier_orders SET status=CASE WHEN valid THEN 'paid' ELSE 'review_required' END,transaction_id=p_transaction,paid_at=now() WHERE id=o.id;
END $function$

