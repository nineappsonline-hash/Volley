-- The guest cash-confirmation RPC already records cash; accept that real method.
ALTER TABLE public.friendly_game_participants DROP CONSTRAINT friendly_game_participants_pay_method_check;
ALTER TABLE public.friendly_game_participants ADD CONSTRAINT friendly_game_participants_pay_method_check
 CHECK (pay_method IN ('instapay','e_wallet','visa','kashier','cash'));

-- Waitlists have no secured seat or payment. Refuse to discard unexpected paid
-- rows: investigate those records instead of silently losing a payment.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.friendly_game_participants WHERE is_waitlisted
   AND (coalesce(share_amount,0)<>0 OR pay_status IS DISTINCT FROM 'unpaid')) THEN
  RAISE EXCEPTION 'Cannot close waitlists: a waiting entry has payment information requiring review';
 END IF;
END $$;
DELETE FROM public.friendly_game_participants WHERE is_waitlisted;
ALTER TABLE public.friendly_game_participants ADD CONSTRAINT game_waitlists_disabled CHECK (NOT is_waitlisted);

-- All booking entry points, including older clients and service card checkout,
-- must serialize on the game before checking places. Payment-only updates do
-- not take a new place and remain possible when the game is full.
CREATE FUNCTION public.enforce_game_roster_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g public.friendly_games%ROWTYPE;
BEGIN
 IF NEW.is_waitlisted THEN RAISE EXCEPTION 'This game is full. Waiting lists are disabled'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.game_id=OLD.game_id AND NOT OLD.is_waitlisted THEN RETURN NEW; END IF;
 END IF;
 SELECT * INTO g FROM public.friendly_games WHERE id=NEW.game_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
 IF (SELECT count(*) FROM public.friendly_game_participants WHERE game_id=NEW.game_id AND NOT is_waitlisted)>=g.max_players THEN
  RAISE EXCEPTION 'This game is full. No player places are available';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_game_roster_capacity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER enforce_game_roster_capacity BEFORE INSERT OR UPDATE OF game_id,is_waitlisted
 ON public.friendly_game_participants FOR EACH ROW EXECUTE FUNCTION public.enforce_game_roster_capacity();

-- Keep the existing leave/reject/remove callers working, without promoting
-- anyone. A released seat simply becomes available for a new registration.
CREATE OR REPLACE FUNCTION public.promote_waitlisted_player(p_game_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.friendly_games WHERE id=p_game_id FOR UPDATE;
 UPDATE public.friendly_games g SET status=CASE WHEN
  (SELECT count(*) FROM public.friendly_game_participants p WHERE p.game_id=g.id AND NOT p.is_waitlisted)>=g.max_players
  THEN 'full' ELSE 'open' END
 WHERE g.id=p_game_id AND g.status IN ('open','full');
 RETURN false;
END $$;

REVOKE ALL ON FUNCTION public.promote_waitlisted_player(uuid) FROM PUBLIC,anon,authenticated;

-- Refresh any stale open/full status after closing the old waiting lists.
UPDATE public.friendly_games g SET status=CASE WHEN
 (SELECT count(*) FROM public.friendly_game_participants p WHERE p.game_id=g.id AND NOT p.is_waitlisted)>=g.max_players
 THEN 'full' ELSE 'open' END WHERE g.status IN ('open','full');
NOTIFY pgrst,'reload schema';
