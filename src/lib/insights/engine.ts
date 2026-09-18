import type {
  AcademyAlert,
  AlertType,
  PredictionFactor,
  PredictionScore,
  RiskLevel,
} from "@/lib/types";

/**
 * Pure TypeScript mirror of the SQL rules engine (rules-v1). Used by the
 * insights UI to render *transparent factor breakdowns* (why does this score
 * say X?) without a round-trip. Keep the constants in sync with
 * `supabase/migrations/20260918010000_academy_insights.sql`.
 */

export const RULES_V1 = {
  weights: {
    payment_recency: 0.35,
    attendance_recent: 0.3,
    attendance_trend: 0.2,
    subscription_utilization: 0.15,
  },
  defaults: {
    payment_gap_days: 90,
    attendance_gap_days: 30,
    utilization_low_pct: 30,
    revenue_drop_pct: 20,
    churn_high: 70,
    churn_medium: 40,
  },
  model_version: "rules-v1",
} as const;

export interface MemberChurnInput {
  memberId: string;
  /** Days since last payment (null if never paid). */
  daysSinceLastPayment: number | null;
  /** Attendance rate over the last 30 days, 0..1. */
  attendanceRate30d: number | null;
  /** Attendance rate over the last 14 days, 0..1. */
  recentRate: number | null;
  /** Attendance rate over days 15-46 ago, 0..1. */
  baselineRate: number | null;
  /** Total attendance ever in this academy. */
  totalAttendance: number;
  /** Total payments in the last 90 days. */
  payments90d: number;
  subscriptionSessions: number | null;
  sessionsAttended: number;
}

export interface Thresholds {
  payment_gap_days?: number;
  attendance_gap_days?: number;
  utilization_low_pct?: number;
  revenue_drop_pct?: number;
  churn_high?: number;
  churn_medium?: number;
}

