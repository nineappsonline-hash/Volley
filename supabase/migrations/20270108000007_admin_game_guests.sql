-- Independent guests have no account or paying sponsor. Only admin RPCs add them.
ALTER TABLE public.friendly_game_participants DROP CONSTRAINT game_guest_identity;
ALTER TABLE public.friendly_game_participants ADD CONSTRAINT game_guest_identity CHECK (
 (member_id IS NOT NULL AND sponsor_participant_id IS NULL) OR
 (member_id IS NULL AND role='player' AND NOT is_waitlisted AND player_name IS NOT NULL AND length(btrim(player_name)) BETWEEN 1 AND 100)
);

CREATE FUNCTION public.admin_add_friendly_game_guest(p_game_id uuid, p_name text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g public.friendly_games%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN
  RAISE EXCEPTION 'Only a super admin can manage game guests' USING ERRCODE='42501';
 END IF;
 IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Enter a guest name (1–100 characters)'; END IF;
 SELECT * INTO g FROM public.friendly_games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
 IF g.status NOT IN ('open','full') THEN RAISE EXCEPTION 'A finished or cancelled game cannot be edited'; END IF;
 IF (SELECT count(*) FROM public.friendly_game_participants WHERE game_id=p_game_id AND NOT is_waitlisted)>=g.max_players THEN
  RAISE EXCEPTION 'This game has no available places';
 END IF;
 INSERT INTO public.friendly_game_participants(game_id,member_id,role,player_name,is_waitlisted,share_amount,pay_status,kickoff_remind_opt_in)
 VALUES(p_game_id,NULL,'player',btrim(p_name),false,CASE WHEN g.host_pays THEN 0 ELSE g.share_price END,
 CASE WHEN g.host_pays OR g.share_price=0 THEN 'approved' ELSE 'unpaid' END,false);
 UPDATE public.friendly_games SET status='full' WHERE id=p_game_id AND
 (SELECT count(*) FROM public.friendly_game_participants WHERE game_id=p_game_id AND NOT is_waitlisted)>=max_players;
END $$;
REVOKE ALL ON FUNCTION public.admin_add_friendly_game_guest(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_add_friendly_game_guest(uuid,text) TO authenticated;

CREATE FUNCTION public.admin_remove_friendly_game_guest(p_game_id uuid,p_participant_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE g public.friendly_games%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN
  RAISE EXCEPTION 'Only a super admin can manage game guests' USING ERRCODE='42501';
 END IF;
 SELECT * INTO g FROM public.friendly_games WHERE id=p_game_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
 IF g.status NOT IN ('open','full') THEN RAISE EXCEPTION 'A finished or cancelled game cannot be edited'; END IF;
 DELETE FROM public.friendly_game_participants WHERE id=p_participant_id AND game_id=p_game_id AND member_id IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Guest not found in this game'; END IF;
 PERFORM public.promote_waitlisted_player(p_game_id);
END $$;
REVOKE ALL ON FUNCTION public.admin_remove_friendly_game_guest(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_friendly_game_guest(uuid,uuid) TO authenticated;
-- Cash received for an independent guest has no account to notify.
CREATE FUNCTION public.admin_confirm_game_guest_payment(p_game_id uuid,p_participant_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN
  RAISE EXCEPTION 'Only a super admin can manage game guests' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.friendly_games WHERE id=p_game_id AND status IN ('open','full') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Game is not editable'; END IF;
 UPDATE public.friendly_game_participants SET pay_status='approved',pay_method='cash'
 WHERE id=p_participant_id AND game_id=p_game_id AND member_id IS NULL AND sponsor_participant_id IS NULL AND pay_status='unpaid';
 IF NOT FOUND THEN RAISE EXCEPTION 'Unpaid independent guest not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_confirm_game_guest_payment(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_game_guest_payment(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
