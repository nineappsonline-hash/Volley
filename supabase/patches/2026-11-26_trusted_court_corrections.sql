-- The trusted account's valid court corrections do not return the listing to pending approval.
CREATE OR REPLACE FUNCTION playza_private.guard_court_corrections()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE allowed text[]; f text; v jsonb := to_jsonb(NEW); complete boolean;
BEGIN
 IF public.is_super_admin() IS TRUE OR auth.role()='service_role' THEN
   IF NEW.approval_status='rejected' AND (TG_OP='INSERT' OR OLD.approval_status IS DISTINCT FROM 'rejected') THEN
     IF cardinality(NEW.review_missing_fields) NOT BETWEEN 1 AND 11 OR NOT NEW.review_missing_fields <@ ARRAY['name','photos','sport','address','location','directions','phone','price','courts','capacity','hours']::text[]
       OR array_position(NEW.review_missing_fields,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Select the information the court must correct'; END IF;
   ELSIF NEW.approval_status='approved' THEN NEW.review_missing_fields:='{}'; NEW.review_note:=NULL;
   END IF;
   RETURN NEW;
 END IF;
 IF TG_OP='INSERT' THEN NEW.review_missing_fields:='{}'; NEW.review_note:=NULL; RETURN NEW; END IF;
 IF NEW.review_missing_fields IS DISTINCT FROM OLD.review_missing_fields OR NEW.review_note IS DISTINCT FROM OLD.review_note THEN
   RAISE EXCEPTION 'Only a super admin can change court review reasons' USING ERRCODE='42501';
 END IF;
 IF OLD.approval_status='rejected' AND cardinality(OLD.review_missing_fields)>0 THEN
   allowed:=playza_private.court_correction_columns(OLD.review_missing_fields);
   IF (to_jsonb(NEW)-allowed-'approval_status') IS DISTINCT FROM (to_jsonb(OLD)-allowed-'approval_status') THEN
     RAISE EXCEPTION 'Only the requested court information can be changed' USING ERRCODE='42501';
   END IF;
   FOREACH f IN ARRAY OLD.review_missing_fields LOOP
     complete:=CASE f
       WHEN 'name' THEN length(btrim(NEW.name))>0
       WHEN 'photos' THEN jsonb_typeof(NEW.photos)='array' AND jsonb_array_length(NEW.photos)>0
         AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.photos) p WHERE jsonb_typeof(p)<>'string' OR p#>>'{}' !~ '^https?://[^[:space:]]+$')
       WHEN 'sport' THEN NEW.sport_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.sports s WHERE s.id=NEW.sport_id)
       WHEN 'address' THEN length(btrim(NEW.address))>0
       WHEN 'location' THEN length(btrim(NEW.country))>0 AND length(btrim(NEW.governorate))>0 AND length(btrim(NEW.area))>0
       WHEN 'directions' THEN NEW.location_link ~ '^https?://[^[:space:]]+$'
       WHEN 'phone' THEN NEW.contact_phone ~ '[0-9]{3}' AND length(regexp_replace(NEW.contact_phone,'[^0-9]','','g')) BETWEEN 7 AND 15
       WHEN 'price' THEN NEW.rental_cost>=0 AND NEW.rental_cost::text NOT IN ('NaN','Infinity','-Infinity') AND NEW.rental_hours>0 AND NEW.rental_hours::text NOT IN ('NaN','Infinity','-Infinity')
       WHEN 'courts' THEN NEW.court_count BETWEEN 1 AND 100
       WHEN 'capacity' THEN NEW.capacity>0
       WHEN 'hours' THEN jsonb_typeof(NEW.court_availability)='array' AND jsonb_array_length(NEW.court_availability)>0
       ELSE false END;
     IF complete IS NOT TRUE THEN RAISE EXCEPTION 'Complete the requested court information: %',f; END IF;
   END LOOP;
   NEW.approval_status:=CASE WHEN NEW.owner_profile_id=auth.uid() AND public.is_trusted_auto_approval_account(NEW.owner_profile_id) THEN 'approved' ELSE 'pending' END; NEW.review_missing_fields:='{}'; NEW.review_note:=NULL;
 END IF;
 RETURN NEW;
END; $function$

