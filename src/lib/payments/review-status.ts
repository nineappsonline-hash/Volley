export type PaymentReviewStatus = "pending" | "approved" | "rejected" | "awaiting_payment" | "review_required";
export function paymentReviewStatus(status: string, method: string | null, order?: { status: string; details?: { admin_review?: string } }): PaymentReviewStatus {
  if (method !== "kashier") return status === "verified" ? "approved" : status as PaymentReviewStatus;
  const decision = order?.details?.admin_review;
  if (decision === "approved" || decision === "rejected") return decision;
  if (order?.status === "review_required") return "review_required";
  if (order?.status === "paid") return "approved";
  if (status === "pending" || status === "unpaid") return "awaiting_payment";
  return status === "verified" ? "approved" : status as PaymentReviewStatus;
}
