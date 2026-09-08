"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  Academy,
  AcademyBranch,
  AcademyPhoto,
  AcademyRating,
  ActivityFeedItem,
  Announcement,
  AppNotification,
  Attendance,
  Block,
  BlockedMember,
  Coach,
  CoachAvailability,
  CommunityLeaderboardRow,
  CommunityMember,
  CommunityReport,
  Expense,
  FriendlyGame,
  FriendlyGameParticipant,
  FriendlyGameWithDetails,
  MemberBadge,
  MembershipPlan,
  MonthlyCost,
  Payment,
  PlayerEvaluation,
  PlanSubscription,
  MembershipType,
  Profile,
  RecurringSchedule,
  ScheduleTemplate,
  SessionCalculation,
  SessionBooking,
  SessionGuest,
  SessionPhoto,
  SessionRating,
  SessionWaitlist,
  ScoutNote,
  Sport,
  TeamWithDetails,
  Tournament,
  TournamentWithMatches,
  TournamentMatch,
  TrainingSession,
  TrialRequest,
  Venue,
  VenueRental,
  SuperAdminStats,
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
  branches: ["branches"] as const,
  announcements: ["announcements"] as const,
  coaches: ["coaches"] as const,
  venues: ["venues"] as const,
  plans: ["plans"] as const,
  expenses: ["expenses"] as const,
  evaluations: (memberId?: string) =>
    ["evaluations", memberId ?? "all"] as const,
  templates: ["templates"] as const,
  trials: ["trials"] as const,
  waitlist: (sessionId?: string) =>
    ["waitlist", sessionId ?? "all"] as const,
  ratings: (sessionId?: string) =>
    ["ratings", sessionId ?? "all"] as const,
  badges: (memberId?: string) =>
    ["badges", memberId ?? "all"] as const,
  photos: ["photos"] as const,
  activity: (memberId?: string) =>
    ["activity", memberId ?? "all"] as const,
  recurring: ["recurring"] as const,
  publicAcademies: ["public-academies"] as const,
  academyRatings: ["academy-ratings"] as const,
  communityMembers: ["community-members"] as const,
  friendlyGames: ["friendly-games"] as const,
  myGameParticipants: ["my-game-participants"] as const,
  poolPlaygrounds: ["pool-playgrounds"] as const,
  children: (guardianId?: string) =>
    ["children", guardianId ?? "all"] as const,
  notifications: ["notifications"] as const,
  reports: ["reports"] as const,
  blocks: ["blocks"] as const,
  blockedMembers: ["blocked-members"] as const,
  communityRecord: ["community-record"] as const,
  myStreaks: ["my-streaks"] as const,
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

export function useBranches() {
  return useQuery({
    queryKey: queryKeys.branches,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("academy_branches")
        .select("*")
        .order("is_main", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as AcademyBranch[];
    },
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      address?: string | null;
      country?: string | null;
      governorate?: string | null;
      area?: string | null;
      phone?: string | null;
    }) => {
      const { error } = await supabase().from("academy_branches").insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches });
    },
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<AcademyBranch> & { id: string }) => {
      const { error } = await supabase()
        .from("academy_branches")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches });
    },
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("academy_branches")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.branches });
    },
  });
}

// Public (no auth required): academy page by slug.

// ── Public academy directory & ratings ──────────────────────

export function usePublicAcademies() {
  return useQuery({
    queryKey: ["public-academies"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("academies")
        .select("id, name, description, country, governorate, area, lat, lng, cover_url, slug")
        .eq("is_public", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pick<
        Academy,
        "id" | "name" | "description" | "country" | "governorate" | "area" | "lat" | "lng" | "cover_url" | "slug"
      >[];
    },
  });
}

export function usePublicSports() {
  return useQuery({
    queryKey: ["public-sports"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("sports")
        .select("academy_id, name");
      if (error) throw error;
      return (data ?? []) as { academy_id: string; name: string }[];
    },
  });
}

export function useAcademyRatings() {
  return useQuery({
    queryKey: queryKeys.academyRatings,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("academy_ratings")
        .select("*");
      if (error) throw error;
      return (data ?? []) as AcademyRating[];
    },
  });
}

