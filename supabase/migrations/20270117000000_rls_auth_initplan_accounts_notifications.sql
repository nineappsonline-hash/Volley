-- Playza RLS initplan optimization batch 2: account ownership and notifications.
-- This alters only evaluation of auth.uid(). Original roles, operations,
-- blocker protections and application-specific checks remain unchanged.
-- Do not change account-blocking semantics or broaden privileges.

ALTER POLICY "Blocks own delete" ON public.blocks
  USING (blocker_id = (SELECT auth.uid()));

ALTER POLICY "Blocks own insert" ON public.blocks
  WITH CHECK (blocker_id = (SELECT auth.uid()));

ALTER POLICY "Blocks own read" ON public.blocks
  USING (blocker_id = (SELECT auth.uid()) OR blocked_id = (SELECT auth.uid()));

ALTER POLICY "Own notification preferences" ON public.notification_preferences
  USING (user_id = (SELECT auth.uid()) AND NOT is_account_blocked()) WITH CHECK (user_id = (SELECT auth.uid()) AND NOT is_account_blocked());

ALTER POLICY "Notifications own delete" ON public.notifications
  USING (recipient_id = (SELECT auth.uid()));

ALTER POLICY "Notifications own insert" ON public.notifications
  WITH CHECK (recipient_id = (SELECT auth.uid()));

ALTER POLICY "Notifications own read" ON public.notifications
  USING (recipient_id = (SELECT auth.uid()));

ALTER POLICY "Notifications own update" ON public.notifications
  USING (recipient_id = (SELECT auth.uid()));

ALTER POLICY "Push subs own delete" ON public.push_subscriptions
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "Push subs own insert" ON public.push_subscriptions
  WITH CHECK (user_id = (SELECT auth.uid()));

ALTER POLICY "Push subs own select" ON public.push_subscriptions
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY "Guardians read children" ON public.profiles
  USING (guardian_id = (SELECT auth.uid()));

ALTER POLICY "Members read own profile" ON public.profiles
  USING ((SELECT auth.uid()) = id);

ALTER POLICY "Members update own profile" ON public.profiles
  USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

ALTER POLICY "Members view own profile" ON public.profiles
  USING ((SELECT auth.uid()) = id);
