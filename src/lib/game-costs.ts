export function estimateGameCost(rate: number | null | undefined, hours: number, min: number, max: number) {
  if (rate == null || !Number.isFinite(rate) || rate < 0 || !Number.isFinite(hours) || hours <= 0 || hours > 24
    || !Number.isInteger(min) || !Number.isInteger(max) || min < 2 || max < min) return null;
  const total = Math.round(rate * hours * 100) / 100;
  return { total, low: total / max, high: total / min };
}
