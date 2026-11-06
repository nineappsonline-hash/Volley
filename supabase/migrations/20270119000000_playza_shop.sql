CREATE TABLE public.shop_products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 name_ar text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '', description_ar text NOT NULL DEFAULT '',
 price numeric(10,2) NOT NULL CHECK(price>0), size_chart jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(size_chart)='array'),
 published boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.shop_variants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES public.shop_products(id) ON DELETE CASCADE,
 color text NOT NULL CHECK(length(btrim(color)) BETWEEN 1 AND 60), color_ar text NOT NULL DEFAULT '',
 color_hex text NOT NULL CHECK(color_hex ~ '^#[0-9a-fA-F]{6}$'), size text NOT NULL CHECK(length(btrim(size)) BETWEEN 1 AND 20),
 images jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(images)='array'), stock integer NOT NULL DEFAULT 0 CHECK(stock>=0),
 active boolean NOT NULL DEFAULT true, UNIQUE(product_id,color,size)
);
CREATE INDEX shop_variant_product ON public.shop_variants(product_id);
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY shop_product_read ON public.shop_products FOR SELECT TO anon,authenticated USING(published);
CREATE POLICY shop_product_admin ON public.shop_products FOR ALL TO authenticated USING((SELECT public.is_super_admin())) WITH CHECK((SELECT public.is_super_admin()));
CREATE POLICY shop_variant_read ON public.shop_variants FOR SELECT TO anon,authenticated USING(active AND EXISTS(SELECT 1 FROM public.shop_products p WHERE p.id=product_id AND p.published));
CREATE POLICY shop_variant_admin ON public.shop_variants FOR ALL TO authenticated USING((SELECT public.is_super_admin())) WITH CHECK((SELECT public.is_super_admin()));
GRANT SELECT ON public.shop_products,public.shop_variants TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.shop_products,public.shop_variants TO authenticated;

CREATE TABLE public.shop_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES public.profiles(id),
 variant_id uuid NOT NULL REFERENCES public.shop_variants(id), product_name text NOT NULL, color text NOT NULL, size text NOT NULL,
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 10), unit_price numeric(10,2) NOT NULL CHECK(unit_price>0),
 delivery_fee numeric(10,2) NOT NULL CHECK(delivery_fee IN (0,90)), total numeric(10,2) NOT NULL CHECK(total=unit_price*quantity+delivery_fee),
 fulfillment text NOT NULL CHECK(fulfillment IN ('collection','delivery')), customer_name text NOT NULL, phone text NOT NULL, address text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'awaiting_payment' CHECK(status IN ('awaiting_payment','pending_review','paid','fulfilled','rejected','expired','review_required')),
 pay_method text CHECK(pay_method IN ('instapay','e_wallet','kashier')), receipt_url text,
 hold_until timestamptz NOT NULL DEFAULT now()+interval '30 minutes', created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz,
 request_id uuid NOT NULL, UNIQUE(member_id,request_id)
);
CREATE UNIQUE INDEX shop_order_receipt ON public.shop_orders(receipt_url) WHERE receipt_url IS NOT NULL;
CREATE INDEX shop_order_member ON public.shop_orders(member_id,created_at DESC);
CREATE INDEX shop_order_expiry ON public.shop_orders(hold_until) WHERE status='awaiting_payment';
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY shop_order_read ON public.shop_orders FOR SELECT TO authenticated USING(member_id=(SELECT auth.uid()) OR (SELECT public.is_super_admin()));
GRANT SELECT ON public.shop_orders TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.shop_orders FROM anon,authenticated;

