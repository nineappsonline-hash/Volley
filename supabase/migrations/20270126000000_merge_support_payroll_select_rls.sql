-- Playza: consolidate same-role SELECT policies for support and payroll.
-- Predicates copied unchanged from live pg_policies on 2026-11-27.
-- Preserve original permissive union (A OR B OR ...), roles and RESTRICTIVE policies.
-- Especially keep is_internal=false on submitter visibility for support messages.
-- This migration does not modify grants, tables, or any write policies.

CREATE POLICY "Support tickets unified read" ON public.support_tickets
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  (((academy_id = current_academy_id()) AND is_academy_coach() AND ((assignee_id = ( SELECT auth.uid() AS uid)) OR (team_id = ANY (current_coach_team_ids())))))
  OR
  (((academy_id = current_academy_id()) AND is_academy_staff()))
  OR
  (((academy_id = current_academy_id()) AND (submitter_id = ( SELECT auth.uid() AS uid))))
);
DROP POLICY "Support tickets read coach teams" ON public.support_tickets;
DROP POLICY "Support tickets read staff" ON public.support_tickets;
DROP POLICY "Support tickets read submitter" ON public.support_tickets;

CREATE POLICY "Support messages unified read" ON public.support_ticket_messages
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  (((is_internal = false) AND (EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_ticket_messages.ticket_id) AND (t.academy_id = current_academy_id()) AND (t.submitter_id = ( SELECT auth.uid() AS uid)))))))
  OR
  ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_ticket_messages.ticket_id) AND (t.academy_id = current_academy_id()) AND is_academy_staff()))))
);
DROP POLICY "Support messages read public submitter" ON public.support_ticket_messages;
DROP POLICY "Support messages read staff" ON public.support_ticket_messages;

CREATE POLICY "Support surveys unified read" ON public.support_surveys
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_surveys.ticket_id) AND (t.academy_id = current_academy_id()) AND is_academy_staff()))))
  OR
  ((EXISTS ( SELECT 1
   FROM support_tickets t
  WHERE ((t.id = support_surveys.ticket_id) AND (t.academy_id = current_academy_id()) AND (t.submitter_id = ( SELECT auth.uid() AS uid))))))
);
DROP POLICY "Support surveys read staff" ON public.support_surveys;
DROP POLICY "Support surveys read submitter" ON public.support_surveys;

CREATE POLICY "Payroll entries unified read" ON public.payroll_entries
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  ((EXISTS ( SELECT 1
   FROM coaches c
  WHERE ((c.id = payroll_entries.coach_id) AND (c.profile_id = ( SELECT auth.uid() AS uid))))))
  OR
  ((EXISTS ( SELECT 1
   FROM payroll_periods p
  WHERE ((p.id = payroll_entries.period_id) AND (p.academy_id = current_academy_id()) AND is_academy_staff()))))
);
DROP POLICY "Payroll entries read coach" ON public.payroll_entries;
DROP POLICY "Payroll entries read staff" ON public.payroll_entries;

CREATE POLICY "Payroll disputes unified read" ON public.payroll_disputes
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  ((EXISTS ( SELECT 1
   FROM coaches c
  WHERE ((c.id = payroll_disputes.coach_id) AND (c.profile_id = ( SELECT auth.uid() AS uid))))))
  OR
  ((EXISTS ( SELECT 1
   FROM (payroll_entries e
     JOIN payroll_periods p ON ((p.id = e.period_id)))
  WHERE ((e.id = payroll_disputes.entry_id) AND (p.academy_id = current_academy_id()) AND is_academy_staff()))))
);
DROP POLICY "Payroll disputes read coach" ON public.payroll_disputes;
DROP POLICY "Payroll disputes read staff" ON public.payroll_disputes;

