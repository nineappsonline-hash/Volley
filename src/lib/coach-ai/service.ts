import { createAdminClient } from "@/lib/supabase/admin";
import { aiConfigured, loadAiConfig, type AiConfig } from "@/lib/ai/config";
import { complete } from "@/lib/ai/client";
import {
  aiTrainingPlanSchema,
  aiDevelopmentPlanSchema,
  aiPostSessionReportSchema,
  parseJsonSafely,
  type AiDevelopmentPlan,
  type AiPostSessionReport,
  type AiTrainingPlan,
} from "@/lib/ai/schemas";
import {
  buildDevPlanPrompt,
  buildPlanPrompt,
  buildReportPrompt,
  estimateCost,
  type SportContext,
} from "@/lib/ai/prompts";
import { generateFallbackDevPlan, generateFallbackPlan, generateFallbackReport } from "@/lib/ai/templates";
import type { TrainingPlan } from "@/lib/types";

/** Context used to generate a plan. Assembled from scoped academy data. */
export interface PlanContext extends SportContext {
  sport: string;
  session_duration_min?: number;
  team_name?: string | null;
  team_id?: string | null;
  coach_name?: string;
  latest_plan?: Partial<TrainingPlan> | null;
}

/**
 * Loads the context block used by both the AI prompt and the fallback
 * template. Requires a manager/coach-scoped request; the supabase admin
 * client is only used to bypass RLS in the same manner as the API route
 * authorizes the caller first.
 */
export async function loadPlanContext(input: {
  academyId: string;
  sportId?: string | null;
  sport: string;
  teamId?: string | null;
  branchId?: string | null;
  sessionDurationMin?: number;
  numPlayers?: number;
  numCoaches?: number;
  ageGroup?: string | null;
  skillLevel?: string | null;
  gender?: string | null;
  equipment?: string[];
  space?: string | null;
  intensityTheme?: "light" | "moderate" | "intense";
  mainObjective?: string | null;
  secondaryObjectives?: string[];
  skillFocus?: string[];
  notes?: string | null;
  coachName?: string;
}): Promise<PlanContext> {
  const admin = createAdminClient();

  let latestPlan: Partial<TrainingPlan> | null = null;
  if (input.teamId) {
    const { data } = await admin
      .from("ai_training_plans")
      .select("id, title, sections(ai_training_plan_sections(id, title, skill_focus))")
      .eq("team_id", input.teamId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) latestPlan = data as unknown as Partial<TrainingPlan>;
  }

  return {
    sport: input.sport,
    team_id: input.teamId ?? null,
    session_duration_min: input.sessionDurationMin,
    num_players: input.numPlayers,
    num_coaches: input.numCoaches,
    age_group: input.ageGroup,
    skill_level: input.skillLevel,
    gender: input.gender,
    equipment: input.equipment ?? [],
    space: input.space,
    intensity_theme: input.intensityTheme,
    main_objective: input.mainObjective,
    secondary_objectives: input.secondaryObjectives,
    skill_focus: input.skillFocus,
    notes: input.notes,
    coach_name: input.coachName,
    previous_plan_title: latestPlan?.title ?? null,
    previous_sections: latestPlan?.sections?.map((s) => ({ title: s.title, skill_focus: s.skill_focus })) ?? [],
  };
}

export interface GeneratePlanResult {
  plan: AiTrainingPlan;
  provider: string | null;
  model: string | null;
  estimated_cost: number;
  fallback: boolean;
}

