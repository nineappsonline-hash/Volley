import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { kashierConfig } from "@/lib/payments/kashier";
import { verifiedCardTransaction } from "@/lib/payments/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron supplies Authorization: Bearer <CRON_SECRET>.
// Fail closed if the secret has not been configured.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = createAdminClient();
    const mode = kashierConfig().mode;
    const { count, error: countError } = await db.from("kashier_orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending").eq("mode", mode);
    if (countError) throw countError;
    // Rotate through pages so a long-lived pending checkout cannot starve
    // older payments of periodic reconciliation.
    const pageCount = Math.max(1, Math.ceil((count ?? 0) / 24));
    const page = Math.floor(Date.now() / 3_600_000) % pageCount;
    const offset = page * 24;
    const { data: orders, error } = await db.from("kashier_orders")
      .select("id,session_id,mode,amount,currency")
      .eq("status", "pending").eq("mode", mode)
      .order("created_at", { ascending: false }).range(offset, offset + 23);
    if (error) throw error;
    let confirmed = 0, unverified = 0, errors = 0;
    for (let i = 0; i < (orders ?? []).length; i += 4) {
      await Promise.all((orders ?? []).slice(i, i + 4).map(async order => {
        try {
          const transaction = await verifiedCardTransaction(order);
          if (!transaction) { unverified++; return; }
          const { error: settleError } = await db.rpc("settle_kashier_order", {
            p_order: order.id, p_transaction: transaction, p_amount: order.amount, p_currency: order.currency
          });
          if (settleError) throw settleError;
          confirmed++;
        } catch (error) {
          errors++;
          console.error("Kashier cron reconciliation", { orderId: order.id, error: error instanceof Error ? error.message : String(error) });
        }
      }));
    }
    console.info("Kashier reconciliation completed", { checked: orders?.length ?? 0, confirmed, unverified, errors });
    return NextResponse.json({ checked: orders?.length ?? 0, confirmed, unverified, errors });
  } catch (error) {
    console.error("Kashier reconciliation failed", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 503 });
  }
}
