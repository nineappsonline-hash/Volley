-- Contact details are available only through the protected platform admin API.
-- Table-level SELECT would override column-level restrictions, so replace it.
REVOKE SELECT ON public.venues FROM PUBLIC, anon, authenticated;
DO $$
DECLARE col RECORD;
BEGIN
  FOR col IN SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues'
  LOOP
    EXECUTE format('REVOKE SELECT (%I) ON public.venues FROM PUBLIC, anon, authenticated', col.column_name);
    IF col.column_name NOT IN ('contact_person', 'contact_phone') THEN
      EXECUTE format('GRANT SELECT (%I) ON public.venues TO anon, authenticated', col.column_name);
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
