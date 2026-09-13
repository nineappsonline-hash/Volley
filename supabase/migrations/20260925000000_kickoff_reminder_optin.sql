-- ────────────────────────────────────────────────────────────
-- Kickoff reminders with a per-participant "remind me" toggle.
--
-- send_upcoming_reminders() (scheduled by pg_cron every 15 minutes)
-- previously pushed a game_alert 1-6 hours before kickoff to every
-- participant unconditionally. Now each participant controls whether
-- they receive it via kickoff_remind_opt_in (default TRUE) and the
-- window is tightened to roughly the hour before kickoff (30-90 min).
-- Waitlisted players and cancelled/completed games are skipped.
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.friendly_game_participants
  ADD COLUMN IF NOT EXISTS kickoff_remind_opt_in BOOLEAN NOT NULL DEFAULT TRUE;

-- Toggle the kickoff reminder for the caller on a given game.
CREATE OR REPLACE FUNCTION public.set_kickoff_reminder(p_game_id UUID, p_enabled BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.friendly_game_participants
  SET kickoff_remind_opt_in = COALESCE(p_enabled, TRUE)
  WHERE game_id = p_game_id AND member_id = auth.uid() AND NOT is_waitlisted;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not part of this game';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_kickoff_reminder(UUID, BOOLEAN) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- send_upcoming_reminders()
-- Reminds opted-in confirmed participants about community games
-- starting within the next 90 minutes (and at least 30 minutes out),
-- plus academy-session bookings 3 hours before start. Idempotent via
-- the kicked_reminded_at / session_reminded_at columns.
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
  -- 1) Community games: remind opted-in confirmed players ~1 hour ahead.
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
      AND p.is_waitlisted = FALSE
      AND p.kickoff_remind_opt_in = TRUE
      AND p.kickoff_reminded_at IS NULL
      AND g.game_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::date
  LOOP
    -- The stored date+time are Cairo wall-clock values; interpret them as
    -- Africa/Cairo so comparisons are correct regardless of the DB timezone.
    v_kickoff := (v_game.game_date || ' ' || v_game.start_time)::timestamp
                 AT TIME ZONE 'Africa/Cairo';

    -- Only send within the 30-90 minute window before kickoff.
    IF v_kickoff > NOW() + interval '90 minutes' THEN
      CONTINUE;
    END IF;
    IF v_kickoff <= NOW() + interval '30 minutes' THEN
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

NOTIFY pgrst, 'reload schema';