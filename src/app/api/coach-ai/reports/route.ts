import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveStaffScope } from "@/lib/coach-ai/permissions";
import { generatePostSessionReport } from "@/lib/coach-ai/service";
import { isEnterpriseAcademy, PLAN_REQUIRED_MESSAGE } from "@/lib/coach-ai/plan-gate";
import { logAiUsage } from "@/lib/ai/usage";

const body = z
  .object({
    planId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    notes: z.string().min(1).max(4000),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const scope = await resolveStaffScope(supabase);

    // Post-session reports are an Enterprise (elite) feature.
    if (!(await isEnterpriseAcademy(supabase))) {
      return NextResponse.json({ error: PLAN_REQUIRED_MESSAGE, code: "plan_required" }, { status: 402 });
    }

    const parsed = body.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    let planTitle: string | null = null;
    if (parsed.data.planId) {
      const { data } = await supabase.from("ai_training_plans").select("id, title, academy_id, created_by").eq("id", parsed.data.planId).maybeSingle();
      if (!data || data.academy_id !== scope.academyId) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }
      planTitle = data.title;
    }

    const result = await generatePostSessionReport({ notes: parsed.data.notes, planTitle });

    await logAiUsage({
      feature: "post_session_report",
      result: {
        provider: result.provider ?? null,
        model: result.model ?? null,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs: 0,
      },
      estimatedCost: result.estimated_cost,
      success: true,
    });

    return NextResponse.json({ report: result.report, meta: { provider: result.provider, model: result.model, estimated_cost: result.estimated_cost, fallback: result.fallback } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 });
  }
}