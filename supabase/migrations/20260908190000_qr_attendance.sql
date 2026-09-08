-- Preserve existing QR codes; issue codes to profiles from older deployments.
ALTER TABLE public.profiles ALTER COLUMN checkin_code
  SET DEFAULT upper(replace(gen_random_uuid()::text, '-', ''));
UPDATE public.profiles SET checkin_code = upper(replace(gen_random_uuid()::text, '-', ''))
WHERE checkin_code IS NULL OR btrim(checkin_code) = '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_checkin_code_normalized
  ON public.profiles (upper(checkin_code));

-- Attendance triggers run alphabetically. Count the actual attendance rows,
-- rather than relying on the profile counter having already been refreshed.
-- Log only newly inserted badges (attendance has no badge_type column).
CREATE OR REPLACE FUNCTION public.check_and_award_badges()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  WITH earned AS (
    INSERT INTO public.member_badges (member_id, badge_type, badge_name, description, icon)
    SELECT NEW.member_id, b.kind, b.name, b.description, b.icon
    FROM (VALUES
      (1, 'first_session', 'First Step', 'Attended first session', '⭐'),
      (10, 'ten_sessions', 'Regular', 'Attended 10 sessions', '🔥'),
      (25, 'twenty_five_sessions', 'Dedicated', 'Attended 25 sessions', '💪'),
      (50, 'fifty_sessions', 'Champion', 'Attended 50 sessions', '🏆'),
      (100, 'hundred_sessions', 'Legend', 'Attended 100 sessions', '👑')
    ) AS b(threshold, kind, name, description, icon)
    WHERE b.threshold <= (SELECT count(*) FROM public.attendance a
      WHERE a.member_id = NEW.member_id AND a.is_present)
    ON CONFLICT (member_id, badge_type) DO NOTHING
    RETURNING badge_type, badge_name
  )
  INSERT INTO public.activity_feed (academy_id, member_id, activity_type, description, metadata)
  SELECT p.academy_id, p.id, 'badge', p.name || ' earned ' || e.badge_name,
    jsonb_build_object('badge_type', e.badge_type)
  FROM earned e CROSS JOIN public.profiles p
  WHERE p.id = NEW.member_id AND p.academy_id IS NOT NULL;
  RETURN NEW;
END;
$$;

-- QR possession identifies a member; only an academy admin can record attendance.
CREATE OR REPLACE FUNCTION public.check_in_member(p_session_id UUID, p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_academy UUID;
  v_member public.profiles%ROWTYPE;
  v_status TEXT;
  v_changed UUID;
BEGIN
  IF auth.uid() IS NULL OR public.is_account_blocked() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  SELECT p.academy_id INTO v_academy FROM public.profiles p
  WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active;
  IF v_academy IS NULL THEN
    RAISE EXCEPTION 'Only academy admins can scan attendance' USING ERRCODE = '42501';
  END IF;
  SELECT s.status INTO v_status FROM public.training_sessions s
  WHERE s.id = p_session_id AND s.academy_id = v_academy FOR SHARE;
  IF v_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Select a scheduled session in your academy';
  END IF;
  SELECT p.* INTO v_member FROM public.profiles p
  WHERE upper(p.checkin_code) = upper(btrim(p_code))
    AND p.academy_id = v_academy AND p.role = 'member' AND p.is_active
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active member in this academy matches this code';
  END IF;
  -- No update (and therefore no repeated triggers) when already present.
  INSERT INTO public.attendance AS a (session_id, member_id, is_present)
  VALUES (p_session_id, v_member.id, TRUE)
  ON CONFLICT (session_id, member_id) DO UPDATE SET is_present = TRUE, marked_at = now()
  WHERE NOT a.is_present
  RETURNING id INTO v_changed;
  RETURN jsonb_build_object('member_name', v_member.name,
    'already_present', v_changed IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.check_in_member(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_member(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
