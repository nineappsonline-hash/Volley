import { getBillablePlayers, getPlayerFee } from "@/lib/constants";

/**
 * The balance still owed for a friendly game, measured on the same basis the
 * booking deposit uses: the total the minimum required players owe, i.e.
 * min_players × per-player price (which already includes the per-player fee),
 * minus what has already been paid. Host-paid games have nothing remaining.
 */
export function gameRentRemaining(game: {
  sport: string;
  min_players: number;
  duration_hours?: number;
  playground_hourly_rate?: number | null;
  host_pays?: boolean;
  participants?: { is_waitlisted?: boolean; pay_status?: string | null; share_amount?: number | null }[];
  rent_payments?: { amount: number; pay_status?: string | null }[];
}): number {
  if (game.host_pays) return 0;
  const rate = game.playground_hourly_rate;
  if (rate == null || rate < 0 || !Number.isFinite(rate)) return 0;
  const hours = game.duration_hours ?? 1;
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  const cents = (amount: number) => Math.round(amount * 100);
  const total = cents(rate * hours);
  const fee = cents(getPlayerFee(game.sport));
  const minPlayers = Math.max(2, Math.round(game.min_players || 0));
  const perPlayer = Math.round(total / minPlayers) + fee;
  const basis = minPlayers * perPlayer;
  let paid = 0;
  for (const participant of game.participants ?? []) {
    if (participant.is_waitlisted) continue;
    const credit = Math.min(perPlayer, Math.max(0, participant.share_amount == null ? perPlayer : cents(participant.share_amount)));
    if (!Number.isFinite(credit)) continue;
    if (participant.pay_status === 'approved') paid += credit;
  }
  for (const topup of game.rent_payments ?? []) {
    if (!Number.isFinite(topup.amount) || topup.amount <= 0) continue;
    if (topup.pay_status === 'approved') paid += cents(topup.amount);
  }
  const remaining = basis - paid;
  if (remaining <= 0) return 0;
  return Math.round(Math.min(remaining, basis)) / 100;
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
/**
 * Booking deposit for a friendly game: the game is confirmed once half of what
 * the minimum required players owe has been paid. The basis is min_players ×
 * per-player price (the per-player price already includes the per-player fee),
 * so everything — the approved total, the deposit and the balance still owed —
 * is measured on the players' side rather than the court cost. Pending
 * receipts are not paid funds.
 */
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
  const fee = cents(getPlayerFee(game.sport));
  const minPlayers = Math.max(2, Math.round(game.min_players || 0));

  // The full (rent share + fee) price one player is expected to pay; a
  // host-paid game is a single organizer covering rent plus the fee.
  const perPlayer = game.host_pays ? total + fee : Math.round(total / minPlayers) + fee;
  const basis = (game.host_pays ? 1 : minPlayers) * perPlayer;
  const depositTarget = Math.ceil(basis / 2);

  let paid = 0, pending = 0;
  for (const participant of game.participants ?? []) {
    if (participant.is_waitlisted) continue;
    if (game.host_pays && participant.role !== 'organizer') continue;
    const credit = Math.min(perPlayer, Math.max(0, participant.share_amount == null ? perPlayer : cents(participant.share_amount)));
    if (!Number.isFinite(credit)) continue;
    if (participant.pay_status === 'approved') paid += credit;
    if (participant.pay_status === 'pending') pending += credit;
  }
  for (const payment of game.rent_payments ?? []) {
    if (!Number.isFinite(payment.amount) || payment.amount <= 0) continue;
    if (payment.pay_status === 'approved') paid += cents(payment.amount);
    if (payment.pay_status === 'pending') pending += cents(payment.amount);
  }
  paid = Math.min(basis, paid);
  pending = Math.min(Math.max(0, basis - paid), pending);
  return {
    confirmed: game.status !== 'cancelled' && paid >= depositTarget,
    total: basis / 100, paid: paid / 100,
    remaining: Math.max(0, basis - paid) / 100,
    depositPercentage: 50,
    depositPaid: paid / 100,
    depositPending: pending / 100,
    depositRemaining: Math.max(0, depositTarget - paid) / 100,
    pending: pending / 100,
  };
}
