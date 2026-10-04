-- Parent is a member account classification, not a new authentication role.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false;
UPDATE public.profiles p SET is_parent=true WHERE EXISTS(SELECT 1 FROM public.profiles c WHERE c.guardian_id=p.id);

CREATE OR REPLACE FUNCTION public.admin_set_parent_account(p_parent_id uuid,p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE OR public.is_account_blocked() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_parent_id AND role='member' AND guardian_id IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_parent_id) THEN RAISE EXCEPTION 'Choose a member with a login account'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'Choose an account type'; END IF;
 IF NOT p_enabled AND EXISTS(SELECT 1 FROM public.profiles WHERE guardian_id=p_parent_id) THEN RAISE EXCEPTION 'This parent still has children linked to the account'; END IF;
 UPDATE public.profiles SET is_parent=p_enabled WHERE id=p_parent_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_save_family_child(p_parent_id uuid,p_details jsonb,p_child_id uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE child_id uuid:=coalesce(p_child_id,gen_random_uuid()); dob date; academy uuid;
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE OR public.is_account_blocked() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_parent_id AND role='member' AND guardian_id IS NULL FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_parent_id) THEN RAISE EXCEPTION 'Choose a member with a login account'; END IF;
 IF nullif(btrim(p_details->>'name'),'') IS NULL OR length(btrim(p_details->>'name'))>100 THEN RAISE EXCEPTION 'Enter a name of up to 100 characters'; END IF;
 IF coalesce(p_details->>'gender','') NOT IN ('male','female') THEN RAISE EXCEPTION 'Choose the child gender'; END IF;
 dob:=nullif(p_details->>'birth_date','')::date;
 IF dob IS NULL OR dob>current_date OR dob<current_date-interval '100 years' THEN RAISE EXCEPTION 'Enter a valid date of birth'; END IF;
 IF length(coalesce(p_details->>'phone',''))>40 THEN RAISE EXCEPTION 'Phone number is too long'; END IF;
 academy:=nullif(p_details->>'academy_id','')::uuid;
 IF academy IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.academies WHERE id=academy) THEN RAISE EXCEPTION 'Academy not found'; END IF;
 IF p_child_id IS NULL THEN
  INSERT INTO public.profiles(id,guardian_id,role,email,name,gender,birth_date,phone,academy_id,join_date,membership_type,subscription_sessions,is_active,community_visible,notify_game_alerts)
  VALUES(child_id,p_parent_id,'member',NULL,btrim(p_details->>'name'),p_details->>'gender',dob,nullif(btrim(p_details->>'phone'),''),academy,current_date,'full',0,academy IS NOT NULL,false,false);
 ELSE
  -- Editing cannot adopt another person or move a child between guardians.
  PERFORM 1 FROM public.profiles WHERE id=p_child_id AND guardian_id=p_parent_id AND role='member' FOR UPDATE;
  IF NOT FOUND OR EXISTS(SELECT 1 FROM auth.users WHERE id=p_child_id) THEN RAISE EXCEPTION 'Child profile not found under this parent'; END IF;
  UPDATE public.profiles SET name=btrim(p_details->>'name'),gender=p_details->>'gender',birth_date=dob,phone=nullif(btrim(p_details->>'phone'),''),academy_id=academy,
   is_active=CASE WHEN academy IS DISTINCT FROM academy_id THEN academy IS NOT NULL ELSE is_active END WHERE id=p_child_id;
 END IF;
 UPDATE public.profiles SET is_parent=true WHERE id=p_parent_id;
 RETURN child_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_parent_account(uuid,boolean),public.admin_save_family_child(uuid,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_parent_account(uuid,boolean),public.admin_save_family_child(uuid,jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
