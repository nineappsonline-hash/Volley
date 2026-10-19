/** Shared rules for onboarding and the academy pricing editor. Zero means free. */
export function parseAcademyPrices(sessions: string, monthly: string, tryout: string) {
  const count = sessions.trim() === "" ? null : Number(sessions);
  const price = monthly.trim() === "" ? null : Number(monthly);
  const trial = tryout.trim() === "" ? null : Number(tryout);
  if ((count == null) !== (price == null) || (count != null && (!Number.isInteger(count) || count < 1 || count > 100))
    || [price, trial].some(n => n != null && (!Number.isFinite(n) || n < 0 || n >= 100000000))) {
    throw new Error("invalid-academy-prices");
  }
  return { monthly_sessions: count, monthly_price: price, tryout_price: trial };
}
