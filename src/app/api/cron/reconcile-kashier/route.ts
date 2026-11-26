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
    const { data: orders, error } = await db.from("kashier_orders")
      .select("id,session_id,mode,amount,currency")
      .eq("status", "pending").eq("mode", kashierConfig().mode)
      .order("created_at", { ascending: false }).limit(24);
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
