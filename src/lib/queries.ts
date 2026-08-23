"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  Academy,
  Announcement,
  Attendance,
  Coach,
  CoachAvailability,
  Expense,
  MembershipPlan,
  MonthlyCost,
  Payment,
  PlayerEvaluation,
  Profile,
  ScheduleTemplate,
  SessionCalculation,
  SessionGuest,
  Sport,
  TeamWithDetails,
  Tournament,
  TournamentWithMatches,
  TournamentMatch,
  TrainingSession,
  TrialRequest,
  Venue,
} from "@/lib/types";

export const queryKeys = {
  profiles: ["profiles"] as const,
  profile: (id: string) => ["profiles", id] as const,
  payments: (memberId?: string) =>
    ["payments", memberId ?? "all"] as const,
  sessions: ["sessions"] as const,
  attendance: (sessionId?: string) =>
    ["attendance", sessionId ?? "all"] as const,
  costs: ["costs"] as const,
  calculations: ["calculations"] as const,
  guests: (sessionId?: string) =>
    ["guests", sessionId ?? "all"] as const,
  sports: ["sports"] as const,
  teams: ["teams"] as const,
  academy: ["academy"] as const,
  announcements: ["announcements"] as const,
  coaches: ["coaches"] as const,
  venues: ["venues"] as const,
  plans: ["plans"] as const,
  expenses: ["expenses"] as const,
  evaluations: (memberId?: string) =>
    ["evaluations", memberId ?? "all"] as const,
  templates: ["templates"] as const,
  trials: ["trials"] as const,
};

const supabase = () => createClient();

// ── Queries ─────────────────────────────────────────────────

