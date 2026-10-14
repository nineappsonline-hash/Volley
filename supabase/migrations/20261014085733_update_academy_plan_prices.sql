-- Update new academy purchases; historical payments and member Pro prices remain unchanged.
CREATE OR REPLACE FUNCTION public.plan_price(
  p_kind TEXT,
  p_plan TEXT,
  p_cycle TEXT
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_kind = 'member' AND p_plan = 'pro' THEN
      CASE p_cycle WHEN 'monthly' THEN 100 WHEN 'semi' THEN 500 WHEN 'yearly' THEN 1000 END
    WHEN p_kind = 'academy' AND p_plan = 'plus' THEN
      CASE p_cycle WHEN 'monthly' THEN 1500 WHEN 'yearly' THEN 15000 END
    WHEN p_kind = 'academy' AND p_plan = 'elite' THEN
      CASE p_cycle WHEN 'monthly' THEN 1900 WHEN 'yearly' THEN 19000 END
    ELSE NULL
  END
$$;
GRANT EXECUTE ON FUNCTION public.plan_price(TEXT, TEXT, TEXT) TO authenticated;

