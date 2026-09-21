-- Tournament access is independent of subscription plans. Existing RLS
-- continues to restrict writes to hosting academy admins and super admins.
DROP TRIGGER IF EXISTS guard_tournament_plan ON public.tournaments;
DROP FUNCTION IF EXISTS public.guard_tournament_plan();

