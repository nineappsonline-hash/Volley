-- Product snapshots survive later catalog/photo edits.
ALTER TABLE public.shop_orders ADD COLUMN product_image text;
UPDATE public.shop_orders o SET product_image=v.images->>0 FROM public.shop_variants v WHERE v.id=o.variant_id;
CREATE FUNCTION public.snapshot_shop_order_image() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 SELECT images->>0 INTO NEW.product_image FROM public.shop_variants WHERE id=NEW.variant_id;
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_shop_order_image BEFORE INSERT ON public.shop_orders FOR EACH ROW EXECUTE FUNCTION public.snapshot_shop_order_image();

-- Guest identities are random browser secrets hashed by the server. Never exposed by RLS.
ALTER TABLE public.shop_orders ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE public.shop_orders ADD COLUMN guest_hash text, ADD COLUMN guest_rate_key text;
ALTER TABLE public.shop_orders ADD CONSTRAINT shop_order_identity CHECK(
 (member_id IS NOT NULL AND guest_hash IS NULL) OR (member_id IS NULL AND guest_hash IS NOT NULL AND guest_hash ~ '^[0-9a-f]{64}$'));
CREATE UNIQUE INDEX shop_guest_request ON public.shop_orders(guest_hash,request_id) WHERE guest_hash IS NOT NULL;
CREATE INDEX shop_guest_rate ON public.shop_orders(guest_rate_key,created_at) WHERE guest_rate_key IS NOT NULL;
ALTER TABLE public.kashier_orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.kashier_orders ADD CONSTRAINT kashier_guest_shop_only CHECK(user_id IS NOT NULL OR kind='shop');