export function computeMemberChurn(input: MemberChurnInput, thresholds: Thresholds = {}): PredictionScore & { factors: PredictionFactor[] } {
  const t = { ...RULES_V1.defaults, ...thresholds };
  const noHistory =
    input.totalAttendance === 0 &&
    input.payments90d === 0 &&
    (input.daysSinceLastPayment === null || (input.daysSinceLastPayment ?? 0) > 0); // no data at all

  const factors: PredictionFactor[] = [];
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  if (noHistory) {
    return {
      id: "",
      academy_id: "",
      entity_type: "member",
      entity_id: input.memberId,
      score_type: "churn_risk",
      score: null,
      level: "not_enough_data",
      explanation: { headline: "Not enough data to predict retention for this member" },
      model_version: RULES_V1.model_version,
      period_key: currentPeriodKey(),
      computed_at: new Date().toISOString(),
      factors,
    };
  }

  // Factor 1: payment recency
  const paymentRecency = input.daysSinceLastPayment === null ? 100 : clamp(((input.daysSinceLastPayment ?? 0) / t.payment_gap_days) * 100);
  factors.push({
    id: "",
    score_id: "",
    factor_key: "payment_recency",
    factor_label: "Payment recency",
    direction: paymentRecency >= t.churn_medium ? "negative" : "positive",
    weight: RULES_V1.weights.payment_recency,
    contribution: paymentRecency,
    data_snapshot: { days_since_last_payment: input.daysSinceLastPayment, threshold_days: t.payment_gap_days },
    created_at: new Date().toISOString(),
  });

  // Factor 2: recent attendance
  const attendanceRecent = input.attendanceRate30d === null ? 75 : (1 - input.attendanceRate30d) * 100;
  factors.push({
    id: "",
    score_id: "",
    factor_key: "attendance_recent",
    factor_label: "Attendance over the last 30 days",
    direction: attendanceRecent >= t.churn_medium ? "negative" : "positive",
    weight: RULES_V1.weights.attendance_recent,
    contribution: attendanceRecent,
    data_snapshot: { attendance_rate_30d: input.attendanceRate30d },
    created_at: new Date().toISOString(),
  });

  // Factor 3: attendance trend (recent vs baseline)
  const trendRaw =
    input.recentRate === null || input.baselineRate === null
      ? 0
      : (input.baselineRate - input.recentRate) * 150;
  const trend = clamp(trendRaw);
  factors.push({
    id: "",
    score_id: "",
    factor_key: "attendance_trend",
    factor_label: "Attendance trend (recent vs prior)",
    direction: trend > 15 ? "negative" : trend < -15 ? "positive" : "neutral",
    weight: RULES_V1.weights.attendance_trend,
    contribution: trend,
    data_snapshot: { recent_rate_14d: input.recentRate, baseline_rate_45d: input.baselineRate },
    created_at: new Date().toISOString(),
  });

  // Factor 4: subscription utilization (over-usage favors renewal for block plans)
  const utilization =
    input.subscriptionSessions && input.subscriptionSessions > 0
      ? clamp((input.sessionsAttended / input.subscriptionSessions) * 100 - 50)
      : 0;
  factors.push({
    id: "",
    score_id: "",
    factor_key: "subscription_utilization",
    factor_label: "Subscription usage",
    direction: utilization > 35 ? "neutral" : "positive",
    weight: RULES_V1.weights.subscription_utilization,
    contribution: utilization,
    data_snapshot: { sessions_attended: input.sessionsAttended, subscription_sessions: input.subscriptionSessions },
    created_at: new Date().toISOString(),
  });

  const score = clamp(factors.reduce((acc, f) => acc + f.weight * f.contribution, 0));
  let level: RiskLevel = "low";
  if (score >= t.churn_high) level = "high";
  else if (score >= t.churn_medium) level = "medium";

  return {
    id: "",
    academy_id: "",
    entity_type: "member",
    entity_id: input.memberId,
    score_type: "churn_risk",
    score: Math.round(score),
    level,
    explanation: {
      headline: "Based on payment recency, recent attendance and subscription usage",
      score_components: factors.map((f) => ({ factor: f.factor_key, contribution: Math.round(f.contribution), weight: f.weight })),
    },
    model_version: RULES_V1.model_version,
    period_key: currentPeriodKey(),
    computed_at: new Date().toISOString(),
    factors,
  };
}

export function computeTeamUtilization(input: { teamId: string; presentChecks45d: number; possibleChecks45d: number }, thresholds: Thresholds = {}): PredictionScore & { factors: PredictionFactor[] } {
  const t = { ...RULES_V1.defaults, ...thresholds };
  const utilization = input.possibleChecks45d > 0 ? (input.presentChecks45d / input.possibleChecks45d) * 100 : 0;
  const risk = Math.max(0, Math.min(100, 100 - utilization));
  const low = t.utilization_low_pct;

  let level: RiskLevel = "low";
  if (utilization < low) level = "high";
  else if (utilization < low * 2) level = "medium";

  return {
    id: "",
    academy_id: "",
    entity_type: "team",
    entity_id: input.teamId,
    score_type: "utilization_risk",
    score: Math.round(risk),
    level,
    explanation: { utilization_pct: Math.round(utilization * 10) / 10, threshold_low_pct: low },
    model_version: RULES_V1.model_version,
    period_key: currentPeriodKey(),
    computed_at: new Date().toISOString(),
    factors: [
      {
        id: "",
        score_id: "",
        factor_key: "team_utilization",
        factor_label: "Average attendance rate",
        direction: utilization >= low ? "positive" : "negative",
        weight: 1,
        contribution: Math.round(risk),
        data_snapshot: { utilization_pct: Math.round(utilization * 10) / 10, present_45d: input.presentChecks45d, possible_45d: input.possibleChecks45d },
        created_at: new Date().toISOString(),
      },
    ],
  };
}

