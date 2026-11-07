ALTER TABLE public.shop_products ADD COLUMN gender text NOT NULL DEFAULT 'unisex'
 CHECK (gender IN ('men','women','unisex'));
-- Keep all existing catalog validation and stock conflict checks.
DO $migration$ DECLARE f text; old text; BEGIN
 f:=pg_get_functiondef('public.save_shop_product(jsonb,jsonb)'::regprocedure);
 old:='UPDATE public.shop_products SET published=coalesce((p_product->>''published'')::boolean,false) WHERE id=pid;';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Unexpected product save function'; END IF;
 f:=replace(f,old,'UPDATE public.shop_products SET gender=coalesce(nullif(p_product->>''gender'',''''),''unisex''),published=coalesce((p_product->>''published'')::boolean,false) WHERE id=pid;');
 EXECUTE f;
END $migration$;
NOTIFY pgrst,'reload schema';
