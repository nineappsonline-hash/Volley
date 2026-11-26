-- Trusted verified account can publish a game immediately without the manual organizer payment approval gate.
-- Existing payment dues remain unchanged; Kashier captures still require verified proof.
CREATE OR REPLACE FUNCTION public.compute_game_publication()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 NEW.creation_payment_approved:=public.is_trusted_auto_approval_account(NEW.creator_id) OR EXISTS(SELECT 1 FROM public.friendly_game_participants WHERE game_id=NEW.id AND member_id=NEW.creator_id AND role='organizer' AND NOT is_waitlisted AND pay_status='approved');
 RETURN NEW;
END $function$

