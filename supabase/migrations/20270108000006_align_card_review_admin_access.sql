-- Reuse the existing verified-Auth super-admin allowlist. A profile's role or
-- academy activity is not the platform administrator's authorization source.
-- This routine remains invoker-only and callable only by service_role.
DO $migration$
DECLARE f text; old_gate text; new_gate text;
BEGIN
 f:=pg_get_functiondef('public.review_card_payment(uuid,uuid,boolean)'::regprocedure);
 old_gate:=$old$ IF (SELECT auth.jwt()->>'role') IS DISTINCT FROM 'service_role' OR NOT EXISTS(
   SELECT 1 FROM public.profiles WHERE id=p_actor AND role='super_admin' AND is_active
 ) THEN RAISE EXCEPTION 'Not authorized'; END IF;$old$;
 new_gate:=$new$ IF (SELECT auth.jwt()->>'role') IS DISTINCT FROM 'service_role' OR p_actor IS NULL THEN
   RAISE EXCEPTION 'Not authorized';
 END IF;
 -- The API supplies the verified caller, never a client-provided actor. Check
 -- that actor with the same is_super_admin() function used by API and RLS.
 -- Preserve the service request's subject before any business mutations.
 prior_subject:=current_setting('request.jwt.claim.sub',true);
 PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);
 actor_allowed:=public.is_super_admin();
 PERFORM set_config('request.jwt.claim.sub',coalesce(prior_subject,''),true);
 IF actor_allowed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Not authorized'; END IF;$new$;
 IF strpos(f,old_gate)=0 THEN
   IF strpos(f,'actor_allowed:=public.is_super_admin()')>0 THEN RETURN; END IF;
   RAISE EXCEPTION 'Unexpected payment review authorization definition';
 END IF;
 f:=replace(f,'n integer;','n integer; prior_subject text; actor_allowed boolean;');
 f:=replace(f,old_gate,new_gate);
 EXECUTE f;
END $migration$;
