export const CURRENCY = "EGP";
export const DEFAULT_SUBSCRIPTION_SESSIONS = 8;

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
