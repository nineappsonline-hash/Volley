-- Card collection status remains authoritative and is never rewritten by an admin decision.
CREATE OR REPLACE FUNCTION public.review_card_payment(p_order uuid, p_actor uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE o public.kashier_orders%ROWTYPE; s public.plan_subscriptions%ROWTYPE; n integer;
BEGIN
 IF (SELECT auth.jwt()->>'role') IS DISTINCT FROM 'service_role' OR NOT EXISTS(
   SELECT 1 FROM public.profiles WHERE id=p_actor AND role='super_admin' AND is_active
 ) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO o FROM public.kashier_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND OR o.kind NOT IN ('share','rent','subscription') OR p_approve IS NULL THEN RAISE EXCEPTION 'Payment not available for review'; END IF;
 IF o.details->>'admin_review' = (CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END) THEN RETURN; END IF;
 IF o.kind='rent' THEN
   UPDATE public.friendly_game_rent_payments SET pay_status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
   WHERE id=o.target_id AND member_id=o.user_id AND pay_method='kashier';
   IF NOT FOUND THEN RAISE EXCEPTION 'Payment record no longer exists'; END IF;
 ELSIF o.kind='share' THEN
   -- Retain paid records for audit; never delete a card payment when rejecting it.
   UPDATE public.friendly_game_participants SET pay_status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
   WHERE id=o.target_id AND member_id=o.user_id AND pay_method='kashier' AND NOT is_waitlisted AND sponsor_participant_id IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'Registration no longer exists; review the charge in Kashier'; END IF;
 ELSE
   SELECT * INTO s FROM public.plan_subscriptions WHERE id=o.target_id AND user_id=o.user_id AND method='kashier' FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Subscription has not been confirmed by Kashier'; END IF;
   UPDATE public.plan_subscriptions SET receipt_status=CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END, reviewed_by=p_actor, reviewed_at=now() WHERE id=s.id;
   IF p_approve THEN
     n:=CASE s.billing_cycle WHEN 'monthly' THEN 1 WHEN 'semi' THEN 6 WHEN 'yearly' THEN 12 END;
     IF s.kind='member' THEN
       UPDATE public.profiles SET member_plan='premium',premium_expires_at=greatest(coalesce(premium_expires_at,now()),s.created_at+make_interval(months=>n)) WHERE id=s.user_id;
     ELSE
       UPDATE public.academies SET plan=s.plan WHERE id=s.academy_id;
     END IF;
   ELSIF NOT EXISTS(SELECT 1 FROM public.plan_subscriptions WHERE id<>s.id AND user_id=s.user_id AND kind=s.kind AND academy_id IS NOT DISTINCT FROM s.academy_id AND receipt_status='verified' AND created_at>=s.created_at) THEN
     IF s.kind='member' THEN UPDATE public.profiles SET member_plan='free',premium_expires_at=NULL WHERE id=s.user_id;
     ELSE UPDATE public.academies SET plan='starter' WHERE id=s.academy_id; END IF;
   END IF;
 END IF;
 UPDATE public.kashier_orders SET details=details||jsonb_build_object('admin_review',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,'admin_reviewed_by',p_actor,'admin_reviewed_at',now(),'admin_review_history',coalesce(details->'admin_review_history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('decision',CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,'actor',p_actor,'at',now()))) WHERE id=o.id;
END $$;
REVOKE ALL ON FUNCTION public.review_card_payment(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_card_payment(uuid,uuid,boolean) TO service_role;

-- Do not expire a provisional seat that an administrator has explicitly accepted.
DO $$ DECLARE f text; BEGIN
 f:=pg_get_functiondef('public.expire_kashier_holds()'::regprocedure);
 IF strpos(f,'admin_review')=0 THEN
 f:=replace(f,$old$details->>'hold_released' IS DISTINCT FROM 'true'$old$,$new$details->>'hold_released' IS DISTINCT FROM 'true' AND details->>'admin_review' IS NULL$new$);
 EXECUTE f;
 END IF;
END $$;

-- A confirmed charge can arrive after an explicit manual acceptance. Preserve
-- that decision while still recording genuine provider collection exactly once.
DO $migration$ DECLARE f text; BEGIN
 f:=pg_get_functiondef('public.settle_kashier_order(uuid,text,numeric,text)'::regprocedure);
 IF strpos(f,'admin_review')=0 THEN
 f:=replace(f,$old$UPDATE kashier_orders SET status=CASE WHEN valid THEN 'paid' ELSE 'review_required' END$old$,$new$
 IF o.details->>'admin_review'='approved' THEN
   IF o.kind='rent' THEN valid:=EXISTS(SELECT 1 FROM friendly_game_rent_payments WHERE id=o.target_id AND member_id=o.user_id AND pay_status='approved' AND amount=o.amount);
   ELSIF o.kind='share' THEN valid:=EXISTS(SELECT 1 FROM friendly_game_participants WHERE id=o.target_id AND member_id=o.user_id AND pay_status='approved' AND NOT is_waitlisted);
   END IF;
 END IF;
 UPDATE kashier_orders SET status=CASE WHEN valid THEN 'paid' ELSE 'review_required' END$new$);
 EXECUTE f;
 END IF;
END $migration$;
