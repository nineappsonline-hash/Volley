-- Re-enable waiting lists, capped at two registered players per game.
-- Serialize every roster/waiting-list write on the same game row.
ALTER TABLE public.friendly_game_participants DROP CONSTRAINT IF EXISTS game_waitlists_disabled;
ALTER TABLE public.friendly_game_participants ADD CONSTRAINT game_waitlist_unpaid
 CHECK (NOT is_waitlisted OR (member_id IS NOT NULL AND sponsor_participant_id IS NULL
   AND coalesce(share_amount,0)=0 AND pay_status='unpaid' AND pay_method IS NULL));

CREATE OR REPLACE FUNCTION public.enforce_game_roster_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g public.friendly_games%ROWTYPE; occupied integer;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.game_id=OLD.game_id AND NEW.is_waitlisted=OLD.is_waitlisted THEN RETURN NEW; END IF;
 END IF;
 SELECT * INTO g FROM public.friendly_games WHERE id=NEW.game_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
 IF NEW.is_waitlisted THEN
  IF g.status NOT IN ('open','full') THEN RAISE EXCEPTION 'Game is no longer open'; END IF;
  SELECT count(*) INTO occupied FROM public.friendly_game_participants
   WHERE game_id=NEW.game_id AND is_waitlisted AND id<>NEW.id;
  IF occupied>=2 THEN RAISE EXCEPTION 'Waiting list is full (2 players maximum)'; END IF;
 ELSE
  SELECT count(*) INTO occupied FROM public.friendly_game_participants
   WHERE game_id=NEW.game_id AND NOT is_waitlisted AND id<>NEW.id;
  IF occupied>=g.max_players THEN RAISE EXCEPTION 'This game is full. No player places are available'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_game_roster_capacity() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.promote_waitlisted_player(p_game_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g public.friendly_games%ROWTYPE; w public.friendly_game_participants%ROWTYPE;
 occupied integer; promoted boolean:=false;
BEGIN
 SELECT * INTO g FROM public.friendly_games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND OR g.status NOT IN ('open','full') THEN RETURN false; END IF;
 SELECT count(*) INTO occupied FROM public.friendly_game_participants WHERE game_id=p_game_id AND NOT is_waitlisted;
 IF occupied<g.max_players THEN
  SELECT * INTO w FROM public.friendly_game_participants WHERE game_id=p_game_id AND is_waitlisted
   ORDER BY joined_at,id LIMIT 1 FOR UPDATE;
  IF FOUND THEN
   UPDATE public.friendly_game_participants SET is_waitlisted=false,
    share_amount=CASE WHEN g.host_pays THEN 0 ELSE g.share_price END,
    pay_status=CASE WHEN g.host_pays THEN 'approved' ELSE 'unpaid' END WHERE id=w.id;
   INSERT INTO public.notifications(recipient_id,type,title,body,link) VALUES
    (w.member_id,'game_alert','A spot opened up!','You have a player place in '||g.title||'. Review your booking and payment.','/dashboard/my-games?focus='||g.id),
    (g.creator_id,'game_alert','Waiting player promoted',w.player_name||' moved into the roster for '||g.title||'.','/dashboard/my-games?focus='||g.id);
   occupied:=occupied+1; promoted:=true;
  END IF;
 END IF;
 UPDATE public.friendly_games SET status=CASE WHEN occupied>=g.max_players THEN 'full' ELSE 'open' END WHERE id=p_game_id;
 RETURN promoted;
END $$;
REVOKE ALL ON FUNCTION public.promote_waitlisted_player(uuid) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
