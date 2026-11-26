-- Trusted account approval exception. Already applied to production.
CREATE OR REPLACE FUNCTION public.add_game_guests(p_game uuid, p_guests jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE g public.friendly_games%ROWTYPE; sponsor public.friendly_game_participants%ROWTYPE; guest jsonb; n integer; age_years integer;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF jsonb_typeof(p_guests) IS DISTINCT FROM 'array' OR jsonb_array_length(p_guests)>20 THEN RAISE EXCEPTION 'Add at most 20 guests'; END IF;
 n:=jsonb_array_length(p_guests); IF n=0 THEN RETURN; END IF;
 SELECT * INTO g FROM public.friendly_games WHERE id=p_game FOR UPDATE;
 IF NOT FOUND OR g.status NOT IN ('open','full') OR (g.game_date+g.start_time) AT TIME ZONE 'Africa/Cairo'<=now() THEN RAISE EXCEPTION 'Game is no longer open'; END IF;
 SELECT * INTO sponsor FROM public.friendly_game_participants WHERE game_id=p_game AND member_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR sponsor.is_waitlisted THEN RAISE EXCEPTION 'Guests need confirmed roster places'; END IF;
 IF EXISTS(SELECT 1 FROM public.friendly_game_participants WHERE sponsor_participant_id=sponsor.id) THEN RAISE EXCEPTION 'Guests have already been added to this booking'; END IF;
 IF NOT g.host_pays AND sponsor.pay_status NOT IN ('pending','unpaid') AND NOT (sponsor.pay_status='approved' AND sponsor.pay_method IN ('instapay','e_wallet') AND nullif(btrim(coalesce(sponsor.pay_receipt_url,'')),'') IS NOT NULL AND public.is_trusted_auto_approval_account(sponsor.member_id)) THEN RAISE EXCEPTION 'Add guests when you join, before payment is approved'; END IF;
 IF (SELECT count(*) FROM public.friendly_game_participants WHERE game_id=p_game AND NOT is_waitlisted)+n>g.max_players THEN RAISE EXCEPTION 'Not enough places for you and all your guests. No booking was added'; END IF;
 FOR guest IN SELECT value FROM jsonb_array_elements(p_guests) LOOP
  IF jsonb_typeof(guest) IS DISTINCT FROM 'object' OR length(btrim(coalesce(guest->>'name',''))) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Enter each guest name'; END IF;
  IF g.gender IN ('male','female') AND guest->>'gender' IS DISTINCT FROM g.gender THEN RAISE EXCEPTION 'Each guest must meet the game gender requirement'; END IF;
  IF g.min_age IS NOT NULL OR g.max_age IS NOT NULL THEN
   IF coalesce(guest->>'age','') !~ '^[0-9]{1,3}$' THEN RAISE EXCEPTION 'Enter each guest age'; END IF;
   age_years:=(guest->>'age')::integer;
   IF age_years>100 OR age_years<coalesce(g.min_age,0) OR age_years>coalesce(g.max_age,100) THEN RAISE EXCEPTION 'Each guest must meet the game age requirement'; END IF;
  END IF;
  INSERT INTO public.friendly_game_participants(game_id,member_id,sponsor_participant_id,role,player_name,share_amount,pay_method,pay_receipt_url,pay_status,kickoff_remind_opt_in)
  VALUES(p_game,NULL,sponsor.id,'player',btrim(guest->>'name'),CASE WHEN g.host_pays THEN 0 ELSE g.share_price END,sponsor.pay_method,sponsor.pay_receipt_url,sponsor.pay_status,false);
 END LOOP;
 UPDATE public.friendly_games SET status='full' WHERE id=p_game AND (SELECT count(*) FROM public.friendly_game_participants WHERE game_id=p_game AND NOT is_waitlisted)>=max_players;
END $function$

