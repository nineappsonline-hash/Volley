import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStaffScope } from "@/lib/coach-ai/permissions";
import { generateDevelopmentPlan } from "@/lib/coach-ai/service";
import { isEnterpriseAcademy, PLAN_REQUIRED_MESSAGE } from "@/lib/coach-ai/plan-gate";
import { logAiUsage } from "@/lib/ai/usage";

const body = z
  .object({
    playerId: z.string().uuid(),
    existing: z
      .object({
        strengths: z.array(z.string().max(200)).optional(),
        areas_to_improve: z.array(z.string().max(200)).optional(),
      })
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const scope = await resolveStaffScope(supabase);

    // Player development plans are an Enterprise (elite) feature.
    if (!(await isEnterpriseAcademy(supabase))) {
      return NextResponse.json({ error: PLAN_REQUIRED_MESSAGE, code: "plan_required" }, { status: 402 });
    }

    const parsed = body.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    // Coaches can only generate plans for players they manage.
    if (!scope.isAdmin && !scope.playerIds.includes(parsed.data.playerId)) {
      return NextResponse.json({ error: "Player not in your roster" }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: player } = await admin
      .from("profiles")
      .select("id, name, academy_id, birth_date, gender, join_date")
      .eq("id", parsed.data.playerId)
      .eq("academy_id", scope.academyId)
      .maybeSingle();

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    // Build a scoped observation history: attendance rate + plan data.
    const { data: attendance } = await admin
      .from("attendance")
      .select("id, is_present, marked_at")
      .eq("member_id", player.id)
      .order("marked_at", { ascending: false })
      .limit(120);

    const present = (attendance ?? []).filter((a) => a.is_present).length;
    const total = (attendance ?? []).length || 1;
    const history = [
      `Attendance rate (last ${total} sessions): ${Math.round((present / total) * 100)}%`,
      `Checked in ${present} of ${total} recorded sessions`,
    ].join("\n");

    const previous = parsed.data.existing;
    const dataBlock = [history];
    if (previous?.strengths?.length) dataBlock.push(`Known strengths: ${previous.strengths.join(", ")}`);
    if (previous?.areas_to_improve?.length) dataBlock.push(`Noted areas: ${previous.areas_to_improve.join(", ")}`);

    const result = await generateDevelopmentPlan({
      playerName: player.name || "Member",
      sport: "Volleyball",
      coachName: "",
      data: dataBlock.join("\n"),
    });

    await logAiUsage({
      feature: "development_plan",
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

    return NextResponse.json({ plan: result.plan, player: { id: player.id, name: player.name } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to generate development plan";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500 });
  }
}