import { getBillablePlayers, getPlayerFee } from "@/lib/constants";

/**
 * The court rent still outstanding for a friendly game. Remaining = full rent
 * (hourly rate × duration) minus the rent portions covered by shares that have
 * been submitted (pending or approved, non-waitlisted) and minus any approved
 * or pending rent top-ups. Host-paid games have nothing remaining.
 */
export function gameRentRemaining(game: {
  sport: string;
  min_players: number;
  duration_hours?: number;
  playground_hourly_rate?: number | null;
  host_pays?: boolean;
  participants?: { is_waitlisted?: boolean; pay_status?: string | null }[];
  rent_payments?: { amount: number; pay_status?: string | null }[];
}): number {
  if (game.host_pays) return 0;
  const rate = game.playground_hourly_rate;
  if (rate == null || rate < 0 || !Number.isFinite(rate)) return 0;
  const hours = game.duration_hours ?? 1;
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  const billable = getBillablePlayers(game.sport, game.min_players);
  const rent = rate * hours;
  const share = rent / billable;
  const paidShares = (game.participants ?? []).filter(
    (p) =>
      !p.is_waitlisted &&
      (p.pay_status === "pending" || p.pay_status === "approved"),
  ).length;
  const topups = (game.rent_payments ?? [])
    .filter((p) => p.pay_status === "pending" || p.pay_status === "approved")
    .reduce((sum, p) => sum + p.amount, 0);
  const remaining = rent - paidShares * share - topups;
  if (remaining <= 0) return 0;
  return Math.round(Math.min(remaining, rent) * 100) / 100;
}

/**
 * Per-player price for a friendly game, folded into a single number:
 * playground portion (rental × hours ÷ billable players) plus the per-player
 * fee for the sport. The billable headcount is fixed per sport
 * (Football/Volleyball 10, Padel 4) even if the minimum players are changed.
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
  const fee = getPlayerFee(sport);
  const total = Math.round((rent + fee) * 100) / 100;
  return { rent, fee, total };
}
/** Booking deposit is half the court rent; pending receipts are not paid funds. */
export function gameBookingPayment(game: {
  sport: string; min_players: number; playground_hourly_rate?: number | null;
  duration_hours?: number; host_pays?: boolean; status?: string;
  participants?: { role?: string; is_waitlisted?: boolean; pay_status?: string | null; share_amount?: number | null }[];
  rent_payments?: { amount: number; pay_status?: string | null }[];
}) {
  const rate = game.playground_hourly_rate;
  const hours = game.duration_hours ?? 1;
  if (rate == null || !Number.isFinite(rate) || rate < 0 || !Number.isFinite(hours) || hours <= 0) return null;
  const cents = (amount: number) => Math.round(amount * 100);
  const total = cents(rate * hours);
  const share = Math.round(total / getBillablePlayers(game.sport, game.min_players));
  const fee = cents(getPlayerFee(game.sport));
  let paid = 0, pending = 0;
  for (const participant of game.participants ?? []) {
    if (participant.is_waitlisted) continue;
    if (game.host_pays && participant.role !== 'organizer') continue;
    const maximum = game.host_pays ? total : share;
    const amount = participant.share_amount == null ? maximum : Math.min(maximum, Math.max(0, cents(participant.share_amount) - fee));
    if (!Number.isFinite(amount)) continue;
    if (participant.pay_status === 'approved') paid += amount;
    if (participant.pay_status === 'pending') pending += amount;
  }
  for (const payment of game.rent_payments ?? []) {
    if (!Number.isFinite(payment.amount) || payment.amount <= 0) continue;
    if (payment.pay_status === 'approved') paid += cents(payment.amount);
    if (payment.pay_status === 'pending') pending += cents(payment.amount);
  }
  paid = Math.min(total, paid);
  const threshold = Math.ceil(total / 2);
  return {
    confirmed: game.status !== 'cancelled' && paid >= threshold,
    total: total / 100, paid: paid / 100,
    remaining: Math.max(0, total - paid) / 100,
    depositRemaining: Math.max(0, threshold - paid) / 100,
    pending: Math.min(total - paid, pending) / 100,
  };
}
