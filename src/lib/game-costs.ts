import { getPlayerFee } from "@/lib/constants";

/**
 * Per-player price for a friendly game, folded into a single number:
 * playground portion (rental × hours ÷ min players) plus the per-player
 * fee for the sport (Football/Volleyball 20 EGP, Padel 40 EGP).
 */
export function estimateSharePrice(
  rate: number | null | undefined,
  hours: number,
  min: number,
  sport: string,
): { rent: number; fee: number; total: number } | null {
  if (
    rate == null ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    !Number.isFinite(hours) ||
    hours <= 0 ||
    hours > 24 ||
    !Number.isInteger(min) ||
    min < 2
  ) {
    return null;
  }
  const rent = Math.round(((rate * hours) / min) * 100) / 100;
  const fee = getPlayerFee(sport);
  const total = Math.round((rent + fee) * 100) / 100;
  return { rent, fee, total };
}

/**
 * Total price a host pays to cover the whole reservation: the venue rental for
 * the slot plus the per-player fee for the sport. Players then join for free.
 */
export function estimateHostTotal(
  rate: number | null | undefined,
  hours: number,
  sport: string,
): { rent: number; fee: number; total: number } | null {
  if (
    rate == null ||
    !Number.isFinite(rate) ||
    rate < 0 ||
    !Number.isFinite(hours) ||
    hours <= 0 ||
    hours > 24
  ) {
    return null;
  }
  const rent = Math.round(rate * hours * 100) / 100;
  const fee = getPlayerFee(sport);
  const total = Math.round((rent + fee) * 100) / 100;
  return { rent, fee, total };
}