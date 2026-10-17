-- Preserve the existing creation RPC and permissions while fixing its alert target.
-- The guard aborts instead of silently rewriting an unexpected function version.
DO $migration$
DECLARE
  v_count integer := 0;
  v_definition text;
  v_updated text;
  v_old_link text := $old$    '/games'
  FROM public.profiles p$old$;
  v_new_link text := $new$    '/games/' || v_game::text
  FROM public.profiles p$new$;
  v_old_filter text := $old$  WHERE p.id <> v_member
    AND p.notify_game_alerts = TRUE$old$;
  v_new_filter text := $new$  WHERE p.id <> v_member
    AND COALESCE(p_is_public, TRUE)
    AND p.notify_game_alerts = TRUE$new$;
BEGIN
  FOR v_definition IN
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_friendly_game'
  LOOP
    -- Safe to replay when the fix was already applied to a hosted project.
    IF position(v_new_link IN v_definition) > 0 AND position(v_new_filter IN v_definition) > 0 THEN
      v_count := v_count + 1;
      CONTINUE;
    END IF;
    IF position(v_old_link IN v_definition) = 0 OR position(v_old_filter IN v_definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected create_friendly_game alert implementation';
    END IF;
    v_updated := replace(replace(v_definition, v_old_link, v_new_link), v_old_filter, v_new_filter);
    EXECUTE v_updated;
    v_count := v_count + 1;
  END LOOP;
  IF v_count = 0 THEN RAISE EXCEPTION 'create_friendly_game is missing'; END IF;
END;
$migration$;
