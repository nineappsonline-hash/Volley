-- Keep requested corrections on the court, separate from owner-account approval.
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS review_missing_fields text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS review_note text;

CREATE OR REPLACE FUNCTION playza_private.court_correction_columns(fields text[])
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT COALESCE(array_agg(DISTINCT col),'{}'::text[]) FROM unnest(fields) f
 CROSS JOIN LATERAL unnest(CASE f
 WHEN 'name' THEN ARRAY['name'] WHEN 'photos' THEN ARRAY['photos','cover_url']
 WHEN 'sport' THEN ARRAY['sport_id'] WHEN 'address' THEN ARRAY['address']
 WHEN 'location' THEN ARRAY['country','governorate','area'] WHEN 'directions' THEN ARRAY['location_link']
 WHEN 'phone' THEN ARRAY['contact_phone'] WHEN 'price' THEN ARRAY['rental_cost','rental_hours']
 WHEN 'courts' THEN ARRAY['court_count'] WHEN 'capacity' THEN ARRAY['capacity']
 WHEN 'hours' THEN ARRAY['court_availability','working_hours'] ELSE '{}'::text[] END) col;
$$;
REVOKE ALL ON FUNCTION playza_private.court_correction_columns(text[]) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION playza_private.guard_court_corrections()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
   NEW.approval_status:='pending'; NEW.review_missing_fields:='{}'; NEW.review_note:=NULL;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION playza_private.guard_court_corrections() FROM PUBLIC,anon,authenticated;
-- Runs after the existing approval/details guards, including on future schema replays.
DROP TRIGGER IF EXISTS zzz_guard_court_corrections ON public.venues;
CREATE TRIGGER zzz_guard_court_corrections BEFORE INSERT OR UPDATE ON public.venues
FOR EACH ROW EXECUTE FUNCTION playza_private.guard_court_corrections();

CREATE OR REPLACE FUNCTION public.review_court_submission(p_venue_id uuid,p_approve boolean,p_missing_fields text[] DEFAULT '{}',p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Only a super admin can review playgrounds' USING ERRCODE='42501'; END IF;
 IF p_approve IS NULL THEN RAISE EXCEPTION 'A review decision is required'; END IF;
 IF p_missing_fields IS NULL OR length(COALESCE(p_note,''))>2000 THEN RAISE EXCEPTION 'Invalid court review'; END IF;
 UPDATE public.venues SET approval_status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
   review_missing_fields=CASE WHEN p_approve THEN '{}'::text[] ELSE p_missing_fields END,review_note=CASE WHEN p_approve THEN NULL ELSE NULLIF(btrim(p_note),'') END
 WHERE id=p_venue_id AND approval_status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Playground is no longer awaiting review'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.review_court_submission(uuid,boolean,text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_court_submission(uuid,boolean,text[],text) TO authenticated;

CREATE OR REPLACE FUNCTION public.resubmit_court_corrections(p_venue_id uuid,p_details jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v public.venues; patched public.venues; allowed text[];
BEGIN
 IF auth.uid() IS NULL OR public.court_can_manage(p_venue_id) IS NOT TRUE THEN RAISE EXCEPTION 'Court management permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.venues WHERE id=p_venue_id FOR UPDATE;
 IF NOT FOUND OR v.approval_status<>'rejected' OR cardinality(v.review_missing_fields)=0 THEN RAISE EXCEPTION 'No requested corrections to resubmit'; END IF;
 -- Explicit mapping stays inside this invoker RPC; helper is private to trigger owners.
 allowed:=ARRAY(SELECT key FROM jsonb_object_keys(to_jsonb(v)) key WHERE
   (key='name' AND 'name'=ANY(v.review_missing_fields)) OR
   (key IN ('photos','cover_url') AND 'photos'=ANY(v.review_missing_fields)) OR
   (key='sport_id' AND 'sport'=ANY(v.review_missing_fields)) OR
   (key='address' AND 'address'=ANY(v.review_missing_fields)) OR
   (key IN ('country','governorate','area') AND 'location'=ANY(v.review_missing_fields)) OR
   (key='location_link' AND 'directions'=ANY(v.review_missing_fields)) OR
   (key='contact_phone' AND 'phone'=ANY(v.review_missing_fields)) OR
   (key IN ('rental_cost','rental_hours') AND 'price'=ANY(v.review_missing_fields)) OR
   (key='court_count' AND 'courts'=ANY(v.review_missing_fields)) OR
   (key='capacity' AND 'capacity'=ANY(v.review_missing_fields)) OR
   (key IN ('court_availability','working_hours') AND 'hours'=ANY(v.review_missing_fields)));
 IF jsonb_typeof(p_details) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_details) key WHERE NOT key=ANY(allowed)) THEN RAISE EXCEPTION 'Only the requested court information can be changed' USING ERRCODE='42501'; END IF;
 patched:=jsonb_populate_record(v,p_details);
 UPDATE public.venues SET name=patched.name,photos=patched.photos,cover_url=patched.cover_url,sport_id=patched.sport_id,address=patched.address,
 country=patched.country,governorate=patched.governorate,area=patched.area,location_link=patched.location_link,contact_phone=patched.contact_phone,
 rental_cost=patched.rental_cost,rental_hours=patched.rental_hours,court_count=patched.court_count,capacity=patched.capacity,
 court_availability=patched.court_availability,working_hours=patched.working_hours WHERE id=p_venue_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Court could not be updated'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.resubmit_court_corrections(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resubmit_court_corrections(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
