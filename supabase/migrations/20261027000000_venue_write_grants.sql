-- In-app venue management (Playgrounds page, Schedule → venues manager) writes
-- to the venues table through the authenticated client, protected by row-level
-- security. The RLS write policies (20261015000000_venue_manage_policies.sql:
-- super admin or an academy's own admin may write) have always existed, but
-- the table-level INSERT privilege was never granted to `authenticated`, so every
-- in-app "Add playground" failed with PostgREST 42501 (permission denied).
-- UPDATE/DELETE already work; re-asserting them here keeps the grant contract
-- explicit and idempotent.
--
-- RLS still restricts which rows each role may touch, so these grants do not
-- open write access to other academies' (or the pool's) venues.
GRANT INSERT, UPDATE, DELETE ON public.venues TO authenticated;

NOTIFY pgrst, 'reload schema';