CREATE FUNCTION public.expire_shop_orders() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o record; BEGIN
 FOR o IN SELECT * FROM public.shop_orders WHERE status='awaiting_payment' AND hold_until<=now() ORDER BY id FOR UPDATE SKIP LOCKED LOOP
  UPDATE public.shop_orders SET status='expired' WHERE id=o.id;
  UPDATE public.shop_variants SET stock=stock+o.quantity WHERE id=o.variant_id;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.expire_shop_orders() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.create_shop_order(p_variant uuid,p_quantity integer,p_fulfillment text,p_name text,p_phone text,p_address text,p_request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.shop_variants%ROWTYPE; p public.shop_products%ROWTYPE; oid uuid; uid uuid:=auth.uid(); fee numeric;
BEGIN
 IF uid IS NULL OR public.is_account_blocked() THEN RAISE EXCEPTION 'Sign in with an active account'; END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'Request reference is required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||p_request::text,0));
 SELECT id INTO oid FROM public.shop_orders WHERE member_id=uid AND request_id=p_request;
 IF FOUND THEN RETURN oid; END IF;
 IF p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 10 OR p_fulfillment IS NULL OR p_fulfillment NOT IN ('collection','delivery') THEN RAISE EXCEPTION 'Choose quantity and fulfillment'; END IF;
 IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120 OR length(btrim(coalesce(p_phone,''))) NOT BETWEEN 7 AND 30 THEN RAISE EXCEPTION 'Enter your name and phone'; END IF;
 IF p_fulfillment='delivery' AND length(btrim(coalesce(p_address,''))) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'Enter a complete delivery address'; END IF;
 PERFORM public.expire_shop_orders();
 SELECT * INTO v FROM public.shop_variants WHERE id=p_variant FOR UPDATE;
 IF NOT FOUND OR NOT v.active OR v.stock<p_quantity THEN RAISE EXCEPTION 'This color and size is out of stock'; END IF;
 SELECT * INTO p FROM public.shop_products WHERE id=v.product_id FOR SHARE;
 IF NOT FOUND OR NOT p.published THEN RAISE EXCEPTION 'Product is unavailable'; END IF;
 fee:=CASE WHEN p_fulfillment='delivery' THEN 90 ELSE 0 END;
 UPDATE public.shop_variants SET stock=stock-p_quantity WHERE id=v.id;
 INSERT INTO public.shop_orders(member_id,variant_id,product_name,color,size,quantity,unit_price,delivery_fee,total,fulfillment,customer_name,phone,address,request_id)
 VALUES(uid,v.id,p.name,v.color,v.size,p_quantity,p.price,fee,p.price*p_quantity+fee,p_fulfillment,btrim(p_name),btrim(p_phone),CASE WHEN p_fulfillment='delivery' THEN btrim(p_address) ELSE '' END,p_request) RETURNING id INTO oid;
 RETURN oid;
END $$;
REVOKE ALL ON FUNCTION public.create_shop_order(uuid,integer,text,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_shop_order(uuid,integer,text,text,text,text,uuid) TO authenticated;

CREATE FUNCTION public.submit_shop_receipt(p_order uuid,p_method text,p_receipt text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_method IS NULL OR p_method NOT IN ('instapay','e_wallet') OR split_part(coalesce(p_receipt,''),'/',1)<>auth.uid()::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='game-fee-receipts' AND name=p_receipt) THEN RAISE EXCEPTION 'Upload your receipt and select a payment method'; END IF;
 UPDATE public.shop_orders SET status='pending_review',pay_method=p_method,receipt_url=p_receipt
 WHERE id=p_order AND member_id=auth.uid() AND status='awaiting_payment' AND hold_until>now() AND coalesce(pay_method,'')<>'kashier';
 IF NOT FOUND THEN RAISE EXCEPTION 'This order is no longer awaiting payment'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.submit_shop_receipt(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_shop_receipt(uuid,text,text) TO authenticated;

CREATE FUNCTION public.review_shop_order(p_order uuid,p_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.shop_orders%ROWTYPE; BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO o FROM public.shop_orders WHERE id=p_order FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF p_action='fulfill' AND o.status='paid' THEN UPDATE public.shop_orders SET status='fulfilled',reviewed_at=now() WHERE id=o.id;
 ELSIF p_action='approve' AND o.status='pending_review' AND o.pay_method IN ('instapay','e_wallet') THEN UPDATE public.shop_orders SET status='paid',reviewed_at=now() WHERE id=o.id;
 ELSIF p_action='reject' AND o.status='pending_review' AND o.pay_method IN ('instapay','e_wallet') THEN
  UPDATE public.shop_orders SET status='rejected',reviewed_at=now() WHERE id=o.id;
  UPDATE public.shop_variants SET stock=stock+o.quantity WHERE id=o.variant_id;
 ELSE RAISE EXCEPTION 'This action is not available for this order'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.review_shop_order(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_shop_order(uuid,text) TO authenticated;

-- Extend the existing hosted card checkout and verified webhook settlement.
ALTER TABLE public.kashier_orders DROP CONSTRAINT kashier_orders_kind_check;
ALTER TABLE public.kashier_orders ADD CONSTRAINT kashier_orders_kind_check CHECK(kind IN ('academy','share','rent','subscription','shop'));
DO $migration$ DECLARE f text; BEGIN
 f:=pg_get_functiondef('public.prepare_kashier_order(uuid,jsonb,text)'::regprocedure);
 IF strpos(f,'IF k=''academy'' THEN')=0 THEN RAISE EXCEPTION 'Unexpected card preparation function'; END IF;
 f:=replace(f,$old$('academy','share','rent','subscription')$old$,$new$('academy','share','rent','subscription','shop')$new$);
 f:=replace(f,$old$IF k='academy' THEN$old$,$patch$IF k='shop' THEN
  PERFORM public.expire_shop_orders();
  SELECT total,hold_until INTO amount,expiry FROM public.shop_orders WHERE id=target AND member_id=p_user AND status='awaiting_payment' AND hold_until>now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This shop order is no longer awaiting payment'; END IF;
  IF EXISTS(SELECT 1 FROM public.shop_orders WHERE id=target AND receipt_url IS NOT NULL) THEN RAISE EXCEPTION 'A transfer receipt has already been submitted'; END IF;
  UPDATE public.shop_orders SET pay_method='kashier' WHERE id=target;
  info:=jsonb_build_object('label','Playza Shop','shop_order',target);
 ELSIF k='academy' THEN$patch$);
 EXECUTE f;
 f:=pg_get_functiondef('public.settle_kashier_order(uuid,text,numeric,text)'::regprocedure);
 IF strpos(f,'IF o.kind=''academy'' THEN')=0 THEN RAISE EXCEPTION 'Unexpected card settlement function'; END IF;
 f:=replace(f,$old$IF o.kind='academy' THEN$old$,$patch$IF o.kind='shop' THEN
  UPDATE public.shop_orders SET status='paid',reviewed_at=now() WHERE id=o.target_id AND member_id=o.user_id AND total=o.amount AND status='awaiting_payment' AND hold_until>now() AND pay_method='kashier';
  valid:=FOUND;
  IF NOT valid THEN UPDATE public.shop_orders SET status='review_required' WHERE id=o.target_id AND member_id=o.user_id AND status NOT IN ('paid','fulfilled'); END IF;
 ELSIF o.kind='academy' THEN$patch$);
 EXECUTE f;
 f:=pg_get_functiondef('public.expire_kashier_holds()'::regprocedure);
 f:=replace(f,'FOR o IN SELECT','PERFORM public.expire_shop_orders(); FOR o IN SELECT');
 EXECUTE f;
END $migration$;
NOTIFY pgrst,'reload schema';

-- Public product photographs; only platform administrators may upload/edit them.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('shop-images','shop-images',true,8388608,ARRAY['image/jpeg','image/png','image/webp','image/avif']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY shop_images_read ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='shop-images');
CREATE POLICY shop_images_admin ON storage.objects FOR ALL TO authenticated
 USING(bucket_id='shop-images' AND (SELECT public.is_super_admin()))
 WITH CHECK(bucket_id='shop-images' AND (SELECT public.is_super_admin()));

CREATE FUNCTION public.save_shop_product(p_product jsonb,p_variants jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pid uuid; v jsonb; existing public.shop_variants%ROWTYPE; measurement jsonb;
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF jsonb_typeof(p_variants) IS DISTINCT FROM 'array' OR jsonb_array_length(p_variants)>200 THEN RAISE EXCEPTION 'Invalid variants'; END IF;
 pid:=(p_product->>'id')::uuid;
 IF pid IS NULL THEN RAISE EXCEPTION 'Product reference is required'; END IF;
 IF coalesce((p_product->>'published')::boolean,false) THEN
  IF jsonb_array_length(p_variants)=0 OR jsonb_typeof(p_product->'size_chart') IS DISTINCT FROM 'array' OR jsonb_array_length(p_product->'size_chart')=0 THEN RAISE EXCEPTION 'Add variants and size measurements before publishing'; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_variants) entry(value) WHERE coalesce((entry.value->>'active')::boolean,true)) THEN RAISE EXCEPTION 'Add at least one active variant'; END IF;
  FOR measurement IN SELECT value FROM jsonb_array_elements(p_product->'size_chart') LOOP
   IF length(btrim(coalesce(measurement->>'size','')))=0 OR coalesce((measurement->>'chest')::numeric,0)<=0 OR coalesce((measurement->>'length')::numeric,0)<=0 THEN RAISE EXCEPTION 'Enter each size and its chest width and length in cm'; END IF;
  END LOOP;
 END IF;
 INSERT INTO public.shop_products(id,name,name_ar,description,description_ar,price,size_chart,published)
 VALUES(pid,btrim(p_product->>'name'),coalesce(p_product->>'name_ar',''),coalesce(p_product->>'description',''),coalesce(p_product->>'description_ar',''),(p_product->>'price')::numeric,coalesce(p_product->'size_chart','[]'::jsonb),false)
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_ar=excluded.name_ar,description=excluded.description,description_ar=excluded.description_ar,price=excluded.price,size_chart=excluded.size_chart;
 FOR v IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
  SELECT * INTO existing FROM public.shop_variants WHERE id=(v->>'id')::uuid FOR UPDATE;
  IF FOUND AND (existing.product_id<>pid OR existing.stock IS DISTINCT FROM (v->>'original_stock')::integer) THEN RAISE EXCEPTION 'Stock changed while editing. Refresh the catalog and try again'; END IF;
  IF coalesce((p_product->>'published')::boolean,false) AND coalesce((v->>'active')::boolean,true) THEN
   IF jsonb_typeof(v->'images') IS DISTINCT FROM 'array' OR jsonb_array_length(v->'images')=0 THEN RAISE EXCEPTION 'Add photos for every active color'; END IF;
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_product->'size_chart') m WHERE m->>'size'=v->>'size') THEN RAISE EXCEPTION 'Add measurements for every active size'; END IF;
  END IF;
  INSERT INTO public.shop_variants(id,product_id,color,color_ar,color_hex,size,images,stock,active)
  VALUES((v->>'id')::uuid,pid,btrim(v->>'color'),coalesce(v->>'color_ar',''),v->>'color_hex',btrim(v->>'size'),coalesce(v->'images','[]'::jsonb),(v->>'stock')::integer,coalesce((v->>'active')::boolean,true))
  ON CONFLICT(id) DO UPDATE SET color=excluded.color,color_ar=excluded.color_ar,color_hex=excluded.color_hex,size=excluded.size,images=excluded.images,stock=excluded.stock,active=excluded.active;
 END LOOP;
 UPDATE public.shop_variants SET active=false WHERE product_id=pid AND id NOT IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(p_variants) x);
 UPDATE public.shop_products SET published=coalesce((p_product->>'published')::boolean,false) WHERE id=pid;
 RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.save_shop_product(jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_shop_product(jsonb,jsonb) TO authenticated;
-- Catalog writes go through validation; readers keep their role-specific policies.
REVOKE INSERT,UPDATE,DELETE ON public.shop_products,public.shop_variants FROM authenticated;

GRANT ALL ON public.shop_products,public.shop_variants,public.shop_orders TO service_role;
-- Existing platform card-review authorization and audit history also cover shop orders.
DO $migration$ DECLARE f text; BEGIN
 f:=pg_get_functiondef('public.review_card_payment(uuid,uuid,boolean)'::regprocedure);
 IF strpos(f,$x$('share','rent','subscription')$x$)=0 OR strpos(f,$x$IF o.kind='rent' THEN$x$)=0 THEN RAISE EXCEPTION 'Unexpected card review function'; END IF;
 f:=replace(f,$x$('share','rent','subscription')$x$,$x$('share','rent','subscription','shop')$x$);
 f:=replace(f,$old$IF o.kind='rent' THEN$old$,$patch$IF o.kind='shop' THEN
   PERFORM public.expire_shop_orders();
   IF NOT EXISTS(SELECT 1 FROM public.shop_orders WHERE id=o.target_id AND member_id=o.user_id AND total=o.amount AND pay_method='kashier') THEN RAISE EXCEPTION 'Shop payment record not found'; END IF;
   IF NOT p_approve AND EXISTS(SELECT 1 FROM public.shop_orders WHERE id=o.target_id AND status='fulfilled') THEN RAISE EXCEPTION 'This order was fulfilled; handle any refund separately'; END IF;
   IF p_approve THEN
     IF EXISTS(SELECT 1 FROM public.shop_orders WHERE id=o.target_id AND status IN ('expired','review_required','rejected')) THEN
       UPDATE public.shop_variants v SET stock=v.stock-shop_row.quantity FROM public.shop_orders shop_row WHERE shop_row.id=o.target_id AND v.id=shop_row.variant_id AND v.stock>=shop_row.quantity;
       IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient stock. Arrange a manual refund instead'; END IF;
     END IF;
     UPDATE public.shop_orders SET status='paid',reviewed_at=now() WHERE id=o.target_id AND status<>'fulfilled';
   ELSE
     UPDATE public.shop_variants v SET stock=v.stock+shop_row.quantity FROM public.shop_orders shop_row WHERE shop_row.id=o.target_id AND v.id=shop_row.variant_id AND shop_row.status IN ('awaiting_payment','paid','pending_review');
     UPDATE public.shop_orders SET status='rejected',reviewed_at=now() WHERE id=o.target_id;
   END IF;
 ELSIF o.kind='rent' THEN$patch$);
 EXECUTE f;
 f:=pg_get_functiondef('public.settle_kashier_order(uuid,text,numeric,text)'::regprocedure);
 f:=replace(f,$old$IF o.kind='rent' THEN valid:=$old$,$patch$IF o.kind='shop' THEN valid:=EXISTS(SELECT 1 FROM public.shop_orders WHERE id=o.target_id AND member_id=o.user_id AND total=o.amount AND status IN ('paid','fulfilled'));
   ELSIF o.kind='rent' THEN valid:=$patch$);
 EXECUTE f;
END $migration$;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  PERFORM cron.schedule('expire-shop-orders','* * * * *','SELECT public.expire_shop_orders()');
 END IF;
END $$;
