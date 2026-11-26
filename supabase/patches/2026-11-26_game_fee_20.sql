-- Applies to newly created games. Historical booked prices remain unchanged.
CREATE OR REPLACE FUNCTION playza_private.price_court_game()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v public.venues%ROWTYPE; n integer; rental numeric; venue_sport text;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.playground_hourly_rate IS DISTINCT FROM OLD.playground_hourly_rate OR NEW.owner_rental_total IS DISTINCT FROM OLD.owner_rental_total
     OR NEW.booking_total IS DISTINCT FROM OLD.booking_total OR NEW.pricing_version IS DISTINCT FROM OLD.pricing_version
     OR NEW.share_price IS DISTINCT FROM OLD.share_price OR NEW.host_total IS DISTINCT FROM OLD.host_total
     OR NEW.host_pays IS DISTINCT FROM OLD.host_pays OR NEW.playground_id IS DISTINCT FROM OLD.playground_id
     OR NEW.duration_hours IS DISTINCT FROM OLD.duration_hours OR NEW.sport IS DISTINCT FROM OLD.sport OR NEW.min_players IS DISTINCT FROM OLD.min_players THEN
     IF public.is_super_admin() IS NOT TRUE AND current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Booking prices cannot be edited'; END IF;
   END IF;
   RETURN NEW;
 END IF;
 IF NEW.playground_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO v FROM public.venues WHERE id=NEW.playground_id FOR UPDATE;
 IF v.approval_status IS DISTINCT FROM 'approved' THEN RAISE EXCEPTION 'Court unavailable'; END IF;
 SELECT name INTO venue_sport FROM public.sports WHERE id=v.sport_id;
 IF venue_sport IS NOT NULL AND lower(NEW.sport)<>lower(venue_sport) THEN RAISE EXCEPTION 'Choose a court for this sport'; END IF;
 n:=public.court_minimum_players(NEW.sport);
 IF n IS NULL THEN RETURN NEW; END IF;
 IF NEW.min_players<n OR NEW.max_players<NEW.min_players THEN RAISE EXCEPTION 'Minimum players required: %',n; END IF;
 IF v.rental_cost IS NULL OR v.rental_cost<0 THEN RAISE EXCEPTION 'Court price not configured'; END IF;
 IF NEW.duration_hours IS NULL OR NEW.duration_hours<=0 OR NEW.duration_hours>24 OR NEW.duration_hours::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid duration'; END IF;
 NEW.court_number:=public.pick_free_court(v.id,NEW.game_date,NEW.start_time,round(NEW.duration_hours*60)::integer,NULL,NEW.id);
 IF NEW.court_number IS NULL THEN RAISE EXCEPTION 'No court available for this time'; END IF;
 rental:=round(v.rental_cost*NEW.duration_hours,2);
 NEW.playground_hourly_rate:=v.rental_cost; NEW.owner_rental_total:=rental; NEW.pricing_version:=2;
 NEW.share_price:=CASE WHEN NEW.host_pays THEN 0 ELSE round(rental/n,2)+20 END;
 NEW.host_total:=CASE WHEN NEW.host_pays THEN rental+20*n ELSE NULL END;
 NEW.booking_total:=CASE WHEN NEW.host_pays THEN NEW.host_total ELSE round(NEW.share_price*n,2) END;
 RETURN NEW;
END; $function$