export function useProfiles() {
  return useQuery({
    queryKey: queryKeys.profiles,
    queryFn: async () => {
      // Roster = accounts that an admin has added (is_active).
      const { data, error } = await supabase()
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export function usePendingProfiles() {
  return useQuery({
    queryKey: [...queryKeys.profiles, "pending"],
    queryFn: async () => {
      // Accounts that signed up but haven't been added to the roster yet.
      const { data, error } = await supabase()
        .from("profiles")
        .select("*")
        .eq("role", "member")
        .eq("is_active", false)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export function useProfile(id: string) {
  return useQuery({
    queryKey: queryKeys.profile(id),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

function toPayments(data: any[]): Payment[] {
  // Postgres DECIMAL comes back as a string; keep the number type truthful.
  return (data ?? []).map((p) => ({
    ...p,
    amount: Number(p.amount),
    subscription_sessions: Number(p.subscription_sessions),
  }));
}

/**
 * Fetch payments for a specific member. For all payments use useAllPayments().
 */
export function usePayments(memberId: string) {
  return useQuery({
    queryKey: queryKeys.payments(memberId),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("payments")
        .select("*")
        .eq("member_id", memberId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return toPayments(data);
    },
    enabled: !!memberId,
  });
}

export function useAllPayments() {
  return useQuery({
    queryKey: queryKeys.payments(),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("payments")
        .select("*")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return toPayments(data);
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("training_sessions")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingSession[];
    },
  });
}

export function useUpcomingSessions() {
  return useQuery({
    queryKey: [...queryKeys.sessions, "upcoming"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase()
        .from("training_sessions")
        .select("*")
        .gte("date", today)
        .neq("status", "canceled")
        .order("date")
        .limit(30);
      if (error) throw error;
      return (data ?? []) as TrainingSession[];
    },
  });
}

export function useAttendance(sessionId?: string) {
  return useQuery({
    queryKey: queryKeys.attendance(sessionId),
    queryFn: async () => {
      let q = supabase().from("attendance").select("*");
      if (sessionId) q = q.eq("session_id", sessionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Attendance[];
    },
    enabled: sessionId ? !!sessionId : true,
  });
}

export function useMonthlyCosts() {
  return useQuery({
    queryKey: queryKeys.costs,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("monthly_costs")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        coach_fee: Number(c.coach_fee),
        court_rental: Number(c.court_rental),
        cost_per_session: Number(c.cost_per_session),
      })) as MonthlyCost[];
    },
  });
}

export function useMemberSessionCosts() {
  return useQuery({
    queryKey: [...queryKeys.costs, "member"],
    queryFn: async () => {
      // Members may only read per-session costs via the member_session_costs
      // view — coach salary / court rental are admin-only.
      const { data, error } = await supabase()
        .from("member_session_costs")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        cost_per_session: Number(c.cost_per_session),
      })) as { month: number; year: number; cost_per_session: number }[];
    },
  });
}

export function useMemberRoster() {
  return useQuery({
    queryKey: [...queryKeys.profiles, "roster"],
    queryFn: async () => {
      // Names-only view (no email/phone) so members can see the attendance
      // roster of every session without exposing other users' contact data.
      const { data, error } = await supabase()
        .from("member_roster")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}

export function useSessionCalculations() {
  return useQuery({
    queryKey: queryKeys.calculations,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("session_calculations")
        .select("*");
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        total_revenue: Number(c.total_revenue),
        cost_per_session: Number(c.cost_per_session),
        profit_loss: Number(c.profit_loss),
      })) as SessionCalculation[];
    },
  });
}

export function useSessionGuests(sessionId?: string) {
  return useQuery({
    queryKey: queryKeys.guests(sessionId),
    queryFn: async () => {
      let q = supabase().from("session_guests").select("*");
      if (sessionId) q = q.eq("session_id", sessionId);
      const { data, error } = await q.order("created_at");
      if (error) throw error;
      return ((data ?? []) as any[]).map((g) => ({
        ...g,
        amount_paid: Number(g.amount_paid),
      })) as SessionGuest[];
    },
  });
}

export function useAttendanceCounts() {
  return useQuery({
    queryKey: [...queryKeys.attendance(), "counts"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("attendance")
        .select("session_id, is_present");
      if (error) throw error;
      const counts: Record<string, { total: number; present: number }> = {};
      for (const a of data ?? []) {
        const c = (counts[a.session_id] ??= { total: 0, present: 0 });
        c.total += 1;
        if (a.is_present) c.present += 1;
      }
      return counts;
    },
  });
}

// ── Sports & Teams ──────────────────────────────────────────

export function useSports() {
  return useQuery({
    queryKey: queryKeys.sports,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("sports")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Sport[];
    },
  });
}

export function useSaveSport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...sport }: Partial<Sport> & { name: string }) => {
      const { error } = id
        ? await supabase().from("sports").update({ name: sport.name }).eq("id", id)
        : await supabase().from("sports").insert({ name: sport.name });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sports"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeleteSport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("sports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sports"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useTeams() {
  return useQuery({
    queryKey: queryKeys.teams,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("teams")
        .select(
          `*,
           sport:sports(id, name),
           team_members(member_id, profile:profiles(id, name))`
        )
        .order("name");
      if (error) throw error;
      return ((data ?? []) as any[]).map((team) => ({
        ...team,
        team_members: (team.team_members ?? []).filter((m: any) => m.profile),
      })) as TeamWithDetails[];
    },
  });
}

export function useSaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...team
    }: Partial<TeamWithDetails> & { name: string }) => {
      const payload = {
        name: team.name,
        sport_id: team.sport_id ?? null,
        coach_id: team.coach_id ?? null,
        age_group: team.age_group ?? null,
        skill_level: team.skill_level ?? null,
        description: team.description ?? null,
      };
      if (id) {
        const { error } = await supabase()
          .from("teams")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase()
        .from("teams")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

/** Replace a team's whole roster with the given member ids. */
export function useSetTeamMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      team_id,
      member_ids,
    }: {
      team_id: string;
      member_ids: string[];
    }) => {
      const { error: delError } = await supabase()
        .from("team_members")
        .delete()
        .eq("team_id", team_id);
      if (delError) throw delError;
      if (member_ids.length === 0) return;
      const { error } = await supabase()
        .from("team_members")
        .insert(member_ids.map((member_id) => ({ team_id, member_id })));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

// ── Mutations ───────────────────────────────────────────────

export function useUpsertAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (records: { session_id: string; member_id: string; is_present: boolean }[]) => {
      if (records.length === 0) return;
      const { error } = await supabase()
        .from("attendance")
        .upsert(records, { onConflict: "session_id,member_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useSaveSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session: Partial<TrainingSession>) => {
      const { error } = session.id
        ? await supabase()
            .from("training_sessions")
            .update(session)
            .eq("id", session.id)
        : await supabase().from("training_sessions").insert(session);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("training_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
    },
  });
}

export function useBulkCreateSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      sessions: {
        date: string;
        time: string;
        location: string | null;
        notes: string | null;
        sport_id?: string | null;
        venue_id?: string | null;
        coach_id?: string | null;
        age_group?: string | null;
        skill_level?: string | null;
      }[]
    ) => {
      if (sessions.length === 0) return;
      const { error } = await supabase()
        .from("training_sessions")
        .insert(sessions);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
    },
  });
}

