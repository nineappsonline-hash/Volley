import { GAME_PLATFORM_FEE } from "@/lib/constants";

/**
 * Per-player price for a friendly game, folded into a single number:
 * playground portion (rental × hours ÷ min players) plus the hidden platform
 * fee. The 20 EGP fee is intentionally NOT shown separately to members.
 */
export function estimateSharePrice(
  rate: number | null | undefined,
  hours: number,
  min: number
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
  const total = Math.round((rent + GAME_PLATFORM_FEE) * 100) / 100;
  return { rent, fee: GAME_PLATFORM_FEE, total };
}

/**
 * Total price a host pays to cover the whole reservation: the venue rental for
 * the slot plus the hidden platform fee. Players then join for free.
 */
export function estimateHostTotal(
  rate: number | null | undefined,
  hours: number
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
  const total = Math.round((rent + GAME_PLATFORM_FEE) * 100) / 100;
  return { rent, fee: GAME_PLATFORM_FEE, total };
}