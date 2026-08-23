"use client";

/** Fire-and-forget email trigger. Errors are logged but don't block the UI. */
export async function triggerEmail(
  type: "payment" | "renewal" | "welcome",
  memberId: string,
  data?: { amount?: number; sessions?: number; remaining?: number }
) {
  try {
    await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, member_id: memberId, ...data }),
    });
  } catch (err) {
    console.error("[email-trigger] failed", err);
  }
}
