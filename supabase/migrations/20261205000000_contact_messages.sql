-- ────────────────────────────────────────────────────────────
-- CONTACT US / INQUIRIES
--
-- Public contact form (menubar + floating widget). Anyone may
-- submit a message; only platform super admins can read/update
-- the inbox queue. The unread badge in the admin sidebar stays
-- live through the realtime publication added below.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  phone TEXT NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 1 AND 40),
  email TEXT CHECK (email IS NULL OR char_length(btrim(email)) BETWEEN 3 AND 254),
  message TEXT NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contact_messages_read_created
  ON public.contact_messages(is_read, created_at DESC);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous visitors included) can submit a message.
DROP POLICY IF EXISTS "Contact messages insert" ON public.contact_messages;
CREATE POLICY "Contact messages insert" ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only platform super admins can read / update the inbox queue.
DROP POLICY IF EXISTS "Contact messages super admin read" ON public.contact_messages;
CREATE POLICY "Contact messages super admin read" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Contact messages super admin update" ON public.contact_messages;
CREATE POLICY "Contact messages super admin update" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Live unread counter for the admin sidebar badge.
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_messages;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END
$$;

NOTIFY pgrst, 'reload schema';