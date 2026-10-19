-- Owner workspace: scoped staff permissions, operational records and immutable ledgers.
CREATE TABLE public.academy_staff (
 academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
 profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 role text NOT NULL CHECK(role IN ('manager','receptionist','finance','coach')),
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(academy_id,profile_id)
);
CREATE OR REPLACE FUNCTION public.academy_can(p_academy uuid,p_capability text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND NOT public.is_account_blocked() AND (
 coalesce(public.is_super_admin(),false) OR EXISTS(
 SELECT 1 FROM public.profiles p LEFT JOIN public.academy_staff s ON s.profile_id=p.id AND s.academy_id=p_academy AND s.active
 WHERE p.id=auth.uid() AND p.is_active AND p.academy_id=p_academy AND (
 p.role='admin' OR (p.role='member' AND CASE p_capability
 WHEN 'read' THEN s.role IS NOT NULL
 WHEN 'training' THEN s.role='manager'
 WHEN 'bookings' THEN s.role IN ('manager','receptionist')
 WHEN 'attendance' THEN s.role IN ('manager','receptionist','coach')
 WHEN 'members' THEN s.role IN ('manager','receptionist')
 WHEN 'finance' THEN s.role IN ('manager','finance')
 WHEN 'leads' THEN s.role IN ('manager','receptionist')
 WHEN 'audit' THEN s.role='manager'
 ELSE false END))));
$$;
REVOKE ALL ON FUNCTION public.academy_can(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.academy_can(uuid,text) TO authenticated,anon;
ALTER TABLE public.academy_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_read ON public.academy_staff FOR SELECT TO authenticated USING(profile_id=auth.uid() OR public.academy_can(academy_id,'owner'));
GRANT SELECT ON public.academy_staff TO authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.academy_branches(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS training_frozen_until date,
 ADD COLUMN IF NOT EXISTS training_frozen_from date;
ALTER TABLE public.training_sessions ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.academy_branches(id) ON DELETE SET NULL;
ALTER TABLE public.academy_training_programs ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.academy_branches(id) ON DELETE SET NULL;
CREATE TABLE public.academy_member_details (
 member_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
 contact_email text, emergency_name text, emergency_phone text,
 consent_status text NOT NULL DEFAULT 'not_recorded' CHECK(consent_status IN ('not_recorded','granted','withdrawn')),
 consent_note text, consent_recorded_at timestamptz, updated_by uuid REFERENCES public.profiles(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academy_audit_log (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
 actor_id uuid, action text NOT NULL, entity_id text, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academy_audit_scope ON public.academy_audit_log(academy_id,created_at DESC);
CREATE TABLE public.academy_member_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES public.profiles(id), booking_id uuid REFERENCES public.academy_training_bookings(id),
 payment_id uuid REFERENCES public.payments(id), branch_id uuid REFERENCES public.academy_branches(id) ON DELETE SET NULL,
 kind text NOT NULL CHECK(kind IN ('payment','refund','credit','credit_used','makeup','freeze','resume','cancel','reschedule')),
 amount numeric(10,2) NOT NULL DEFAULT 0 CHECK(amount <> 'NaN'::numeric), sessions integer NOT NULL DEFAULT 0,
 reason text NOT NULL, actor_id uuid, request_id uuid UNIQUE, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX academy_booking_receipt_ledger ON public.academy_member_ledger(booking_id) WHERE kind='payment';
CREATE INDEX academy_ledger_scope ON public.academy_member_ledger(academy_id,created_at DESC);
CREATE TABLE public.academy_booking_checkins (
 booking_id uuid NOT NULL REFERENCES public.academy_training_bookings(id) ON DELETE CASCADE,
 session_date date NOT NULL, starts_at time NOT NULL, is_present boolean NOT NULL,
 marked_by uuid NOT NULL REFERENCES public.profiles(id), marked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(booking_id,session_date,starts_at)
);
CREATE TABLE public.academy_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
 trial_request_id uuid UNIQUE REFERENCES public.trial_requests(id) ON DELETE SET NULL,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120), email text, phone text,
 stage text NOT NULL DEFAULT 'new' CHECK(stage IN ('new','contacted','trial_booked','attended','joined','declined')),
 member_id uuid REFERENCES public.profiles(id), branch_id uuid REFERENCES public.academy_branches(id) ON DELETE SET NULL,
 trial_date date, followup_date date, notes text, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX academy_lead_scope ON public.academy_leads(academy_id,stage,followup_date);
CREATE TABLE public.academy_outreach (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES public.profiles(id), actor_id uuid NOT NULL, request_id uuid UNIQUE NOT NULL,
 notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
 channel text NOT NULL DEFAULT 'in_app' CHECK(channel='in_app'), status text NOT NULL CHECK(status='sent'), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academy_import_batches (
 id uuid PRIMARY KEY, academy_id uuid NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['academy_member_details','academy_audit_log','academy_member_ledger','academy_booking_checkins','academy_leads','academy_outreach','academy_import_batches'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 END LOOP;
END $$;
CREATE POLICY ledger_read ON public.academy_member_ledger FOR SELECT TO authenticated USING(public.academy_can(academy_id,'finance'));
GRANT SELECT ON public.academy_member_ledger TO authenticated;

CREATE OR REPLACE FUNCTION private.academy_record_audit(p_academy uuid,p_action text,p_entity text,p_details jsonb DEFAULT '{}') RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO public.academy_audit_log(academy_id,actor_id,action,entity_id,details) VALUES(p_academy,auth.uid(),p_action,p_entity,p_details);
$$;
REVOKE ALL ON FUNCTION private.academy_record_audit(uuid,text,text,jsonb) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.academy_set_staff(p_profile uuid,p_role text,p_active boolean DEFAULT true) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid:=public.current_academy_id(); BEGIN
 IF NOT public.academy_can(aid,'owner') THEN RAISE EXCEPTION 'Only the academy owner can manage staff' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_profile AND academy_id=aid AND role='member' AND is_active AND email IS NOT NULL) THEN RAISE EXCEPTION 'Choose an active member account of your academy'; END IF;
 INSERT INTO public.academy_staff(academy_id,profile_id,role,active) VALUES(aid,p_profile,p_role,p_active)
 ON CONFLICT(academy_id,profile_id) DO UPDATE SET role=excluded.role,active=excluded.active;
 PERFORM private.academy_record_audit(aid,'staff_access',p_profile::text,jsonb_build_object('role',p_role,'active',p_active));
END $$;

CREATE OR REPLACE FUNCTION private.guard_academy_branch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.branch_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.academy_branches b WHERE b.id=NEW.branch_id AND b.academy_id=NEW.academy_id) THEN RAISE EXCEPTION 'Branch belongs to another academy'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_academy_branch() FROM PUBLIC;
CREATE TRIGGER workspace_profile_branch BEFORE INSERT OR UPDATE OF branch_id,academy_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.guard_academy_branch();
CREATE TRIGGER workspace_session_branch BEFORE INSERT OR UPDATE OF branch_id,academy_id ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION private.guard_academy_branch();
CREATE TRIGGER workspace_program_branch BEFORE INSERT OR UPDATE OF branch_id,academy_id ON public.academy_training_programs FOR EACH ROW EXECUTE FUNCTION private.guard_academy_branch();

CREATE OR REPLACE FUNCTION public.academy_save_member_details(p_member uuid,p_details jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid:=public.current_academy_id(); guardian uuid:=nullif(p_details->>'guardian_id','')::uuid; BEGIN
 IF NOT public.academy_can(aid,'members') OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_member AND academy_id=aid AND role='member') THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_details->>'contact_email'),'') IS NOT NULL AND (length(p_details->>'contact_email')>254 OR btrim(p_details->>'contact_email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN RAISE EXCEPTION 'Enter a valid contact email'; END IF;
 IF p_details ? 'guardian_id' AND NOT public.academy_can(aid,'owner') THEN RAISE EXCEPTION 'Only the owner can change guardian links'; END IF;
 IF guardian IS NOT NULL AND (guardian=p_member OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=guardian AND academy_id=aid AND guardian_id IS NULL AND is_active AND email IS NOT NULL AND (birth_date IS NULL OR birth_date<=CURRENT_DATE-interval '18 years')) OR EXISTS(SELECT 1 FROM public.profiles WHERE guardian_id=p_member)) THEN RAISE EXCEPTION 'Choose an adult guardian account in this academy'; END IF;
 UPDATE public.profiles SET branch_id=nullif(p_details->>'branch_id','')::uuid WHERE id=p_member;
 IF p_details ? 'guardian_id' THEN UPDATE public.profiles SET guardian_id=guardian WHERE id=p_member; END IF;
 INSERT INTO public.academy_member_details(member_id,academy_id,contact_email,emergency_name,emergency_phone,consent_status,consent_note,consent_recorded_at,updated_by)
 VALUES(p_member,aid,nullif(btrim(p_details->>'contact_email'),''),left(p_details->>'emergency_name',120),left(p_details->>'emergency_phone',50),coalesce(p_details->>'consent_status','not_recorded'),left(p_details->>'consent_note',1000),now(),auth.uid())
 ON CONFLICT(member_id) DO UPDATE SET contact_email=excluded.contact_email,emergency_name=excluded.emergency_name,emergency_phone=excluded.emergency_phone,consent_status=excluded.consent_status,consent_note=excluded.consent_note,consent_recorded_at=CASE WHEN academy_member_details.consent_status IS DISTINCT FROM excluded.consent_status THEN now() ELSE academy_member_details.consent_recorded_at END,updated_by=auth.uid(),updated_at=now();
 PERFORM private.academy_record_audit(aid,'member_details',p_member::text,jsonb_build_object('branch_id',p_details->>'branch_id','consent_status',p_details->>'consent_status'));
END $$;

CREATE OR REPLACE FUNCTION public.academy_mark_booking_attendance(p_booking uuid,p_date date,p_time time,p_present boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid; b public.academy_training_bookings%ROWTYPE; BEGIN
 SELECT * INTO b FROM public.academy_training_bookings WHERE id=p_booking;
 SELECT academy_id INTO aid FROM public.academy_training_programs WHERE id=b.program_id;
 IF NOT public.academy_can(aid,'attendance') OR b.status<>'approved' OR NOT EXISTS(SELECT 1 FROM public.academy_training_booking_sessions WHERE booking_id=p_booking AND session_date=p_date AND starts_at=p_time) THEN RAISE EXCEPTION 'Confirmed academy session required' USING ERRCODE='42501'; END IF;
 IF p_date>(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Cannot mark a future session'; END IF;
 INSERT INTO public.academy_booking_checkins VALUES(p_booking,p_date,p_time,p_present,auth.uid(),now()) ON CONFLICT(booking_id,session_date,starts_at) DO UPDATE SET is_present=excluded.is_present,marked_by=auth.uid(),marked_at=now();
 PERFORM private.academy_record_audit(aid,'booking_attendance',p_booking::text,jsonb_build_object('date',p_date,'time',p_time,'present',p_present));
END $$;

-- Immutable verified receipts feed training revenue without changing legacy membership counters.
CREATE OR REPLACE FUNCTION private.academy_booking_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid; branch uuid; BEGIN
 IF NEW.status='approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
 SELECT academy_id,branch_id INTO aid,branch FROM public.academy_training_programs WHERE id=NEW.program_id;
 INSERT INTO public.academy_member_ledger(academy_id,member_id,booking_id,branch_id,kind,amount,reason,actor_id,created_at)
 VALUES(aid,NEW.member_id,NEW.id,branch,'payment',NEW.amount,'Verified training booking',auth.uid(),coalesce(NEW.reviewed_at,now())) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.academy_booking_receipt() FROM PUBLIC;
CREATE TRIGGER workspace_booking_receipt AFTER INSERT OR UPDATE OF status ON public.academy_training_bookings FOR EACH ROW EXECUTE FUNCTION private.academy_booking_receipt();
INSERT INTO public.academy_member_ledger(academy_id,member_id,booking_id,branch_id,kind,amount,reason,created_at)
 SELECT p.academy_id,b.member_id,b.id,p.branch_id,'payment',b.amount,'Verified training booking',coalesce(b.reviewed_at,b.created_at) FROM public.academy_training_bookings b JOIN public.academy_training_programs p ON p.id=b.program_id WHERE b.status='approved' ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.academy_adjust_membership(p_member uuid,p_action text,p_details jsonb,p_request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid:=public.current_academy_id(); bid uuid:=nullif(p_details->>'booking_id','')::uuid; payid uuid:=nullif(p_details->>'payment_id','')::uuid;
 b public.academy_training_bookings%ROWTYPE; member public.profiles%ROWTYPE; entry uuid; value numeric:=coalesce(nullif(p_details->>'amount','')::numeric,0); original numeric; already numeric; until_date date; reason text:=btrim(p_details->>'reason'); branch uuid; BEGIN
 IF NOT public.academy_can(aid,'finance') THEN RAISE EXCEPTION 'Finance permission required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL OR nullif(reason,'') IS NULL OR length(reason)>1000 OR value='NaN'::numeric OR value<0 OR value>=100000000 THEN RAISE EXCEPTION 'A reason and valid amount are required'; END IF;
 SELECT * INTO member FROM public.profiles WHERE id=p_member FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
 SELECT id INTO entry FROM public.academy_member_ledger WHERE request_id=p_request AND academy_id=aid;
 IF entry IS NOT NULL THEN RETURN entry; END IF;
 IF bid IS NOT NULL AND payid IS NOT NULL THEN RAISE EXCEPTION 'Choose one payment reference'; END IF;
 IF payid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.payments WHERE id=payid AND academy_id=aid AND member_id=p_member) THEN RAISE EXCEPTION 'Payment belongs to another academy'; END IF;
 IF bid IS NOT NULL THEN
  SELECT * INTO b FROM public.academy_training_bookings WHERE id=bid AND member_id=p_member FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.academy_training_programs WHERE id=b.program_id AND academy_id=aid) THEN RAISE EXCEPTION 'Booking belongs to another academy'; END IF;
  SELECT branch_id INTO branch FROM public.academy_training_programs WHERE id=b.program_id;
 ELSIF member.academy_id IS DISTINCT FROM aid OR member.role<>'member' THEN RAISE EXCEPTION 'Member belongs to another academy';
 ELSE branch:=member.branch_id;
 END IF;
 IF p_action='refund' THEN
  IF value<=0 OR (bid IS NULL AND payid IS NULL) THEN RAISE EXCEPTION 'Choose a verified payment and refund amount'; END IF;
  IF bid IS NOT NULL THEN
   SELECT coalesce(sum(amount),0) INTO original FROM public.academy_member_ledger WHERE booking_id=bid AND kind='payment';
   SELECT branch_id INTO branch FROM public.academy_member_ledger WHERE booking_id=bid AND kind='payment' LIMIT 1;
   SELECT coalesce(-sum(amount),0) INTO already FROM public.academy_member_ledger WHERE booking_id=bid AND kind='refund';
  ELSE
   SELECT amount,branch_id INTO original,branch FROM public.payments WHERE id=payid AND academy_id=aid AND member_id=p_member;
   SELECT coalesce(-sum(amount),0) INTO already FROM public.academy_member_ledger WHERE payment_id=payid AND kind='refund';
  END IF;
  IF original IS NULL OR value>original-already THEN RAISE EXCEPTION 'Refund exceeds collected funds'; END IF;
  value:=-value;
 ELSIF p_action='credit' THEN
  IF value<=0 THEN RAISE EXCEPTION 'Enter the credit amount'; END IF;
 ELSIF p_action='credit_used' THEN
  IF bid IS NULL OR b.status<>'awaiting_payment' OR b.hold_until<=now() OR b.expires_on<=(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Choose an unexpired unpaid booking'; END IF;
  SELECT coalesce(sum(amount),0) INTO already FROM public.academy_member_ledger WHERE academy_id=aid AND member_id=p_member AND kind IN ('credit','credit_used');
  IF b.amount<=0 OR already<b.amount THEN RAISE EXCEPTION 'Insufficient credit to cover this booking'; END IF;
  value:=-b.amount;
 ELSIF p_action='freeze' THEN
  IF bid IS NOT NULL THEN RAISE EXCEPTION 'Reschedule confirmed bookings separately; freezing applies to legacy training credits'; END IF;
  until_date:=(p_details->>'until')::date;
  IF until_date IS NULL OR until_date<(now() AT TIME ZONE 'Africa/Cairo')::date OR until_date>(now() AT TIME ZONE 'Africa/Cairo')::date+90 THEN RAISE EXCEPTION 'Freeze must end within 90 days'; END IF;
  UPDATE public.profiles SET training_frozen_until=until_date,training_frozen_from=(now() AT TIME ZONE 'Africa/Cairo')::date WHERE id=p_member; value:=0;
 ELSIF p_action='resume' THEN
  IF bid IS NOT NULL THEN RAISE EXCEPTION 'Resume applies to legacy training credits only'; END IF;
  UPDATE public.profiles SET training_frozen_until=NULL,training_frozen_from=NULL WHERE id=p_member; value:=0;
 ELSIF p_action='makeup' THEN
  IF bid IS NOT NULL OR member.academy_id IS DISTINCT FROM aid THEN RAISE EXCEPTION 'Choose a legacy academy member; use reschedule for purchased sessions'; END IF;
  UPDATE public.profiles SET subscription_sessions=subscription_sessions+1 WHERE id=p_member; value:=0;
 ELSIF p_action='cancel' THEN
  IF bid IS NULL THEN UPDATE public.profiles SET subscription_sessions=0 WHERE id=p_member;
  ELSE UPDATE public.academy_training_bookings SET status='cancelled' WHERE id=bid;
  END IF; value:=0;
 ELSE RAISE EXCEPTION 'Unknown membership action'; END IF;
 INSERT INTO public.academy_member_ledger(academy_id,member_id,booking_id,payment_id,branch_id,kind,amount,sessions,reason,actor_id,request_id)
 VALUES(aid,p_member,bid,payid,branch,p_action,value,CASE WHEN p_action='makeup' THEN 1 ELSE 0 END,reason,auth.uid(),p_request) RETURNING id INTO entry;
 IF p_action='credit_used' THEN UPDATE public.academy_training_bookings SET status='approved',reviewed_at=now(),reviewed_by=auth.uid(),review_note='Paid using academy credit' WHERE id=bid; END IF;
 PERFORM private.academy_record_audit(aid,'membership_'||p_action,p_member::text,jsonb_build_object('ledger',entry,'amount',value,'booking',bid,'payment',payid,'until',until_date));
 RETURN entry;
END $$;
-- Credit-funded approvals are not additional cash receipts.
CREATE OR REPLACE FUNCTION private.academy_booking_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid; branch uuid; used numeric; BEGIN
 IF NEW.status='approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
 SELECT academy_id,branch_id INTO aid,branch FROM public.academy_training_programs WHERE id=NEW.program_id;
 SELECT coalesce(-sum(amount),0) INTO used FROM public.academy_member_ledger WHERE booking_id=NEW.id AND kind='credit_used';
 INSERT INTO public.academy_member_ledger(academy_id,member_id,booking_id,branch_id,kind,amount,reason,actor_id,created_at)
 VALUES(aid,NEW.member_id,NEW.id,branch,'payment',greatest(NEW.amount-used,0),'Verified training booking',auth.uid(),coalesce(NEW.reviewed_at,now())) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION private.guard_workspace_profile_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
 IF NEW.branch_id IS DISTINCT FROM OLD.branch_id AND NOT public.academy_can(OLD.academy_id,'members') THEN RAISE EXCEPTION 'Member management permission required'; END IF;
 IF (NEW.training_frozen_until IS DISTINCT FROM OLD.training_frozen_until OR NEW.training_frozen_from IS DISTINCT FROM OLD.training_frozen_from) AND NOT public.academy_can(OLD.academy_id,'finance') THEN RAISE EXCEPTION 'Finance permission required'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_workspace_profile_fields() FROM PUBLIC;
CREATE TRIGGER workspace_profile_fields BEFORE UPDATE OF branch_id,training_frozen_until,training_frozen_from ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.guard_workspace_profile_fields();
CREATE OR REPLACE FUNCTION private.guard_frozen_attendance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.is_present AND EXISTS(SELECT 1 FROM public.profiles p JOIN public.training_sessions s ON s.id=NEW.session_id WHERE p.id=NEW.member_id AND s.date BETWEEN coalesce(p.training_frozen_from,(now() AT TIME ZONE 'Africa/Cairo')::date) AND p.training_frozen_until) THEN RAISE EXCEPTION 'Training package is frozen'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_frozen_attendance() FROM PUBLIC;
CREATE TRIGGER workspace_frozen_attendance BEFORE INSERT OR UPDATE OF is_present ON public.attendance FOR EACH ROW EXECUTE FUNCTION private.guard_frozen_attendance();

CREATE OR REPLACE FUNCTION public.academy_reschedule_booking(p_booking uuid,p_old_date date,p_old_time time,p_date date,p_time time,p_reason text,p_request uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.academy_training_bookings%ROWTYPE; p public.academy_training_programs%ROWTYPE; slot record; court integer; BEGIN
 SELECT * INTO p FROM public.academy_training_programs WHERE id=(SELECT program_id FROM public.academy_training_bookings WHERE id=p_booking) FOR UPDATE;
 SELECT * INTO b FROM public.academy_training_bookings WHERE id=p_booking FOR UPDATE;
 IF NOT public.academy_can(p.academy_id,'bookings') OR b.status<>'approved' THEN RAISE EXCEPTION 'Confirmed booking and booking permission required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.academy_member_ledger WHERE request_id=p_request AND academy_id=p.academy_id) THEN RETURN; END IF;
 IF p_request IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.academy_training_booking_sessions WHERE booking_id=b.id AND session_date=p_old_date AND starts_at=p_old_time) OR EXISTS(SELECT 1 FROM public.academy_booking_checkins WHERE booking_id=b.id AND session_date=p_old_date AND starts_at=p_old_time AND is_present) THEN RAISE EXCEPTION 'Choose an unconsumed booked session'; END IF;
 IF EXISTS(SELECT 1 FROM public.academy_training_booking_sessions WHERE booking_id=b.id AND session_date=p_date AND starts_at=p_time) THEN RAISE EXCEPTION 'This booking already includes that session'; END IF;
 SELECT * INTO slot FROM public.training_program_slots(p.id) WHERE session_date=p_date AND starts_at=p_time AND seats_left>0;
 IF NOT FOUND OR p_date<(now() AT TIME ZONE 'Africa/Cairo')::date OR p_date>=b.expires_on THEN RAISE EXCEPTION 'Choose an available slot within this booking term'; END IF;
 IF EXISTS(SELECT 1 FROM public.academy_training_booking_sessions bs JOIN public.academy_training_bookings other ON other.id=bs.booking_id WHERE other.member_id=b.member_id AND other.id<>b.id AND (other.status IN ('approved','submitted') OR (other.status='awaiting_payment' AND other.hold_until>now())) AND bs.session_date=p_date AND bs.starts_at<slot.ends_at AND bs.ends_at>p_time) THEN RAISE EXCEPTION 'Member has an overlapping booking'; END IF;
 SELECT bs.court_number INTO court FROM public.academy_training_booking_sessions bs JOIN public.academy_training_bookings other ON other.id=bs.booking_id WHERE bs.program_id=p.id AND bs.session_date=p_date AND bs.starts_at=p_time AND (other.status IN ('approved','submitted') OR (other.status='awaiting_payment' AND other.hold_until>now())) LIMIT 1;
 court:=coalesce(court,public.pick_free_court(p.venue_id,p_date,p_time,public.minutes_of_day(slot.ends_at)-public.minutes_of_day(p_time)));
 IF court IS NULL THEN RAISE EXCEPTION 'No court available'; END IF;
 UPDATE public.academy_training_booking_sessions SET session_date=p_date,starts_at=p_time,ends_at=slot.ends_at,court_number=court WHERE booking_id=b.id AND session_date=p_old_date AND starts_at=p_old_time;
 DELETE FROM public.academy_booking_checkins WHERE booking_id=b.id AND session_date=p_old_date AND starts_at=p_old_time;
 UPDATE public.academy_training_bookings SET details=jsonb_set(details,'{sessions}',coalesce((SELECT jsonb_agg(jsonb_build_object('session_date',session_date,'starts_at',starts_at,'ends_at',ends_at) ORDER BY session_date,starts_at) FROM public.academy_training_booking_sessions WHERE booking_id=b.id),'[]')) WHERE id=b.id;
 INSERT INTO public.academy_member_ledger(academy_id,member_id,booking_id,branch_id,kind,reason,actor_id,request_id) VALUES(p.academy_id,b.member_id,b.id,p.branch_id,'reschedule',p_reason,auth.uid(),p_request);
 PERFORM private.academy_record_audit(p.academy_id,'booking_reschedule',b.id::text,jsonb_build_object('from_date',p_old_date,'from_time',p_old_time,'to_date',p_date,'to_time',p_time));
END $$;
CREATE OR REPLACE FUNCTION private.sync_academy_trial_lead() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.academy_leads(academy_id,trial_request_id,name,email,phone,stage,trial_date,created_at)
 VALUES(NEW.academy_id,NEW.id,NEW.name,NEW.email,NEW.phone,CASE NEW.status WHEN 'converted' THEN 'joined' WHEN 'declined' THEN 'declined' WHEN 'contacted' THEN 'contacted' ELSE 'new' END,NEW.preferred_date,NEW.created_at)
 ON CONFLICT(trial_request_id) DO UPDATE SET stage=CASE WHEN NEW.status IN ('converted','declined') THEN excluded.stage ELSE academy_leads.stage END,updated_at=now();
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.sync_academy_trial_lead() FROM PUBLIC;
CREATE TRIGGER workspace_trial_lead AFTER INSERT OR UPDATE OF status ON public.trial_requests FOR EACH ROW EXECUTE FUNCTION private.sync_academy_trial_lead();
INSERT INTO public.academy_leads(academy_id,trial_request_id,name,email,phone,stage,trial_date,created_at)
 SELECT academy_id,id,name,email,phone,CASE status WHEN 'converted' THEN 'joined' WHEN 'declined' THEN 'declined' WHEN 'contacted' THEN 'contacted' ELSE 'new' END,preferred_date,created_at FROM public.trial_requests ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.academy_save_lead(p_details jsonb,p_id uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid:=public.current_academy_id(); lid uuid:=coalesce(p_id,gen_random_uuid()); member uuid:=nullif(p_details->>'member_id','')::uuid; branch uuid:=nullif(p_details->>'branch_id','')::uuid; BEGIN
 IF NOT public.academy_can(aid,'leads') THEN RAISE EXCEPTION 'Inquiry management permission required' USING ERRCODE='42501'; END IF;
 IF p_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.academy_leads WHERE id=p_id AND academy_id=aid) THEN RAISE EXCEPTION 'Inquiry not found'; END IF;
 IF branch IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.academy_branches WHERE id=branch AND academy_id=aid) THEN RAISE EXCEPTION 'Branch belongs to another academy'; END IF;
 IF member IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=member AND academy_id=aid AND role='member') THEN RAISE EXCEPTION 'Member belongs to another academy'; END IF;
 IF p_details->>'stage'='joined' AND member IS NULL THEN RAISE EXCEPTION 'Link the enrolled member before marking joined'; END IF;
 INSERT INTO public.academy_leads(id,academy_id,name,email,phone,stage,member_id,branch_id,trial_date,followup_date,notes)
 VALUES(lid,aid,left(btrim(p_details->>'name'),120),left(p_details->>'email',254),left(p_details->>'phone',50),coalesce(p_details->>'stage','new'),member,branch,nullif(p_details->>'trial_date','')::date,nullif(p_details->>'followup_date','')::date,left(p_details->>'notes',2000))
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,stage=excluded.stage,member_id=excluded.member_id,branch_id=excluded.branch_id,trial_date=excluded.trial_date,followup_date=excluded.followup_date,notes=excluded.notes,updated_at=now();
 UPDATE public.trial_requests SET status=CASE p_details->>'stage' WHEN 'joined' THEN 'converted' WHEN 'declined' THEN 'declined' ELSE status END WHERE id=(SELECT trial_request_id FROM public.academy_leads WHERE id=lid) AND p_details->>'stage' IN ('joined','declined');
 PERFORM private.academy_record_audit(aid,'inquiry_stage',lid::text,jsonb_build_object('stage',p_details->>'stage'));
 RETURN lid;
END $$;
CREATE OR REPLACE FUNCTION public.academy_send_renewal_reminder(p_member uuid,p_request uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid:=public.current_academy_id(); nid uuid; existing uuid; BEGIN
 IF NOT public.academy_can(aid,'leads') OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_member AND academy_id=aid AND role='member' AND is_active AND email IS NOT NULL) THEN RAISE EXCEPTION 'An active member login account is required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=p_member FOR UPDATE;
 SELECT notification_id INTO existing FROM public.academy_outreach WHERE request_id=p_request AND academy_id=aid;
 IF existing IS NOT NULL THEN RETURN existing; END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'Request ID required'; END IF;
 IF EXISTS(SELECT 1 FROM public.academy_outreach WHERE academy_id=aid AND member_id=p_member AND created_at>now()-interval '24 hours') THEN RAISE EXCEPTION 'A reminder was already sent in the last 24 hours'; END IF;
 INSERT INTO public.notifications(recipient_id,type,title,body,link) VALUES(p_member,'renewal','Academy training renewal / تجديد اشتراك التدريب','Review your training package with your academy. / راجع باقة التدريب مع أكاديميتك.','/profile#training-renewal') RETURNING id INTO nid;
 IF nid IS NULL THEN RAISE EXCEPTION 'Member notification preferences prevented delivery; no reminder was recorded'; END IF;
 INSERT INTO public.academy_outreach(academy_id,member_id,actor_id,request_id,notification_id,status) VALUES(aid,p_member,auth.uid(),p_request,nid,'sent');
 UPDATE public.profiles SET last_reminded_at=now() WHERE id=p_member;
 PERFORM private.academy_record_audit(aid,'renewal_reminder',p_member::text,jsonb_build_object('channel','in_app','notification',nid));
 RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.academy_import_roster(p_rows jsonb,p_commit boolean DEFAULT false,p_request uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid:=public.current_academy_id(); row jsonb; output jsonb:='[]'; result jsonb; uid uuid; branch uuid; v_email text; v_phone text; v_name text; seen text[]:='{}'; seen_phones text[]:='{}'; rownum integer:=1; reason text; existing uuid; BEGIN
 IF NOT public.academy_can(aid,'members') THEN RAISE EXCEPTION 'Member management permission required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Import 1 to 500 rows'; END IF;
 IF p_commit AND p_request IS NULL THEN RAISE EXCEPTION 'Import request ID required'; END IF;
 PERFORM 1 FROM public.academies WHERE id=aid FOR UPDATE;
 IF p_commit THEN SELECT b.result INTO result FROM public.academy_import_batches b WHERE b.id=p_request AND b.academy_id=aid; IF result IS NOT NULL THEN RETURN result; END IF; END IF;
 FOR row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  rownum:=rownum+1; reason:=NULL; branch:=NULL; uid:=NULL; existing:=NULL;
  v_name:=btrim(row->>'name'); v_email:=nullif(lower(btrim(row->>'email')),''); v_phone:=nullif(btrim(row->>'phone'),'');
  BEGIN
   IF v_name IS NULL OR length(v_name) NOT BETWEEN 1 AND 120 OR length(coalesce(v_phone,''))>50 OR (v_email IS NOT NULL AND (length(v_email)>254 OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) THEN RAISE EXCEPTION 'Invalid name, email or phone'; END IF;
   IF v_email IS NOT NULL AND v_email=ANY(seen) THEN RAISE EXCEPTION 'Duplicate email in this file'; END IF;
   IF v_email IS NOT NULL THEN seen:=array_append(seen,v_email); END IF;
   IF v_phone IS NOT NULL AND v_phone=ANY(seen_phones) THEN RAISE EXCEPTION 'Duplicate phone in this file'; END IF;
   IF v_phone IS NOT NULL THEN seen_phones:=array_append(seen_phones,v_phone); END IF;
   IF nullif(btrim(row->>'branch'),'') IS NOT NULL THEN
    SELECT id INTO branch FROM public.academy_branches b WHERE academy_id=aid AND lower(b.name)=lower(btrim(row->>'branch')) LIMIT 1;
    IF branch IS NULL THEN RAISE EXCEPTION 'Unknown branch name'; END IF;
   END IF;
   SELECT p.id INTO existing FROM public.profiles p LEFT JOIN public.academy_member_details d ON d.member_id=p.id WHERE p.academy_id=aid AND p.role='member' AND ((v_email IS NOT NULL AND (lower(p.email)=v_email OR d.contact_email=v_email)) OR (v_phone IS NOT NULL AND p.phone=v_phone)) LIMIT 1;
   IF existing IS NOT NULL THEN RAISE EXCEPTION 'Existing academy member; skipped'; END IF;
   IF p_commit THEN
    uid:=gen_random_uuid();
    INSERT INTO public.profiles(id,academy_id,role,name,username,email,phone,is_active,subscription_sessions,branch_id,join_date)
    VALUES(uid,aid,'member',v_name,'r_'||left(replace(uid::text,'-',''),20),NULL,v_phone,true,0,branch,(now() AT TIME ZONE 'Africa/Cairo')::date);
    INSERT INTO public.academy_member_details(member_id,academy_id,contact_email,updated_by) VALUES(uid,aid,v_email,auth.uid());
   END IF;
  EXCEPTION WHEN OTHERS THEN reason:=SQLERRM; uid:=NULL;
  END;
  output:=output||jsonb_build_array(jsonb_build_object('row',rownum,'name',v_name,'email',v_email,'status',CASE WHEN reason IS NOT NULL THEN 'error' WHEN p_commit THEN 'imported' ELSE 'ready' END,'message',reason,'member_id',uid));
 END LOOP;
 result:=jsonb_build_object('rows',output,'committed',p_commit);
 IF p_commit THEN
  INSERT INTO public.academy_import_batches VALUES(p_request,aid,auth.uid(),result,now());
  PERFORM private.academy_record_audit(aid,'roster_import',p_request::text,jsonb_build_object('rows',jsonb_array_length(output)));
 END IF;
 RETURN result;
END $$;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.academy_branches(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION private.academy_payment_branch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.branch_id IS NULL THEN SELECT branch_id INTO NEW.branch_id FROM public.profiles WHERE id=NEW.member_id; END IF;
 IF NEW.branch_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.academy_branches WHERE id=NEW.branch_id AND academy_id=NEW.academy_id) THEN RAISE EXCEPTION 'Branch belongs to another academy'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.academy_payment_branch() FROM PUBLIC;
CREATE TRIGGER workspace_payment_branch BEFORE INSERT OR UPDATE OF branch_id ON public.payments FOR EACH ROW EXECUTE FUNCTION private.academy_payment_branch();
CREATE OR REPLACE FUNCTION public.academy_assign_branch(p_kind text,p_id uuid,p_branch uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid:=public.current_academy_id(); BEGIN
 IF NOT public.academy_can(aid,'training') THEN RAISE EXCEPTION 'Training management permission required' USING ERRCODE='42501'; END IF;
 IF p_branch IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.academy_branches WHERE id=p_branch AND academy_id=aid) THEN RAISE EXCEPTION 'Branch belongs to another academy'; END IF;
 IF p_kind='program' THEN UPDATE public.academy_training_programs SET branch_id=p_branch WHERE id=p_id AND academy_id=aid;
 ELSIF p_kind='session' THEN UPDATE public.training_sessions SET branch_id=p_branch WHERE id=p_id AND academy_id=aid;
 ELSE RAISE EXCEPTION 'Unknown branch assignment'; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;
 PERFORM private.academy_record_audit(aid,'branch_assignment',p_id::text,jsonb_build_object('kind',p_kind,'branch',p_branch));
END $$;
CREATE OR REPLACE FUNCTION private.academy_audit_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before_row jsonb:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END; after_row jsonb:=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END; aid uuid; keys text[]:=ARRAY['amount','method','payment_date','subscription_sessions','is_present','status','name','slug','is_public','monthly_price','tryout_price','platform_fee_percent','date','time','duration_minutes','court_number']; before_safe jsonb; after_safe jsonb; BEGIN
 aid:=coalesce(nullif(after_row->>'academy_id','')::uuid,nullif(before_row->>'academy_id','')::uuid);
 IF TG_TABLE_NAME='academies' THEN aid:=coalesce(NEW.id,OLD.id); END IF;
 IF TG_TABLE_NAME='attendance' THEN SELECT academy_id INTO aid FROM public.training_sessions WHERE id=coalesce(NEW.session_id,OLD.session_id); END IF;
 IF aid IS NOT NULL THEN
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO before_safe FROM jsonb_each(before_row) WHERE key=ANY(keys);
 SELECT coalesce(jsonb_object_agg(key,value),'{}') INTO after_safe FROM jsonb_each(after_row) WHERE key=ANY(keys);
 IF TG_OP<>'UPDATE' OR before_safe IS DISTINCT FROM after_safe THEN PERFORM private.academy_record_audit(aid,TG_TABLE_NAME||'_'||lower(TG_OP),coalesce(after_row->>'id',before_row->>'id'),jsonb_build_object('before',before_safe,'after',after_safe)); END IF;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.academy_audit_changes() FROM PUBLIC;
CREATE TRIGGER workspace_audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION private.academy_audit_changes();
CREATE TRIGGER workspace_audit_attendance AFTER INSERT OR UPDATE OR DELETE ON public.attendance FOR EACH ROW EXECUTE FUNCTION private.academy_audit_changes();
CREATE TRIGGER workspace_audit_settings AFTER UPDATE ON public.academies FOR EACH ROW EXECUTE FUNCTION private.academy_audit_changes();
CREATE TRIGGER workspace_audit_programs AFTER INSERT OR UPDATE OR DELETE ON public.academy_training_programs FOR EACH ROW EXECUTE FUNCTION private.academy_audit_changes();
CREATE TRIGGER workspace_audit_sessions AFTER INSERT OR UPDATE OR DELETE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION private.academy_audit_changes();

CREATE OR REPLACE FUNCTION public.academy_workspace(p_branch uuid DEFAULT NULL,p_day date DEFAULT CURRENT_DATE) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE aid uuid:=public.current_academy_id(); caps jsonb; result jsonb; BEGIN
 IF NOT public.academy_can(aid,'read') THEN RAISE EXCEPTION 'Academy staff access required' USING ERRCODE='42501'; END IF;
 IF p_branch IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.academy_branches WHERE id=p_branch AND academy_id=aid) THEN RAISE EXCEPTION 'Branch belongs to another academy'; END IF;
 SELECT jsonb_object_agg(cap,public.academy_can(aid,cap)) INTO caps FROM unnest(ARRAY['owner','training','bookings','attendance','members','finance','leads','audit']) cap;
 SELECT jsonb_build_object(
 'academy',jsonb_build_object('id',a.id,'name',a.name,'slug',a.slug,'is_public',a.is_public),
 'capabilities',caps,
 'setup',jsonb_build_object('identity',a.logo_url IS NOT NULL AND a.name<>'','sports',EXISTS(SELECT 1 FROM public.sports WHERE academy_id=aid),'branches',EXISTS(SELECT 1 FROM public.academy_branches WHERE academy_id=aid),'venue',EXISTS(SELECT 1 FROM public.venues WHERE academy_id=aid AND approval_status='approved'),'coach',EXISTS(SELECT 1 FROM public.coaches WHERE academy_id=aid),'prices',EXISTS(SELECT 1 FROM public.academy_training_programs WHERE academy_id=aid),'training',EXISTS(SELECT 1 FROM public.academy_training_programs WHERE academy_id=aid AND active),'schedule',EXISTS(SELECT 1 FROM public.training_sessions WHERE academy_id=aid AND date>=CURRENT_DATE AND status='scheduled') OR EXISTS(SELECT 1 FROM public.academy_training_programs p WHERE p.academy_id=aid AND p.active AND EXISTS(SELECT 1 FROM public.training_program_slots(p.id) sl WHERE sl.seats_left>0)),'public',a.is_public AND a.slug IS NOT NULL),
 'branches',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'name',b.name)) FROM public.academy_branches b WHERE b.academy_id=aid),'[]'),
 'members',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'has_account',p.email IS NOT NULL,'email',CASE WHEN public.academy_can(aid,'members') THEN coalesce(p.email,d.contact_email) END,'phone',CASE WHEN public.academy_can(aid,'members') THEN p.phone END,'guardian_id',p.guardian_id,'branch_id',p.branch_id,'frozen_until',p.training_frozen_until,'sessions',p.subscription_sessions,'details',CASE WHEN public.academy_can(aid,'members') THEN to_jsonb(d)-'updated_by'-'academy_id' WHEN public.academy_can(aid,'attendance') THEN jsonb_build_object('emergency_name',d.emergency_name,'emergency_phone',d.emergency_phone,'consent_status',d.consent_status) ELSE '{}' END) ORDER BY p.name) FROM public.profiles p LEFT JOIN public.academy_member_details d ON d.member_id=p.id WHERE p.academy_id=aid AND p.role='member' AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]'),
 'programs',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'branch_id',p.branch_id,'active',p.active,'venue_id',p.venue_id)) FROM public.academy_training_programs p WHERE p.academy_id=aid AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]'),
 'bookings',CASE WHEN public.academy_can(aid,'bookings') OR public.academy_can(aid,'finance') THEN coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC) FROM public.academy_training_bookings b JOIN public.academy_training_programs p ON p.id=b.program_id WHERE p.academy_id=aid AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'agenda',CASE WHEN public.academy_can(aid,'attendance') OR public.academy_can(aid,'bookings') THEN coalesce((SELECT jsonb_agg(jsonb_build_object('booking_id',b.id,'member_id',m.id,'member',m.name,'program',p.name,'program_id',p.id,'venue',v.name,'date',s.session_date,'time',s.starts_at,'end',s.ends_at,'present',c.is_present,'frozen_until',m.training_frozen_until,'branch_id',p.branch_id,'court',s.court_number) ORDER BY s.session_date,s.starts_at,m.name) FROM public.academy_training_booking_sessions s JOIN public.academy_training_bookings b ON b.id=s.booking_id AND b.status='approved' JOIN public.academy_training_programs p ON p.id=b.program_id JOIN public.profiles m ON m.id=b.member_id JOIN public.venues v ON v.id=p.venue_id LEFT JOIN public.academy_booking_checkins c ON c.booking_id=s.booking_id AND c.session_date=s.session_date AND c.starts_at=s.starts_at WHERE p.academy_id=aid AND s.session_date BETWEEN p_day AND p_day+30 AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'sessions',CASE WHEN public.academy_can(aid,'training') THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'date',date,'time',time,'branch_id',branch_id)) FROM public.training_sessions WHERE academy_id=aid AND date BETWEEN p_day AND p_day+30 AND (p_branch IS NULL OR branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'credit_balance',CASE WHEN public.academy_can(aid,'finance') THEN coalesce((SELECT sum(amount) FROM public.academy_member_ledger WHERE academy_id=aid AND kind IN ('credit','credit_used')),0) ELSE 0 END,
 'payments',CASE WHEN public.academy_can(aid,'finance') THEN coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.payment_date DESC) FROM public.payments p WHERE p.academy_id=aid AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'renewal_requests',CASE WHEN public.academy_can(aid,'finance') THEN coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM public.renewal_requests r JOIN public.profiles p ON p.id=r.member_id WHERE r.academy_id=aid AND r.status='pending' AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'ledger',CASE WHEN public.academy_can(aid,'finance') THEN coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC) FROM public.academy_member_ledger l WHERE l.academy_id=aid AND (p_branch IS NULL OR l.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'staff',CASE WHEN public.academy_can(aid,'owner') THEN coalesce((SELECT jsonb_agg(jsonb_build_object('profile_id',s.profile_id,'name',p.name,'role',s.role,'active',s.active)) FROM public.academy_staff s JOIN public.profiles p ON p.id=s.profile_id WHERE s.academy_id=aid),'[]') ELSE '[]'::jsonb END,
 'leads',CASE WHEN public.academy_can(aid,'leads') THEN coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.updated_at DESC) FROM public.academy_leads l WHERE l.academy_id=aid AND (p_branch IS NULL OR l.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'renewals',CASE WHEN public.academy_can(aid,'leads') THEN coalesce((SELECT jsonb_agg(jsonb_build_object('member_id',p.id,'name',p.name,'has_account',p.email IS NOT NULL,'remaining',greatest(p.subscription_sessions-coalesce((SELECT count(*) FROM public.attendance t JOIN public.training_sessions s ON s.id=t.session_id WHERE t.member_id=p.id AND t.is_present AND s.status<>'canceled' AND s.date>=coalesce((SELECT max(payment_date) FROM public.payments WHERE member_id=p.id),p.join_date)),0),0),'last_reminder',(SELECT max(created_at) FROM public.academy_outreach WHERE academy_id=aid AND member_id=p.id),'pending_request',EXISTS(SELECT 1 FROM public.renewal_requests r WHERE r.member_id=p.id AND r.academy_id=aid AND r.status='pending'))) FROM public.profiles p WHERE p.academy_id=aid AND p.role='member' AND p.is_active AND (p_branch IS NULL OR p.branch_id=p_branch)),'[]') ELSE '[]'::jsonb END,
 'audit',CASE WHEN public.academy_can(aid,'audit') THEN coalesce((SELECT jsonb_agg(to_jsonb(l)) FROM (SELECT * FROM public.academy_audit_log WHERE academy_id=aid ORDER BY created_at DESC LIMIT 200) l),'[]') ELSE '[]'::jsonb END
 ) INTO result FROM public.academies a WHERE a.id=aid;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_save_training_program(p_details jsonb, p_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE aid uuid := (p_details->>'academy_id')::uuid; sid uuid; pid uuid; slot jsonb; existing public.academy_training_programs%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF NOT coalesce(public.is_super_admin(),false) THEN
  IF NOT public.academy_can(coalesce((SELECT academy_id FROM public.academy_training_programs WHERE id=p_id),aid),'training') OR (aid IS NOT NULL AND NOT public.academy_can(aid,'training')) THEN RAISE EXCEPTION 'Training management permission required' USING ERRCODE='42501'; END IF;
 END IF;
 IF p_details ? 'media' THEN
  IF jsonb_typeof(p_details->'media') IS DISTINCT FROM 'array' OR jsonb_array_length(p_details->'media')>12 THEN RAISE EXCEPTION 'Add at most 12 media items'; END IF;
  FOR slot IN SELECT value FROM jsonb_array_elements(p_details->'media') LOOP
   IF coalesce(slot->>'kind','') NOT IN ('image','video','youtube') OR coalesce(slot->>'url','') !~ '^https://[^[:space:]]+$' THEN RAISE EXCEPTION 'Invalid media URL'; END IF;
   IF slot->>'kind'='youtube' AND slot->>'url' !~ '^https://(www\.)?(youtube\.com/|youtu\.be/)' THEN RAISE EXCEPTION 'Invalid YouTube link'; END IF;
  END LOOP;
 END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO existing FROM public.academy_training_programs WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Program not found'; END IF;
  IF p_details ? 'active' AND (SELECT count(*) FROM jsonb_object_keys(p_details)) = 1 THEN
   UPDATE public.academy_training_programs SET active=(p_details->>'active')::boolean WHERE id=p_id; RETURN p_id;
  END IF;
  IF EXISTS(SELECT 1 FROM public.academy_training_bookings WHERE program_id=p_id) THEN
   IF existing.academy_id IS DISTINCT FROM aid OR existing.venue_id IS DISTINCT FROM (p_details->>'venue_id')::uuid
    OR existing.monthly_sessions IS DISTINCT FROM (p_details->>'monthly_sessions')::integer
    OR existing.monthly_price IS DISTINCT FROM (p_details->>'monthly_price')::numeric
    OR existing.trial_price IS DISTINCT FROM (p_details->>'trial_price')::numeric
    OR existing.capacity IS DISTINCT FROM (p_details->>'capacity')::integer
    OR existing.schedule IS DISTINCT FROM p_details->'schedule'
    OR existing.min_age IS DISTINCT FROM nullif(p_details->>'min_age','')::integer
    OR existing.max_age IS DISTINCT FROM nullif(p_details->>'max_age','')::integer
    OR existing.gender IS DISTINCT FROM coalesce(p_details->>'gender','mixed')
    OR NOT EXISTS(SELECT 1 FROM public.sports WHERE id=existing.sport_id AND name=p_details->>'sport')
   THEN RAISE EXCEPTION 'This group has bookings. Pause it and create a new group to change its terms'; END IF;
   UPDATE public.academy_training_programs SET name=p_details->>'name',media=coalesce(p_details->'media','[]'::jsonb) WHERE id=p_id;
   RETURN p_id;
  END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.academies WHERE id=aid) THEN RAISE EXCEPTION 'Academy not found'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.venues WHERE id=(p_details->>'venue_id')::uuid AND approval_status='approved' AND (public.is_super_admin() OR academy_id IS NULL OR academy_id=aid)) THEN RAISE EXCEPTION 'Choose an approved playground'; END IF;
 IF nullif(btrim(p_details->>'sport'),'') IS NULL OR length(p_details->>'sport')>100 THEN RAISE EXCEPTION 'Sport is required'; END IF;
 -- Serialize sport creation for this academy.
 PERFORM 1 FROM public.academies WHERE id=aid FOR UPDATE;
 SELECT id INTO sid FROM public.sports WHERE academy_id=aid AND lower(name)=lower(btrim(p_details->>'sport')) LIMIT 1;
 IF sid IS NULL THEN INSERT INTO public.sports(academy_id,name) VALUES(aid,btrim(p_details->>'sport')) RETURNING id INTO sid; END IF;
 IF jsonb_typeof(p_details->'schedule') IS DISTINCT FROM 'array' OR jsonb_array_length(p_details->'schedule') NOT BETWEEN 1 AND 14 THEN RAISE EXCEPTION 'Add 1 to 14 weekly session times'; END IF;
 FOR slot IN SELECT value FROM jsonb_array_elements(p_details->'schedule') LOOP
  IF coalesce(slot->>'weekday','') !~ '^[0-6]$' OR coalesce(slot->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(slot->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Invalid session day or time'; END IF;
  IF (slot->>'start')::time >= (slot->>'end')::time THEN RAISE EXCEPTION 'Session end must be after start'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_details->'schedule') other WHERE other->>'weekday'=slot->>'weekday' AND (other->>'start')::time < (slot->>'end')::time AND (other->>'end')::time > (slot->>'start')::time)>1 THEN RAISE EXCEPTION 'Weekly sessions overlap'; END IF;
 END LOOP;
 INSERT INTO public.academy_training_programs(id,academy_id,sport_id,venue_id,name,monthly_sessions,monthly_price,trial_price,capacity,schedule)
 VALUES(coalesce(p_id,gen_random_uuid()),aid,sid,(p_details->>'venue_id')::uuid,p_details->>'name',(p_details->>'monthly_sessions')::integer,(p_details->>'monthly_price')::numeric,(p_details->>'trial_price')::numeric,(p_details->>'capacity')::integer,p_details->'schedule')
 ON CONFLICT(id) DO UPDATE SET academy_id=excluded.academy_id,sport_id=excluded.sport_id,venue_id=excluded.venue_id,name=excluded.name,monthly_sessions=excluded.monthly_sessions,monthly_price=excluded.monthly_price,trial_price=excluded.trial_price,capacity=excluded.capacity,schedule=excluded.schedule
 RETURNING id INTO pid;
 UPDATE public.academy_training_programs SET branch_id=coalesce(nullif(p_details->>'branch_id','')::uuid,branch_id),min_age=nullif(p_details->>'min_age','')::integer,max_age=nullif(p_details->>'max_age','')::integer,gender=coalesce(p_details->>'gender','mixed'),media=coalesce(p_details->'media','[]'::jsonb) WHERE id=pid;
 RETURN pid;
