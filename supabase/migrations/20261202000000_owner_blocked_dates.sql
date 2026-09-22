-- Playground owners pick unavailable dates (whole day or time windows) from a
-- calendar in their dashboard. Each one-off block is stored in a new
-- `blocked_dates` JSONB column and enforced by pick_free_court so no venue
-- rental or friendly game can be booked during a blocked window.
--
-- Entry shape (ISO date, 24h "HH:MM" times):
--   { "date": "2026-12-25", "all_day": true }
--   { "date": "2026-12-26", "start": "09:00", "end": "12:00" }

ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS blocked_dates JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.pick_free_court(
  p_venue_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_duration_minutes INTEGER,
  p_exclude_rental UUID DEFAULT NULL,
  p_exclude_game UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_courts INTEGER;
  v_court  INTEGER;
  v_start  INTEGER := public.minutes_of_day(p_start_time);
  v_end    INTEGER := v_start + p_duration_minutes;
  v_free   BOOLEAN;
BEGIN
  SELECT court_count INTO v_courts FROM public.venues WHERE id = p_venue_id;
  IF v_courts IS NULL OR v_courts <= 0 THEN
    RETURN NULL;
  END IF;

  FOR v_court IN 1..v_courts LOOP
    SELECT NOT EXISTS (
      SELECT 1 FROM public.venue_rentals r
      WHERE r.venue_id = p_venue_id
        AND r.rental_date = p_date
        AND public.minutes_of_day(r.start_time) < v_end
        AND v_start < public.minutes_of_day(r.start_time) + r.hours * 60
        AND (r.court_number = v_court OR (v_court = 1 AND r.court_number IS NULL))
        AND r.id IS DISTINCT FROM p_exclude_rental
    ) INTO v_free;
    IF v_free THEN
      SELECT NOT EXISTS (
        SELECT 1 FROM public.friendly_games f
        WHERE f.playground_id = p_venue_id
          AND f.game_date = p_date
          AND f.status <> 'cancelled'
          AND public.minutes_of_day(f.start_time) < v_end
          AND v_start < public.minutes_of_day(f.start_time) + COALESCE(f.duration_hours, 1) * 60
          AND (f.court_number = v_court OR (v_court = 1 AND f.court_number IS NULL))
          AND f.id IS DISTINCT FROM p_exclude_game
      ) INTO v_free;
    END IF;
    IF v_free THEN
      -- Owner-blocked dates: whole-day entries block any time; window entries
      -- only the stated range. Malformed or reversed ranges are ignored.
      SELECT NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          (SELECT COALESCE(blocked_dates, '[]'::jsonb) FROM public.venues WHERE id = p_venue_id)
        ) blk
        WHERE blk ->> 'date' = to_char(p_date, 'YYYY-MM-DD')
          AND (
            blk ->> 'all_day' = 'true'
            OR (
              (blk ->> 'start') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
              AND (blk ->> 'end') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
              AND (blk ->> 'start') < (blk ->> 'end')
              AND public.minutes_of_day((blk ->> 'start')::time) < v_end
              AND v_start < public.minutes_of_day((blk ->> 'end')::time)
            )
          )
      ) INTO v_free;
    END IF;
    IF v_free THEN
      RETURN v_court;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.pick_free_court(UUID, DATE, TIME, INTEGER, UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';