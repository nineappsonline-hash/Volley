-- Follow-up after measuring the two targeted indexes on Playza.
-- venues has only six rows; planner correctly prefers Sequential Scan
-- even after adding idx_venues_academy_id. Keep the useful
-- confirmed_payment_emails(member_id) index; remove only the new
-- venue index to avoid needless write and maintenance overhead.
DROP INDEX IF EXISTS public.idx_venues_academy_id;
