-- Specific verified account exemption for manual approvals only; never bypass bank/card capture checks.
CREATE OR REPLACE FUNCTION public.is_trusted_auto_approval_account(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(
 SELECT 1 FROM auth.users u
 WHERE u.id=p_user AND lower(u.email)='zaitandfilter@gmail.com'
 AND u.id='0f83e860-d46d-459b-ae66-5801c38fbc96'::uuid
 )
$$;
REVOKE ALL ON FUNCTION public.is_trusted_auto_approval_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_trusted_auto_approval_account(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.autoapprove_trusted_game_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.member_id IS NOT NULL
 AND public.is_trusted_auto_approval_account(NEW.member_id)
 AND NEW.pay_status='pending'
 AND NEW.pay_method IN ('instapay','e_wallet')
 AND nullif(btrim(coalesce(NEW.pay_receipt_url,'')),'') IS NOT NULL
 THEN
   NEW.pay_status:='approved';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zzz_autoapprove_trusted_game_payment ON public.friendly_game_participants;
CREATE TRIGGER zzz_autoapprove_trusted_game_payment
BEFORE INSERT OR UPDATE OF pay_status,pay_method,pay_receipt_url ON public.friendly_game_participants
FOR EACH ROW EXECUTE FUNCTION public.autoapprove_trusted_game_payment();

CREATE OR REPLACE FUNCTION public.autoapprove_trusted_playground_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.profile_id IS NOT NULL AND public.is_trusted_auto_approval_account(NEW.profile_id)
 AND (auth.uid()=NEW.profile_id OR current_setting('request.jwt.claim.role',true)='service_role')
 AND NEW.status='pending' THEN
  NEW.status:='approved'; NEW.approved_at:=now(); NEW.approved_by:=NEW.profile_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS zzz_autoapprove_trusted_playground_owner ON public.playground_owners;
CREATE TRIGGER zzz_autoapprove_trusted_playground_owner
BEFORE INSERT OR UPDATE OF status ON public.playground_owners FOR EACH ROW
EXECUTE FUNCTION public.autoapprove_trusted_playground_owner();

