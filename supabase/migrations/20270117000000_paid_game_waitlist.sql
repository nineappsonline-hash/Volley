-- Waiting players pay the same share as roster players. Host-covered games stay free.
ALTER TABLE public.friendly_game_participants DROP CONSTRAINT IF EXISTS game_waitlist_unpaid;
ALTER TABLE public.friendly_game_participants ADD CONSTRAINT game_waitlist_identity
 CHECK (NOT is_waitlisted OR (member_id IS NOT NULL AND sponsor_participant_id IS NULL));

-- Earlier free waiting entries were stored as unpaid even though the host covers them.
UPDATE public.friendly_game_participants p SET pay_status='approved'
 FROM public.friendly_games g WHERE g.id=p.game_id AND g.host_pays
 AND p.is_waitlisted AND coalesce(p.share_amount,0)=0 AND p.pay_status='unpaid';

-- Preserve the existing join eligibility, notifications and service-only card path.
DO $migration$ DECLARE f text; old text; BEGIN
 f:=pg_get_functiondef('public.join_friendly_game(uuid,text,text,text)'::regprocedure);
 old:='IF v_count >= v_game.max_players THEN';
 IF strpos(f,old)=0 OR strpos(f,'TRUE, 0, ''unpaid'');')=0 THEN RAISE EXCEPTION 'Unexpected waiting-list join function'; END IF;
 f:=replace(f,old,$patch$IF v_count >= v_game.max_players THEN
   IF NOT v_game.host_pays THEN
     IF v_game.share_price IS NULL OR v_game.share_price<=0 THEN RAISE EXCEPTION 'Game share price is not available'; END IF;
     IF p_pay_method IS NULL OR (p_pay_method NOT IN ('instapay','e_wallet') AND NOT (p_pay_method='kashier' AND auth.role()='service_role')) THEN
       RAISE EXCEPTION 'Payment is required to join the waiting list';
     END IF;
     IF p_pay_method<>'kashier' AND nullif(btrim(p_pay_receipt_url),'') IS NULL THEN RAISE EXCEPTION 'A receipt is required to join the waiting list'; END IF;
   END IF;
 $patch$);
 f:=replace(f,'(game_id, member_id, role, player_name, is_waitlisted, share_amount, pay_status)',
 '(game_id, member_id, role, player_name, is_waitlisted, share_amount, pay_status, pay_method, pay_receipt_url)');
 f:=replace(f,'TRUE, 0, ''unpaid'');',$patch$TRUE, CASE WHEN v_game.host_pays THEN 0 ELSE v_game.share_price END,
 CASE WHEN v_game.host_pays THEN 'approved' WHEN p_pay_method='kashier' THEN 'unpaid' ELSE 'pending' END,
 CASE WHEN v_game.host_pays THEN NULL ELSE p_pay_method END,
 CASE WHEN v_game.host_pays THEN NULL ELSE btrim(p_pay_receipt_url) END);$patch$);
 EXECUTE f;
END $migration$;

-- Paid/pending waiting players retain their payment when promoted; no second charge.
DO $migration$ DECLARE f text; BEGIN
 f:=pg_get_functiondef('public.promote_waitlisted_player(uuid)'::regprocedure);
 IF strpos(f,'share_amount=CASE')=0 THEN RAISE EXCEPTION 'Unexpected promotion function'; END IF;
 f:=replace(f,'WHERE game_id=p_game_id AND is_waitlisted',
 'WHERE game_id=p_game_id AND is_waitlisted AND (g.host_pays OR pay_status IN (''pending'',''approved''))');
 f:=replace(f,$old$is_waitlisted=false,
    share_amount=CASE WHEN g.host_pays THEN 0 ELSE g.share_price END,
    pay_status=CASE WHEN g.host_pays THEN 'approved' ELSE 'unpaid' END$old$,'is_waitlisted=false');
 EXECUTE f;
END $migration$;

