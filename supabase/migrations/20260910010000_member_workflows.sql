-- Member/guardian workflows. All mutations authenticate and derive identity server-side.
CREATE OR REPLACE FUNCTION public.can_manage_player(p_member uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT public.is_account_blocked() AND EXISTS (
 SELECT 1 FROM public.profiles me JOIN public.profiles player ON player.id=p_member
 WHERE me.id=auth.uid() AND me.is_active AND me.role='admin' AND me.academy_id=player.academy_id);
$$;
CREATE OR REPLACE FUNCTION public.can_read_player(p_member uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT public.is_account_blocked() AND (p_member=auth.uid() OR EXISTS (
 SELECT 1 FROM public.profiles WHERE id=p_member AND guardian_id=auth.uid()) OR public.can_manage_player(p_member));
$$;
REVOKE ALL ON FUNCTION public.can_manage_player(uuid),public.can_read_player(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_player(uuid),public.can_read_player(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.training_goals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 1 AND 160), notes text NOT NULL DEFAULT '' CHECK(char_length(notes)<=2000),
 target_date date, progress integer NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
 created_by uuid REFERENCES public.profiles ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS training_goals_member ON public.training_goals(member_id,updated_at DESC);
ALTER TABLE public.training_goals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_goals FROM anon,authenticated;
GRANT SELECT ON public.training_goals TO authenticated;
DROP POLICY IF EXISTS "Player goals read" ON public.training_goals;
CREATE POLICY "Player goals read" ON public.training_goals FOR SELECT TO authenticated USING(public.can_read_player(member_id));
CREATE OR REPLACE FUNCTION public.save_training_goal(p_member uuid,p_title text,p_notes text,p_target date,p_progress integer,p_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_player(p_member) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL THEN
 INSERT INTO public.training_goals(member_id,title,notes,target_date,progress,created_by) VALUES(p_member,btrim(p_title),coalesce(p_notes,''),p_target,p_progress,auth.uid()) RETURNING id INTO v_id;
 ELSE UPDATE public.training_goals SET title=btrim(p_title),notes=coalesce(p_notes,''),target_date=p_target,progress=p_progress,updated_at=now() WHERE id=p_id AND member_id=p_member RETURNING id INTO v_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Goal not found'; END IF; END IF;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.save_training_goal(uuid,text,text,date,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_training_goal(uuid,text,text,date,integer,uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.renewal_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id uuid NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
 academy_id uuid NOT NULL REFERENCES public.academies ON DELETE CASCADE, requested_by uuid REFERENCES public.profiles ON DELETE SET NULL,
 plan_id uuid NOT NULL REFERENCES public.membership_plans, plan_name text NOT NULL, sessions integer NOT NULL CHECK(sessions>0), amount numeric(10,2) NOT NULL CHECK(amount>=0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','declined','cancelled')), payment_id uuid REFERENCES public.payments ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS renewal_one_pending ON public.renewal_requests(member_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS renewal_academy ON public.renewal_requests(academy_id,status,created_at);
ALTER TABLE public.renewal_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.renewal_requests FROM anon,authenticated; GRANT SELECT ON public.renewal_requests TO authenticated;
DROP POLICY IF EXISTS "Player renewals read" ON public.renewal_requests;
CREATE POLICY "Player renewals read" ON public.renewal_requests FOR SELECT TO authenticated USING(public.can_read_player(member_id));
CREATE OR REPLACE FUNCTION public.request_training_renewal(p_member uuid,p_plan uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_plan public.membership_plans; v_academy uuid; v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_member AND (id=auth.uid() OR guardian_id=auth.uid())) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT academy_id INTO v_academy FROM public.profiles WHERE id=p_member FOR UPDATE;
 SELECT * INTO v_plan FROM public.membership_plans WHERE id=p_plan AND academy_id=v_academy AND is_active;
 IF NOT FOUND OR v_plan.price IS NULL THEN RAISE EXCEPTION 'Choose an active priced training plan'; END IF;
 INSERT INTO public.renewal_requests(member_id,academy_id,requested_by,plan_id,plan_name,sessions,amount) VALUES(p_member,v_academy,auth.uid(),p_plan,v_plan.name,v_plan.sessions_count,v_plan.price) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.resolve_training_renewal(p_id uuid,p_status text,p_method text DEFAULT 'cash') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.renewal_requests; v_payment uuid;
BEGIN
 SELECT * INTO r FROM public.renewal_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT public.can_manage_player(r.member_id) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'Request already resolved'; END IF;
 IF p_status NOT IN ('completed','declined') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 IF p_status='completed' THEN
 IF p_method NOT IN ('cash','card','wallet','bank_transfer','other') THEN RAISE EXCEPTION 'Invalid method'; END IF;
 INSERT INTO public.payments(member_id,academy_id,amount,payment_date,subscription_sessions,plan_id,membership_type,method,notes)
 VALUES(r.member_id,r.academy_id,r.amount,current_date,r.sessions,r.plan_id,CASE WHEN r.sessions<=4 THEN 'half' ELSE 'full' END,p_method,'Training renewal '||r.id) RETURNING id INTO v_payment;
 END IF;
 UPDATE public.renewal_requests SET status=p_status,payment_id=v_payment,resolved_at=now() WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.request_training_renewal(uuid,uuid),public.resolve_training_renewal(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_training_renewal(uuid,uuid),public.resolve_training_renewal(uuid,text,text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
 user_id uuid PRIMARY KEY REFERENCES public.profiles ON DELETE CASCADE,
 games boolean NOT NULL DEFAULT true, training boolean NOT NULL DEFAULT true, payments boolean NOT NULL DEFAULT true,
 push_enabled boolean NOT NULL DEFAULT true, quiet_start integer CHECK(quiet_start BETWEEN 0 AND 23), quiet_end integer CHECK(quiet_end BETWEEN 0 AND 23),
 timezone text NOT NULL DEFAULT 'Africa/Cairo', CHECK((quiet_start IS NULL)=(quiet_end IS NULL)));
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_preferences FROM anon,authenticated;GRANT SELECT,INSERT,UPDATE ON public.notification_preferences TO authenticated;
DROP POLICY IF EXISTS "Own notification preferences" ON public.notification_preferences;
CREATE POLICY "Own notification preferences" ON public.notification_preferences TO authenticated USING(user_id=auth.uid() AND NOT public.is_account_blocked()) WITH CHECK(user_id=auth.uid() AND NOT public.is_account_blocked());
CREATE OR REPLACE FUNCTION public.filter_notification_preferences() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.notification_preferences;
BEGIN
 SELECT * INTO p FROM public.notification_preferences WHERE user_id=NEW.recipient_id;
 IF FOUND AND ((NEW.type LIKE 'game_%' AND NOT p.games) OR (NEW.type IN ('payment','renewal') AND NOT p.payments) OR (NEW.type IN ('attendance','evaluation','training_reminder') AND NOT p.training)) THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS notification_preferences_filter ON public.notifications;
CREATE TRIGGER notification_preferences_filter BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.filter_notification_preferences();
-- Quiet hours only suppress push; in-app messages remain available.
CREATE OR REPLACE FUNCTION public.push_allowed(p_user uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.notification_preferences; h integer;
BEGIN
 SELECT * INTO p FROM public.notification_preferences WHERE user_id=p_user;
 IF NOT FOUND THEN RETURN true; END IF; IF NOT p.push_enabled THEN RETURN false; END IF;
 IF p.quiet_start IS NULL OR p.quiet_start=p.quiet_end THEN RETURN true; END IF;
 h:=extract(hour FROM now() AT TIME ZONE p.timezone);
 RETURN NOT (CASE WHEN p.quiet_start<p.quiet_end THEN h>=p.quiet_start AND h<p.quiet_end ELSE h>=p.quiet_start OR h<p.quiet_end END);
END $$;
-- Preserve the existing endpoint/auth configuration in the deployed forwarding function.
DO $$ DECLARE definition text; BEGIN
 IF to_regprocedure('public.notify_push_forward()') IS NOT NULL THEN
 definition:=pg_get_functiondef('public.notify_push_forward()'::regprocedure);
 IF position('public.push_allowed' IN definition)=0 THEN
 definition:=regexp_replace(definition,E'BEGIN',E'BEGIN\n  IF NOT public.push_allowed(NEW.recipient_id) THEN RETURN NEW; END IF;');
 EXECUTE definition;
 END IF; END IF;
END $$;
NOTIFY pgrst,'reload schema';
