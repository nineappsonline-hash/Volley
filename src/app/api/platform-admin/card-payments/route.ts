import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifiedCardTransaction } from "@/lib/payments/reconcile";
import { kashierConfig } from "@/lib/payments/kashier";

export const maxDuration = 60;

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("refresh") }),
  z.object({ action: z.literal("review"), orderId: z.string().uuid(), approve: z.boolean() }),
]);

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const client = createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { data: allowed, error: accessError } = await client.rpc("is_super_admin");
  if (accessError || !allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment action" }, { status: 400 });
  try {
    const db = createAdminClient();
    if (parsed.data.action === "review") {
      const { error } = await db.rpc("review_card_payment", { p_order: parsed.data.orderId, p_actor: user.id, p_approve: parsed.data.approve });
      if (error) return NextResponse.json({ error: "Could not review this payment. Refresh and try again." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    const { data: orders, error } = await db.from("kashier_orders")
      .select("id,session_id,mode,amount,currency")
      .eq("status", "pending").eq("mode", kashierConfig().mode)
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    let confirmed = 0, unavailable = 0, stillPending = 0;
    // Bound each batch and concurrency. No charge/capture/refund API is called.
    for (let i = 0; i < (orders ?? []).length; i += 4) {
      await Promise.all((orders ?? []).slice(i, i + 4).map(async order => {
        try {
          const transaction = await verifiedCardTransaction(order);
          if (!transaction) { stillPending++; return; }
          const result = await db.rpc("settle_kashier_order", { p_order: order.id, p_transaction: transaction, p_amount: order.amount, p_currency: order.currency });
          if (result.error) throw result.error;
          confirmed++;
        } catch (error) { unavailable++; console.warn("Kashier order reconciliation needs attention", { orderId: order.id, error: error instanceof Error ? error.message : String(error) }); }
      }));
    }
    return NextResponse.json({ ok: true, checked: (orders ?? []).length, confirmed, stillPending, unavailable });
  } catch {
    return NextResponse.json({ error: "Could not refresh card payments. Try again later." }, { status: 503 });
  }
}