export function useRateAcademy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ academyId, rating }: { academyId: string; rating: number }) => {
      const { data: session } = await supabase().auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error("not authenticated");
      const { error } = await supabase().from("academy_ratings").upsert(
        { academy_id: academyId, member_id: uid, rating },
        { onConflict: "academy_id,member_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.academyRatings });
    },
  });
}

/** Attach a pending (codeless) member to a public academy. Returns false if already attached. */
export function joinPublicAcademy(academyId: string) {
  return supabase().rpc("join_public_academy", { p_academy_id: academyId });
}

// ── Member premium plan ────────────────────────────────────

export function useActivatePremium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      months,
      amount,
      method,
    }: {
      months: number;
      amount: number;
      method: string;
    }) => {
      const { error } = await supabase().rpc("activate_member_premium", {
        p_months: months,
        p_amount: amount,
        p_method: method,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

export function useAdminSetMemberPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      member_id,
      member_plan,
      premium_expires_at,
    }: {
      member_id: string;
      member_plan: "free" | "premium";
      premium_expires_at?: string | null;
    }) => {
      const { error } = await supabase()
        .from("profiles")
        .update({ member_plan, premium_expires_at: premium_expires_at ?? null })
        .eq("id", member_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
  });
}

// ── Nearby events (premium) ─────────────────────────────────

export function useNearbyTournaments(myAcademyId?: string | null) {
  return useQuery({
    queryKey: ["nearby-tournaments", myAcademyId],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tournaments")
        .select(
          `*,
           sport:sports(id, name),
           academy:academies(id, name, slug, address)`
        )
        .eq("academies.is_public", true)
        .neq("academy_id", myAcademyId ?? "")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (TournamentWithMatches & {
        sport: Pick<Sport, "id" | "name"> | null;
        academy: Pick<Academy, "id" | "name" | "slug" | "address"> | null;
      })[];
    },
    enabled: !!myAcademyId,
  });
}

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

export function useSuperAdminStats() {
  return useQuery({
    queryKey: ["super-admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase().rpc("super_admin_stats");
      if (error) throw error;
      return data as SuperAdminStats;
    },
  });
}

export function useAcademyManagement(academyId: string | null) {
  return useQuery({
    queryKey: ["academy-management", academyId],
    enabled: !!academyId,
    queryFn: async () => {
      const [adminRes, sportsRes, branchesRes, venuesRes, coachesRes] =
        await Promise.all([
          supabase()
            .from("profiles")
            .select("*")
            .eq("academy_id", academyId!)
            .eq("role", "admin")
            .order("created_at", { ascending: true })
            .limit(1),
          supabase()
            .from("sports")
            .select("id, name")
            .eq("academy_id", academyId!)
            .order("created_at", { ascending: true }),
          supabase()
            .from("academy_branches")
            .select("*")
            .eq("academy_id", academyId!)
            .order("is_main", { ascending: false })
            .order("created_at", { ascending: true }),
          fetch("/api/platform-admin", { cache: "no-store" }).then(async response => {
            const result = await response.json();
            if (!response.ok) throw new Error(result.error ?? "Could not load playgrounds");
            return { data: (result.venues ?? []) as Venue[], error: null };
          }),
          supabase()
            .from("coaches")
            .select("*")
            .eq("academy_id", academyId!)
            .order("created_at", { ascending: true }),
        ]);
      for (const r of [adminRes, sportsRes, branchesRes, venuesRes, coachesRes]) {
        if (r.error) throw r.error;
      }
      const sportsRows = (sportsRes.data ?? []) as { id: string; name: string }[];
      const sportsById = Object.fromEntries(
        sportsRows.map((s) => [s.id, s.name])
      );
      const allVenues = (venuesRes.data ?? []) as Venue[];
      return {
        admin: (adminRes.data?.[0] as Profile) ?? null,
        sports: sportsRows,
        sportsById,
        branches: (branchesRes.data ?? []) as AcademyBranch[],
        venues: allVenues.filter((venue) => venue.academy_id === academyId),
        poolVenues: allVenues.filter((venue) => venue.academy_id == null),
        coaches: (coachesRes.data ?? []) as Coach[],
      };
    },
  });
}

