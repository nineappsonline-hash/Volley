-- Weekly excluded times per playground (venue).
-- The playground is always unavailable during these weekly windows:
-- e.g. [{"weekday":0,"start":"08:00","end":"10:00"}] blocks Sunday 08:00–10:00 every week.
-- weekday uses 0 = Sunday … 6 = Saturday (matches coach_availability / schedule_templates).
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS unavailable_slots JSONB NOT NULL DEFAULT '[]'::jsonb;