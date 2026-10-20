-- Apply after deploying the court catalog and final-price frontend.
-- Raw rates and rental snapshots must not be selectable through REST, including '*'.
DO $$ DECLARE t text; cols text; hidden text[];
BEGIN
 FOREACH t IN ARRAY ARRAY['venues','friendly_games'] LOOP
 hidden:=CASE WHEN t='venues' THEN ARRAY['rental_cost'] ELSE ARRAY['playground_hourly_rate','owner_rental_total'] END;
 EXECUTE format('REVOKE SELECT ON public.%I FROM PUBLIC,anon,authenticated',t);
 FOREACH cols IN ARRAY hidden LOOP EXECUTE format('REVOKE SELECT (%I) ON public.%I FROM PUBLIC,anon,authenticated',cols,t); END LOOP;
 SELECT string_agg(format('%I',column_name),',') INTO cols FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND NOT(column_name=ANY(hidden));
 EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated',cols,t);
 IF t='venues' THEN EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon',cols,t); END IF;
 END LOOP;
END $$;

-- A composite-returning invite RPC must mask the restricted fields as well.
CREATE OR REPLACE FUNCTION public.get_game_by_invite(p_code text) RETURNS SETOF public.friendly_games
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_populate_record(NULL::public.friendly_games,to_jsonb(g)-'playground_hourly_rate'-'owner_rental_total')
 FROM public.friendly_games g WHERE invite_code=upper(btrim(coalesce(p_code,''))) AND status<>'cancelled' LIMIT 1;
$$;


-- Keep raw rental snapshots out of client change events as well as REST reads.
DO $$ DECLARE cols text;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='friendly_games') THEN
 SELECT string_agg(format('%I',column_name),',') INTO cols FROM information_schema.columns WHERE table_schema='public' AND table_name='friendly_games' AND column_name NOT IN ('playground_hourly_rate','owner_rental_total');
 ALTER PUBLICATION supabase_realtime DROP TABLE public.friendly_games;
 EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.friendly_games (%s)',cols);
 END IF;
END $$;

-- Offline rental amounts and customer details belong to venue managers/academy finance staff.
CREATE POLICY "Rental financial data restricted" ON public.venue_rentals AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.is_super_admin() OR public.court_can_manage(venue_id) OR public.academy_can(academy_id,'finance'));

-- Explicit grants also protect against permissive project default privileges.
REVOKE ALL ON public.court_owner_payouts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.court_owner_payouts TO authenticated;
