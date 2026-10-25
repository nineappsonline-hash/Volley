import { amountInPiastres, kashierConfig, kashierRequest } from "./kashier";

type CardOrder = { id: string; session_id: string | null; mode: string; amount: number | string; currency: string };

// Bind every read to our merchant, order, amount and currency. Redirect flags
// and a session's status alone are never proof that this order was collected.
export async function verifiedCardTransaction(order: CardOrder): Promise<string | null> {
  const config = kashierConfig();
  if (!order.session_id || order.mode !== config.mode) return null;
  let response: any;
  try {
    response = await kashierRequest(`/v3/payment/sessions/${encodeURIComponent(order.session_id)}/payment`, undefined, { timeoutMs: 8000 });
  } catch {
    // Some sessions are unavailable through the merchant read but are retained
    // by the checkout session resource. Both are documented Kashier endpoints.
    response = await kashierRequest(`/v3/payment/sessions/${encodeURIComponent(order.session_id)}`, undefined, { timeoutMs: 8000 });
  }
  const session = response?.data ?? response;
  const params = session?.paymentParams ?? session;
  if (String(session?.merchantId) !== config.merchantId ||
      String(params?.merchantOrderId ?? params?.order) !== order.id ||
      params?.currency !== order.currency ||
      amountInPiastres(params?.amount) !== amountInPiastres(order.amount)) {
    throw new Error("Payment verification mismatch");
  }
  if (!/^(PAID|SUCCESS|SUCCEEDED|CAPTURED|APPROVED)$/i.test(String(session?.status ?? ""))) return null;
  // AUTHORIZED alone is intentionally excluded: capture must have succeeded.
  const transaction = session.transactionId ?? session.lastTransactionId ??
    session.history?.find((h: any) => /^(PAID|SUCCESS|SUCCEEDED|CAPTURED|APPROVED)$/i.test(String(h?.status)) && h?.transactionId)?.transactionId;
  return typeof transaction === "string" && transaction.trim() ? transaction : null;
}
