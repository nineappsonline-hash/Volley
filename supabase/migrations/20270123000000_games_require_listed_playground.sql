-- Keep existing games/history; all new games must use the approved public catalog.
CREATE FUNCTION public.require_listed_game_playground() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.playground_id IS NOT DISTINCT FROM OLD.playground_id THEN RETURN NEW; END IF;
 END IF;
 IF NEW.playground_id IS NULL THEN
  RAISE EXCEPTION 'Select a playground listed on Playza to create a game' USING ERRCODE='23514';
 END IF;
 PERFORM 1 FROM public.venues WHERE id=NEW.playground_id AND approval_status='approved' FOR SHARE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Select an approved playground listed on Playza' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.require_listed_game_playground() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_listed_game_playground BEFORE INSERT OR UPDATE OF playground_id ON public.friendly_games
 FOR EACH ROW EXECUTE FUNCTION public.require_listed_game_playground();
NOTIFY pgrst,'reload schema';
