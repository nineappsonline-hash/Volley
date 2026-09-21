-- Existing playgrounds remain available; new academy submissions require review.
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.venues ALTER COLUMN approval_status SET DEFAULT 'pending';
GRANT SELECT (approval_status) ON public.venues TO anon, authenticated;
CREATE INDEX IF NOT EXISTS venues_pending_approval ON public.venues(created_at) WHERE approval_status = 'pending';

CREATE OR REPLACE FUNCTION public.guard_venue_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_super_admin() IS TRUE OR auth.role() = 'service_role' THEN
    IF TG_OP = 'INSERT' THEN NEW.approval_status := 'approved'; END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      NEW.approval_status := 'pending';
    ELSE
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
        RAISE EXCEPTION 'Only a super admin can review playgrounds' USING ERRCODE = '42501';
      END IF;
      -- Changed listings are resubmitted for review, including rejected ones.
      IF NEW IS DISTINCT FROM OLD THEN NEW.approval_status := 'pending'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_venue_approval ON public.venues;
CREATE TRIGGER guard_venue_approval BEFORE INSERT OR UPDATE ON public.venues
FOR EACH ROW EXECUTE FUNCTION public.guard_venue_approval();

-- Restrictive policy also applies alongside older permissive read policies.
DROP POLICY IF EXISTS "Approved playground visibility" ON public.venues;
CREATE POLICY "Approved playground visibility" ON public.venues AS RESTRICTIVE
FOR SELECT TO anon, authenticated USING (
  approval_status = 'approved' OR public.is_super_admin()
  OR (academy_id = public.current_academy_id() AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ))
);
CREATE OR REPLACE FUNCTION public.review_playground(p_venue_id UUID, p_approve BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Only a super admin can review playgrounds' USING ERRCODE = '42501';
  END IF;
  IF p_approve IS NULL THEN RAISE EXCEPTION 'A review decision is required'; END IF;
  UPDATE public.venues SET approval_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END
  WHERE id = p_venue_id AND approval_status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Playground is no longer awaiting review'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.review_playground(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_playground(UUID, BOOLEAN) TO authenticated;

-- SECURITY DEFINER booking RPCs must also respect approval, even with a known ID.
CREATE OR REPLACE FUNCTION public.require_approved_playground()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_old UUID;
BEGIN
  v_id := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
  IF TG_OP = 'UPDATE' THEN v_old := (to_jsonb(OLD)->>TG_ARGV[0])::uuid; END IF;
  IF v_id IS NOT NULL AND (TG_OP = 'INSERT' OR v_id IS DISTINCT FROM v_old) THEN
    PERFORM 1 FROM public.venues WHERE id = v_id AND approval_status = 'approved' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'This playground is awaiting approval or is unavailable'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS approved_playground ON public.friendly_games;
CREATE TRIGGER approved_playground BEFORE INSERT OR UPDATE OF playground_id ON public.friendly_games
FOR EACH ROW EXECUTE FUNCTION public.require_approved_playground('playground_id');
DROP TRIGGER IF EXISTS approved_playground ON public.venue_rentals;
CREATE TRIGGER approved_playground BEFORE INSERT OR UPDATE OF venue_id ON public.venue_rentals
FOR EACH ROW EXECUTE FUNCTION public.require_approved_playground('venue_id');
DROP TRIGGER IF EXISTS approved_playground ON public.training_sessions;
CREATE TRIGGER approved_playground BEFORE INSERT OR UPDATE OF venue_id ON public.training_sessions
FOR EACH ROW EXECUTE FUNCTION public.require_approved_playground('venue_id');
NOTIFY pgrst, 'reload schema';
