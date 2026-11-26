-- Playza: targeted FK indexes, based on live Advisor and query-plan review.
-- Existing indexes checked on 2026-11-27; avoid indexing empty tables en masse.
-- confirmed_payment_emails: 316 rows, member lookup used Seq Scan in baseline.
-- venues: academy_id is commonly used for scoped academy venue lookup.
-- Both btree indexes support the respective foreign-key relationship.
-- IF NOT EXISTS allows safe retries; don't touch existing data.

CREATE INDEX IF NOT EXISTS idx_confirmed_payment_emails_member_id
  ON public.confirmed_payment_emails (member_id);

CREATE INDEX IF NOT EXISTS idx_venues_academy_id
  ON public.venues (academy_id);