export function useSuperAdminUpdateAcademy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      academyId,
      payload,
    }: {
      academyId: string;
      payload: Record<string, unknown>;
    }) => {
      const { error } = await supabase().rpc("super_admin_update_academy", {
        p_academy_id: academyId,
        p_payload: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-academies"] });
      qc.invalidateQueries({ queryKey: ["super-admin-stats"] });
      qc.invalidateQueries({ queryKey: ["academy-management"] });
    },
  });
}

export function useSuperAdminDeleteAcademy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (academyId: string) => {
      const { error } = await supabase().rpc("super_admin_delete_academy", {
        p_academy_id: academyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-academies"] });
      qc.invalidateQueries({ queryKey: ["super-admin-stats"] });
      qc.invalidateQueries({ queryKey: ["academy-management"] });
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
        .select("id, academy_id, name, address, lat, lng, capacity, sport_id, school_name, rental_cost, rental_hours, created_at")
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
        lat: venue.lat ?? null,
        lng: venue.lng ?? null,
        capacity: venue.capacity ?? null,
        sport_id: venue.sport_id ?? null,
        school_name: venue.school_name ?? null,
        rental_cost: venue.rental_cost ?? null,
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

export function useBookableSessions() {
  return useQuery({
    queryKey: ["bookable-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("training_sessions")
        .select(`*
          , sport:sports(id, name)
          , venue:venues(id, name, address)
          , coach:coaches(id, name)
          , academy:academies(id, name, slug, address, session_booking_enabled)`)
        .eq("academies.session_booking_enabled", true)
        .eq("status", "scheduled")
        .gte("date", new Date().toISOString().slice(0, 10))
        .order("date")
        .limit(50);
      if (error) throw error;
      return (data ?? []) as (TrainingSession & {
        sport: Pick<Sport, "id" | "name"> | null;
        venue: Pick<Venue, "id" | "name" | "address"> | null;
        coach: Pick<Coach, "id" | "name"> | null;
        academy: Pick<Academy, "id" | "name" | "slug" | "address" | "session_booking_enabled"> | null;
      })[];
    },
  });
}

export function useMyBookings() {
  return useQuery({
    queryKey: ["my-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("session_bookings")
        .select(`*
          , session:training_sessions(*)
          , academy:academies(id, name, slug, address)`)
        .eq("member_id", (await supabase().auth.getUser()).data.user?.id ?? "")
        .order("booked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SessionBooking[];
    },
  });
}

export function useBookSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, notes }: { sessionId: string; notes?: string }) => {
      const { error } = await supabase().rpc("book_session", {
        p_session_id: sessionId,
        p_notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    },
  });
}

export function useUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ bookingId, status }: { bookingId: string; status: string }) => {
      const { error } = await supabase()
        .from("session_bookings")
        .update({ status })
        .eq("id", bookingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    },
  });
}

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

// ── Waitlist ──────────────────────────────────────────────

export function useSessionWaitlist(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.waitlist(sessionId),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("session_waitlist")
        .select("*, profile:member_id(id, name)")
        .eq("session_id", sessionId)
        .eq("status", "waiting")
        .order("position");
      if (error) throw error;
      return (data ?? []) as SessionWaitlist[];
    },
    enabled: !!sessionId,
  });
}

export function useJoinWaitlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      session_id,
      member_id,
      position,
    }: {
      session_id: string;
      member_id: string;
      position: number;
    }) => {
      const { error } = await supabase().from("session_waitlist").insert({
        session_id,
        member_id,
        position,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
    },
  });
}

export function useUpdateWaitlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<SessionWaitlist> & { id: string }) => {
      const { error } = await supabase()
        .from("session_waitlist")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waitlist"] });
    },
  });
}

// ── Session Ratings ───────────────────────────────────────

export function useSessionRatings(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.ratings(sessionId),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("session_ratings")
        .select("*, profile:member_id(id, name)")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SessionRating[];
    },
    enabled: !!sessionId,
  });
}

export function useSubmitRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      session_id,
      member_id,
      rating,
      comment,
    }: {
      session_id: string;
      member_id: string;
      rating: number;
      comment?: string;
    }) => {
      const { error } = await supabase().from("session_ratings").upsert(
        { session_id, member_id, rating, comment },
        { onConflict: "session_id,member_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ratings"] });
    },
  });
}

// ── Member Badges ─────────────────────────────────────────

