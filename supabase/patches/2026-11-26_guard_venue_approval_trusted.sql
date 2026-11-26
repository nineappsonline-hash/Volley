-- Trusted account approval exception. Already applied to production.
CREATE OR REPLACE FUNCTION public.guard_venue_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_super_admin() IS TRUE OR auth.role() = 'service_role' OR (public.is_trusted_auto_approval_account(COALESCE(NEW.owner_profile_id,auth.uid())) AND (NEW.owner_profile_id=auth.uid() OR (NEW.owner_profile_id IS NULL AND auth.uid() IS NOT NULL))) THEN
    IF TG_OP = 'INSERT' THEN NEW.approval_status := 'approved'; ELSIF NEW.owner_profile_id IS NOT DISTINCT FROM OLD.owner_profile_id AND public.is_trusted_auto_approval_account(NEW.owner_profile_id) THEN NEW.approval_status := 'approved'; END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      NEW.approval_status := 'pending';
    ELSE
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
        RAISE EXCEPTION 'Only a super admin can review playgrounds' USING ERRCODE = '42501';
      END IF;
      -- Changed listings are resubmitted for review, including rejected ones.
      IF (to_jsonb(NEW)-'working_hours'-'unavailable_slots'-'blocked_dates'-'court_availability')
       IS DISTINCT FROM (to_jsonb(OLD)-'working_hours'-'unavailable_slots'-'blocked_dates'-'court_availability') THEN NEW.approval_status := 'pending'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$

