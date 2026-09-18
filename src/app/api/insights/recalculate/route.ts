import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Triggers the rules-based recalculation for the caller's academy.
 * Runs the SECURITY DEFINER RPC so the whole academy snapshot is recomputed.
 */
export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase.rpc("recalculate_academy_insights");
    if (error) {
      // Surface access-control errors distinctly.
      if (error.code === "42501" || error.message?.includes("Only academy staff")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...(data ?? {}) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Recalculation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}