export function useMemberBadges(memberId?: string) {
  return useQuery({
    queryKey: queryKeys.badges(memberId),
    queryFn: async () => {
      let q = supabase()
        .from("member_badges")
        .select("*")
        .order("earned_at", { ascending: false });
      if (memberId) q = q.eq("member_id", memberId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MemberBadge[];
    },
  });
}

export function useAwardBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      member_id,
      badge_type,
      badge_name,
      description,
      icon,
    }: {
      member_id: string;
      badge_type: string;
      badge_name: string;
      description?: string;
      icon?: string;
    }) => {
      const { error } = await supabase().from("member_badges").upsert(
        { member_id, badge_type, badge_name, description, icon },
        { onConflict: "member_id,badge_type" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["badges"] });
    },
  });
}

// ── Session Photos ────────────────────────────────────────

export function useSessionPhotos(sessionId?: string) {
  return useQuery({
    queryKey: queryKeys.photos,
    queryFn: async () => {
      let q = supabase()
        .from("session_photos")
        .select("*")
        .order("created_at", { ascending: false });
      if (sessionId) q = q.eq("session_id", sessionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SessionPhoto[];
    },
  });
}

export function useUploadPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      session_id,
      announcement_id,
      photo_url,
      caption,
      uploaded_by,
    }: {
      session_id?: string;
      announcement_id?: string;
      photo_url: string;
      caption?: string;
      uploaded_by?: string;
    }) => {
      const { error } = await supabase().from("session_photos").insert({
        session_id,
        announcement_id,
        photo_url,
        caption,
        uploaded_by,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("session_photos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["photos"] });
    },
  });
}

// ── Academy Photos (logo & gallery) ───────────────────────

export function useAcademyPhotos(academyId?: string) {
  return useQuery({
    queryKey: academyId ? ["academy-photos", academyId] : ["academy-photos"],
    enabled: !!academyId,
    queryFn: async () => {
      let q = supabase()
        .from("academy_photos")
        .select("*")
        .order("created_at", { ascending: true });
      if (academyId) q = q.eq("academy_id", academyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AcademyPhoto[];
    },
  });
}

export function useAddAcademyPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      academy_id,
      photo_url,
      caption,
    }: {
      academy_id: string;
      photo_url: string;
      caption?: string;
    }) => {
      const { error } = await supabase().from("academy_photos").insert({
        academy_id,
        photo_url,
        caption,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academy-photos"] });
    },
  });
}

export function useDeleteAcademyPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("academy_photos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["academy-photos"] });
    },
  });
}

// ── Venue rentals (playground sub-rentals) ────────────────

export function useVenueRentals() {
  return useQuery({
    queryKey: ["venue-rentals"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("venue_rentals")
        .select("*, venues(name)")
        .order("rental_date", { ascending: false })
        .order("start_time", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VenueRental[];
    },
  });
}

export function useSaveVenueRental() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...rental
    }: Partial<VenueRental> & {
      customer_name: string;
      price: number;
      rental_date: string;
      start_time: string;
    }) => {
      const payload = {
        venue_id: rental.venue_id ?? null,
        customer_name: rental.customer_name,
        customer_phone: rental.customer_phone ?? null,
        customer_email: rental.customer_email ?? null,
        price: rental.price,
        hours: rental.hours ?? 1,
        rental_date: rental.rental_date,
        start_time: rental.start_time,
        is_paid: rental.is_paid ?? false,
        payment_method: rental.payment_method ?? null,
        notes: rental.notes ?? null,
      };
      const { error } = id
        ? await supabase().from("venue_rentals").update(payload).eq("id", id)
        : await supabase().from("venue_rentals").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venue-rentals"] });
    },
  });
}

export function useDeleteVenueRental() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().from("venue_rentals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venue-rentals"] });
    },
  });
}

// ── Activity Feed ─────────────────────────────────────────

export function useActivityFeed(memberId?: string, limit = 50) {
  return useQuery({
    queryKey: queryKeys.activity(memberId),
    queryFn: async () => {
      let q = supabase()
        .from("activity_feed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (memberId) q = q.eq("member_id", memberId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ActivityFeedItem[];
    },
  });
}

// ── Recurring Schedules ───────────────────────────────────

export function useRecurringSchedules() {
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("recurring_schedules")
        .select("*")
        .order("weekday");
      if (error) throw error;
      return (data ?? []) as RecurringSchedule[];
    },
  });
}

