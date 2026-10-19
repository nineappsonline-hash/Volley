"use client";

import { ACTIVE_SPORTS } from "@/lib/active-sports";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { COMMUNITY_SPORTS } from "@/lib/constants";
import { isValidUsername } from "@/lib/username";
import type {
  Academy,
  AcademyBranch,
  AcademyFollow,
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
  CoachInvitation,
  CommunityLeaderboardRow,
  CommunityMember,
  CommunityReport,
  CompletedGameRatingTarget,
  CompletedSessionRatingTarget,
  ContactMessage,
  Expense,
  FriendlyGame,
  FriendlyGameParticipant,
  FriendlyGameRentPayment,
  FriendlyGameWithDetails,
  MemberBadge,
  MembershipPlan,
  MonthlyCost,
  Payment,
  PlayerEvaluation,
  PlaygroundRating,
  PlanSubscription,
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
  SportLeaderboardRow,
  TeamWithDetails,
  Tournament,
  TournamentWithMatches,
  TournamentMatch,
  TournamentParticipant,
  TournamentTeamWithMembers,
  TournamentStanding,
  TrainingSession,
  TrialRequest,
  Venue,
  VenueRental,
  PlaygroundOwner,
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
  sportSettings: ["sport_settings"] as const,
  teams: ["teams"] as const,
  academy: ["academy"] as const,
  branches: ["branches"] as const,
  announcements: ["announcements"] as const,
  coaches: ["coaches"] as const,
  coachInvitations: ["coach-invitations"] as const,
  coachInvitation: (id: string) => ["coach-invitations", id] as const,
  venues: ["venues"] as const,
  venueRentals: ["venue-rentals"] as const,
  ownerApplication: ["playground-owner", "me"] as const,
  ownerVenues: ["playground-owner", "venues"] as const,
  ownerApplications: ["playground-owners"] as const,
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
  playgroundRatings: ["playground-ratings"] as const,
  ratingEligibility: ["rating-eligibility"] as const,
  academyFollows: ["academy-follows"] as const,
  communityMembers: ["community-members"] as const,
  friendlyGames: ["friendly-games"] as const,
  myGameParticipants: ["my-game-participants"] as const,
  poolPlaygrounds: ["playgrounds"] as const,
  children: (guardianId?: string) =>
    ["children", guardianId ?? "all"] as const,
  notifications: ["notifications"] as const,
  reports: ["reports"] as const,
  contactMessages: ["contact-messages"] as const,
  blocks: ["blocks"] as const,
  blockedMembers: ["blocked-members"] as const,
  communityRecord: ["community-record"] as const,
  myStreaks: ["my-streaks"] as const,
  communitySports: ["community-sports"] as const,
  sportLeaderboard: (sport: string) => ["sport-leaderboard", sport] as const,
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

/** Profile of the signed-in user (client-side). */
export function useCurrentProfile() {
  return useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase()
        .from("profiles")
        .select("*")
        .eq("id", user.id)
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

/**
 * Platform-wide per-sport game rules (sport_settings table). Currently only
 * the minimum players a community game must have. Falls back to an empty map —
 * callers then use the built-in SPORT_DEFAULT_MIN constants.
 */
export function useSportSettings() {
  return useQuery({
    queryKey: queryKeys.sportSettings,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("sport_settings")
        .select("sport, min_players");
      if (error) throw error;
      return new Map((data ?? []).map((row: { sport: string; min_players: number }) => [row.sport, row.min_players]));
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
           team_members(member_id, profile:profiles(id, name, nickname))`
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
      qc.invalidateQueries({ queryKey: queryKeys.communityMembers });
      qc.invalidateQueries({ queryKey: ["community-leaderboard"] });
      qc.refetchQueries({ queryKey: ["sport-leaderboard"] });
    },
  });
}

export type UsernameAvailability =
  | "idle"
  | "checking"
  | "available"
  | "taken"
  | "invalid";

export function useUsernameAvailability(username: string | undefined) {
  return useQuery({
    queryKey: ["username-availability", username ?? ""],
    queryFn: async () => {
      const { data, error } = await supabase().rpc("is_username_taken", {
        p_username: username,
      });
      if (error) throw error;
      return data ? "taken" : "available";
    },
    enabled: Boolean(username && isValidUsername(username)),
  });
}

// ── Academy (tenant settings) ───────────────────────────────

export function useAcademy() {
  return useQuery({
    queryKey: queryKeys.academy,
    queryFn: async () => {
      const client = supabase();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (!user) return null;
      const { data: profile, error: profileError } = await client.from("profiles")
        .select("academy_id").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.academy_id) return null;
      const { data, error } = await client
        .from("academies")
        .select("*")
        .eq("id", profile.academy_id)
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
      qc.invalidateQueries({ queryKey: ["academy-logo"] });
      qc.invalidateQueries({ queryKey: ["public-academies"] });
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
        .select("id, name, description, country, governorate, area, lat, lng, cover_url, logo_url, slug")
        .eq("is_public", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pick<
        Academy,
        "id" | "name" | "description" | "country" | "governorate" | "area" | "lat" | "lng" | "cover_url" | "logo_url" | "slug"
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
        .select("academy_id, name")
        .in("name", [...ACTIVE_SPORTS]);
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
    mutationFn: async ({
      academyId,
      rating,
      comment,
    }: {
      academyId: string;
      rating: number;
      comment?: string;
    }) => {
      const { data: session } = await supabase().auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error("not authenticated");
      const { error } = await supabase().from("academy_ratings").upsert(
        { academy_id: academyId, member_id: uid, rating, comment: comment ?? null },
        { onConflict: "academy_id,member_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.academyRatings });
    },
  });
}

export function usePlaygroundRatings() {
  return useQuery({
    queryKey: queryKeys.playgroundRatings,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("playground_ratings")
        .select("*");
      if (error) throw error;
      return (data ?? []) as PlaygroundRating[];
    },
  });
}

export function useRatePlayground() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      venueId,
      rating,
      comment,
    }: {
      venueId: string;
      rating: number;
      comment?: string;
    }) => {
      const { data: session } = await supabase().auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error("not authenticated");
      const { error } = await supabase().from("playground_ratings").upsert(
        { venue_id: venueId, member_id: uid, rating, comment: comment ?? null },
        { onConflict: "venue_id,member_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.playgroundRatings });
    },
  });
}

/** Academy/venue ids the current member is allowed to rate (attended). */
export function useMyRatingEligibility() {
  return useQuery({
    queryKey: queryKeys.ratingEligibility,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase().auth.getUser();
      if (!user) {
        return { academies: new Set<string>(), playgrounds: new Set<string>() };
      }
      const { data, error } = await supabase().rpc("member_rating_eligibility");
      if (error) throw error;
      return {
        academies: new Set<string>((data?.academies ?? []) as string[]),
        playgrounds: new Set<string>((data?.playgrounds ?? []) as string[]),
      };
    },
  });
}

/**
 * Playgrounds the member just played at (completed friendly game in the last
 * 14 days) that they haven't rated yet, newest game first. Drives the
 * post-game rating prompt; excludes waitlist-only entries.
 */
export function useUnratedPlaygroundTargets(memberId: string) {
  return useQuery({
    queryKey: [...queryKeys.myGameParticipants, "unrated-targets", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);
      const cutoffISO = cutoff.toISOString().slice(0, 10);

      const { data: ratings, error: ratingsError } = await supabase()
        .from("playground_ratings")
        .select("venue_id")
        .eq("member_id", memberId);
      if (ratingsError) throw ratingsError;
      const ratedVenues = new Set((ratings ?? []).map((r) => r.venue_id));

      const { data, error } = await supabase()
        .from("friendly_game_participants")
        .select(
          "is_waitlisted, game:friendly_games!inner(id, game_date, start_time, playground_id, playground:venues(id, name, address, country, governorate, area, photos, cover_url))"
        )
        .eq("member_id", memberId)
        .gte("game.game_date", cutoffISO)
        .eq("game.status", "completed")
        .limit(100);
      if (error) throw error;

      const targets = new Map<string, CompletedGameRatingTarget>();
      for (const row of (data ?? []) as any[]) {
        if (row.is_waitlisted) continue;
        const game = Array.isArray(row.game) ? row.game[0] : row.game;
        const venue = Array.isArray(game?.playground) ? game.playground[0] : game?.playground;
        if (!game || !venue || ratedVenues.has(venue.id)) continue;
        const key = `${game.game_date}T${game.start_time ?? ""}`;
        const existing = targets.get(venue.id);
        if (!existing || key > `${existing.gameDate}T${existing.startTime ?? ""}`) {
          targets.set(venue.id, {
            gameId: game.id,
            gameDate: game.game_date,
            startTime: game.start_time ?? null,
            venue,
          });
        }
      }
      return Array.from(targets.values()).sort(
        (a, b) => (b.gameDate + (b.startTime ?? "")).localeCompare(a.gameDate + (a.startTime ?? ""))
      );
    },
  });
}

/**
 * Academies the member just trained at (present attendance at a completed
 * session in the last 14 days) that they haven't rated yet, newest first.
 * Drives the post-session academy rating prompt.
 */
export function useUnratedAcademyTargets(memberId: string) {
  return useQuery({
    queryKey: [...queryKeys.sessions, "unrated-academy-targets", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14);
      const cutoffISO = cutoff.toISOString().slice(0, 10);

      const { data: ratings, error: ratingsError } = await supabase()
        .from("academy_ratings")
        .select("academy_id")
        .eq("member_id", memberId);
      if (ratingsError) throw ratingsError;
      const ratedAcademies = new Set((ratings ?? []).map((r) => r.academy_id));

      const { data, error } = await supabase()
        .from("attendance")
        .select(
          "is_present, session:training_sessions!inner(id, date, time, status, academy:academies(id, name, cover_url, logo_url, governorate, area))"
        )
        .eq("member_id", memberId)
        .eq("is_present", true)
        .gte("session.date", cutoffISO)
        .eq("session.status", "completed")
        .limit(100);
      if (error) throw error;

      const targets = new Map<string, CompletedSessionRatingTarget>();
      for (const row of (data ?? []) as any[]) {
        const session = Array.isArray(row.session) ? row.session[0] : row.session;
        const academy = Array.isArray(session?.academy)
          ? session.academy[0]
          : session?.academy;
        if (!session || !academy || ratedAcademies.has(academy.id)) continue;
        const key = `${session.date}T${session.time ?? ""}`;
        const existing = targets.get(academy.id);
        if (!existing || key > `${existing.sessionDate}T${existing.sessionTime ?? ""}`) {
          targets.set(academy.id, {
            sessionId: session.id,
            sessionDate: session.date,
            sessionTime: session.time ?? null,
            academy,
          });
        }
      }
      return Array.from(targets.values()).sort(
        (a, b) =>
          (b.sessionDate + (b.sessionTime ?? "")).localeCompare(
            a.sessionDate + (a.sessionTime ?? "")
          )
      );
    },
  });
}

/** Attach a pending (codeless) member to a public academy. Returns false if already attached. */
export function joinPublicAcademy(academyId: string) {
  return supabase().rpc("join_public_academy", { p_academy_id: academyId });
}

// ── Academy follows ─────────────────────────────────────────

type FollowedAcademy = AcademyFollow & {
  academy: Pick<
    Academy,
    "id" | "name" | "slug" | "description" | "cover_url" | "country" | "governorate" | "area"
  > | null;
};

/** All public academies followed by the signed-in member (joined details). */
export function useMyAcademyFollows() {
  return useQuery({
    queryKey: queryKeys.academyFollows,
    queryFn: async () => {
      const { data: session } = await supabase().auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) return [] as FollowedAcademy[];
      const { data, error } = await supabase()
        .from("academy_follows")
        .select(
          "id, member_id, academy_id, created_at, academy:academies(id, name, slug, description, cover_url, country, governorate, area)"
        )
        .eq("member_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FollowedAcademy[];
    },
  });
}

/** Follow (or re-follow) a public academy. */
export function useFollowAcademy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (academyId: string) => {
      const { data: session } = await supabase().auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error("not authenticated");
      const { error } = await supabase()
        .from("academy_follows")
        .upsert(
          { member_id: uid, academy_id: academyId },
          { onConflict: "member_id,academy_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.academyFollows });
    },
  });
}

/** Unfollow an academy. */
export function useUnfollowAcademy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (academyId: string) => {
      const { data: session } = await supabase().auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error("not authenticated");
      const { error } = await supabase()
        .from("academy_follows")
        .delete()
        .eq("member_id", uid)
        .eq("academy_id", academyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.academyFollows });
    },
  });
}

/** Who follows a given academy (for follower counts). */
export function useAcademyFollowerCount(academyId: string | null | undefined) {
  return useQuery({
    queryKey: ["academy-followers", academyId],
    enabled: !!academyId,
    queryFn: async () => {
      const { count, error } = await supabase()
        .from("academy_follows")
        .select("id", { count: "exact", head: true })
        .eq("academy_id", academyId!);
      if (error) throw error;
      return count ?? 0;
    },
  });
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

// ── Nearby events (all plans) ─────────────────────────────────

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

/** Feed for the "Following" page: latest updates (announcements) and events
 * from the academies the current member follows. */
export function useFollowingFeed() {
  const { data: follows } = useMyAcademyFollows();
  const academyIds = (follows ?? [])
    .map((f) => f.academy_id)
    .filter((id): id is string => !!id);
  return useQuery({
    queryKey: ["following-feed", academyIds] as const,
    enabled: academyIds.length > 0,
    queryFn: async () => {
      const [updatesRes, eventsRes] = await Promise.all([
        supabase()
          .from("announcements")
          .select("*, academy:academies(id, name, slug)")
          .in("academy_id", academyIds)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase()
          .from("tournaments")
          .select(
            `*, sport:sports(id, name),
             academy:academies(id, name, slug, address)`
          )
          .in("academy_id", academyIds)
          .eq("academies.is_public", true)
          .order("start_date", { ascending: true }),
      ]);
      if (updatesRes.error) throw updatesRes.error;
      if (eventsRes.error) throw eventsRes.error;
      return {
        updates: (updatesRes.data ?? []) as (Announcement & {
          academy: Pick<Academy, "id" | "name" | "slug"> | null;
        })[],
        events: (eventsRes.data ?? []) as (TournamentWithMatches & {
          sport: Pick<Sport, "id" | "name"> | null;
          academy: Pick<Academy, "id" | "name" | "slug" | "address"> | null;
        })[],
      };
    },
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

// ── Coach invitations ───────────────────────────────────────

export function useCoachInvitations() {
  return useQuery({
    queryKey: queryKeys.coachInvitations,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("coach_invitations")
        .select(
          "*, member:profiles!coach_invitations_member_id_fkey(id, name, username, avatar_url, avatar_id, phone)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (CoachInvitation & {
        member: {
          id: string;
          name: string;
          username: string;
          avatar_url: string | null;
          avatar_id: string | null;
          phone: string | null;
        } | null;
      })[];
    },
  });
}

export function useCoachInvitation(id: string | null) {
  return useQuery({
    queryKey: queryKeys.coachInvitation(id ?? ""),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase()
        .from("coach_invitations")
        .select(
          "*, academy:academies!coach_invitations_academy_id_fkey(name), inviter:profiles!coach_invitations_invited_by_fkey(name, avatar_url, avatar_id)"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as (CoachInvitation & {
        academy: { name: string } | null;
        inviter: {
          name: string;
          avatar_url: string | null;
          avatar_id: string | null;
        } | null;
      }) | null;
    },
    enabled: !!id,
  });
}

export function useInviteCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase().rpc("invite_coach_member", {
        p_member_id: memberId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.coachInvitations });
    },
  });
}

export function useRespondCoachInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { error } = await supabase().rpc("respond_coach_invitation", {
        p_invitation_id: id,
        p_accept: accept,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.coachInvitations });
      qc.invalidateQueries({ queryKey: queryKeys.coaches });
      qc.invalidateQueries({ queryKey: ["profile", "me"] });
    },
  });
}

// ── Venues ──────────────────────────────────────────────────

export function useVenues(includePending = false) {
  return useQuery({
    queryKey: [...queryKeys.venues, includePending],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("venues")
        .select("id, academy_id, owner_profile_id, approval_status, name, address, lat, lng, location_link, photos, cover_url, capacity, sport_id, school_name, rental_cost, rental_hours, country, governorate, area, unavailable_slots, working_hours, court_count, created_at")
        .order("name");
      if (error) throw error;
      const { data: labels, error: labelError } = await supabase().rpc("playground_sport_labels");
      if (labelError) console.warn("playground_sport_labels unavailable, sport labels disabled", labelError);
      const sportsByVenue = new Map<string, { id: string; name: string }>(
        (labels ?? []).map((row: { venue_id: string; sport_id: string; sport_name: string }) =>
          [row.venue_id, { id: row.sport_id, name: row.sport_name }]
        )
      );
      return (data ?? []).filter((venue) => includePending || venue.approval_status === "approved").map((venue) => ({ ...venue, sport: sportsByVenue.get(venue.id) ?? null })) as Venue[];
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
        rental_hours: venue.rental_hours ?? null,
        location_link: venue.location_link ?? null,
        court_count: venue.court_count ?? 1,
        owner_profile_id: venue.owner_profile_id ?? null,
        ...(venue.photos ? { photos: venue.photos } : {}),
        ...(venue.cover_url !== undefined ? { cover_url: venue.cover_url } : {}),
        ...(venue.blocked_dates ? { blocked_dates: venue.blocked_dates } : {}),
      };
      const { error } = id
        ? await supabase().from("venues").update(payload).eq("id", id)
        : await supabase().from("venues").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["venues"] });
      qc.invalidateQueries({ queryKey: ["playgrounds"] });
      qc.invalidateQueries({ queryKey: ["venue-approvals"] });
      qc.invalidateQueries({ queryKey: queryKeys.ownerVenues });
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

// ── Playground owners ───────────────────────────────────────

export function useOwnerVenues() {
  return useQuery({
    queryKey: queryKeys.ownerVenues,
    queryFn: async () => {
      const user = await supabase().auth.getUser();
      const { data, error } = await supabase()
        .from("venues")
        .select("id, academy_id, owner_profile_id, approval_status, name, address, lat, lng, location_link, photos, cover_url, capacity, sport_id, school_name, rental_cost, rental_hours, country, governorate, area, unavailable_slots, working_hours, blocked_dates, court_count, created_at")
        .eq("owner_profile_id", user.data.user?.id ?? "")
        .order("name");
      if (error) throw error;
      const { data: labels, error: labelError } = await supabase().rpc("playground_sport_labels");
      if (labelError) console.warn("playground_sport_labels unavailable, sport labels disabled", labelError);
      const sportsByVenue = new Map<string, { id: string; name: string }>(
        (labels ?? []).map((row: { venue_id: string; sport_id: string; sport_name: string }) =>
          [row.venue_id, { id: row.sport_id, name: row.sport_name }]
        )
      );
      return (data ?? []).map((venue) => ({ ...venue, sport: sportsByVenue.get(venue.id) ?? null })) as Venue[];
    },
  });
}

export function useOwnerApplication() {
  return useQuery({
    queryKey: queryKeys.ownerApplication,
    queryFn: async () => {
      const user = await supabase().auth.getUser();
      const { data, error } = await supabase()
        .from("playground_owners")
        .select("*")
        .eq("profile_id", user.data.user?.id ?? "")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PlaygroundOwner | null;
    },
  });
}

export function usePlaygroundOwnerApprovals() {
  return useQuery({
    queryKey: queryKeys.ownerApplications,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("playground_owners")
        .select("*, profiles(name, email, phone, avatar_url)")
        .eq("status", "pending")
        .order("created_at");
      if (error) throw error;
      return (
        data ?? []
      ) as (PlaygroundOwner & {
        profiles: Pick<Profile, "name" | "email" | "phone" | "avatar_url"> | null;
      })[];
    },
  });
}

export function useReviewPlaygroundOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ownerId,
      approve,
      note,
    }: {
      ownerId: string;
      approve: boolean;
      note?: string;
    }) => {
      const { error } = await supabase().rpc("review_playground_owner", {
        p_owner_id: ownerId,
        p_approve: approve,
        p_note: note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.ownerApplications });
      qc.invalidateQueries({ queryKey: queryKeys.ownerApplication });
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
        .order("evaluation_date", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (memberId) q = q.eq("member_id", memberId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PlayerEvaluation[];
    },
    refetchInterval: 30000,
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

/** Tournaments the current member participates in, with matches, the
 *  member's team, and the roster of every team (for standings). */
export function useMyTournaments(memberId: string | null) {
  return useQuery({
    queryKey: ["my-tournaments", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tournament_participants")
        .select(
          `id,
           tournament_id,
           tournament:tournaments(
             *, sport:sports(id, name), tournament_matches(*),
             participants:tournament_participants(count),
             teams:tournament_teams(
               id, name, created_at,
               members:tournament_team_members(id, participant_id)
             )
           )`
        )
        .eq("member_id", memberId!)
        .order("added_at", { ascending: false });
      if (error) throw error;
      const rows = (
        (data ?? []) as unknown as {
          id: string;
          tournament: TournamentWithMatches & {
            participants: { count: number }[];
            teams: {
              id: string;
              name: string;
              created_at: string;
              members: { id: string; participant_id: string }[];
            }[];
          } | null;
        }[]
      );
      return rows
        .filter((r) => r.tournament)
        .map((r) => {
          const tournament = r.tournament!;
          tournament.participant_count = Number(tournament.participants?.[0]?.count ?? 0);
          delete (tournament as { participants?: unknown }).participants;
          const myTeam = tournament.teams.find((t) =>
            t.members.some((m) => m.participant_id === r.id)
          );
          return {
            participant_id: r.id,
            tournament,
            myTeam: myTeam
              ? { id: myTeam.id, name: myTeam.name, tournament_id: tournament.id, created_at: myTeam.created_at }
              : null,
          };
        });
    },
  });
}

export function useTournaments() {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tournaments")
        .select(
          `*, sport:sports(id, name), tournament_matches(*),
           participants:tournament_participants(count)`
        )
        .order("start_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const t = row as TournamentWithMatches & {
          participants: { count: number }[];
        };
        return {
          ...t,
          participant_count: Number(t.participants?.[0]?.count ?? 0),
        };
      }) as TournamentWithMatches[];
    },
  });
}

/** All tournaments across the platform, with sport + academy info and match
 *  counts — used by the member dashboard's "upcoming tournaments" card. */
export function useAllTournaments() {
  return useQuery({
    queryKey: ["all-tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tournaments")
        .select(
          `*, sport:sports(id, name), tournament_matches(*),
           academy:academies(id, name, slug),
           participants:tournament_participants(count)`
        )
        .order("start_date", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as (TournamentWithMatches & {
        academy: { id: string; name: string; slug: string | null } | null;
        participants: { count: number }[];
      })[]).map((row) => ({
        ...row,
        participant_count: Number(row.participants?.[0]?.count ?? 0),
      }));
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
        prize: tournament.prize ?? null,
        sport_id: tournament.sport_id ?? null,
        start_date: tournament.start_date,
        end_date: tournament.end_date ?? null,
        start_time: tournament.start_time ?? null,
        end_time: tournament.end_time ?? null,
        participant_fee: tournament.participant_fee ?? 0,
        max_participants: tournament.max_participants ?? null,
        venue_id: tournament.venue_id ?? null,
        status: tournament.status ?? "upcoming",
        format: tournament.format ?? null,
      };
      const { error } = tournament.id
        ? await supabase().from("tournaments").update(payload).eq("id", tournament.id)
        : await supabase().from("tournaments").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      qc.invalidateQueries({ queryKey: ["all-tournaments"] });
      qc.invalidateQueries({ queryKey: ["my-tournaments"] });
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
      qc.invalidateQueries({ queryKey: ["all-tournaments"] });
      qc.invalidateQueries({ queryKey: ["my-tournaments"] });
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

// ── Tournament runner: pool → teams → fixtures → scores ─────────────

function invalidateTournamentRunner(qc: ReturnType<typeof useQueryClient>, tournamentId?: string) {
  qc.invalidateQueries({ queryKey: ["tournaments"] });
  qc.invalidateQueries({ queryKey: ["all-tournaments"] });
  qc.invalidateQueries({ queryKey: ["my-tournaments"] });
  qc.invalidateQueries({ queryKey: ["tournament-participants"] });
  qc.invalidateQueries({ queryKey: ["tournament-teams"] });
  if (tournamentId) {
    qc.invalidateQueries({ queryKey: ["tournament-participants", tournamentId] });
    qc.invalidateQueries({ queryKey: ["tournament-teams", tournamentId] });
  }
}

/** Pool of members participating in a tournament. */
export function useTournamentParticipants(tournamentId: string | null) {
  return useQuery({
    queryKey: ["tournament-participants", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tournament_participants")
        .select("*, member:profiles(id, name, nickname, username)")
        .eq("tournament_id", tournamentId!)
        .order("added_at");
      if (error) throw error;
      return (data ?? []) as (TournamentParticipant & {
        member: Pick<Profile, "id" | "name" | "nickname" | "username"> | null;
      })[];
    },
  });
}

export function useAddTournamentParticipants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tournamentId, memberIds }: { tournamentId: string; memberIds: string[] }) => {
      const { error } = await supabase()
        .from("tournament_participants")
        .upsert(
          memberIds.map((member_id) => ({ tournament_id: tournamentId, member_id })),
          { onConflict: "tournament_id,member_id", ignoreDuplicates: true }
        );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => invalidateTournamentRunner(qc, vars.tournamentId),
  });
}

export function useRemoveTournamentParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase()
        .from("tournament_participants")
        .delete()
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: () => invalidateTournamentRunner(qc),
  });
}

/** Named teams created inside a tournament (with their rosters). */
export function useTournamentTeams(tournamentId: string | null) {
  return useQuery({
    queryKey: ["tournament-teams", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("tournament_teams")
        .select(
          `*,
           members:tournament_team_members(
             id, participant_id,
             participant:tournament_participants(member_id)
           )`
        )
        .eq("tournament_id", tournamentId!)
        .order("created_at");
      if (error) throw error;
      const teams = (data ?? []) as unknown as {
        id: string;
        tournament_id: string;
        name: string;
        created_at: string;
        members: {
          id: string;
          participant_id: string;
          participant: { member_id: string } | null;
        }[];
      }[];
      // Resolve display names through the participants' profiles.
      const memberIds = [
        ...new Set(teams.flatMap((tm) => tm.members.map((m) => m.participant?.member_id).filter(Boolean))),
      ] as string[];
      let names = new Map<string, string>();
      if (memberIds.length > 0) {
        const { data: profs } = await supabase()
          .from("profiles")
          .select("id, name, nickname")
          .in("id", memberIds);
        names = new Map(
          (profs ?? []).map((p: { id: string; name: string; nickname: string | null }) => [
            p.id,
            p.nickname?.trim() || p.name,
          ])
        );
      }
      return teams.map((tm) => ({
        id: tm.id,
        tournament_id: tm.tournament_id,
        name: tm.name,
        created_at: tm.created_at,
        members: tm.members
          .filter((m) => m.participant)
          .map((m) => ({
            id: m.id,
            participant_id: m.participant_id,
            member_id: m.participant!.member_id,
            display_name: names.get(m.participant!.member_id) ?? "?",
          })),
      })) as TournamentTeamWithMembers[];
    },
  });
}

export function useCreateTournamentTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tournamentId, name }: { tournamentId: string; name: string }) => {
      const { data, error } = await supabase()
        .from("tournament_teams")
        .insert({ tournament_id: tournamentId, name })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: (_data, vars) => invalidateTournamentRunner(qc, vars.tournamentId),
  });
}

export function useRenameTournamentTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, name }: { teamId: string; name: string }) => {
      const { error } = await supabase()
        .from("tournament_teams")
        .update({ name })
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => invalidateTournamentRunner(qc),
  });
}

export function useDeleteTournamentTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase()
        .from("tournament_teams")
        .delete()
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => invalidateTournamentRunner(qc),
  });
}

export function useAddTournamentTeamMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, participantIds }: { teamId: string; participantIds: string[] }) => {
      const { error } = await supabase()
        .from("tournament_team_members")
        .upsert(
          participantIds.map((participant_id) => ({ team_id: teamId, participant_id })),
          { onConflict: "team_id,participant_id", ignoreDuplicates: true }
        );
      if (error) throw error;
    },
    onSuccess: () => invalidateTournamentRunner(qc),
  });
}

export function useRemoveTournamentTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase()
        .from("tournament_team_members")
        .delete()
        .eq("id", membershipId);
      if (error) throw error;
    },
    onSuccess: () => invalidateTournamentRunner(qc),
  });
}

/** Enter a result: sets the score, marks complete, advances knockout winners. */
export function useSubmitTournamentScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      matchId: string;
      scoreA: number;
      scoreB: number;
      goalsA?: number | null;
      goalsB?: number | null;
    }) => {
      const { error } = await supabase().rpc("submit_tournament_score", {
        p_match_id: input.matchId,
        p_score_a: input.scoreA,
        p_score_b: input.scoreB,
        p_goals_a: input.goalsA ?? input.scoreA,
        p_goals_b: input.goalsB ?? input.scoreB,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTournamentRunner(qc);
    },
  });
}

/** Generate the bracket (knockout) or the matchday schedule (league). */
export function useGenerateTournamentFixtures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tournamentId: string) => {
      const { data, error } = await supabase().rpc("generate_tournament_fixtures", {
        p_tournament_id: tournamentId,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      invalidateTournamentRunner(qc);
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
        .select("*, venues(name, rental_cost)")
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
      const { error } = await supabase().rpc("save_venue_rental", {
        p_id: id ?? null,
        p_venue_id: rental.venue_id ?? null,
        p_customer_name: rental.customer_name,
        p_customer_phone: rental.customer_phone ?? null,
        p_customer_email: rental.customer_email ?? null,
        p_price: rental.price,
        p_hours: rental.hours ?? 1,
        p_rental_date: rental.rental_date,
        p_start_time: rental.start_time,
        p_is_paid: rental.is_paid ?? false,
        p_payment_method: rental.payment_method ?? null,
        p_notes: rental.notes ?? null,
      });
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
    mutationFn: async (schedule: Omit<RecurringSchedule, "id" | "created_at" | "academy_id">) => {
      if (!schedule.name.trim() || schedule.end_date < schedule.start_date) throw new Error("Enter a name and a valid date range");
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
      const { data, error } = await supabase().rpc("generate_recurring_training_sessions", { p_schedule_id: schedule.id });
      if (error) throw error;
      return Number(data ?? 0);
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
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
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
          "*, participants:friendly_game_participants(id, sponsor_participant_id, member_id, role, player_name, is_waitlisted, share_amount, pay_status, joined_at, kickoff_remind_opt_in), rent_payments:friendly_game_rent_payments(amount, member_id, pay_status, created_at), playground:venues(name, country, area, governorate, address, lat, lng, location_link, photos, cover_url)"
        )
        .neq("status", "cancelled")
        .gte("game_date", today)
        .order("game_date")
        .limit(200);
      if (error) throw error;

      const hidden = new Set(blockedIds);
      return ((data ?? []) as any[])
        .filter((g) => !hidden.has(g.creator_id))
        .map((g) => {
          const participants = (g.participants ?? []) as FriendlyGameParticipant[];
          const active = participants.filter((p) => !p.is_waitlisted);
          const waitlisted = participants.filter((p) => p.is_waitlisted);
          return {
            ...g,
            participants,
            participants_count: active.length,
            waitlist_count: waitlisted.length,
            rent_payments: (g.rent_payments ?? []) as FriendlyGameRentPayment[],
          } as FriendlyGameWithDetails;
        });
    },
  });
}

/** All playgrounds (unassigned pool + academy venues) that members can pick for community games. */
export function usePlaygrounds() {
  return useQuery({
    queryKey: queryKeys.poolPlaygrounds,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("venues")
        .select("id, academy_id, name, address, country, governorate, area, lat, lng, location_link, photos, cover_url, capacity, sport_id, school_name, rental_cost, rental_hours, unavailable_slots, working_hours, court_count, created_at")
        .eq("approval_status", "approved")
        .order("name");
      if (error) throw error;
      const { data: labels, error: labelError } = await supabase().rpc("playground_sport_labels");
      if (labelError) console.warn("playground_sport_labels unavailable, sport filter disabled", labelError);
      const sportsByVenue = new Map<string, { id: string; name: string }>(
        (labels ?? []).map((row: { venue_id: string; sport_id: string; sport_name: string }) =>
          [row.venue_id, { id: row.sport_id, name: row.sport_name }]
        )
      );
      return (data ?? []).map((venue) => ({ ...venue, sport: sportsByVenue.get(venue.id) ?? null })) as Venue[];
    },
  });
}

export function useUpcomingGameParticipants(gameId: string | null, memberId: string) {
  return useQuery({
    queryKey: [...queryKeys.myGameParticipants, "roster", memberId, gameId],
    enabled: !!gameId && !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase().from("friendly_game_participants")
        .select("id, player_name, role, is_waitlisted")
        .eq("game_id", gameId!)
        .order("player_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyUpcomingGames(memberId: string) {
  return useQuery({
    queryKey: [...queryKeys.myGameParticipants, "upcoming", memberId],
    enabled: !!memberId,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const { data, error } = await supabase().from("friendly_game_participants")
        .select("id, is_waitlisted, pay_status, game:friendly_games!inner(id, playground_id, creator_id, title, sport, game_date, start_time, status, invite_code, area, location, duration_hours, description, max_players, min_players, lat, lng, is_public, share_price, host_pays, playground:venues(name, country, area, governorate, address, lat, lng, location_link, photos, cover_url))")
        .eq("member_id", memberId)
        .gte("game.game_date", new Date().toISOString().slice(0, 10))
        .in("game.status", ["open", "full"]);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const g = (Array.isArray(row.game) ? row.game[0] : row.game) as any;
        const playground = Array.isArray(g?.playground) ? g.playground[0] ?? null : (g?.playground ?? null);
        return {
          ...row,
          game: {
            ...g,
            playground,
          } as {
            id: string; playground_id: string | null; creator_id: string; title: string; sport: string; game_date: string; start_time: string;
            status: string; invite_code: string | null; area: string | null;
            location: string | null; duration_hours: number; description: string | null; max_players: number;
            min_players: number; lat: number | null; lng: number | null; is_public: boolean;
            share_price: number | null; host_pays: boolean;
            playground: {
              country: string | null; name: string | null; area: string | null; governorate: string | null;
              address: string | null; lat: number | null; lng: number | null; location_link: string | null;
              photos: string[]; cover_url: string | null;
            } | null;
          },
        };
      }).filter(row => row.game).sort((a, b) =>
        (a.game.game_date + a.game.start_time).localeCompare(b.game.game_date + b.game.start_time)
      );
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
        .select(
          "id, game_id, member_id, role, player_name, is_waitlisted, joined_at, share_amount, pay_method, pay_receipt_url, pay_status, kickoff_remind_opt_in"
        )
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
      min_players?: number;
      duration_hours?: number;
      skill_level?: string;
      description?: string;
      is_public?: boolean;
      recurrence?: "weekly" | null;
      gender?: "male" | "female" | "mixed";
      min_age?: number | null;
      max_age?: number | null;
      hostPays?: boolean;
    }) => {
      const { data, error } = await supabase().rpc("create_friendly_game", {
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
        p_min_players: input.min_players ?? 2,
        p_duration_hours: input.duration_hours ?? 1,
        p_skill_level: input.skill_level ?? null,
        p_description: input.description ?? null,
        p_is_public: input.is_public ?? true,
        p_recurrence: input.recurrence ?? null,
        p_gender: input.gender ?? "mixed",
        p_min_age: input.min_age ?? null,
        p_max_age: input.max_age ?? null,
        p_host_pays: input.hostPays ?? false,
      });
      if (error) throw error;
      return data as string;
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
    mutationFn: async (input: {
      gameId: string;
      guests?: {name:string;gender:string;age:string}[];
      inviteCode?: string | null;
      payMethod: "instapay" | "e_wallet" | "kashier" | null;
      payReceiptUrl: string | null;
    }) => {
      const { data, error } = await supabase().rpc("join_game_with_guests", {
        p_guests: input.guests ?? [],
        p_game_id: input.gameId,
        p_invite_code: input.inviteCode ?? null,
        p_pay_method: input.payMethod,
        p_pay_receipt_url: input.payReceiptUrl,
      });
      if (error) throw error;
      // TRUE = placed on the waitlist, FALSE = took a real spot.
      return data as boolean;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

export function usePayGameShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameId: string;
      payMethod: "instapay" | "e_wallet" | "kashier" | null;
      payReceiptUrl: string | null;
    }) => {
      const { error } = await supabase().rpc("pay_game_share", {
        p_game_id: input.gameId,
        p_pay_method: input.payMethod,
        p_pay_receipt_url: input.payReceiptUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

export function usePayRentRemaining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      gameId: string;
      payMethod: "instapay" | "e_wallet" | null;
      payReceiptUrl: string;
    }) => {
      const { data, error } = await supabase().rpc("pay_rent_remaining", {
        p_game_id: input.gameId,
        p_pay_method: input.payMethod,
        p_pay_receipt_url: input.payReceiptUrl,
      });
      if (error) throw error;
      return data as number;
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
      nickname?: string | null;
      gender: "male" | "female";
      birth_date?: string | null;
      phone?: string | null;
    }) => {
      const { data, error } = await supabase().rpc("add_family_member", {
        p_name: input.name,
        p_nickname: input.nickname ?? null,
        p_gender: input.gender ?? null,
        p_birth_date: input.birth_date ?? null,
        p_phone: input.phone ?? null,
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
      nickname?: string | null;
      gender?: string | null;
      birth_date?: string | null;
      phone?: string | null;
    }) => {
      const { error } = await supabase().rpc("update_family_member", {
        p_child_id: input.childId,
        p_name: input.name,
        // Distinct null/undefined semantics: undefined = keep, "" = clear.
        p_nickname: input.nickname === undefined ? null : input.nickname,
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

export function useSetKickoffReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { gameId: string; enabled: boolean }) => {
      const { error } = await supabase().rpc("set_kickoff_reminder", {
        p_game_id: input.gameId,
        p_enabled: input.enabled,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

export function useSetFriendlyGameVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gameId, isPublic }: { gameId: string; isPublic: boolean }) => {
      const { error } = await supabase().rpc("set_friendly_game_visibility", {
        p_game_id: gameId,
        p_is_public: isPublic,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.friendlyGames }),
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

export function useUpdateFriendlyGameMaxPlayers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { gameId: string; maxPlayers: number }) => {
      const { error } = await supabase().rpc(
        "organizer_update_friendly_game_max_players",
        { p_game_id: input.gameId, p_max_players: input.maxPlayers }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

export function useAdminAddGameMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { gameId: string; memberId: string }) => {
      const { error } = await supabase().rpc("admin_add_friendly_game_member", {
        p_game_id: input.gameId,
        p_member_id: input.memberId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-records"] });
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

export function useAdminRemoveGameMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { gameId: string; memberId: string }) => {
      const { error } = await supabase().rpc("admin_remove_friendly_game_member", {
        p_game_id: input.gameId,
        p_member_id: input.memberId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-records"] });
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

// ── Contact messages (platform inbox) ───────────────────────

export function useContactMessages(limit = 200) {
  return useQuery({
    queryKey: [...queryKeys.contactMessages, limit],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as ContactMessage[];
    },
  });
}

export function useUnreadContactCount() {
  return useQuery({
    queryKey: [...queryKeys.contactMessages, "unread"],
    queryFn: async () => {
      const { count, error } = await supabase()
        .from("contact_messages")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkContactRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: string[]) => {
      let query = supabase()
        .from("contact_messages")
        .update({ is_read: true });
      if (ids && ids.length > 0) {
        query = query.in("id", ids);
      } else {
        query = query.eq("is_read", false);
      }
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.contactMessages });
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

// ── Super admin: game share-payment review ─────────────────

export function usePendingGamePayments() {
  return useQuery({
    queryKey: ["pending-game-payments"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("friendly_game_participants")
        .select(
          "id, game_id, member_id, share_amount, pay_method, pay_receipt_url, pay_status, game:friendly_games(title, sport, game_date, start_time)"
        )
        .eq("pay_status", "pending")
        .order("joined_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        id: string;
        game_id: string;
        member_id: string;
        share_amount: number | null;
        pay_method: string | null;
        pay_receipt_url: string | null;
        pay_status: string;
        game:
          | {
              title: string | null;
              sport: string | null;
              game_date: string | null;
              start_time: string | null;
            }
          | {
              title: string | null;
              sport: string | null;
              game_date: string | null;
              start_time: string | null;
            }[]
          | null;
      }[];
      return rows.map((r) => ({
        ...r,
        game: Array.isArray(r.game) ? (r.game[0] ?? null) : r.game,
      }));
    },
  });
}

export function useReviewParticipantShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      participantId,
      approve,
    }: {
      participantId: string;
      approve: boolean;
    }) => {
      const { error } = await supabase().rpc("review_participant_share", {
        p_participant_id: participantId,
        p_approve: approve,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-game-payments"] });
      qc.invalidateQueries({ queryKey: ["all-game-payments"] });
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

// All friendly-game share payments (pending + approved) for the unified super
// admin payment approvals section.
export function useAllGamePayments() {
  return useQuery({
    queryKey: ["all-game-payments"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("friendly_game_participants")
        .select(
          "id, game_id, member_id, player_name, share_amount, pay_method, pay_receipt_url, pay_status, joined_at, game:friendly_games(title, sport, game_date, start_time)"
        )
        .in("pay_status", ["pending", "approved"])
        .order("joined_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        id: string;
        game_id: string;
        member_id: string;
        player_name: string | null;
        share_amount: number | null;
        pay_method: string | null;
        pay_receipt_url: string | null;
        pay_status: string;
        joined_at: string;
        game:
          | {
              title: string | null;
              sport: string | null;
              game_date: string | null;
              start_time: string | null;
            }
          | {
              title: string | null;
              sport: string | null;
              game_date: string | null;
              start_time: string | null;
            }[]
          | null;
      }[];
      return rows.map((r) => ({
        ...r,
        game: Array.isArray(r.game) ? (r.game[0] ?? null) : r.game,
      }));
    },
  });
}

export function useReviewRentPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      paymentId,
      approve,
    }: {
      paymentId: string;
      approve: boolean;
    }) => {
      const { error } = await supabase().rpc("review_rent_payment", {
        p_payment_id: paymentId,
        p_approve: approve,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-rent-payments"] });
      qc.invalidateQueries({ queryKey: ["all-rent-payments"] });
      qc.invalidateQueries({ queryKey: queryKeys.friendlyGames });
      qc.invalidateQueries({ queryKey: queryKeys.myGameParticipants });
    },
  });
}

// All court-rent top-up payments (pending + approved + rejected).
export function useAllRentPayments() {
  return useQuery({
    queryKey: ["all-rent-payments"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("friendly_game_rent_payments")
        .select(
          "id, game_id, member_id, amount, pay_method, pay_receipt_url, pay_status, created_at, game:friendly_games(title, sport, game_date, start_time)"
        )
        .in("pay_status", ["pending", "approved", "rejected"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        id: string;
        game_id: string;
        member_id: string;
        amount: number;
        pay_method: string | null;
        pay_receipt_url: string | null;
        pay_status: string;
        created_at: string;
        game:
          | {
              title: string | null;
              sport: string | null;
              game_date: string | null;
              start_time: string | null;
            }
          | {
              title: string | null;
              sport: string | null;
              game_date: string | null;
              start_time: string | null;
            }[]
          | null;
      }[];
      return rows.map((r) => ({
        ...r,
        game: Array.isArray(r.game) ? (r.game[0] ?? null) : r.game,
      }));
    },
  });
}

// Rent remaining paymens awaiting payment review (super admin).
export function usePendingRentPayments() {
  return useQuery({
    queryKey: ["pending-rent-payments"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("friendly_game_rent_payments")
        .select(
          "id, game_id, member_id, amount, pay_method, pay_receipt_url, pay_status, created_at, game:friendly_games(title, sport, game_date, start_time)"
        )
        .eq("pay_status", "pending")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        id: string;
        game_id: string;
        member_id: string;
        amount: number;
        pay_method: string | null;
        pay_receipt_url: string | null;
        pay_status: string;
        created_at: string;
        game:
          | {
              title: string | null;
              sport: string | null;
              game_date: string | null;
              start_time: string | null;
            }
          | {
              title: string | null;
              sport: string | null;
              game_date: string | null;
              start_time: string | null;
            }[]
          | null;
      }[];
      return rows.map((r) => ({
        ...r,
        game: Array.isArray(r.game) ? (r.game[0] ?? null) : r.game,
      }));
    },
  });
}


// ── Broadcast push (super admin) ─────────────
// Returns the number of subscribed devices the push was dispatched to.
export function useSendBroadcast() {
  return useMutation({
    mutationFn: async ({
      title,
      body,
      link,
    }: {
      title: string;
      body?: string;
      link?: string | null;
    }) => {
      const { data, error } = await supabase().rpc("send_broadcast_push", {
        p_title: title,
        p_body: body ?? "",
        p_link: link ?? null,
      });
      if (error) throw error;
      return (data as number | null) ?? 0;
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
      qc.invalidateQueries({ queryKey: ["all-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["all-academies"] });
      qc.invalidateQueries({ queryKey: ["academy"] });
    },
  });
}

// ALL plan subscriptions (pending + verified + rejected) for the super admin
// payment approvals section.
export function useAllSubscriptions() {
  return useQuery({
    queryKey: ["all-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("plan_subscriptions")
        .select("*")
        .in("receipt_status", ["pending", "verified", "rejected"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as PlanSubscription[];
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

export function useCommunitySports() {
  return useQuery({
    queryKey: queryKeys.communitySports,
    queryFn: async () => {
      const { data } = await supabase()
        .from("friendly_games")
        .select("sport")
        .eq("status", "completed")
        .not("sport", "is", null);
      const set = new Set<string>();
      for (const r of data ?? []) {
        const s = (r as { sport?: string }).sport?.trim();
        if (s) set.add(s);
      }
      const ordered = COMMUNITY_SPORTS.filter((c) => set.has(c));
      const extra = [...set]
        .filter((s) => !COMMUNITY_SPORTS.includes(s as (typeof COMMUNITY_SPORTS)[number]))
        .sort();
      return [...ordered, ...extra];
    },
  });
}

export function useSportLeaderboard(sport: string) {
  return useQuery({
    queryKey: queryKeys.sportLeaderboard(sport),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("sport_leaderboard")
        .select("member_id, name, username, sport, games_played, points, rank")
        .eq("sport", sport)
        .order("rank")
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SportLeaderboardRow[];
    },
    enabled: !!sport,
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

export function useRequestGamePlayers() {
  return useMutation({
    mutationFn: async (gameId: string) => {
      const { data, error } = await supabase().rpc("request_game_players", { p_game_id: gameId });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}
