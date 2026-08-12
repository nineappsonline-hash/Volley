"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  Attendance,
  MonthlyCost,
  Payment,
  Profile,
  SessionCalculation,
  TrainingSession,
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

export function usePayments(memberId?: string) {
  return useQuery({
    queryKey: queryKeys.payments(memberId),
    queryFn: async () => {
      let q = supabase().from("payments").select("*");
      if (memberId) q = q.eq("member_id", memberId);
      const { data, error } = await q.order("payment_date", {
        ascending: false,
      });
      if (error) throw error;
      return toPayments(data);
    },
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

export function useSavePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: Partial<Payment> & { member_id: string; amount: number; payment_date: string }) => {
      const { error } = await supabase().from("payments").insert(payment);
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
        .upsert(costs, { onConflict: "month,year" });
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
