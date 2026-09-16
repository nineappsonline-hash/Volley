-- Coach invitations: academy owners invite members to become coaches;
-- invited members accept or decline from their side.

-- 1. Link coach → member (nullable so legacy manually-added coaches still work).
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS profile_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Invitation table.
CREATE TABLE IF NOT EXISTS public.coach_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE
    DEFAULT public.current_academy_id(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_coach_invitations_member
  ON public.coach_invitations(member_id, status);
CREATE INDEX IF NOT EXISTS idx_coach_invitations_academy
  ON public.coach_invitations(academy_id, status);
ALTER TABLE public.coach_invitations ENABLE ROW LEVEL SECURITY;

-- Members can read their own invitations.
DROP POLICY IF EXISTS "Members read own coach invitations" ON public.coach_invitations;
CREATE POLICY "Members read own coach invitations" ON public.coach_invitations
  FOR SELECT USING (member_id = auth.uid());

-- Admins can read all invitations in their academy.
DROP POLICY IF EXISTS "Admins read academy coach invitations" ON public.coach_invitations;
CREATE POLICY "Admins read academy coach invitations" ON public.coach_invitations
  FOR SELECT USING (
    academy_id = public.current_academy_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.academy_id = public.current_academy_id()
        AND p.role = 'admin'
    )
  );

-- All mutation goes through SECURITY DEFINER RPCs below; no client INSERT/UPDATE/DELETE.

-- 3. RPC: Admin invites a member to become a coach.
CREATE OR REPLACE FUNCTION public.invite_coach_member(p_member_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_member RECORD;
  v_academy_name TEXT;
  v_invite_id UUID;
BEGIN
  -- Caller must be an academy admin
  SELECT id, academy_id, role INTO v_admin
    FROM public.profiles WHERE id = auth.uid();
  IF v_admin IS NULL OR v_admin.role <> 'admin' THEN
    RAISE EXCEPTION 'Only academy owners can invite coaches';
  END IF;

  -- Target member validation
  SELECT id, name, phone, email, guardian_id, is_active, academy_id INTO v_member
    FROM public.profiles WHERE id = p_member_id;
  IF v_member IS NULL OR v_member.academy_id IS DISTINCT FROM v_admin.academy_id THEN
    RAISE EXCEPTION 'Member not found in this academy';
  END IF;
  IF NOT v_member.is_active THEN
    RAISE EXCEPTION 'Member is not active';
  END IF;
  IF v_member.guardian_id IS NOT NULL THEN
    RAISE EXCEPTION 'Family members cannot be invited as coaches';
  END IF;

  -- Not already a coach
  IF EXISTS (
    SELECT 1 FROM public.coaches
    WHERE academy_id = v_admin.academy_id AND profile_id = p_member_id
  ) THEN
    RAISE EXCEPTION 'This member is already a coach';
  END IF;

  -- No duplicate pending invitation
  IF EXISTS (
    SELECT 1 FROM public.coach_invitations
    WHERE academy_id = v_admin.academy_id
      AND member_id = p_member_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'An invitation is already pending for this member';
  END IF;

  INSERT INTO public.coach_invitations (academy_id, member_id, invited_by)
    VALUES (v_admin.academy_id, p_member_id, auth.uid())
    RETURNING id INTO v_invite_id;

  SELECT name INTO v_academy_name FROM public.academies WHERE id = v_admin.academy_id;

  INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      p_member_id,
      'coach_invite',
      'Coach invitation',
      COALESCE(v_academy_name, 'Academy') || ' invited you to be a coach',
      '/coaches/invitations/' || v_invite_id
    );

  RETURN v_invite_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.invite_coach_member(UUID) TO authenticated;

-- 4. RPC: Member responds to a coach invitation.
CREATE OR REPLACE FUNCTION public.respond_coach_invitation(
  p_invitation_id UUID,
  p_accept BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_plan TEXT;
  v_count INTEGER;
  v_member_name TEXT;
BEGIN
  SELECT * INTO v_inv FROM public.coach_invitations WHERE id = p_invitation_id;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF v_inv.member_id <> auth.uid() THEN
    RAISE EXCEPTION 'You can only respond to your own invitation';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'This invitation has already been responded to';
  END IF;

  IF p_accept THEN
    -- Plan limit check (mirrors guard_coach_limit but gives a clear error)
    SELECT plan INTO v_plan FROM public.academies WHERE id = v_inv.academy_id;
    IF v_plan = 'starter' THEN
      SELECT count(*) INTO v_count FROM public.coaches WHERE academy_id = v_inv.academy_id;
      IF v_count >= 1 THEN
        RAISE EXCEPTION 'Your plan allows only 1 coach. Upgrade to add more.';
      END IF;
    END IF;

    SELECT name INTO v_member_name FROM public.profiles WHERE id = v_inv.member_id;

    INSERT INTO public.coaches (academy_id, profile_id, name, phone)
      SELECT v_inv.academy_id, id, name, phone
      FROM public.profiles WHERE id = v_inv.member_id;

    UPDATE public.coach_invitations
      SET status = 'accepted', responded_at = now()
      WHERE id = p_invitation_id;
  ELSE
    UPDATE public.coach_invitations
      SET status = 'declined', responded_at = now()
      WHERE id = p_invitation_id;
  END IF;

  -- Notify the admin who invited
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
    VALUES (
      v_inv.invited_by,
      'coach_invite',
      'Coach invitation ' || CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
      COALESCE(v_member_name, 'Member') || ' ' ||
        CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END ||
        ' your coach invitation',
      '/coaches'
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.respond_coach_invitation(UUID, BOOLEAN) TO authenticated;

-- Reload PostgREST schema cache
SELECT notify('pgrst', 'reload schema');
