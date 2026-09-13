-- Super-admin broadcast: send a custom External Push to every subscribed PWA
-- device at once. Unlike inserting into public.notifications, this does NOT
-- create in-app bell entries — it only fires a Web Push that shows on the
-- phone even when the app is closed. Delivery is handled by the existing
-- custom/push "notify-push" edge function in broadcast mode.

DROP FUNCTION IF EXISTS public.send_broadcast_notification(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.send_broadcast_push(
  p_title TEXT,
  p_body TEXT DEFAULT '',
  p_link TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Non-secret constants. Keep in sync with public.notify_push_forward():
  -- same Edge Function project URL + public anon/publishable key.
  v_functions_url TEXT := 'https://wknaiyouwjobmzzjoutz.supabase.co/functions/v1';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrbmFpeW91d2pvYm16empvdXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1Mjc1ODYsImV4cCI6MjEwMjEwMzU4Nn0.oNl-1ctScgybJWMwrQSmJrOvLLhkYJ9zO0E_mwWeaB0';
  v_devices INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  SELECT COUNT(*) INTO v_devices FROM public.push_subscriptions;

  IF v_devices > 0 AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url := v_functions_url || '/notify-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body := jsonb_build_object(
        'broadcast', jsonb_build_object(
          'title', btrim(p_title),
          'body', COALESCE(btrim(COALESCE(p_body, '')), ''),
          'link', NULLIF(btrim(COALESCE(p_link, '')), '')
        )
      ),
      timeout_milliseconds := 5000
    );
  END IF;

  -- Number of devices the push was dispatched to (best effort — the edge
  -- function cleans up expired subscriptions as it sends).
  RETURN v_devices;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_broadcast_push(TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';