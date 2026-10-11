-- Organizer-requested recruitment alerts, limited to one per game per 24 hours.
CREATE TABLE public.game_recruitment_alerts (
  game_id uuid PRIMARY KEY REFERENCES public.friendly_games(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_recruitment_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_recruitment_alerts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_game_players(p_game_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  g public.friendly_games%ROWTYPE;
  v_slots integer;
  v_sent integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO g FROM public.friendly_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND OR g.creator_id <> auth.uid() THEN RAISE EXCEPTION 'Only the organizer can request players'; END IF;
  IF NOT g.is_public OR g.status <> 'open' OR (g.game_date + g.start_time) <= now() THEN
    RAISE EXCEPTION 'Only upcoming public open games can request players';
  END IF;
  SELECT g.max_players - count(*) INTO v_slots FROM public.friendly_game_participants
    WHERE game_id = g.id AND NOT is_waitlisted;
  IF v_slots <= 0 THEN RAISE EXCEPTION 'This game is full'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_recruitment_alerts WHERE game_id = g.id AND sent_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'You can request players once every 24 hours';
  END IF;
  INSERT INTO public.notifications(recipient_id, type, title, body, link)
  SELECT p.id, 'game_alert',
    'We need ' || v_slots || ' more player' || CASE WHEN v_slots = 1 THEN '' ELSE 's' END,
    g.title || ' · ' || g.sport || ' · ' || g.game_date || ' ' || g.start_time,
    CASE WHEN g.invite_code IS NOT NULL THEN '/dashboard/games?join=' || g.invite_code ELSE '/dashboard/games' END
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id <> g.creator_id AND p.role = 'member' AND p.is_active AND p.notify_game_alerts
    AND (u.banned_until IS NULL OR u.banned_until <= now())
    AND EXISTS (SELECT 1 FROM unnest(p.interested_sports) sport WHERE lower(btrim(sport)) = lower(btrim(g.sport)))
    AND (g.skill_level IS NULL OR p.skill_level IS NULL OR p.skill_level = g.skill_level)
    AND (coalesce(cardinality(p.availability_days), 0) = 0 OR extract(dow FROM g.game_date)::integer = ANY(p.availability_days))
    AND NOT EXISTS (SELECT 1 FROM public.friendly_game_participants fp WHERE fp.game_id = g.id AND fp.member_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM public.blocks b WHERE (b.blocker_id = p.id AND b.blocked_id = g.creator_id) OR (b.blocker_id = g.creator_id AND b.blocked_id = p.id))
  ORDER BY p.id LIMIT 100;
  GET DIAGNOSTICS v_sent = ROW_COUNT;
  IF v_sent > 0 THEN
    INSERT INTO public.game_recruitment_alerts(game_id, sent_at) VALUES(g.id, now())
      ON CONFLICT(game_id) DO UPDATE SET sent_at = excluded.sent_at;
  END IF;
  RETURN v_sent;
END;
$$;
REVOKE ALL ON FUNCTION public.request_game_players(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_game_players(uuid) TO authenticated;
