-- ────────────────────────────────────────────────────────────
-- Kill-switch for transactional emails
--
-- Emails are OFF by default until the team wires up the mail provider
-- (Resend API key + verified sending domain). The single choke point is
-- public.notify_email_forward(): every confirmation/receipt event passes
-- through it, so guarding there disables everything at once without
-- touching the triggers. Flip it back on later from the SQL editor with
-- SELECT public.set_email_enabled(true);
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;

-- Default: emails disabled.
INSERT INTO public.app_settings (key, value)
VALUES ('email_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Guards the forwarder (and lets a super admin flip emails back on later).
CREATE OR REPLACE FUNCTION public.get_app_setting(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT value INTO v_value FROM public.app_settings WHERE key = p_key;
  RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_email_enabled(p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.app_settings (key, value)
  VALUES ('email_enabled', CASE WHEN p_enabled THEN 'true' ELSE 'false' END)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW();
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_email_enabled(BOOLEAN) TO authenticated;

-- ─┐ Forwarder with the kill-switch ─────────────────────────
CREATE OR REPLACE FUNCTION public.notify_email_forward(p_payload JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_functions_url TEXT := 'https://wknaiyouwjobmzzjoutz.supabase.co/functions/v1';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrbmFpeW91d2pvYm16empvdXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1Mjc1ODYsImV4cCI6MjEwMjEwMzU4Nn0.oNl-1ctScgybJWMwrQSmJrOvLLhkYJ9zO0E_mwWeaB0';
BEGIN
  -- Emails are off until the mail provider is wired up.
  IF COALESCE(public.get_app_setting('email_enabled'), 'false') <> 'true' THEN
    RETURN FALSE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url := v_functions_url || '/notify-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := p_payload,
      timeout_milliseconds := 5000
    );
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

NOTIFY pgrst, 'reload schema';