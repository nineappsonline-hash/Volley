-- Auto-complete past games: anything whose schedule (kickoff + duration) has
-- ended gets flipped from 'open'/'full' to 'completed', unless a player or
-- admin already cancelled it. Stored dates/times are Africa/Cairo wall-clock
-- values, so convert them with the app's canonical timezone before comparing.

CREATE OR REPLACE FUNCTION public.auto_complete_ended_games()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.friendly_games
     SET status = 'completed'
   WHERE status IN ('open', 'full')
     AND ((game_date || ' ' || start_time)::timestamp
          AT TIME ZONE 'Africa/Cairo'
          + COALESCE(duration_hours, 1) * interval '1 hour') <= NOW();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- Run frequently so games flip shortly after their scheduled end, and keep a
-- late-night sweep as a safety net. Both are idempotent.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_class WHERE relname = 'job') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'volley-game-auto-complete') THEN
      PERFORM cron.unschedule('volley-game-auto-complete');
    END IF;
    PERFORM cron.schedule('volley-game-auto-complete', '*/5 * * * *',
      $$SELECT public.auto_complete_ended_games()$$);

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'volley-daily-housekeeping') THEN
      PERFORM cron.unschedule('volley-daily-housekeeping');
    END IF;
    PERFORM cron.schedule('volley-daily-housekeeping', '0 3 * * *',
      $$SELECT public.auto_complete_ended_games()$$);
  END IF;
END
$do$;

NOTIFY pgrst, 'reload schema';