export function useSaveGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      guest: Partial<SessionGuest> & {
        session_id: string;
        name: string;
        amount_paid: number;
      }
    ) => {
      const { error } = guest.id
        ? await supabase()
            .from("session_guests")
            .update({ name: guest.name, amount_paid: guest.amount_paid })
            .eq("id", guest.id)
        : await supabase()
            .from("session_guests")
            .insert({
              session_id: guest.session_id,
              name: guest.name,
              amount_paid: guest.amount_paid,
            });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useDeleteGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("session_guests")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

export function useSavePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: Partial<Payment> & { member_id: string; amount: number; payment_date: string }) => {
      const { data, error } = await supabase()
        .from("payments")
        .insert(payment)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
    },
  });
}

export function useUpdatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: Partial<Payment> & { id: string }) => {
      const { id, ...updates } = payment;
      const { error } = await supabase()
        .from("payments")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
    },
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
    },
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Profile> & { id: string }) => {
      const { error } = await supabase()
        .from("profiles")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
    },
  });
}

export function useSaveCosts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (costs: {
      month: number;
      year: number;
      coach_fee: number;
      coach_fee_basis: "full" | "half";
      court_rental: number;
      sessions_per_month: number;
      cost_per_session: number;
    }) => {
      const { error } = await supabase()
        .from("monthly_costs")
        .upsert(costs, { onConflict: "academy_id,month,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["costs"] });
      qc.invalidateQueries({ queryKey: ["calculations"] });
    },
  });
}

export function useUpdateOwnProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Profile> & { id: string }) => {
      const { error } = await supabase()
        .from("profiles")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

// ── Academy (tenant settings) ───────────────────────────────

export function useAcademy() {
  return useQuery({
    queryKey: queryKeys.academy,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("academies")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as Academy | null;
    },
  });
}

export function useUpdateAcademy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Academy> & { id: string }) => {
      const { error } = await supabase()
        .from("academies")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academy"] });
    },
  });
}

// Public (no auth required): academy page by slug.
// ── Super admin: all academies ──────────────────────────────

export function useAllAcademies() {
  return useQuery({
    queryKey: ["all-academies"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("academies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Academy[];
    },
  });
}

export function useExtendTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      academy_id,
      days,
    }: {
      academy_id: string;
      days: number;
    }) => {
      const { error } = await supabase()
        .from("academies")
        .update({
          trial_ends_at: new Date(
            Date.now() + days * 24 * 60 * 60 * 1000
          ).toISOString(),
          trial_extended_at: new Date().toISOString(),
        })
        .eq("id", academy_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-academies"] });
    },
  });
}

export function useConvertToPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (academy_id: string) => {
      const { error } = await supabase()
        .from("academies")
        .update({
          is_trial: false,
          trial_ends_at: null,
        })
        .eq("id", academy_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-academies"] });
    },
  });
}

export function usePublicAcademy(slug?: string) {
  return useQuery({
    queryKey: ["public-academy", slug],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("academies")
        .select("id, name, description, is_public, slug")
        .eq("slug", slug ?? "")
        .eq("is_public", true)
        .maybeSingle();
      if (error) throw error;
      return data as Pick<Academy, "id" | "name" | "description" | "is_public" | "slug"> | null;
    },
    enabled: !!slug,
  });
}

// ── Announcements ───────────────────────────────────────────

export function useAnnouncements() {
  return useQuery({
    queryKey: queryKeys.announcements,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Announcement[];
    },
  });
}

