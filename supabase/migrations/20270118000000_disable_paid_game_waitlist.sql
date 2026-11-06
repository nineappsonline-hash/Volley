-- Disable new waiting-list places without deleting existing payment records.
CREATE OR REPLACE FUNCTION public.enforce_game_roster_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g public.friendly_games%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.game_id=OLD.game_id AND NEW.is_waitlisted=OLD.is_waitlisted THEN RETURN NEW; END IF;
  IF OLD.is_waitlisted THEN RAISE EXCEPTION 'Waiting lists are disabled'; END IF;
 END IF;
 IF NEW.is_waitlisted THEN RAISE EXCEPTION 'This game is full. Waiting lists are disabled'; END IF;
 SELECT * INTO g FROM public.friendly_games WHERE id=NEW.game_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
 IF (SELECT count(*) FROM public.friendly_game_participants WHERE game_id=NEW.game_id AND NOT is_waitlisted AND id<>NEW.id)>=g.max_players THEN
  RAISE EXCEPTION 'This game is full. No player places are available';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_game_roster_capacity() FROM PUBLIC,anon,authenticated;

-- Keep leave, review and removal callers working, without moving waiting players.
CREATE OR REPLACE FUNCTION public.promote_waitlisted_player(p_game_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.friendly_games WHERE id=p_game_id FOR UPDATE;
 UPDATE public.friendly_games g SET status=CASE WHEN
  (SELECT count(*) FROM public.friendly_game_participants p WHERE p.game_id=g.id AND NOT p.is_waitlisted)>=g.max_players
  THEN 'full' ELSE 'open' END WHERE g.id=p_game_id AND g.status IN ('open','full');
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.promote_waitlisted_player(uuid) FROM PUBLIC,anon,authenticated;

-- No new charges for existing waiting entries. Already collected card payments
-- can still settle/reconcile, and administrators can still review their receipts.
DO $migration$ DECLARE f text; old text; BEGIN
 f:=pg_get_functiondef('public.pay_game_share(uuid,text,text)'::regprocedure);
 old:='SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Unexpected share payment function'; END IF;
 f:=replace(f,old,$patch$IF EXISTS (SELECT 1 FROM public.friendly_game_participants WHERE game_id=p_game_id AND member_id=auth.uid() AND is_waitlisted) THEN
 RAISE EXCEPTION 'Waiting lists are disabled. Contact the organizer about your existing payment'; END IF;
 SELECT * INTO v_game FROM public.friendly_games WHERE id = p_game_id$patch$);
 EXECUTE f;
 f:=pg_get_functiondef('public.prepare_kashier_order(uuid,jsonb,text)'::regprocedure);
 old:='IF k=''share'' THEN';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Unexpected card share payment function'; END IF;
 IF strpos(f,'SELECT * INTO o FROM kashier_orders WHERE user_id=p_user')=0 THEN RAISE EXCEPTION 'Unexpected card checkout lookup'; END IF;
 f:=replace(f,'SELECT * INTO o FROM kashier_orders WHERE user_id=p_user',$patch$IF k='share' AND EXISTS(SELECT 1 FROM public.friendly_game_participants WHERE game_id=target AND member_id=p_user AND is_waitlisted) THEN
 RAISE EXCEPTION 'Waiting lists are disabled'; END IF;
 SELECT * INTO o FROM kashier_orders WHERE user_id=p_user$patch$);
 f:=replace(f,old,$patch$IF k='share' THEN
 IF part.is_waitlisted THEN RAISE EXCEPTION 'Waiting lists are disabled'; END IF;$patch$);
 EXECUTE f;
END $migration$;
NOTIFY pgrst,'reload schema';
