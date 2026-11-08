-- Payment rows are reservations until approved; only approved players form the roster.
ALTER TABLE public.friendly_games ADD COLUMN creation_payment_approved boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.compute_game_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 NEW.creation_payment_approved:=EXISTS(SELECT 1 FROM public.friendly_game_participants WHERE game_id=NEW.id AND member_id=NEW.creator_id AND role='organizer' AND NOT is_waitlisted AND pay_status='approved');
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.compute_game_publication() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER compute_game_publication BEFORE INSERT OR UPDATE ON public.friendly_games
 FOR EACH ROW EXECUTE FUNCTION public.compute_game_publication();
CREATE FUNCTION public.refresh_game_publication() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP<>'DELETE' THEN UPDATE public.friendly_games SET creation_payment_approved=false WHERE id=NEW.game_id; END IF;
 IF TG_OP='DELETE' THEN UPDATE public.friendly_games SET creation_payment_approved=false WHERE id=OLD.game_id;
 ELSIF TG_OP='UPDATE' AND OLD.game_id IS DISTINCT FROM NEW.game_id THEN UPDATE public.friendly_games SET creation_payment_approved=false WHERE id=OLD.game_id; END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.refresh_game_publication() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER refresh_game_publication AFTER INSERT OR UPDATE OR DELETE ON public.friendly_game_participants
 FOR EACH ROW EXECUTE FUNCTION public.refresh_game_publication();
UPDATE public.friendly_games SET creation_payment_approved=false;
CREATE POLICY "Game creation payment required" ON public.friendly_games AS RESTRICTIVE FOR SELECT TO authenticated
 USING(creation_payment_approved OR creator_id=(SELECT auth.uid()) OR (SELECT public.is_super_admin()));
CREATE POLICY "Public game creation payment required" ON public.friendly_games AS RESTRICTIVE FOR SELECT TO anon USING(creation_payment_approved);
CREATE FUNCTION public.owns_game_payment(p_parent uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.friendly_game_participants WHERE id=p_parent AND member_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.owns_game_payment(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owns_game_payment(uuid) TO authenticated;
CREATE POLICY "Only approved roster or own payment" ON public.friendly_game_participants AS RESTRICTIVE FOR SELECT TO authenticated
 USING(pay_status='approved' OR member_id=(SELECT auth.uid()) OR public.owns_game_payment(sponsor_participant_id) OR (SELECT public.is_super_admin()));
CREATE POLICY "Public approved roster only" ON public.friendly_game_participants AS RESTRICTIVE FOR SELECT TO anon USING(pay_status='approved');
CREATE FUNCTION public.require_game_creation_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g public.friendly_games%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND NEW.game_id=OLD.game_id THEN RETURN NEW; END IF;
 SELECT * INTO g FROM public.friendly_games WHERE id=NEW.game_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
 IF NOT g.creation_payment_approved AND NOT coalesce((NEW.role='organizer' AND NEW.member_id=g.creator_id),false)
 AND NOT EXISTS(SELECT 1 FROM public.friendly_game_participants parent WHERE parent.id=NEW.sponsor_participant_id AND parent.game_id=g.id AND parent.member_id=g.creator_id AND parent.role='organizer') THEN
  RAISE EXCEPTION 'This game is awaiting organizer payment approval';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.require_game_creation_payment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_game_creation_payment BEFORE INSERT OR UPDATE OF game_id ON public.friendly_game_participants
 FOR EACH ROW EXECUTE FUNCTION public.require_game_creation_payment();
NOTIFY pgrst,'reload schema';

-- A payment reservation does not unlock game chat.
CREATE POLICY "Approved players access chat" ON public.friendly_game_messages AS RESTRICTIVE FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.friendly_game_participants WHERE game_id=friendly_game_messages.game_id AND member_id=(SELECT auth.uid()) AND NOT is_waitlisted AND pay_status='approved'));
CREATE FUNCTION public.require_approved_game_message_sender() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.friendly_game_participants WHERE game_id=NEW.game_id AND member_id=NEW.sender_id AND NOT is_waitlisted AND pay_status='approved' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment approval is required before joining game chat'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.require_approved_game_message_sender() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_approved_game_message_sender BEFORE INSERT ON public.friendly_game_messages
 FOR EACH ROW EXECUTE FUNCTION public.require_approved_game_message_sender();

-- Defer the old immediate creation/join announcements until approval.
DO $migration$ DECLARE f text; r record; BEGIN
 FOR r IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='create_friendly_game' LOOP
  f:=pg_get_functiondef(r.oid);
  f:=replace(f,'WHERE p.id <> v_member','WHERE EXISTS(SELECT 1 FROM public.friendly_games WHERE id=v_game AND creation_payment_approved) AND p.id <> v_member');
  EXECUTE f;
 END LOOP;
 IF to_regprocedure('public.join_friendly_game(uuid,text,text,text)') IS NOT NULL THEN
  f:=pg_get_functiondef('public.join_friendly_game(uuid,text,text,text)'::regprocedure);
  f:=replace(f,'AND p.member_id <> v_member','AND false AND p.member_id <> v_member');
  EXECUTE f;
 END IF;
 IF to_regprocedure('public.request_game_players(uuid)') IS NOT NULL THEN
  f:=pg_get_functiondef('public.request_game_players(uuid)'::regprocedure);
  f:=replace(f,'IF NOT g.is_public OR','IF NOT g.creation_payment_approved OR NOT g.is_public OR');
  EXECUTE f;
 END IF;
END $migration$;
CREATE FUNCTION public.announce_approved_game() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.is_public THEN
  INSERT INTO public.notifications(recipient_id,type,title,body,link)
  SELECT p.id,'game_alert','New '||btrim(NEW.sport)||' game',btrim(NEW.title),'/games/'||NEW.id
  FROM public.profiles p WHERE p.id<>NEW.creator_id AND p.notify_game_alerts AND p.interested_sports @> ARRAY[NEW.sport]
  AND NOT EXISTS(SELECT 1 FROM public.blocks WHERE blocker_id=p.id AND blocked_id=NEW.creator_id) LIMIT 100;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.announce_approved_game() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER announce_approved_game AFTER UPDATE OF creation_payment_approved ON public.friendly_games
 FOR EACH ROW WHEN(NEW.creation_payment_approved AND NOT OLD.creation_payment_approved) EXECUTE FUNCTION public.announce_approved_game();
CREATE FUNCTION public.announce_approved_game_player() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.pay_status<>'approved' OR NEW.is_waitlisted OR NEW.role='organizer' OR NEW.member_id IS NULL THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' THEN IF OLD.pay_status='approved' THEN RETURN NULL; END IF; END IF;
 INSERT INTO public.notifications(recipient_id,type,title,body,link)
 SELECT p.member_id,'game_join','Player confirmed',coalesce(nullif(NEW.player_name,''),'A player')||' joined '||g.title||'.','/games/'||NEW.game_id
 FROM public.friendly_game_participants p JOIN public.friendly_games g ON g.id=p.game_id
 WHERE p.game_id=NEW.game_id AND p.member_id<>NEW.member_id AND p.pay_status='approved' AND NOT p.is_waitlisted
 AND NOT EXISTS(SELECT 1 FROM public.blocks WHERE blocker_id=p.member_id AND blocked_id=NEW.member_id);
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.announce_approved_game_player() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER announce_approved_game_player AFTER INSERT OR UPDATE OF pay_status ON public.friendly_game_participants
 FOR EACH ROW EXECUTE FUNCTION public.announce_approved_game_player();