export function useCreateRecurringSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (schedule: Omit<RecurringSchedule, "id" | "created_at">) => {
      const { error } = await supabase().from("recurring_schedules").insert(schedule);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.recurring });
    },
  });
}

export function useDeleteRecurringSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase()
        .from("recurring_schedules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.recurring });
    },
  });
}

/** Generate training_sessions from a recurring schedule within a date range. */
export function useGenerateSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (schedule: RecurringSchedule) => {
      const sessions: Omit<TrainingSession, "id" | "created_at">[] = [];
      const start = new Date(schedule.start_date);
      const end = new Date(schedule.end_date);

      for (
        let d = new Date(start);
        d <= end;
        d.setDate(d.getDate() + 1)
      ) {
        if (d.getDay() === schedule.weekday) {
          sessions.push({
            academy_id: schedule.academy_id,
            date: d.toISOString().slice(0, 10),
            time: schedule.time,
            location: null,
            notes: `Generated from: ${schedule.name}`,
            is_completed: false,
            status: "scheduled",
            sport_id: schedule.sport_id,
            venue_id: schedule.venue_id,
            coach_id: schedule.coach_id,
            age_group: schedule.age_group,
            skill_level: schedule.skill_level,
            session_price: null,
          });
        }
      }

      // Skip if no dates fall on the weekday
      if (sessions.length === 0) return;

      const { error } = await supabase().from("training_sessions").insert(sessions);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

// ── Community ───────────────────────────────────────────────

export function useCommunityMembers() {
  return useQuery({
    queryKey: queryKeys.communityMembers,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("community_members")
        .select("*")
        .order("name")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as CommunityMember[];
    },
  });
}

export function useFriendlyGames() {
  return useQuery({
    queryKey: queryKeys.friendlyGames,
    queryFn: async () => {
      // Lazy-materialize weekly series so recurring games always show the
      // next instances without waiting for a scheduler.
      try {
        await supabase().rpc("materialize_recurring_games");
      } catch {
        // Non-fatal: the listing below still works without materialization.
      }

      const today = new Date().toISOString().slice(0, 10);

      // Load member blocks so blocked users' games don't surface.
      const {
        data: { user },
      } = await supabase().auth.getUser();
      let blockedIds: string[] = [];
      if (user) {
        const { data: blockRows, error: blockErr } = await supabase()
          .from("blocks")
          .select("blocked_id")
          .eq("blocker_id", user.id);
        if (!blockErr) blockedIds = (blockRows ?? []).map((b) => b.blocked_id);
      }

      const { data, error } = await supabase()
        .from("friendly_games")
        .select(
          "*, participants:friendly_game_participants(count), playground:venues(name, area, governorate, address)"
        )
        .neq("status", "cancelled")
        .gte("game_date", today)
        .order("game_date")
        .limit(200);
      if (error) throw error;

      const hidden = new Set(blockedIds);
      return ((data ?? []) as any[])
        .filter((g) => !hidden.has(g.creator_id))
        .map((g) => ({
          ...g,
          participants_count: Number(g.participants?.[0]?.count ?? 0),
        })) as FriendlyGameWithDetails[];
    },
  });
}

export function usePoolPlaygrounds() {
  return useQuery({
    queryKey: queryKeys.poolPlaygrounds,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("venues")
        .select("*")
        .is("academy_id", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Venue[];
    },
  });
}

export function useMyGameParticipants() {
  return useQuery({
    queryKey: queryKeys.myGameParticipants,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase()
        .from("friendly_game_participants")
        .select("id, game_id, member_id, role, is_waitlisted, joined_at")
        .eq("member_id", user.id);
      if (error) throw error;
      return (data ?? []) as FriendlyGameParticipant[];
    },
  });
}

