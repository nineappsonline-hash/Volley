"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  AcademyAlert,
  AcademyInsight,
  AiUsageLog,
  AlertAction,
  DashboardPreferences,
  PlayerDevelopmentPlan,
  PostSessionReport,
  PredictionFactor,
  PredictionScore,
  PredictionSettings,
  TrainingPlan,
  TrainingPlanVersion,
} from "@/lib/types";

const supabase = () => createClient();

export const aiQueryKeys = {
  trainingPlans: ["ai-training-plans"] as const,
  trainingPlan: (id: string) => ["ai-training-plans", id] as const,
  trainingPlanSections: (id: string) => ["ai-training-plans", id, "sections"] as const,
  trainingPlanVersions: (id: string) => ["ai-training-plans", id, "versions"] as const,
  devPlans: ["dev-plans"] as const,
  devPlan: (id: string) => ["dev-plans", id] as const,
  reports: ["post-session-reports"] as const,
  usage: ["ai-usage"] as const,
  insights: ["academy-insights"] as const,
  predictionScores: (type?: string) => ["prediction-scores", type ?? "all"] as const,
  predictionFactors: (scoreId: string) => ["prediction-factors", scoreId] as const,
  alerts: (status?: string) => ["alerts", status ?? "all"] as const,
  alertActions: (alertId: string) => ["alert-actions", alertId] as const,
  settings: ["prediction-settings"] as const,
  prefs: ["dashboard-preferences"] as const,
};

// ── AI Coach Assistant ──────────────────────────────────────

export function useTrainingPlans() {
  return useQuery({
    queryKey: aiQueryKeys.trainingPlans,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("ai_training_plans")
        .select("*, sections:ai_training_plan_sections(*)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TrainingPlan[];
    },
  });
}

export function useTrainingPlan(id: string) {
  return useQuery({
    queryKey: aiQueryKeys.trainingPlan(id),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("ai_training_plans")
        .select("*, sections:ai_training_plan_sections(*, exercises:training_exercises(*))")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as TrainingPlan;
    },
    enabled: !!id,
  });
}

export function useTrainingPlanVersions(id: string) {
  return useQuery({
    queryKey: aiQueryKeys.trainingPlanVersions(id),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("training_plan_versions")
        .select("*")
        .eq("plan_id", id)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TrainingPlanVersion[];
    },
    enabled: !!id,
  });
}

export function useSaveTrainingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Record<string, unknown>) => {
      const { data, error } = await supabase().rpc("save_ai_training_plan", {
        p_plan: plan,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiQueryKeys.trainingPlans });
    },
  });
}

export function useSubmitTrainingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().rpc("submit_ai_training_plan", { p_plan_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.trainingPlans }),
  });
}

export function useDecideTrainingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; approved: boolean; reason?: string | null }) => {
      const { error } = await supabase().rpc("decide_ai_training_plan", {
        p_plan_id: input.id,
        p_approved: input.approved,
        p_reason: input.reason ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.trainingPlans }),
  });
}

export function useTogglePlanFlags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; favorite?: boolean; isTemplate?: boolean; templateName?: string | null }) => {
      const { error } = await supabase().rpc("toggle_ai_plan_flags", {
        p_plan_id: input.id,
        p_favorite: input.favorite ?? null,
        p_is_template: input.isTemplate ?? null,
        p_template_name: input.templateName ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.trainingPlans }),
  });
}

export function useDuplicatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase().rpc("duplicate_ai_training_plan", { p_plan_id: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: aiQueryKeys.trainingPlans });
    },
  });
}

export function useArchivePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().rpc("archive_ai_training_plan", { p_plan_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.trainingPlans }),
  });
}

export function useRestorePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase().rpc("restore_ai_training_plan", { p_plan_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.trainingPlans }),
  });
}

export function useAssignPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: string; sessionIds: string[] }) => {
      const { error } = await supabase().rpc("assign_ai_training_plan", {
        p_plan_id: input.planId,
        p_session_ids: input.sessionIds,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.trainingPlans }),
  });
}

