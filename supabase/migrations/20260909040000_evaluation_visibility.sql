-- Coach feedback is readable by its member, their guardian, and academy admins.
DROP POLICY IF EXISTS "Members manage evaluations" ON public.player_evaluations;
DROP POLICY IF EXISTS "Members read own evaluations" ON public.player_evaluations;
CREATE POLICY "Members read own evaluations" ON public.player_evaluations
FOR SELECT TO authenticated USING (
  member_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = player_evaluations.member_id
      AND p.guardian_id = (SELECT auth.uid())
  )
);
DROP POLICY IF EXISTS "Academy admins manage evaluations" ON public.player_evaluations;
CREATE POLICY "Academy admins manage evaluations" ON public.player_evaluations
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin' AND p.is_active AND p.academy_id = player_evaluations.academy_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid())
    AND p.role = 'admin' AND p.is_active AND p.academy_id = player_evaluations.academy_id)
  AND EXISTS (SELECT 1 FROM public.profiles member WHERE member.id = player_evaluations.member_id
    AND member.academy_id = player_evaluations.academy_id AND member.role = 'member')
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.player_evaluations;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
