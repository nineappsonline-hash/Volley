import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const body = z
  .object({
    action: z.enum(["acknowledged", "assigned", "in_progress", "contacted", "resolved", "dismissed", "note"]),
    note: z.string().max(1000).optional(),
    assignTo: z.string().uuid().optional(),
  })
  .strict();

/** Actions center: record an action + transition alert status via RPC. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parsed = body.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const { error } = await supabase.rpc("act_on_alert", {
      p_alert_id: id,
      p_action: parsed.data.action,
      p_note: parsed.data.note ?? null,
      p_assign_to: parsed.data.assignTo ?? null,
    });

    if (error) {
      if (error.code === "42501" || error.message?.includes("Only academy staff") || error.message?.includes("belongs to another academy")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}