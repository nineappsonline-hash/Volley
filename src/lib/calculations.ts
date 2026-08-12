import { sessionsForMembership } from "@/lib/constants";
import type {
  Attendance,
  MonthlyCost,
  Payment,
  Profile,
  SessionCalculation,
  TrainingSession,
} from "@/lib/types";

/**
 * Revenue contribution of a member per attended session =
 * their most recent payment amount ÷ that payment's subscription sessions.
 */
export function memberPerSessionValue(
  memberId: string,
  payments: Payment[]
): number {
  const memberPayments = payments
    .filter((p) => p.member_id === memberId)
    .sort(
      (a, b) =>
        b.payment_date.localeCompare(a.payment_date) ||
        b.created_at.localeCompare(a.created_at)
    );
  const latest = memberPayments[0];
  if (!latest) return 0;
  return latest.amount / Math.max(latest.subscription_sessions, 1);
}

export function computeSessionRevenue(
  attendance: Attendance[],
  payments: Payment[]
): number {
  const present = attendance.filter((a) => a.is_present);
  const byMember = new Map<string, number>();
  for (const memberPayments of present) {
    if (!byMember.has(memberPayments.member_id)) {
      byMember.set(memberPayments.member_id, 0);
    }
  }
  let total = 0;
  for (const memberId of byMember.keys()) {
    total += memberPerSessionValue(memberId, payments);
  }
  return round2(total);
}

export function computeCostPerSession(costs: {
  coachFee: number;
  coachBasis: "full" | "half";
  courtRental: number;
  sessionsPerMonth: number;
}): number {
  const basisSessions = sessionsForMembership(costs.coachBasis);
  const perSessionCoach = costs.coachFee / basisSessions;
  const perSessionRent =
    costs.sessionsPerMonth > 0 ? costs.courtRental / costs.sessionsPerMonth : 0;
  return round2(perSessionCoach + perSessionRent);
}

export function computeProfitLoss(revenue: number, costPerSession: number): number {
  return round2(revenue - costPerSession);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildSessionCalculation(
  session: TrainingSession,
  attendance: Attendance[],
  payments: Payment[],
  monthlyCosts: MonthlyCost[]
): SessionCalculation {
  const d = new Date(session.date + "T00:00:00");
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const cost = monthlyCosts.find((c) => c.month === month && c.year === year);
  const costPerSession = cost?.cost_per_session ?? 0;
  const revenue = computeSessionRevenue(attendance, payments);
  return {
    id: `client-${session.id}`,
    session_id: session.id,
    total_revenue: revenue,
    cost_per_session: costPerSession,
    profit_loss: computeProfitLoss(revenue, costPerSession),
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Sessions "used" from the current subscription =
 * attended sessions that fall on/after the member's latest payment date.
 */
export function usedSessionsSincePayment(
  attendance: Attendance[],
  sessions: TrainingSession[],
  payments: Payment[]
): number {
  const latest = [...payments].sort(
    (a, b) =>
      b.payment_date.localeCompare(a.payment_date) ||
      b.created_at.localeCompare(a.created_at)
  )[0];
  if (!latest) return 0;
  const paidDates = new Set(attendance.filter((a) => a.is_present).map((a) => a.session_id));
  return sessions.filter(
    (s) => paidDates.has(s.id) && s.date >= latest.payment_date
  ).length;
}

export function remainingSessions(profile: Profile): number {
  return Math.max(profile.subscription_sessions - profile.sessions_attended, 0);
}
