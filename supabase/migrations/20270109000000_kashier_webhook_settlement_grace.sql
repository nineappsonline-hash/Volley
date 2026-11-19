-- Keep paid-but-delayed hosted-checkout reservations for a short webhook grace period.
-- Checkout still expires at the original time; only releasing its provisional
-- booking is delayed, so a verified capture can settle without losing seats.
-- After the grace window, expired holds release and late captures require review.
DO $$
DECLARE src text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='expire_kashier_holds' LIMIT 1;
 IF src IS NULL OR position('expires_at<=now()' in src)=0 THEN
  RAISE EXCEPTION 'Unexpected expire_kashier_holds definition';
 END IF;
 src:=replace(src,'expires_at<=now()','expires_at <= now() - interval ''20 minutes''');
 EXECUTE src;

 SELECT pg_get_functiondef(p.oid) INTO src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='settle_kashier_order' LIMIT 1;
 IF src IS NULL OR position('o.expires_at>now()' in src)=0 THEN
  RAISE EXCEPTION 'Unexpected settle_kashier_order definition';
 END IF;
 src:=replace(src,'o.expires_at>now()','o.expires_at > now() - interval ''20 minutes'' AND o.details->>''hold_released'' IS DISTINCT FROM ''true''');
 EXECUTE src;
END $$;
