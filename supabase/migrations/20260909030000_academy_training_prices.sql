-- Public training offering; null means the academy has not set a price yet.
ALTER TABLE public.academies
  ADD COLUMN IF NOT EXISTS monthly_sessions INTEGER CHECK (monthly_sessions BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10,2) CHECK (monthly_price >= 0 AND monthly_price <> 'NaN'::numeric),
  ADD COLUMN IF NOT EXISTS tryout_price NUMERIC(10,2) CHECK (tryout_price >= 0 AND tryout_price <> 'NaN'::numeric);

ALTER TABLE public.academies DROP CONSTRAINT IF EXISTS academy_monthly_offering_complete;
ALTER TABLE public.academies ADD CONSTRAINT academy_monthly_offering_complete
  CHECK ((monthly_sessions IS NULL) = (monthly_price IS NULL));

-- Existing academy UPDATE policies are broad. Guard these fields even on direct writes.
CREATE OR REPLACE FUNCTION public.guard_academy_training_prices()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (NEW.monthly_sessions IS DISTINCT FROM OLD.monthly_sessions
      OR NEW.monthly_price IS DISTINCT FROM OLD.monthly_price
      OR NEW.tryout_price IS DISTINCT FROM OLD.tryout_price)
    AND auth.uid() IS NOT NULL THEN
    IF public.is_account_blocked() OR NOT (
      COALESCE(public.is_super_admin(), FALSE) OR EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
          AND p.role = 'admin' AND p.is_active AND p.academy_id = OLD.id
      )
    ) THEN
      RAISE EXCEPTION 'Only academy administrators can change training prices' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_academy_training_prices ON public.academies;
CREATE TRIGGER guard_academy_training_prices BEFORE UPDATE ON public.academies
FOR EACH ROW EXECUTE FUNCTION public.guard_academy_training_prices();

CREATE OR REPLACE FUNCTION public.set_academy_training_prices(
  p_academy_id UUID, p_monthly_sessions INTEGER, p_monthly_price NUMERIC, p_tryout_price NUMERIC
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_account_blocked() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF NOT (COALESCE(public.is_super_admin(), FALSE) OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      AND p.is_active AND p.academy_id = p_academy_id
  )) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF (p_monthly_sessions IS NULL) <> (p_monthly_price IS NULL) THEN
    RAISE EXCEPTION 'Enter both monthly sessions and monthly price, or leave both blank';
  END IF;
  IF p_monthly_sessions NOT BETWEEN 1 AND 100
    OR p_monthly_price < 0 OR p_monthly_price >= 100000000 OR p_monthly_price = 'NaN'::numeric
    OR p_tryout_price < 0 OR p_tryout_price >= 100000000 OR p_tryout_price = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Invalid session count or price';
  END IF;
  UPDATE public.academies SET monthly_sessions = p_monthly_sessions,
    monthly_price = p_monthly_price, tryout_price = p_tryout_price WHERE id = p_academy_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Academy not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_academy_training_prices(UUID, INTEGER, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_academy_training_prices(UUID, INTEGER, NUMERIC, NUMERIC) TO authenticated;
NOTIFY pgrst, 'reload schema';
