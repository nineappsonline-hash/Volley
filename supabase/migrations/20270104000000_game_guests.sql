-- Guests are real roster rows, owned and paid for by one signed-in participant.
ALTER TABLE public.friendly_game_participants ALTER COLUMN member_id DROP NOT NULL;
ALTER TABLE public.friendly_game_participants ADD COLUMN sponsor_participant_id uuid REFERENCES public.friendly_game_participants(id) ON DELETE CASCADE;
CREATE INDEX game_guest_sponsor ON public.friendly_game_participants(sponsor_participant_id) WHERE sponsor_participant_id IS NOT NULL;
ALTER TABLE public.friendly_game_participants ADD CONSTRAINT game_guest_identity CHECK (
 (member_id IS NOT NULL AND sponsor_participant_id IS NULL) OR
 (member_id IS NULL AND sponsor_participant_id IS NOT NULL AND role='player' AND NOT is_waitlisted AND length(btrim(player_name)) BETWEEN 1 AND 100)
);

CREATE FUNCTION public.add_game_guests(p_game uuid,p_guests jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 IF NOT g.host_pays AND sponsor.pay_status NOT IN ('pending','unpaid') THEN RAISE EXCEPTION 'Add guests when you join, before payment is approved'; END IF;
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
END $$;
-- Internal helper: only the atomic join/card routines may call it.
REVOKE ALL ON FUNCTION public.add_game_guests(uuid,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.join_game_with_guests(p_game_id uuid,p_invite_code text,p_pay_method text,p_pay_receipt_url text,p_guests jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE waitlisted boolean;
BEGIN
 PERFORM 1 FROM public.friendly_games WHERE id=p_game_id FOR UPDATE;
 waitlisted:=public.join_friendly_game(p_game_id,p_invite_code,p_pay_method,p_pay_receipt_url);
 PERFORM public.add_game_guests(p_game_id,p_guests);
 RETURN waitlisted;
END $$;
REVOKE ALL ON FUNCTION public.join_game_with_guests(uuid,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_game_with_guests(uuid,text,text,text,jsonb) TO authenticated;

-- One review or card settlement updates the entire party. Guest shares remain
-- separate for court-rent accounting; the sponsor pays their sum.
CREATE FUNCTION public.sync_game_guest_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.sponsor_participant_id IS NULL THEN
  UPDATE public.friendly_game_participants SET pay_status=NEW.pay_status,pay_method=NEW.pay_method,pay_receipt_url=NEW.pay_receipt_url
  WHERE sponsor_participant_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sync_guest_payment AFTER UPDATE OF pay_status,pay_method,pay_receipt_url ON public.friendly_game_participants FOR EACH ROW EXECUTE FUNCTION public.sync_game_guest_payment();

-- Fail migration on unexpected upstream function changes instead of silently
-- installing only part of the combined-payment flow.
DO $$ DECLARE f text; old text; BEGIN
 f:=pg_get_functiondef('public.prepare_kashier_order(uuid,jsonb,text)'::regprocedure);
 old:='IF FOUND THEN RETURN to_jsonb(o)||jsonb_build_object(''is_new'',false); END IF;';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Unexpected card preparation function'; END IF;
 f:=replace(f,old,$r$IF FOUND THEN
 IF coalesce(o.details->'guests','[]'::jsonb) IS DISTINCT FROM coalesce(p_request->'guests','[]'::jsonb) THEN RAISE EXCEPTION 'A checkout with different guests is already open. Finish it or wait for it to expire'; END IF;
 RETURN to_jsonb(o)||jsonb_build_object('is_new',false); END IF;$r$);
 old:='is_new_player:=true;';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Missing card join step'; END IF;
 f:=replace(f,old,old||' PERFORM public.add_game_guests(g.id,coalesce(p_request->''guests'',''[]''::jsonb));');
 old:='target:=part.id;info:=info||jsonb_build_object(''new_player'',is_new_player);';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Missing card participant target'; END IF;
 f:=replace(f,old,old||' info:=info||jsonb_build_object(''guests'',coalesce(p_request->''guests'',''[]''::jsonb));');
 old:='UPDATE friendly_game_participants SET pay_status=''unpaid'',pay_method=''kashier'',share_amount=amount,pay_receipt_url=NULL WHERE id=target;';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Missing card share update'; END IF;
 f:=replace(f,old,old||' SELECT amount+coalesce(sum(share_amount),0) INTO amount FROM friendly_game_participants WHERE sponsor_participant_id=target;');
 EXECUTE f;
 f:=pg_get_functiondef('public.settle_kashier_order(uuid,text,numeric,text)'::regprocedure);
 old:='AND share_amount=o.amount;';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Missing card settlement amount check'; END IF;
 f:=replace(f,old,'AND share_amount+(SELECT coalesce(sum(guest.share_amount),0) FROM public.friendly_game_participants guest WHERE guest.sponsor_participant_id=o.target_id)=o.amount;');
 EXECUTE f;
 -- Guest reviews must use the payer, including notification recipient.
 f:=pg_get_functiondef('public.review_participant_share(uuid,boolean)'::regprocedure);
 old:='WHERE id = p_participant_id';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Unexpected share review function'; END IF;
 f:=replace(f,old,'WHERE id = coalesce((SELECT sponsor_participant_id FROM public.friendly_game_participants WHERE id=p_participant_id),p_participant_id)');
 EXECUTE f;
 -- Email only the payer and include the whole party's amount.
 f:=pg_get_functiondef('public.queue_confirmed_payment()'::regprocedure);
 old:='amt:=coalesce(r->>''amount'',r->>''share_amount'')::numeric;';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Unexpected receipt queue'; END IF;
 f:=replace(f,old,old||' IF TG_TABLE_NAME=''friendly_game_participants'' THEN SELECT amt+coalesce(sum(share_amount),0) INTO amt FROM public.friendly_game_participants WHERE sponsor_participant_id=NEW.id; END IF;');
 EXECUTE f;
END $$;

-- A private account-only view avoids sending notifications to guest rows.
CREATE VIEW public.game_account_participants AS SELECT * FROM public.friendly_game_participants WHERE member_id IS NOT NULL;
REVOKE ALL ON public.game_account_participants FROM PUBLIC,anon,authenticated;
DO $$ DECLARE fn record; f text; statement text; changed text; BEGIN
 FOR fn IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f' AND prosrc LIKE '%INSERT INTO public.notifications%' AND prosrc LIKE '%friendly_game_participants%' LOOP
  f:=pg_get_functiondef(fn.oid); changed:=f;
  FOR statement IN SELECT (regexp_matches(f,'INSERT INTO public.notifications[\s\S]*?;','g'))[1] LOOP
   IF statement ~ 'FROM public.friendly_game_participants' AND statement !~ 'VALUES[[:space:]]*\(' THEN
    changed:=replace(changed,statement,replace(statement,'FROM public.friendly_game_participants','FROM public.game_account_participants'));
   END IF;
  END LOOP;
  IF changed<>f THEN EXECUTE changed; END IF;
 END LOOP;
 -- Guests are booked for one occurrence, not automatically charged next week.
 f:=pg_get_functiondef('public.materialize_recurring_games()'::regprocedure);
 f:=replace(f,'WHERE game_id = v_anchor','WHERE game_id = v_anchor AND member_id IS NOT NULL');
 EXECUTE f;
END $$;
NOTIFY pgrst,'reload schema';