END $$;
CREATE OR REPLACE FUNCTION public.academy_training_catalog(p_academy_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.name),'[]'::jsonb) FROM (
 SELECT p.*, a.name academy_name,a.slug academy_slug,s.name sport,v.name venue_name,v.address venue_address,v.lat venue_lat,v.lng venue_lng,v.area venue_area,v.governorate venue_governorate,
 (SELECT round(avg(r.rating),1) FROM public.training_ratings r WHERE r.program_id=p.id) rating,
 (SELECT count(*) FROM public.training_ratings r WHERE r.program_id=p.id) rating_count,
 coalesce((SELECT jsonb_agg(to_jsonb(sl)) FROM public.training_program_slots(p.id) sl),'[]'::jsonb) slots
 FROM public.academy_training_programs p JOIN public.academies a ON a.id=p.academy_id JOIN public.sports s ON s.id=p.sport_id JOIN public.venues v ON v.id=p.venue_id
 WHERE (p_academy_id IS NULL OR p.academy_id=p_academy_id) AND ((p.active AND a.is_public AND v.approval_status='approved') OR public.is_super_admin() OR public.academy_can(p.academy_id,'read'))
 ) x;
$$;
CREATE OR REPLACE FUNCTION public.training_program_slots(p_id uuid) RETURNS TABLE(session_date date, starts_at time, ends_at time, seats_left bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 SELECT d::date,(s->>'start')::time,(s->>'end')::time,
 CASE WHEN
  (jsonb_array_length(coalesce(v.working_hours,'[]'::jsonb))=0 OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(v.working_hours) wh WHERE wh->>'weekday'=extract(dow FROM d)::integer::text
    AND wh->>'start'<=s->>'start' AND wh->>'end'>=s->>'end'
  )) AND NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(coalesce(v.unavailable_slots,'[]'::jsonb)) blk
   WHERE blk->>'weekday'=extract(dow FROM d)::integer::text
    AND (blk->>'all_day'='true' OR (blk->>'start'<s->>'end' AND blk->>'end'>s->>'start'))
  ) AND NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(coalesce(v.blocked_dates,'[]'::jsonb)) blk
   WHERE blk->>'date'=to_char(d,'YYYY-MM-DD')
    AND (blk->>'all_day'='true' OR (blk->>'start'<s->>'end' AND blk->>'end'>s->>'start'))
  ) AND (
   EXISTS(SELECT 1 FROM public.academy_training_booking_sessions bs JOIN public.academy_training_bookings b ON b.id=bs.booking_id
    WHERE bs.program_id=p.id AND bs.session_date=d::date AND bs.starts_at=(s->>'start')::time
     AND (b.status IN ('submitted','approved') OR (b.status='awaiting_payment' AND b.hold_until>now())))
   OR public.pick_free_court(p.venue_id,d::date,(s->>'start')::time,(extract(epoch FROM ((s->>'end')::time-(s->>'start')::time))/60)::integer) IS NOT NULL
  ) THEN greatest(0,p.capacity-(SELECT count(*) FROM public.academy_training_booking_sessions bs JOIN public.academy_training_bookings b ON b.id=bs.booking_id
 WHERE bs.program_id=p.id AND bs.session_date=d::date AND bs.starts_at=(s->>'start')::time AND (b.status IN ('submitted','approved') OR (b.status='awaiting_payment' AND b.hold_until>now())))) ELSE 0 END
 FROM public.academy_training_programs p JOIN public.academies a ON a.id=p.academy_id JOIN public.venues v ON v.id=p.venue_id,
 generate_series((now() AT TIME ZONE 'Africa/Cairo')::date::timestamp, ((now() AT TIME ZONE 'Africa/Cairo')::date+29)::timestamp, interval '1 day') d,
 jsonb_array_elements(p.schedule) s
 WHERE p.id=p_id AND ((p.active AND a.is_public AND v.approval_status='approved') OR public.is_super_admin() OR public.academy_can(p.academy_id,'read'))
 AND extract(dow FROM d)::integer=(s->>'weekday')::integer
 AND (d::date+(s->>'start')::time) AT TIME ZONE 'Africa/Cairo'>now()
 ORDER BY d,(s->>'start')::time;
