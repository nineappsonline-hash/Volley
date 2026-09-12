-- ────────────────────────────────────────────────────────────
-- Automatic push reminders for upcoming community games and
-- academy training sessions.
--
-- A pg_cron job runs send_upcoming_reminders() every 15 minutes.
-- For every upcoming game / session whose start is within the
-- reminder windows and that has not been reminded yet, it inserts
-- a row into public.notifications per attendee. The existing
-- "notify_push_on_insert" trigger then forwards each insert to the
-- notify-push Edge Function, delivering both the in-app
-- notification and the browser PWA push notification.
-- ────────────────────────────────────────────────────────────

-- Track that a reminder was already generated per entity.
ALTER TABLE public.friendly_game_participants
  ADD COLUMN IF NOT EXISTS kickoff_reminded_at TIMESTAMPTZ;
ALTER TABLE public.session_bookings
  ADD COLUMN IF NOT EXISTS session_reminded_at TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────
-- send_upcoming_reminders()
-- Generates reminders for:
--   1. Community games (friendly_games) starting within the next
--      24 hours    → "kickoff in ~Xh", 2 hours before kickoff.
--   2. Academy sessions (training_sessions) starting within the
--      next 24 hours → booking reminder, 3 hours before start.
-- Idempotent: each participant/booking is reminded at most once
-- thanks to the reminder_sent_at columns.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_upcoming_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_kickoff TIMESTAMPTZ;
  v_session_start TIMESTAMPTZ;
  v_game RECORD;
  v_session RECORD;
BEGIN
  -- 1) Community games: remind confirmed attendees 2 hours before kickoff.
  FOR v_game IN
    SELECT g.id AS game_id,
           g.game_date,
           g.start_time,
           g.sport,
           g.title,
           g.location,
           p.id   AS member_id
    FROM public.friendly_games g
    JOIN public.friendly_game_participants p ON p.game_id = g.id
    WHERE g.status NOT IN ('cancelled', 'completed')
      AND p.kickoff_reminded_at IS NULL
      AND g.game_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date
  LOOP
    -- The stored date+time are Cairo wall-clock values; interpret them as
    -- Africa/Cairo so comparisons are correct regardless of the DB timezone.
    v_kickoff := (v_game.game_date || ' ' || v_game.start_time)::timestamp
                 AT TIME ZONE 'Africa/Cairo';

    -- Only send when within the window: between 1h and 6h before kickoff.
    IF v_kickoff > NOW() + interval '6 hours' THEN
      CONTINUE;
    END IF;
    IF v_kickoff <= NOW() + interval '1 hour' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_game.member_id,
      'game_alert',
      'Upcoming ' || v_game.sport || ' game',
      concat_ws(' ', 'Your game', '“' || v_game.title || '”', 'starts soon' || coalesce(' at ' || v_game.location, ''))
    , '/games')
    ON CONFLICT DO NOTHING;

    UPDATE public.friendly_game_participants
       SET kickoff_reminded_at = NOW()
     WHERE game_id = v_game.game_id AND member_id = v_game.member_id;

    v_count := v_count + 1;
  END LOOP;

  -- 2) Academy sessions: remind members 3 hours before their booking.
  FOR v_session IN
    SELECT s.id     AS session_id,
           s.academy_id,
           s.date,
           s."time",
           s.location,
           b.member_id,
           b.id     AS booking_id
    FROM public.training_sessions s
    JOIN public.session_bookings b ON b.session_id = s.id
    WHERE s.status <> 'canceled'
      AND b.status IN ('pending', 'confirmed')
      AND b.session_reminded_at IS NULL
      AND s.date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date
  LOOP
    v_session_start := (v_session.date || ' ' || v_session."time")::timestamp
                       AT TIME ZONE 'Africa/Cairo';

    IF v_session_start > NOW() + interval '6 hours' THEN
      CONTINUE;
    END IF;
    IF v_session_start <= NOW() + interval '1 hour' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_session.member_id,
      'game_alert',
      'Training session reminder',
      concat_ws(' ',
        'Your training session starts soon'
        , coalesce('at ' || v_session.location, '')
      ),
      '/schedule'
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.session_bookings
       SET session_reminded_at = NOW()
     WHERE id = v_session.booking_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_upcoming_reminders() TO service_role;

-- ────────────────────────────────────────────────────────────
-- Schedule it with pg_cron (idempotent).
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'playza-upcoming-reminders',
  '*/15 * * * *',
  $$SELECT public.send_upcoming_reminders()$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'playza-upcoming-reminders'
);