CREATE FUNCTION public.create_guest_shop_order(p_guest_hash text,p_rate_key text,p_variant uuid,p_quantity integer,p_fulfillment text,p_name text,p_phone text,p_address text,p_request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.shop_variants%ROWTYPE; p public.shop_products%ROWTYPE; oid uuid; fee numeric;
BEGIN
 IF p_guest_hash IS NULL OR p_guest_hash !~ '^[0-9a-f]{64}$' OR p_request IS NULL THEN RAISE EXCEPTION 'Invalid order request'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_guest_hash,0));
 SELECT id INTO oid FROM public.shop_orders WHERE guest_hash=p_guest_hash AND request_id=p_request;
 IF FOUND THEN RETURN oid; END IF;
 IF p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 10 OR p_fulfillment IS NULL OR p_fulfillment NOT IN ('collection','delivery') THEN RAISE EXCEPTION 'Choose quantity and fulfillment'; END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 OR length(btrim(coalesce(p_phone,''))) NOT BETWEEN 7 AND 30 THEN RAISE EXCEPTION 'Enter your name and phone'; END IF;
 IF p_fulfillment='delivery' AND length(btrim(coalesce(p_address,''))) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'Enter a complete delivery address'; END IF;
 PERFORM public.expire_shop_orders();
 IF (SELECT count(*) FROM public.shop_orders WHERE guest_hash=p_guest_hash AND status='awaiting_payment')>=3 THEN RAISE EXCEPTION 'Complete an existing order before creating another'; END IF;
 IF p_rate_key IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_rate_key,1));
  IF (SELECT count(*) FROM public.shop_orders WHERE guest_rate_key=p_rate_key AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'Too many order attempts. Try again later'; END IF;
 END IF;
 SELECT * INTO v FROM public.shop_variants WHERE id=p_variant FOR UPDATE;
 IF NOT FOUND OR NOT v.active OR v.stock<p_quantity THEN RAISE EXCEPTION 'This color and size is out of stock'; END IF;
 SELECT * INTO p FROM public.shop_products WHERE id=v.product_id FOR SHARE;
 IF NOT FOUND OR NOT p.published THEN RAISE EXCEPTION 'Product is unavailable'; END IF;
 fee:=CASE WHEN p_fulfillment='delivery' THEN 90 ELSE 0 END;
 UPDATE public.shop_variants SET stock=stock-p_quantity WHERE id=v.id;
 INSERT INTO public.shop_orders(member_id,guest_hash,guest_rate_key,variant_id,product_name,color,size,quantity,unit_price,delivery_fee,total,fulfillment,customer_name,phone,address,request_id)
 VALUES(NULL,p_guest_hash,p_rate_key,v.id,p.name,v.color,v.size,p_quantity,p.price,fee,p.price*p_quantity+fee,p_fulfillment,btrim(p_name),btrim(p_phone),CASE WHEN p_fulfillment='delivery' THEN btrim(p_address) ELSE '' END,p_request) RETURNING id INTO oid;
 RETURN oid;
END $$;
REVOKE ALL ON FUNCTION public.create_guest_shop_order(text,text,uuid,integer,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_shop_order(text,text,uuid,integer,text,text,text,text,uuid) TO service_role;

CREATE FUNCTION public.submit_guest_shop_receipt(p_guest_hash text,p_order uuid,p_method text,p_receipt text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_method IS NULL OR p_method NOT IN ('instapay','e_wallet') OR p_receipt IS NULL OR p_receipt NOT LIKE 'guest/'||p_order::text||'/%' OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='game-fee-receipts' AND name=p_receipt) THEN RAISE EXCEPTION 'Upload a receipt and choose a payment method'; END IF;
 UPDATE public.shop_orders SET status='pending_review',pay_method=p_method,receipt_url=p_receipt WHERE id=p_order AND guest_hash=p_guest_hash AND member_id IS NULL AND status='awaiting_payment' AND hold_until>now() AND coalesce(pay_method,'')<>'kashier';
 IF NOT FOUND THEN RAISE EXCEPTION 'Order is no longer awaiting payment'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.submit_guest_shop_receipt(text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_guest_shop_receipt(text,uuid,text,text) TO service_role;

CREATE FUNCTION public.prepare_guest_shop_card(p_guest_hash text,p_order uuid,p_mode text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.shop_orders%ROWTYPE; o public.kashier_orders%ROWTYPE;
BEGIN
 IF p_mode IS NULL OR p_mode NOT IN ('test','live') THEN RAISE EXCEPTION 'Invalid payment mode'; END IF;
 PERFORM public.expire_shop_orders();
 SELECT * INTO s FROM public.shop_orders WHERE id=p_order AND guest_hash=p_guest_hash AND member_id IS NULL FOR UPDATE;
 IF NOT FOUND OR s.status<>'awaiting_payment' OR s.hold_until<=now() OR s.receipt_url IS NOT NULL THEN RAISE EXCEPTION 'Order is no longer awaiting payment'; END IF;
 IF EXISTS(SELECT 1 FROM public.kashier_orders WHERE kind='shop' AND target_id=s.id AND status='review_required') THEN RAISE EXCEPTION 'Your payment needs review. Do not pay again'; END IF;
 SELECT * INTO o FROM public.kashier_orders WHERE kind='shop' AND target_id=s.id AND user_id IS NULL AND mode=p_mode AND status='pending' AND expires_at>now() ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN RETURN to_jsonb(o)||jsonb_build_object('is_new',false); END IF;
 UPDATE public.shop_orders SET pay_method='kashier' WHERE id=s.id;
 INSERT INTO public.kashier_orders(user_id,kind,target_id,request_key,details,amount,mode,expires_at)
 VALUES(NULL,'shop',s.id,'shop:'||s.id,jsonb_build_object('label','Playza Shop','shop_order',s.id),s.total,p_mode,s.hold_until) RETURNING * INTO o;
 RETURN to_jsonb(o)||jsonb_build_object('is_new',true);
END $$;
REVOKE ALL ON FUNCTION public.prepare_guest_shop_card(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_guest_shop_card(text,uuid,text) TO service_role;

-- Reuse verified card settlement/review for guest shop orders. Null identity only
-- applies to shop orders; all other kinds still require a member identity.
DO $migration$ DECLARE f text; name text; BEGIN
 FOREACH name IN ARRAY ARRAY['public.settle_kashier_order(uuid,text,numeric,text)','public.review_card_payment(uuid,uuid,boolean)'] LOOP
  f:=pg_get_functiondef(name::regprocedure);
  f:=replace(f,'member_id=o.user_id','member_id IS NOT DISTINCT FROM o.user_id');
  IF name LIKE '%settle_kashier_order%' THEN f:=replace(f,'IF o.kind=''shop'' THEN','IF o.kind=''shop'' THEN PERFORM public.expire_shop_orders();'); END IF;
  EXECUTE f;
 END LOOP;
END $migration$;
NOTIFY pgrst,'reload schema';