-- Card checkout reserves one of the same two waiting places until it expires.
DO $migration$ DECLARE f text; old text; BEGIN
 f:=pg_get_functiondef('public.prepare_kashier_order(uuid,jsonb,text)'::regprocedure);
 old:='IF (SELECT count(*) FROM friendly_game_participants WHERE game_id=g.id AND NOT is_waitlisted)>=g.max_players THEN RAISE EXCEPTION ''Game is full. Join the waitlist without paying''; END IF;';
 IF strpos(f,old)=0 THEN RAISE EXCEPTION 'Unexpected card game capacity check'; END IF;
 f:=replace(f,old,'');
 f:=replace(f,'IF part.is_waitlisted OR part.pay_status NOT IN','IF part.pay_status NOT IN');
 EXECUTE f;
 f:=pg_get_functiondef('public.settle_kashier_order(uuid,text,numeric,text)'::regprocedure);
 f:=replace(f,' AND NOT is_waitlisted','');
 EXECUTE f;
 f:=pg_get_functiondef('public.review_card_payment(uuid,uuid,boolean)'::regprocedure);
 f:=replace(f,' AND NOT is_waitlisted','');
 EXECUTE f;
END $migration$;

-- Manual refunds: preserve receipt and amount when a waiting payment is removed,
-- reset on cancellation, or remains on the waiting list when a game finishes.
CREATE TABLE public.game_waitlist_refund_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 participant_id uuid NOT NULL UNIQUE, game_id uuid NOT NULL, member_id uuid NOT NULL,
 player_name text, amount numeric NOT NULL, pay_status text NOT NULL,
 pay_method text, receipt_url text, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.game_waitlist_refund_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins read waiting refunds" ON public.game_waitlist_refund_records
 FOR SELECT TO authenticated USING ((SELECT public.is_super_admin()));
GRANT SELECT ON public.game_waitlist_refund_records TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.game_waitlist_refund_records FROM anon,authenticated;

CREATE FUNCTION public.archive_waiting_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF OLD.is_waitlisted AND OLD.share_amount>0 AND OLD.pay_status IN ('pending','approved') THEN
  IF TG_OP='UPDATE' THEN
   IF NEW.share_amount=OLD.share_amount AND NEW.pay_status IN ('pending','approved') THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO public.game_waitlist_refund_records(participant_id,game_id,member_id,player_name,amount,pay_status,pay_method,receipt_url,reason)
  VALUES(OLD.id,OLD.game_id,OLD.member_id,OLD.player_name,OLD.share_amount,OLD.pay_status,OLD.pay_method,OLD.pay_receipt_url,'Waiting registration removed or payment reset; review manual refund')
  ON CONFLICT(participant_id) DO NOTHING;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.archive_waiting_payment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER archive_waiting_payment BEFORE DELETE OR UPDATE OF share_amount,pay_status ON public.friendly_game_participants
 FOR EACH ROW EXECUTE FUNCTION public.archive_waiting_payment();

CREATE FUNCTION public.archive_unpromoted_waiting_payments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status IN ('completed','cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO public.game_waitlist_refund_records(participant_id,game_id,member_id,player_name,amount,pay_status,pay_method,receipt_url,reason)
  SELECT id,game_id,member_id,player_name,share_amount,pay_status,pay_method,pay_receipt_url,'Game ended without promotion; review manual refund'
  FROM public.friendly_game_participants WHERE game_id=NEW.id AND is_waitlisted AND share_amount>0 AND pay_status IN ('pending','approved')
  ON CONFLICT(participant_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.archive_unpromoted_waiting_payments() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER archive_unpromoted_waiting_payments AFTER UPDATE OF status ON public.friendly_games
 FOR EACH ROW EXECUTE FUNCTION public.archive_unpromoted_waiting_payments();
NOTIFY pgrst,'reload schema';

-- A card hold may have been unpaid when a roster place opened. Recheck on payment.
CREATE FUNCTION public.promote_paid_waiting_player() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.is_waitlisted AND NEW.pay_status IN ('pending','approved') THEN
  PERFORM public.promote_waitlisted_player(NEW.game_id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.promote_paid_waiting_player() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER promote_paid_waiting_player AFTER UPDATE OF pay_status ON public.friendly_game_participants
 FOR EACH ROW WHEN (NEW.pay_status IS DISTINCT FROM OLD.pay_status)
 EXECUTE FUNCTION public.promote_paid_waiting_player();