$$;
CREATE OR REPLACE FUNCTION public.manage_academy_training_payment(p_booking_id uuid,p_action text,p_method text DEFAULT NULL,p_receipt text DEFAULT NULL,p_note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.academy_training_bookings%ROWTYPE; pid uuid;
BEGIN
 IF auth.uid() IS NULL OR public.is_account_blocked() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 SELECT program_id INTO pid FROM public.academy_training_bookings WHERE id=p_booking_id;
 PERFORM 1 FROM public.academy_training_programs WHERE id=pid FOR UPDATE;
 SELECT * INTO b FROM public.academy_training_bookings WHERE id=p_booking_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
 IF p_action IN ('approve','reject') THEN
  IF public.is_super_admin() IS NOT TRUE AND NOT public.academy_can((SELECT academy_id FROM public.academy_training_programs WHERE id=pid),'finance') THEN RAISE EXCEPTION 'Finance permission required' USING ERRCODE='42501'; END IF;
  IF b.status <> 'submitted' THEN RAISE EXCEPTION 'Only submitted payments can be reviewed'; END IF;
  UPDATE public.academy_training_bookings SET status=CASE WHEN p_action='approve' THEN 'approved' ELSE 'rejected' END,review_note=nullif(btrim(p_note),''),reviewed_by=auth.uid(),reviewed_at=now() WHERE id=b.id;
 ELSE
  IF b.member_id<>auth.uid() THEN RAISE EXCEPTION 'Not your booking' USING ERRCODE='42501'; END IF;
  IF b.status<>'awaiting_payment' THEN RAISE EXCEPTION 'This booking cannot be changed'; END IF;
  IF p_action='cancel' THEN UPDATE public.academy_training_bookings SET status='cancelled' WHERE id=b.id;
  ELSIF p_action='submit' THEN
   IF b.hold_until<=now() OR b.expires_on<=(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Reservation expired. Book again before paying'; END IF;
   IF p_method IS NULL OR p_method NOT IN ('instapay','e_wallet') OR p_receipt IS NULL OR split_part(p_receipt,'/',1)<>auth.uid()::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='game-fee-receipts' AND name=p_receipt) THEN RAISE EXCEPTION 'Choose an existing payment method and upload your receipt'; END IF;
   IF EXISTS(SELECT 1 FROM public.academy_training_bookings WHERE receipt_path=p_receipt AND id<>b.id) THEN RAISE EXCEPTION 'This receipt is already used for another academy booking'; END IF;
   UPDATE public.academy_training_bookings SET status='submitted',pay_method=p_method,receipt_path=p_receipt WHERE id=b.id;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.academy_program_access(p_program uuid,p_capability text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.academy_can((SELECT academy_id FROM public.academy_training_programs WHERE id=p_program),p_capability);
$$;
CREATE OR REPLACE FUNCTION public.academy_receipt_access(p_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.academy_training_bookings b JOIN public.academy_training_programs p ON p.id=b.program_id WHERE b.receipt_path=p_path AND public.academy_can(p.academy_id,'finance'));
$$;
REVOKE ALL ON FUNCTION public.academy_program_access(uuid,text),public.academy_receipt_access(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.academy_program_access(uuid,text),public.academy_receipt_access(text) TO authenticated;
DROP POLICY IF EXISTS training_booking_read ON public.academy_training_bookings;
CREATE POLICY training_booking_read ON public.academy_training_bookings FOR SELECT TO authenticated USING(member_id=auth.uid() OR public.is_super_admin() OR public.academy_program_access(program_id,'bookings') OR public.academy_program_access(program_id,'finance'));
DROP POLICY IF EXISTS training_media_upload ON storage.objects;
CREATE POLICY training_media_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='training-media' AND (public.is_super_admin() OR public.academy_can(public.current_academy_id(),'training')) AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY workspace_receipt_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='game-fee-receipts' AND public.academy_receipt_access(name));
-- Direct program writes remain unavailable; owners manage programs only through validated RPCs.
DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY(ARRAY['academy_set_staff','academy_save_member_details','academy_mark_booking_attendance','academy_adjust_membership','academy_reschedule_booking','academy_save_lead','academy_send_renewal_reminder','academy_import_roster','academy_assign_branch','academy_workspace','resolve_training_renewal']) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',fn.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',fn.signature);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.resolve_training_renewal(p_id uuid,p_status text,p_method text DEFAULT 'cash') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.renewal_requests; v_payment uuid;
BEGIN
 SELECT * INTO r FROM public.renewal_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT public.academy_can(r.academy_id,'finance') OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=r.member_id AND academy_id=r.academy_id) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 IF r.status<>'pending' THEN RAISE EXCEPTION 'Request already resolved'; END IF;
 IF p_status NOT IN ('completed','declined') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 IF p_status='completed' THEN
 IF p_method NOT IN ('cash','card','wallet','bank_transfer','other') THEN RAISE EXCEPTION 'Invalid method'; END IF;
 INSERT INTO public.payments(member_id,academy_id,amount,payment_date,subscription_sessions,plan_id,membership_type,method,notes)
 VALUES(r.member_id,r.academy_id,r.amount,current_date,r.sessions,r.plan_id,CASE WHEN r.sessions<=4 THEN 'half' ELSE 'full' END,p_method,'Training renewal '||r.id) RETURNING id INTO v_payment;
 END IF;
 UPDATE public.renewal_requests SET status=p_status,payment_id=v_payment,resolved_at=now() WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.resolve_training_renewal(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_training_renewal(uuid,text,text) TO authenticated;
-- Index common workspace lookups and member balance / reminder histories.
CREATE INDEX academy_ledger_member_history ON public.academy_member_ledger(academy_id,member_id,kind);
CREATE INDEX academy_ledger_legacy_payment ON public.academy_member_ledger(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX academy_outreach_member_history ON public.academy_outreach(academy_id,member_id,created_at DESC);
CREATE INDEX academy_details_contact ON public.academy_member_details(academy_id,lower(contact_email));
CREATE INDEX academy_staff_profile ON public.academy_staff(profile_id);
CREATE INDEX workspace_profile_branch ON public.profiles(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX workspace_session_branch ON public.training_sessions(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX workspace_program_branch ON public.academy_training_programs(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX workspace_payment_branch ON public.payments(branch_id) WHERE branch_id IS NOT NULL;
NOTIFY pgrst,'reload schema';
