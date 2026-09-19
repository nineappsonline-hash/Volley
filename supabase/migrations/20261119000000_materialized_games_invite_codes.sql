-- Weekly game instances created by materialize_recurring_games() were inserted
-- without an invite_code, so every recurring instance fell back to the generic
-- /games link instead of having its own unique shareable link.
--
-- Fix:
--   1. materialize_recurring_games() now mints a unique 6-char code for each
--      new weekly instance (same generator as create_friendly_game).
--   2. Backfill: any game still missing a code gets one.
--
-- Same function body as 20260924000000_game_waitlist_and_refunds.sql (the
-- latest prior definition) plus the invite-code minting.

CREATE OR REPLACE FUNCTION public.materialize_recurring_games()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent    public.friendly_games%ROWTYPE;
  v_dt        DATE;
  v_new_id    UUID;
  v_anchor    UUID;
  v_created   INTEGER := 0;
  v_horizon   DATE := CURRENT_DATE + 56;
  v_code      TEXT;
BEGIN
  FOR v_parent IN
    SELECT fg.* FROM public.friendly_games fg
    WHERE fg.recurrence = 'weekly'
      AND fg.source_game_id IS NULL
      AND fg.status IN ('open', 'full')
  LOOP
    v_dt := v_parent.game_date + 1;
    IF v_dt < CURRENT_DATE THEN v_dt := CURRENT_DATE; END IF;
    WHILE v_dt <= v_horizon LOOP
      IF date_part('isodow', v_dt) = date_part('isodow', v_parent.game_date)
         AND NOT EXISTS (
           SELECT 1 FROM public.friendly_games f
           WHERE f.source_game_id = v_parent.id AND f.game_date = v_dt
         )
      THEN
        -- Mint a unique shareable code for this instance (see
        -- 20261016000000_all_games_shareable for the same generator).
        LOOP
          v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
          EXIT WHEN NOT EXISTS (
            SELECT 1 FROM public.friendly_games WHERE invite_code = v_code
          );
        END LOOP;

        INSERT INTO public.friendly_games
          (creator_id, creator_name, creator_nickname, sport, title, description, area, location,
           lat, lng, game_date, start_time, max_players, skill_level, is_public,
           status, source_game_id, recurrence, playground_id, court_number, min_players, duration_hours, playground_hourly_rate,
           share_price, host_pays, host_total, invite_code)
        VALUES
          (v_parent.creator_id, v_parent.creator_name, v_parent.creator_nickname, v_parent.sport,
           v_parent.title, v_parent.description, v_parent.area, v_parent.location,
           v_parent.lat, v_parent.lng, v_dt, v_parent.start_time,
           v_parent.max_players, v_parent.skill_level, v_parent.is_public,
           'open', v_parent.id, 'weekly', v_parent.playground_id, v_parent.court_number, v_parent.min_players, v_parent.duration_hours, v_parent.playground_hourly_rate,
           v_parent.share_price, v_parent.host_pays, v_parent.host_total, v_code)
        RETURNING id INTO v_new_id;

        -- Carry the roster over from the most recent past occurrence,
        -- skipping anyone who only sat on the waitlist.
        SELECT f2.id INTO v_anchor
        FROM public.friendly_games f2
        WHERE (f2.source_game_id = v_parent.id OR f2.id = v_parent.id)
          AND f2.game_date < v_dt AND f2.status <> 'cancelled'
        ORDER BY f2.game_date DESC, f2.id DESC LIMIT 1;
        IF v_anchor IS NOT NULL THEN
          INSERT INTO public.friendly_game_participants (game_id, member_id, role, player_name)
          SELECT v_new_id, member_id, role, player_name
          FROM public.friendly_game_participants
          WHERE game_id = v_anchor
            AND NOT is_waitlisted
          ON CONFLICT DO NOTHING;
        END IF;

        IF v_parent.host_pays THEN
          UPDATE public.friendly_game_participants
          SET share_amount = v_parent.host_total, pay_status = 'unpaid'
          WHERE game_id = v_new_id AND role = 'organizer';
        END IF;

        v_created := v_created + 1;
      END IF;
      v_dt := v_dt + 1;
    END LOOP;
  END LOOP;
  RETURN v_created;
END;
$$;
REVOKE ALL ON FUNCTION public.materialize_recurring_games() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materialize_recurring_games() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Backfill: give any game still missing a code its own unique one (same
-- generator as 20261016000000_all_games_shareable). Covers weekly instances
-- created before this fix.
DO $$
DECLARE
  v_row  RECORD;
  v_code TEXT;
BEGIN
  FOR v_row IN
    SELECT id FROM public.friendly_games WHERE invite_code IS NULL
  LOOP
    LOOP
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.friendly_games WHERE invite_code = v_code
      );
    END LOOP;
    UPDATE public.friendly_games SET invite_code = v_code WHERE id = v_row.id;
  END LOOP;
END
$$;
