-- Playground owners whose application was rejected can fix their details and
-- submit again. Allow the owner to edit their own application while it is
-- pending or rejected, and expose a resubmit RPC that moves a rejected
-- application back to pending and clears the previous review note so the
-- super admin sees a fresh application.
DROP POLICY IF EXISTS "Owner edits own pending application" ON public.playground_owners;
CREATE POLICY "Owner edits own pending application" ON public.playground_owners
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid() AND status IN ('pending', 'rejected'))
  WITH CHECK (profile_id = auth.uid() AND status IN ('pending', 'rejected'));

CREATE OR REPLACE FUNCTION public.resubmit_playground_owner()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.playground_owners
  SET status      = 'pending',
      review_note = NULL,
      approved_by = NULL,
      approved_at = NULL
  WHERE profile_id = auth.uid() AND status = 'rejected';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No rejected application to resubmit';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.resubmit_playground_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resubmit_playground_owner() TO authenticated;

NOTIFY pgrst, 'reload schema';
