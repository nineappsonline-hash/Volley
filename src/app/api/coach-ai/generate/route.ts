import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveStaffScope } from "@/lib/coach-ai/permissions";
import { generateTrainingPlan } from "@/lib/coach-ai/service";
import { isEnterpriseAcademy, PLAN_REQUIRED_MESSAGE } from "@/lib/coach-ai/plan-gate";
import { logAiUsage } from "@/lib/ai/usage";

const body = z
  .object({
    teamId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    sport: z.string().min(1).max(60),
    sessionDurationMin: z.number().min(5).max(360).optional(),
    numPlayers: z.number().min(1).max(40).optional(),
    numCoaches: z.number().min(1).max(12).optional(),
    ageGroup: z.string().max(60).optional(),
    skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    gender: z.enum(["male", "female", "mixed", "all"]).optional(),
    equipment: z.array(z.string().max(60)).optional(),
    space: z.string().max(120).optional(),
    intensityTheme: z.enum(["light", "moderate", "intense"]).optional(),
    mainObjective: z.string().max(300).optional(),
    secondaryObjectives: z.array(z.string().max(160)).max(5).optional(),
    skillFocus: z.array(z.string().max(60)).max(8).optional(),
    notes: z.string().max(600).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const scope = await resolveStaffScope(supabase);

    // AI training-session generation is an Enterprise (elite) feature.
    if (!(await isEnterpriseAcademy(supabase))) {
      return NextResponse.json({ error: PLAN_REQUIRED_MESSAGE, code: "plan_required" }, { status: 402 });
    }

    const parsed = body.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const d = parsed.data;

    // Coach team-scoping: only allow their own teams.
    if (!scope.isAdmin && d.teamId && !scope.teamIds.includes(d.teamId)) {
      return NextResponse.json({ error: "Team not in your roster" }, { status: 403 });
    }

    const result = await generateTrainingPlan({
      sport: d.sport,
      session_duration_min: d.sessionDurationMin,
      num_players: d.numPlayers,
      num_coaches: d.numCoaches,
      age_group: d.ageGroup,
      skill_level: d.skillLevel,
      gender: d.gender,
      equipment: d.equipment,
      space: d.space,
      intensity_theme: d.intensityTheme,
      main_objective: d.mainObjective,
      secondary_objectives: d.secondaryObjectives,
      skill_focus: d.skillFocus,
      notes: d.notes,
      team_id: d.teamId,
      coach_name: scope.userId,
    });

    await logAiUsage({ feature: "plan_generate", result: { provider: result.provider ?? null, model: result.model ?? null, promptTokens: 0, completionTokens: 0, latencyMs: 0 }, estimatedCost: result.estimated_cost, success: true });

    return NextResponse.json({ plan: result.plan, meta: { provider: result.provider, model: result.model, estimated_cost: result.estimated_cost, fallback: result.fallback } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate plan";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 });
  }
}