/** Generates a fresh training plan (AI if configured, else deterministic). */
export async function generateTrainingPlan(ctx: PlanContext): Promise<GeneratePlanResult> {
  const cfg: AiConfig = loadAiConfig();

  if (!aiConfigured(cfg)) {
    const plan = generateFallbackPlan({
      sport: ctx.sport,
      session_duration_min: ctx.session_duration_min,
      num_players: ctx.num_players,
      main_objective: ctx.main_objective,
      skill_level: ctx.skill_level,
      age_group: ctx.age_group,
      intensity_theme: ctx.intensity_theme,
    });
    return { plan, provider: null, model: null, estimated_cost: 0, fallback: true };
  }

  const { system, user } = buildPlanPrompt(ctx);
  const result = await complete([{ role: "system", content: system }, { role: "user", content: user }], { cfg });
  try {
    const plan = parseJsonSafely(result.text, aiTrainingPlanSchema);
    return {
      plan,
      provider: result.provider,
      model: result.model,
      estimated_cost: estimateCost(cfg, result.promptTokens, result.completionTokens),
      fallback: false,
    };
  } catch {
    // Structured output failed — degrade to template but keep provider info.
    const plan = generateFallbackPlan({
      sport: ctx.sport,
      session_duration_min: ctx.session_duration_min,
      num_players: ctx.num_players,
      main_objective: ctx.main_objective,
      skill_level: ctx.skill_level,
      age_group: ctx.age_group,
      intensity_theme: ctx.intensity_theme,
    });
    return {
      plan,
      provider: result.provider,
      model: result.model,
      estimated_cost: estimateCost(cfg, result.promptTokens, result.completionTokens),
      fallback: true,
    };
  }
}

export interface GenerateDevPlanResult {
  plan: AiDevelopmentPlan;
  provider: string | null;
  model: string | null;
  estimated_cost: number;
  fallback: boolean;
}

/** Generates a player development plan. */
export async function generateDevelopmentPlan(input: {
  playerName: string;
  sport: string;
  coachName: string;
  data: string;
  previousPlan?: string | null;
}): Promise<GenerateDevPlanResult> {
  const cfg = loadAiConfig();

  if (!aiConfigured(cfg) || !input.data.trim()) {
    // Without observed data we must NOT fabricate a personalized plan.
    const plan = generateFallbackDevPlan({ player_name: input.playerName, sport: input.sport });
    return { plan, provider: null, model: null, estimated_cost: 0, fallback: true };
  }

  const { system, user } = buildDevPlanPrompt(input);
  const result = await complete([{ role: "system", content: system }, { role: "user", content: user }], { cfg });
  try {
    const plan = parseJsonSafely(result.text, aiDevelopmentPlanSchema);
    return {
      plan,
      provider: result.provider,
      model: result.model,
      estimated_cost: estimateCost(cfg, result.promptTokens, result.completionTokens),
      fallback: false,
    };
  } catch {
    const plan = generateFallbackDevPlan({ player_name: input.playerName, sport: input.sport });
    return {
      plan,
      provider: result.provider,
      model: result.model,
      estimated_cost: estimateCost(cfg, result.promptTokens, result.completionTokens),
      fallback: true,
    };
  }
}

export interface GenerateReportResult {
  report: AiPostSessionReport;
  provider: string | null;
  model: string | null;
  estimated_cost: number;
  fallback: boolean;
}

/** Structures a coach's post-session notes into a report. */
export async function generatePostSessionReport(input: { notes: string; planTitle?: string | null }): Promise<GenerateReportResult> {
  const cfg = loadAiConfig();

  if (!aiConfigured(cfg)) {
    const r = generateFallbackReport(input.notes);
    return { report: r, provider: null, model: null, estimated_cost: 0, fallback: true };
  }

  const { system, user } = buildReportPrompt(input.notes, input.planTitle);
  const result = await complete([{ role: "system", content: system }, { role: "user", content: user }], { cfg });
  const base = { provider: result.provider, model: result.model, estimated_cost: estimateCost(cfg, result.promptTokens, result.completionTokens) };
  try {
    const report = parseJsonSafely(result.text, aiPostSessionReportSchema);
    return { report, ...base, fallback: false };
  } catch {
    const r = generateFallbackReport(input.notes);
    return { report: r, ...base, fallback: true };
  }
}