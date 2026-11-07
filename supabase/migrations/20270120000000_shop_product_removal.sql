-- Removing a product preserves order and payment history.
ALTER TABLE public.shop_products ADD COLUMN deleted_at timestamptz;
CREATE FUNCTION public.delete_shop_product(p_product uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(public.is_super_admin(),false) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 UPDATE public.shop_products SET published=false,deleted_at=now() WHERE id=p_product AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
 UPDATE public.shop_variants SET active=false WHERE product_id=p_product;
END $$;
REVOKE ALL ON FUNCTION public.delete_shop_product(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_shop_product(uuid) TO authenticated;
-- Archived products cannot be accidentally republished by an already-open editor.
CREATE FUNCTION public.prevent_deleted_shop_product_edit() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'This product has been deleted'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER prevent_deleted_shop_product_edit BEFORE UPDATE ON public.shop_products
 FOR EACH ROW EXECUTE FUNCTION public.prevent_deleted_shop_product_edit();
NOTIFY pgrst,'reload schema';