export function useCreateFriendlyGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      sport: string;
      playgroundId?: string | null;
      area?: string;
      location?: string;
      lat?: number | null;
      lng?: number | null;
      game_date: string;
      start_time: string;
      max_players: number;
      skill_level?: string;
      description?: string;
      is_public?: boolean;
      recurrence?: "weekly" | null;
      gender?: "male" | "female" | "mixed";
      min_age?: number | null;
      max_age?: number | null;
      fee_method: "instapay" | "e_wallet" | "kashier";
      fee_receipt_url: string;
    }) => {
      const { error } = await supabase().rpc("create_friendly_game", {
        p_title: input.title,
        p_sport: input.sport,
        p_playground_id: input.playgroundId ?? null,
        p_area: input.area ?? null,
        p_location: input.location ?? null,
        p_lat: input.lat ?? null,
        p_lng: input.lng ?? null,
        p_game_date: input.game_date,
        p_start_time: input.start_time,
        p_max_players: input.max_players,
        p_skill_level: input.skill_level ?? null,
        p_description: input.description ?? null,
        p_is_public: input.is_public ?? true,
        p_recurrence: input.recurrence ?? null,
        p_fee_method: input.fee_method,
        p_fee_receipt_url: input.fee_receipt_url,
        p_gender: input.gender ?? "mixed",
        p_min_age: input.min_age ?? null,
        p_max_age: input.max_age ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

export function useJoinFriendlyGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { gameId: string; inviteCode?: string | null }) => {
      const { error } = await supabase().rpc("join_friendly_game", {
        p_game_id: input.gameId,
        p_invite_code: input.inviteCode ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

export function useLeaveFriendlyGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase().rpc("leave_friendly_game", {
        p_game_id: gameId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

// ── Family members (parent-managed children) ────────────────

export function useChildren() {
  return useQuery({
    queryKey: queryKeys.children(),
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase()
        .from("profiles")
        .select("*")
        .eq("guardian_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

export function useAddFamilyMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      gender?: string | null;
      birth_date?: string | null;
      phone?: string | null;
      membership_type: MembershipType;
      subscription_sessions: number;
      join_date?: string | null;
    }) => {
      const { data, error } = await supabase().rpc("add_family_member", {
        p_name: input.name,
        p_gender: input.gender ?? null,
        p_birth_date: input.birth_date ?? null,
        p_phone: input.phone ?? null,
        p_membership_type: input.membership_type,
        p_subscription_sessions: input.subscription_sessions,
        p_join_date: input.join_date ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.children() });
    },
  });
}

export function useUpdateFamilyMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      childId: string;
      name: string;
      gender?: string | null;
      birth_date?: string | null;
      phone?: string | null;
    }) => {
      const { error } = await supabase().rpc("update_family_member", {
        p_child_id: input.childId,
        p_name: input.name,
        p_gender: input.gender ?? null,
        p_birth_date: input.birth_date ?? null,
        p_phone: input.phone ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.children() });
    },
  });
}

export function useRemoveFamilyMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (childId: string) => {
      const { error } = await supabase().rpc("remove_family_member", {
        p_child_id: childId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.children() });
    },
  });
}

export function useCancelFriendlyGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase().rpc("cancel_friendly_game", {
        p_game_id: gameId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

export function useStopRecurringGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (parentId: string) => {
      const { error } = await supabase().rpc("stop_recurring_game", {
        p_parent_id: parentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

export function useUpdateCommunityProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      bio?: string | null;
      community_visible?: boolean;
      skill_level?: string | null;
      position?: string | null;
      availability_days?: number[];
      interested_sports?: string[];
      notify_game_alerts?: boolean;
    }) => {
      const { error } = await supabase()
        .from("profiles")
        .update({
          bio: input.bio ?? null,
          community_visible: input.community_visible ?? true,
          skill_level:
            input.skill_level === undefined ? undefined : input.skill_level,
          position: input.position === undefined ? undefined : input.position,
          availability_days:
            input.availability_days === undefined
              ? undefined
              : input.availability_days,
          interested_sports:
            input.interested_sports === undefined
              ? undefined
              : input.interested_sports,
          notify_game_alerts:
            input.notify_game_alerts === undefined
              ? undefined
              : input.notify_game_alerts,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profiles });
      qc.invalidateQueries({ queryKey: queryKeys.communityMembers });
    },
  });
}

// ── Notifications ────────────────────────────────────────────