export function currentPeriodKey(date = new Date()): string {
  const day = date.getDay();
  const iso = new Date(date.getTime() + (day === 0 ? -1 : 0) * 86400000).toISOString().slice(0, 10);
  return iso.slice(0, 4).concat("-W").concat(String(Math.ceil(parseInt(iso.slice(5, 7), 10) / 4)).padStart(2, "0"));
}

/** Builds the dedupe key the SQL engine uses so the UI matches persisted alerts. */
export function alertDedupeKey(type: AlertType, entityType: string, entityId: string, periodKey = currentPeriodKey()): string {
  return `${type}:${entityType}:${entityId}:${periodKey}`;
}

export interface AlertCandidate {
  type: AlertType;
  severity: AcademyAlert["severity"];
  entityType: "member" | "team" | "academy";
  entityId: string;
  title: string;
  body: string;
  recommendedAction: string;
  dedupeKey: string;
}

/** Mirrors the SQL alert generation rules so the UI can preview pending alerts. */
export function candidateAlerts(churnByMember: Map<string, PredictionScore>, teamUtil: Map<string, PredictionScore>, config: { members: { id: string; name: string; daysSinceLastPayment: number | null; daysSinceLastAttendance: number | null }[]; teams: { id: string; name: string }[] }, thresholds: Thresholds = {}): AlertCandidate[] {
  const t = { ...RULES_V1.defaults, ...thresholds };
  const out: AlertCandidate[] = [];
  const period = currentPeriodKey();

  for (const m of config.members) {
    if (m.daysSinceLastAttendance === null) {
      out.push({ type: "no_attendance", severity: "medium", entityType: "member", entityId: m.id, title: `No attendance recorded for ${m.name}`, body: "This member has no recorded attendance yet this period.", recommendedAction: "Reach out to the member and check their commitment.", dedupeKey: alertDedupeKey("no_attendance", "member", m.id, period) });
    } else if (m.daysSinceLastAttendance >= t.attendance_gap_days && m.daysSinceLastAttendance < t.payment_gap_days) {
      out.push({ type: "no_attendance", severity: "medium", entityType: "member", entityId: m.id, title: `No attendance from ${m.name} in ${m.daysSinceLastAttendance} days`, body: "The member has not attended in longer than the attendance threshold.", recommendedAction: "Send a reminder or call to re-engage the member.", dedupeKey: alertDedupeKey("no_attendance", "member", m.id, period) });
    }
    if (m.daysSinceLastPayment === null || (m.daysSinceLastPayment ?? 0) >= t.payment_gap_days) {
      out.push({ type: "payment_overdue", severity: "high", entityType: "member", entityId: m.id, title: `Payment overdue for ${m.name}`, body: `No payment recorded in the last ${t.payment_gap_days} days.`, recommendedAction: "Send a renewal reminder or follow up on the last payment.", dedupeKey: alertDedupeKey("payment_overdue", "member", m.id, period) });
    }
  }

  for (const [id, score] of teamUtil) {
    if (score.level === "medium" || score.level === "high") {
      out.push({ type: "utilization_low", severity: "medium", entityType: "team", entityId: id, title: `Low utilization on team ${config.teams.find((x) => x.id === id)?.name ?? id}`, body: "Average attendance on this team is below the configured threshold.", recommendedAction: "Review the schedule, timings and coach availability for this team.", dedupeKey: alertDedupeKey("utilization_low", "team", id, period) });
    }
  }

  for (const [id, score] of churnByMember) {
    if (score.level === "high") {
      const name = config.members.find((x) => x.id === id)?.name ?? id;
      out.push({ type: "retention_trajectory", severity: "high", entityType: "member", entityId: id, title: `Retention risk: ${name}`, body: "This member shows a negative retention trajectory and is likely to stop attending.", recommendedAction: "Schedule a personal touchpoint before their subscription lapses.", dedupeKey: alertDedupeKey("retention_trajectory", "member", id, period) });
    }
  }

  return out;
}