export function useSaveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...a
    }: Partial<Announcement> & { title: string; body: string }) => {
      const payload = { title: a.title, body: a.body };
      const { error } = id
        ? await supabase().from("announcements").update(payload).eq("id", id)
        : await supabase().from("announcements").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

// ── Coaches ─────────────────────────────────────────────────

export function useCoaches() {
  return useQuery({
    queryKey: queryKeys.coaches,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("coaches")
        .select("*")
        .order("name");
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        monthly_salary: c.monthly_salary == null ? null : Number(c.monthly_salary),
      })) as Coach[];
    },
  });
}

export function useSaveCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...coach
    }: Partial<Coach> & { name: string }) => {
      const payload = {
        name: coach.name,
        phone: coach.phone ?? null,
        specialty: coach.specialty ?? null,
        monthly_salary: coach.monthly_salary ?? null,
        is_active: coach.is_active ?? true,
      };
      const { error } = id
        ? await supabase().from("coaches").update(payload).eq("id", id)
        : await supabase().from("coaches").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coaches"] });
    },
  });
}

export function useDeleteCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("coaches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coaches"] });
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

// ── Venues ──────────────────────────────────────────────────

export function useVenues() {
  return useQuery({
    queryKey: queryKeys.venues,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("venues")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Venue[];
    },
  });
}

export function useSaveVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...venue }: Partial<Venue> & { name: string }) => {
      const payload = {
        name: venue.name,
        address: venue.address ?? null,
        capacity: venue.capacity ?? null,
      };
      const { error } = id
        ? await supabase().from("venues").update(payload).eq("id", id)
        : await supabase().from("venues").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venues"] });
    },
  });
}

export function useDeleteVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("venues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venues"] });
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}

// ── Membership plans ────────────────────────────────────────

export function usePlans() {
  return useQuery({
    queryKey: queryKeys.plans,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("membership_plans")
        .select("*")
        .order("sessions_count", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((p) => ({
        ...p,
        price: p.price == null ? null : Number(p.price),
      })) as MembershipPlan[];
    },
  });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...plan
    }: Partial<MembershipPlan> & { name: string; sessions_count: number }) => {
      const payload = {
        name: plan.name,
        sessions_count: plan.sessions_count,
        price: plan.price ?? null,
        is_active: plan.is_active ?? true,
      };
      const { error } = id
        ? await supabase().from("membership_plans").update(payload).eq("id", id)
        : await supabase().from("membership_plans").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("membership_plans")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}

// ── Expenses ────────────────────────────────────────────────

export function useExpenses() {
  return useQuery({
    queryKey: queryKeys.expenses,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((e) => ({
        ...e,
        amount: Number(e.amount),
      })) as Expense[];
    },
  });
}

export function useSaveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...expense
    }: Partial<Expense> & {
      description: string;
      amount: number;
      expense_date: string;
    }) => {
      const payload = {
        description: expense.description,
        amount: expense.amount,
        category: expense.category ?? "other",
        expense_date: expense.expense_date,
      };
      const { error } = id
        ? await supabase().from("expenses").update(payload).eq("id", id)
        : await supabase().from("expenses").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}

// ── Player evaluations ──────────────────────────────────────

export function useEvaluations(memberId?: string) {
  return useQuery({
    queryKey: queryKeys.evaluations(memberId),
    queryFn: async () => {
      let q = supabase()
        .from("player_evaluations")
        .select("*")
        .order("evaluation_date", { ascending: false });
      if (memberId) q = q.eq("member_id", memberId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PlayerEvaluation[];
    },
    enabled: memberId ? !!memberId : true,
  });
}

export function useSaveEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...ev
    }: Partial<PlayerEvaluation> & {
      member_id: string;
      evaluation_date: string;
    } & Record<"technique" | "tactics" | "fitness" | "attitude", number>) => {
      const payload = {
        member_id: ev.member_id,
        evaluated_by: ev.evaluated_by || null,
        evaluation_date: ev.evaluation_date,
        technique: ev.technique,
        tactics: ev.tactics,
        fitness: ev.fitness,
        attitude: ev.attitude,
        notes: ev.notes || null,
      };
      const { error } = id
        ? await supabase()
            .from("player_evaluations")
            .update(payload)
            .eq("id", id)
        : await supabase().from("player_evaluations").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluations"] });
    },
  });
}

export function useDeleteEvaluation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("player_evaluations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluations"] });
    },
  });
}

// ── Schedule templates ──────────────────────────────────────

