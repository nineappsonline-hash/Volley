-- Playza: read-only index and query-plan audit for the public game directory.
-- Target: Playza's Supabase database ONLY (currently NOT available in the
-- connected Supabase account). Do not run these on another project's DB.
-- Execute on Playza's production read-only session, or on a representative
-- staging clone. EXPLAIN (ANALYZE) executes the SELECT, but does not mutate rows.
-- PostgREST service-role reads bypass RLS; EXPLAIN directly here is indicative
-- only and should be compared to actual request timings.

-- 1) Existing index definitions, including partial-index predicates.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND tablename IN ('friendly_games', 'friendly_game_participants')
ORDER BY tablename, indexname;

-- 2) Table sizes and row estimates for interpreting plans.
SELECT relname,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       n_live_tup AS estimated_live_rows,
       seq_scan, idx_scan
FROM pg_stat_user_tables
WHERE schemaname='public'
  AND relname IN ('friendly_games', 'friendly_game_participants')
ORDER BY relname;

-- 3) Mirror the public upcoming-game filter and stable order.
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, game_date, start_time, sport, status
FROM public.friendly_games
WHERE is_public = true
  AND creation_payment_approved = true
  AND status NOT IN ('cancelled', 'completed')
  AND game_date >= (now() AT TIME ZONE 'Africa/Cairo')::date
ORDER BY game_date, start_time
LIMIT 100;

-- 4) Mirror the confirmed-seat count for an actual public game.
-- Replace example UUID with a real public game's id before executing.
-- EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
-- SELECT count(*)
-- FROM public.friendly_game_participants
-- WHERE game_id = '00000000-0000-0000-0000-000000000000'::uuid
--   AND pay_status='approved'
--   AND is_waitlisted=false;

-- Possible indexes to EVALUATE AFTER reading existing definitions and plans:
--   ON public.friendly_games(game_date, start_time)
--   WHERE is_public AND creation_payment_approved
--     AND status NOT IN ('cancelled','completed');
--
--   ON public.friendly_game_participants(game_id)
--   WHERE pay_status='approved' AND is_waitlisted=false;
--
-- Do NOT create either index until the actual query plans show a benefit,
-- no equivalent index already exists, and production write-lock risk
-- has been evaluated. For a large production table consider
-- CREATE INDEX CONCURRENTLY outside a transaction with a deployment plan.
