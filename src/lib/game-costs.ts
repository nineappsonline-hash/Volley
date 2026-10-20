import { getBillablePlayers, getPlayerFee } from "@/lib/constants";

/** Saved customer totals drive confirmation; original rates stay on the server. */
export type BookingPaymentGame = {
  sport: string; min_players: number; share_price?: number | null; host_total?: number | null;
  booking_total?: number | null; duration_hours?: number; playground_hourly_rate?: number | null;
  host_pays?: boolean; status?: string;
  participants?: { role?: string; is_waitlisted?: boolean; pay_status?: string | null; share_amount?: number | null }[];
  rent_payments?: { amount: number; pay_status?: string | null }[];
};
export function gameRentRemaining(game: BookingPaymentGame): number {
  return gameBookingPayment(game)?.remaining ?? 0;
}

/**
 * Per-player price for a friendly game, folded into a single number:
 * playground portion (rental × hours ÷ billable players) plus the per-player
 * fee for the sport. The billable headcount is fixed per sport
 * (Tennis/Padel 2, Volleyball 10, Beach Volleyball 8) even if the minimum players are changed.
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
  const players = getBillablePlayers(sport, min);
  const rent = Math.round(((rate * hours) / players) * 100) / 100;
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
  const fee = getPlayerFee(sport) * (["tennis","padel","basketball","volleyball","beach volleyball"].includes(sport.trim().toLowerCase()) ? getBillablePlayers(sport, 2) : 1);
  const total = Math.round((rent + fee) * 100) / 100;
  return { rent, fee, total };
}
/** Only approved funds count toward full prepayment. Saved historical prices remain authoritative. */
export function gameBookingPayment(game: BookingPaymentGame) {
  const saved = game.host_pays ? game.host_total : game.share_price;
  const minimum = getBillablePlayers(game.sport, Math.max(2, game.min_players || 2));
  const fallback = game.host_pays
    ? estimateHostTotal(game.playground_hourly_rate, game.duration_hours ?? 1, game.sport)?.total
    : estimateSharePrice(game.playground_hourly_rate, game.duration_hours ?? 1, minimum, game.sport)?.total;
  const perPlayer = saved ?? fallback;
  const total = game.booking_total ?? (perPlayer == null ? null : game.host_pays ? perPlayer : perPlayer * minimum);
  if (total == null || !Number.isFinite(total) || total < 0 || perPlayer == null) return null;
  const cents = (n: number) => Math.round(n * 100);
  const basis = cents(total), charge = cents(perPlayer);
  let paid = 0, pending = 0;
  for (const p of game.participants ?? []) {
    if (p.is_waitlisted || (game.host_pays && p.role !== 'organizer')) continue;
    const credit = Math.min(charge, Math.max(0, cents(p.share_amount ?? perPlayer)));
    if (!Number.isFinite(credit)) continue;
    if (p.pay_status === 'approved') paid += credit;
    if (p.pay_status === 'pending') pending += credit;
  }
  for (const p of game.rent_payments ?? []) {
    if (!Number.isFinite(p.amount) || p.amount <= 0) continue;
    if (p.pay_status === 'approved') paid += cents(p.amount);
    if (p.pay_status === 'pending') pending += cents(p.amount);
  }
  paid = Math.min(basis, paid); pending = Math.min(Math.max(0, basis - paid), pending);
  return { confirmed: game.status !== 'cancelled' && paid >= basis, total: basis / 100, paid: paid / 100,
    remaining: Math.max(0, basis - paid) / 100, pending: pending / 100,
    depositPercentage: 100, depositPaid: paid / 100, depositPending: pending / 100,
    depositRemaining: Math.max(0, basis - paid) / 100 };
}
