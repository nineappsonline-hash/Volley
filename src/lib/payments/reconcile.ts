import { amountInPiastres, kashierConfig, kashierRequest } from "./kashier";

export type CardOrder = { id: string; session_id: string | null; mode: string; amount: number | string; currency: string };
const successful = /^(PAID|SUCCESS|SUCCEEDED|CAPTURED|APPROVED)$/i;

// A captured gateway payment is required. A redirect, authorization, or
// "pending" payment is never sufficient evidence of collected funds.
export async function verifiedCardTransaction(order: CardOrder): Promise<string | null> {
  const config = kashierConfig();
  if (order.mode !== config.mode) return null;
  if (order.session_id) {
    try {
      const response: any = await kashierRequest(`/v3/payment/sessions/${encodeURIComponent(order.session_id)}/payment`, undefined, { timeoutMs: 7000 });
      const session = response?.data ?? response;
      const params = session?.paymentParams ?? session;
      if (String(session?.merchantId) !== config.merchantId ||
          String(params?.merchantOrderId ?? params?.order) !== order.id ||
          params?.currency !== order.currency ||
          amountInPiastres(params?.amount) !== amountInPiastres(order.amount)) {
        throw new Error("Payment verification mismatch");
      }
      if (!successful.test(String(session?.status ?? ""))) return null;
      const transaction = session.transactionId ?? session.lastTransactionId ??
        session.history?.find((h: any) => successful.test(String(h?.status)) && h?.transactionId)?.transactionId;
      if (typeof transaction === "string" && transaction.trim()) return transaction;
    } catch (error) {
      // A second merchant-authenticated lookup by the exact order reference
      // covers hosted-checkout fallbacks and unavailable session endpoints.
      if (error instanceof Error && error.message === "Payment verification mismatch") throw error;
    }
  }

  // Kashier's order lookup also works for legacy signed hosted checkouts,
  // which have no session_id. The search is partial, so require exact ID.
  const response: any = await kashierRequest(
    `/v3/payment/orders?search=${encodeURIComponent(order.id)}&limit=20`,
    undefined, { timeoutMs: 8000 }
  );
  const rows = response?.data;
  if (!Array.isArray(rows)) throw new Error("Unexpected Kashier order lookup response");
  const matching = rows.filter((r: any) => r?.merchantOrderId === order.id);
  if (matching.length !== 1) return null;
  const gatewayOrder = matching[0];
  if (String(gatewayOrder.status).toUpperCase() !== "CAPTURED") return null;
  const paidTransactions = (Array.isArray(gatewayOrder.transactions) ? gatewayOrder.transactions : []).filter((tx: any) =>
    /^(pay|capture)$/i.test(String(tx?.operation ?? "")) &&
    successful.test(String(tx?.status ?? "")) &&
    /^(00|0|APPROVED)$/i.test(String(tx?.transactionResponseCode ?? "")) &&
    typeof tx?.transactionId === "string" && tx.transactionId.trim()
  );
  if (paidTransactions.length !== 1) return null;
  const transactionId = paidTransactions[0].transactionId as string;
  // Verify the captured transaction's exact order, amount and currency.
  const details: any = await kashierRequest(
    `/v2/aggregator/transactions/${encodeURIComponent(transactionId)}`, undefined, { timeoutMs: 8000 }
  );
  const tx = details?.body ?? details?.data ?? details;
  const reference = tx?.merchantOrderId ?? tx?.order?.orderReference;
  if (String(reference) !== order.id ||
      String(tx?.currency) !== order.currency ||
      !successful.test(String(tx?.status ?? tx?.paymentStatus ?? "")) ||
      tx?.isReversed === true || tx?.isVoided === true) {
    throw new Error("Kashier transaction verification mismatch");
  }
  // Some transaction-detail responses omit amount. The captured amount from
  // the merchant-scoped order reconciliation response is an allowed fallback.
  if (amountInPiastres(tx?.amount ?? tx?.order?.amount ?? gatewayOrder.totalCapturedAmount ?? gatewayOrder.amount) !== amountInPiastres(order.amount)) {
    throw new Error("Kashier transaction amount mismatch");
  }
  return transactionId;
}