export function useUnassignPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: string; sessionId: string }) => {
      const { error } = await supabase().rpc("unassign_ai_training_plan", {
        p_plan_id: input.planId,
        p_session_id: input.sessionId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.trainingPlans }),
  });
}

export function useSavePostSessionReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (report: Record<string, unknown>) => {
      const { data, error } = await supabase().rpc("save_post_session_report", { p_report: report });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.reports }),
  });
}

export function useDevelopmentPlans() {
  return useQuery({
    queryKey: aiQueryKeys.devPlans,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("player_development_plans")
        .select("*, goals:player_development_goals(*)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PlayerDevelopmentPlan[];
    },
  });
}

export function useSaveDevPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Record<string, unknown>) => {
      const { data, error } = await supabase().rpc("save_player_development_plan", { p_plan: plan });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.devPlans }),
  });
}

export function useDecideDevPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; approved: boolean }) => {
      const { error } = await supabase().rpc("decide_player_development_plan", {
        p_plan_id: input.id,
        p_approved: input.approved,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.devPlans }),
  });
}

export function useAiUsage() {
  return useQuery({
    queryKey: aiQueryKeys.usage,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("ai_usage_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AiUsageLog[];
    },
  });
}

// ── Academy Insights ────────────────────────────────────────

export function useAcademyInsights() {
  return useQuery({
    queryKey: aiQueryKeys.insights,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("academy_insights")
        .select("*")
        .order("period_key", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data ?? []) as AcademyInsight[];
    },
  });
}

export function usePredictionScores(type?: string) {
  return useQuery({
    queryKey: aiQueryKeys.predictionScores(type),
    queryFn: async () => {
      let q = supabase().from("prediction_scores").select("*").order("computed_at", { ascending: false });
      if (type) q = q.eq("score_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PredictionScore[];
    },
  });
}

export function usePredictionFactors(scoreId: string) {
  return useQuery({
    queryKey: aiQueryKeys.predictionFactors(scoreId),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("prediction_factors")
        .select("*")
        .eq("score_id", scoreId);
      if (error) throw error;
      return (data ?? []) as PredictionFactor[];
    },
    enabled: !!scoreId,
  });
}

export function useAlerts(activeOnly = false) {
  return useQuery({
    queryKey: aiQueryKeys.alerts(activeOnly ? "active" : "all"),
    queryFn: async () => {
      let q = supabase()
        .from("academy_alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (activeOnly) q = q.not("status", "in", '("resolved","dismissed")');
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AcademyAlert[];
    },
  });
}

export function useAlertActions(alertId: string) {
  return useQuery({
    queryKey: aiQueryKeys.alertActions(alertId),
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("alert_actions")
        .select("*")
        .eq("alert_id", alertId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AlertAction[];
    },
    enabled: !!alertId,
  });
}

export function usePredictionSettings() {
  return useQuery({
    queryKey: aiQueryKeys.settings,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("prediction_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as PredictionSettings | null;
    },
  });
}

export function useSetPredictionSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { thresholds?: Record<string, number>; enabledAlerts?: string[] }) => {
      const { error } = await supabase().rpc("set_prediction_settings", {
        p_thresholds: input.thresholds ?? null,
        p_enabled_alerts: input.enabledAlerts ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.settings }),
  });
}

export function useDashboardPreferences() {
  return useQuery({
    queryKey: aiQueryKeys.prefs,
    queryFn: async () => {
      const { data, error } = await supabase()
        .from("dashboard_preferences")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data as DashboardPreferences | null;
    },
  });
}

export function useSaveDashboardPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { defaultFilters?: Record<string, unknown>; visibleKpis?: string[]; chartPrefs?: Record<string, unknown> }) => {
      const { error } = await supabase().rpc("save_dashboard_preferences", {
        p_default_filters: input.defaultFilters ?? null,
        p_visible_kpis: input.visibleKpis ?? null,
        p_chart_prefs: input.chartPrefs ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: aiQueryKeys.prefs }),
  });
}