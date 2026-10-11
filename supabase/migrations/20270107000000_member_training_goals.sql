-- Members manage personal goals; academy-authored goals remain academy-managed.
CREATE OR REPLACE FUNCTION public.save_training_goal(
  p_member uuid, p_title text, p_notes text, p_target date,
  p_progress integer, p_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid;
  v_manager boolean;
BEGIN
  IF auth.uid() IS NULL OR public.is_account_blocked() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  v_manager := public.can_manage_player(p_member);
  IF NOT coalesce(v_manager, false) AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND id = p_member AND role = 'member' AND is_active
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.training_goals(member_id, title, notes, target_date, progress, created_by)
    VALUES(p_member, btrim(p_title), coalesce(p_notes, ''), p_target, p_progress, auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.training_goals
    SET title = btrim(p_title), notes = coalesce(p_notes, ''),
        target_date = p_target, progress = p_progress, updated_at = now()
    WHERE id = p_id AND member_id = p_member
      AND (coalesce(v_manager, false) OR created_by = auth.uid())
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Goal not found or not editable' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_training_goal(uuid,text,text,date,integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_training_goal(uuid,text,text,date,integer,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
