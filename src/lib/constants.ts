export const CURRENCY = "EGP";
export const DEFAULT_SUBSCRIPTION_SESSIONS = 8;

// Membership plans: full = 8 sessions, half = 4 sessions (per payment cycle).
export const MEMBERSHIP_SESSIONS: Record<"full" | "half", number> = {
  full: 8,
  half: 4,
};

export function sessionsForMembership(type: "full" | "half"): number {
  return MEMBERSHIP_SESSIONS[type] ?? DEFAULT_SUBSCRIPTION_SESSIONS;
}

export function formatMoney(
  amount: number,
  lang: "en" | "ar" = "en"
): string {
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${CURRENCY} ${amount.toFixed(2)}`;
  }
}

export function formatMoneyShort(amount: number, lang: "en" | "ar" = "en"): string {
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: CURRENCY,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${CURRENCY} ${Math.round(amount)}`;
  }
}