export function useNotifications(limit = 30) {
  return useQuery({
    queryKey: [...queryKeys.notifications, limit],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase()
        .from("notifications")
        .select("*")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      const { error } = await supabase().rpc("mark_notifications_read", {
        p_ids: ids ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

// ── Scores & records ─────────────────────────────────────────

export function useSubmitGameScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { gameId: string; resultA: number; resultB: number }) => {
      const { error } = await supabase().rpc("submit_game_score", {
        p_game_id: input.gameId,
        p_result_a: input.resultA,
        p_result_b: input.resultB,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

// ── Trust & safety ───────────────────────────────────────────

export function useFileReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { targetType: "member" | "game"; targetId: string; reason: string }) => {
      if (!input.reason.trim()) throw new Error("Reason is required");
      const { error } = await supabase().rpc("file_report", {
        p_target_type: input.targetType,
        p_target_id: input.targetId,
        p_reason: input.reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.reports });
    },
  });
}

export function useResolveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reportId: string; status: "resolved" | "dismissed" }) => {
      const { error } = await supabase().rpc("resolve_report", {
        p_report_id: input.reportId,
        p_status: input.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.reports });
    },
  });
}

export function useReports() {
  return useQuery({
    queryKey: queryKeys.reports,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as CommunityReport[];
    },
  });
}

export function useMyBlocks() {
  return useQuery({
    queryKey: queryKeys.blocks,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      if (!user) return [] as Block[];
      const { data, error } = await supabase()
        .from("blocks")
        .select("*")
        .eq("blocker_id", user.id);
      if (error) throw error;
      return (data ?? []) as Block[];
    },
  });
}

export function useBlockedMembers() {
  return useQuery({
    queryKey: queryKeys.blockedMembers,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      if (!user) return [] as BlockedMember[];
      const { data, error } = await supabase()
        .from("blocked_members")
        .select("*")
        .eq("blocker_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BlockedMember[];
    },
  });
}

export function useBlockMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase().rpc("block_member", {
        p_member_id: memberId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blocks });
      qc.invalidateQueries({ queryKey: queryKeys.blockedMembers });
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
    },
  });
}

export function useUnblockMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase().rpc("unblock_member", {
        p_member_id: memberId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blocks });
      qc.invalidateQueries({ queryKey: queryKeys.blockedMembers });
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
    },
  });
}

// ── Community record & streaks ───────────────────────────────

export function useMyCommunityRecord(memberId?: string) {
  return useQuery({
    queryKey: queryKeys.communityRecord,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      const target = memberId ?? user?.id;
      if (!target) return { played: 0, wins: 0, losses: 0, draws: 0 };
      const { data: parts } = await supabase()
        .from("friendly_game_participants")
        .select("game_id")
        .eq("member_id", target);
      const ids = (parts ?? []).map((p) => p.game_id);
      if (ids.length === 0) return { played: 0, wins: 0, losses: 0, draws: 0 };
      const { data: games, error } = await supabase()
        .from("friendly_games")
        .select("result_a, result_b")
        .in("id", ids)
        .eq("status", "completed")
        .not("result_a", "is", null);
      if (error) throw error;
      const rows = (games ?? []) as { result_a: number; result_b: number }[];
      let wins = 0;
      let losses = 0;
      let draws = 0;
      for (const g of rows) {
        if (g.result_a > g.result_b) wins += 1;
        else if (g.result_a < g.result_b) losses += 1;
        else draws += 1;
      }
      return { played: rows.length, wins, losses, draws };
    },
  });
}

export interface StreakStats {
  current: number;
  best: number;
  attendedSessions: number;
}