export function useTemplates() {
  return useQuery({
    queryKey: queryKeys.templates,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("schedule_templates")
        .select("*")
        .order("weekday");
      if (error) throw error;
      return (data ?? []) as ScheduleTemplate[];
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...tpl
    }: Partial<ScheduleTemplate> & { name: string; weekday: number; time: string }) => {
      const payload = {
        name: tpl.name,
        weekday: tpl.weekday,
        time: tpl.time,
        sport_id: tpl.sport_id ?? null,
        venue_id: tpl.venue_id ?? null,
        coach_id: tpl.coach_id ?? null,
        age_group: tpl.age_group ?? null,
        skill_level: tpl.skill_level ?? null,
      };
      const { error } = id
        ? await supabase().from("schedule_templates").update(payload).eq("id", id)
        : await supabase().from("schedule_templates").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("schedule_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

// ── Trial requests ──────────────────────────────────────────

// ── Coach availability ─────────────────────────────────────

export function useCoachAvailability(coachId?: string) {
  return useQuery({
    queryKey: [...queryKeys.coaches, "availability", coachId ?? "all"],
    queryFn: async () => {
      let q = supabase().from("coach_availability").select("*");
      if (coachId) q = q.eq("coach_id", coachId);
      const { data, error } = await q.order("weekday").order("start_time");
      if (error) throw error;
      return (data ?? []) as CoachAvailability[];
    },
    enabled: coachId ? !!coachId : true,
  });
}

export function useSaveCoachAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      coach_id,
      slots,
    }: {
      coach_id: string;
      slots: { weekday: number; start_time: string; end_time: string }[];
    }) => {
      // Delete existing slots for this coach, then insert new ones
      const { error: delError } = await supabase()
        .from("coach_availability")
        .delete()
        .eq("coach_id", coach_id);
      if (delError) throw delError;
      if (slots.length === 0) return;
      const { error } = await supabase()
        .from("coach_availability")
        .insert(slots.map((s) => ({ coach_id, ...s })));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...queryKeys.coaches, "availability"] });
    },
  });
}

// ── Tournaments ────────────────────────────────────────────

export function useTournaments() {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tournaments")
        .select(`*, sport:sports(id, name), tournament_matches(*)`)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TournamentWithMatches[];
    },
  });
}

export function useSaveTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tournament: Partial<Tournament> & { name: string; start_date: string }) => {
      const payload = {
        name: tournament.name,
        description: tournament.description ?? null,
        sport_id: tournament.sport_id ?? null,
        start_date: tournament.start_date,
        end_date: tournament.end_date ?? null,
        status: tournament.status ?? "upcoming",
      };
      const { error } = tournament.id
        ? await supabase().from("tournaments").update(payload).eq("id", tournament.id)
        : await supabase().from("tournaments").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
}

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("tournaments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
}

export function useSaveMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (match: Partial<TournamentMatch> & { tournament_id: string; round_name: string }) => {
      const payload = {
        tournament_id: match.tournament_id,
        round_name: match.round_name,
        team_a_id: match.team_a_id ?? null,
        team_b_id: match.team_b_id ?? null,
        score_a: match.score_a ?? null,
        score_b: match.score_b ?? null,
        match_date: match.match_date ?? null,
        match_time: match.match_time ?? null,
        venue_id: match.venue_id ?? null,
        status: match.status ?? "scheduled",
        notes: match.notes ?? null,
      };
      const { error } = match.id
        ? await supabase().from("tournament_matches").update(payload).eq("id", match.id)
        : await supabase().from("tournament_matches").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
}

export function useDeleteMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("tournament_matches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });
}

export function useTrialRequests() {
  return useQuery({
    queryKey: queryKeys.trials,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("trial_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrialRequest[];
    },
  });
}

export function useSubmitTrialRequest() {
  return useMutation({
    mutationFn: async (req: {
      academy_id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      sport_id?: string | null;
      preferred_date?: string | null;
    }) => {
      const { error } = await supabase().from("trial_requests").insert(req);
      if (error) throw error;
    },
  });
}

export function useUpdateTrialRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<TrialRequest> & { id: string }) => {
      const { error } = await supabase()
        .from("trial_requests")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trials"] });
    },
  });
}