export function useMyStreaks(memberId?: string) {
  return useQuery({
    queryKey: queryKeys.myStreaks,
    queryFn: async () => {
      const stats: StreakStats = { current: 0, best: 0, attendedSessions: 0 };
      const {
        data: { user },
      } = await supabase().auth.getUser();
      const target = memberId ?? user?.id;
      if (!target) return stats;

      const { data, error } = await supabase()
        .from("attendance")
        .select("is_present, session:training_sessions(date)")
        .eq("member_id", target)
        .eq("is_present", true);
      if (error) throw error;

      const unique = [
        ...new Set(
          (data ?? []).map((r: any) => r.session?.date).filter(Boolean)
        ),
      ] as string[];
      unique.sort();
      stats.attendedSessions = unique.length;
      if (unique.length === 0) return stats;

      const keyOf = (d: Date) => d.toISOString().slice(0, 10);
      const dayOf = (s: string) => new Date(s + "T12:00:00");
      const set = new Set(unique);

      // Best streak: longest run of consecutive unique dates.
      let run = 1;
      for (let i = 1; i < unique.length; i++) {
        const prev = dayOf(unique[i - 1]);
        const cur = new Date(prev);
        cur.setDate(prev.getDate() + 1);
        if (keyOf(cur) === unique[i]) {
          run += 1;
        } else {
          stats.best = Math.max(stats.best, run);
          run = 1;
        }
      }
      stats.best = Math.max(stats.best, run);

      // Current streak: consecutive days up to today (or yesterday if today
      // has no session yet).
      let cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      if (!set.has(keyOf(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
      }
      while (set.has(keyOf(cursor))) {
        stats.current += 1;
        cursor.setDate(cursor.getDate() - 1);
      }

      return stats;
    },
  });
}

// ── Super admin: game-fee review ───────────────────────────

export function usePendingGameFees() {
  return useQuery({
    queryKey: ["pending-game-fees"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("friendly_games")
        .select("*")
        .eq("fee_status", "pending")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as FriendlyGame[];
    },
  });
}

export function useReviewGameFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gameId,
      approve,
    }: {
      gameId: string;
      approve: boolean;
    }) => {
      const { error } = await supabase().rpc("review_game_fee", {
        p_game_id: gameId,
        p_approve: approve,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-game-fees"] });
      qc.invalidateQueries({ queryKey: ["friendly-games"] });
    },
  });
}

// ── Academy plan management (super admin) ──────────────────

export function useSetAcademyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      academyId,
      plan,
    }: {
      academyId: string;
      plan: "starter" | "plus" | "elite";
    }) => {
      const { error } = await supabase().rpc("set_academy_plan", {
        p_academy_id: academyId,
        p_plan: plan,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-academies"] });
    },
  });
}

// ── Plan subscriptions (member Pro / academy Plus & Elite) ──

export function usePurchasePlanSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      kind,
      plan,
      billingCycle,
      method,
      receiptUrl,
    }: {
      kind: "member" | "academy";
      plan: "pro" | "plus" | "elite";
      billingCycle: "monthly" | "semi" | "yearly";
      method: "instapay" | "e_wallet" | "kashier";
      receiptUrl?: string | null;
    }) => {
      const { error } = await supabase().rpc("purchase_plan_subscription", {
        p_kind: kind,
        p_plan: plan,
        p_billing_cycle: billingCycle,
        p_method: method,
        p_receipt_url: receiptUrl ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["academy"] });
      qc.invalidateQueries({ queryKey: ["all-academies"] });
    },
  });
}

export function useMySubscriptions() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["my-subscriptions"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      if (!user) return [] as PlanSubscription[];
      const { data, error } = await supabase()
        .from("plan_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as PlanSubscription[];
    },
  });
}

export function usePendingSubscriptions() {
  return useQuery({
    queryKey: ["pending-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("plan_subscriptions")
        .select("*")
        .eq("receipt_status", "pending")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PlanSubscription[];
    },
  });
}

export function useReviewSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      subscriptionId,
      approve,
    }: {
      subscriptionId: string;
      approve: boolean;
    }) => {
      const { error } = await supabase().rpc("review_subscription_receipt", {
        p_subscription_id: subscriptionId,
        p_approve: approve,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["all-academies"] });
      qc.invalidateQueries({ queryKey: ["academy"] });
    },
  });
}

// ── Community leaderboard ──────────────────────────────────

export function useCommunityLeaderboard() {
  return useQuery({
    queryKey: ["community-leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("community_leaderboard")
        .select("*")
        .limit(100);
      if (error) throw error;
      return (data ?? []) as CommunityLeaderboardRow[];
    },
  });
}

// ── Scouting shortlist ─────────────────────────────────────

export function useScoutNotes() {
  return useQuery({
    queryKey: ["scout-notes"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase()
        .from("scout_notes")
        .select("*")
        .eq("scout_id", user.id);
      if (error) throw error;
      return (data ?? []) as ScoutNote[];
    },
  });
}

export function useToggleScoutNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (playerId: string) => {
      const { data, error } = await supabase().rpc("toggle_scout_note", {
        p_player_id: playerId,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scout-notes"] });
    },
  });
}
