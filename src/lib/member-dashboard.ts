/**
 * Pure helpers for the member dashboard: game payment state, day grouping and
 * the prioritised "action needed" list. Deliberately free of React and i18n so
 * the rules can be unit tested directly (see tests/member-dashboard.cjs).
 */

import type { Dict } from "@/lib/i18n/dictionary";

/**
 * The fields the payment rules care about. Declared structurally (rather than as
 * a concrete row type) so callers can pass their full query rows directly and
 * keep every other field available for rendering.
 */
export interface MemberDashboardGame {
  is_waitlisted: boolean;
  pay_status?: string | null;
  game: {
    game_date: string;
    start_time: string;
    share_price: number | null;
    host_pays: boolean;
  };
}

/** What the member still owes for their spot in a game. */
export type ShareTone = "due" | "pending" | "paid" | "none";

/**
 * Amount the member still has to pay. Joining a game stores
 * `pay_status = 'approved'` when the host pays and `'unpaid'` otherwise
 * (see the `join_friendly_game` RPC), so `'unpaid'`/`'rejected'` genuinely
 * means money is owed.
 */
export function shareAmountDue(
  row: Pick<MemberDashboardGame, "pay_status" | "is_waitlisted" | "game">
): number {
  const { game, is_waitlisted, pay_status } = row;
  // Waitlisted members have not earned a spot yet, so nothing is due.
  if (is_waitlisted) return 0;
  // The host covers the venue, so there is no per-player share.
  if (game.host_pays) return 0;
  // Already submitted (awaiting approval) or settled.
  if (pay_status === "pending" || pay_status === "approved") return 0;
  const price = Number(game.share_price ?? 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

export function shareTone(
  row: Pick<MemberDashboardGame, "pay_status" | "is_waitlisted" | "game">
): ShareTone {
  if (row.is_waitlisted) return "none";
  if (row.pay_status === "pending") return "pending";
  if (row.pay_status === "approved") return "paid";
  return shareAmountDue(row) > 0 ? "due" : "none";
}

/**
 * Local "today" as `YYYY-MM-DD`. Game dates and start times are stored as
 * wall-clock values in the venue's timezone, so day maths must stay on local
 * date parts rather than UTC (which would shift the boundary by the offset).
 */
export function todayISO(now: Date = new Date()): string {
  return localISO(now);
}

function localISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Shift a `YYYY-MM-DD` by whole days. Uses noon to stay clear of DST shifts. */
export function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localISO(date);
}

export type DayBucket = "today" | "tomorrow" | "week";

export function dayBucket(date: string, today: string): DayBucket {
  if (date === today) return "today";
  if (date === addDaysISO(today, 1)) return "tomorrow";
  return "week";
}

export interface DayGroup<T> {
  date: string;
  bucket: DayBucket;
  items: T[];
}

/**
 * Group games into chronological day buckets, sorting each bucket by start
 * time. Returns an empty array for no games so callers can render an empty state.
 */
export function groupGamesByDay<T extends { game: { game_date: string; start_time: string } }>(
  rows: T[],
  today: string
): DayGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const row of rows) {
    const { game_date } = row.game;
    const bucket = buckets.get(game_date);
    if (bucket) bucket.push(row);
    else buckets.set(game_date, [row]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, items]) => ({
      date,
      bucket: dayBucket(date, today),
      items: [...items].sort((a, b) =>
        a.game.start_time.localeCompare(b.game.start_time)
      ),
    }));
}

export type Countdown =
  | { kind: "minutes"; value: number }
  | { kind: "hours"; value: number };

function gameStart(date: string, time: string | null): Date {
  const [hours, minutes] = (time ?? "00:00").split(":").map(Number);
  const start = new Date(`${date}T00:00:00`);
  start.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );
  return start;
}

/**
 * Relative time cue for a game kickoff, or null when there is nothing useful to
 * say (already started, or more than a day away). The day itself is rendered
 * separately from `dayBucket`.
 */
export function countdown(
  date: string,
  time: string | null,
  now: Date
): Countdown | null {
  const diff = gameStart(date, time).getTime() - now.getTime();
  if (diff <= 0) return null;
  if (diff < 3_600_000) {
    return { kind: "minutes", value: Math.max(1, Math.ceil(diff / 60_000)) };
  }
  if (diff < 86_400_000) return { kind: "hours", value: Math.floor(diff / 3_600_000) };
  return null;
}

export type MemberActionKind =
  | "share_due"
  | "share_pending"
  | "session_empty"
  | "session_low";

export type MemberActionTone = "action" | "warning" | "info";

export interface MemberAction {
  id: string;
  kind: MemberActionKind;
  tone: MemberActionTone;
  /** Translation key for the headline. */
  labelKey: keyof Dict;
  /** Translation key for the supporting line. */
  hintKey: keyof Dict;
  /** Where to send the member. Null means "open the share payment dialog". */
  href: string | null;
  /** Number of games covered by this action, for "n games" phrasing. */
  count: number;
  /** Sum of outstanding shares in EGP, for the payment action. */
  amount: number;
  /** Placeholder values substituted into the translation strings. */
  params: Record<string, string | number>;
}

export interface MemberActionInput {
  games: MemberDashboardGame[];
  /** Sessions left in the academy subscription; null when not applicable. */
  remainingSessions?: number | null;
  /** Warn once the subscription drops to this many sessions or fewer. */
  lowSessionThreshold?: number;
}

/**
 * Substitute a translation's placeholders. Arabic has no plural suffix, so the
 * repo's English-only `{s}` is emptied rather than leaving a literal brace.
 */
export function translateAction(
  template: string,
  params: Record<string, string | number>,
  lang: "en" | "ar"
): string {
  const suffix = lang === "ar" || Number(params.n) === 1 ? "" : "s";
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template.replace("{s}", suffix)
  );
}

/**
 * Build the dashboard's "action needed" list, most urgent first. Games owing a
 * share collapse into a single action so the strip never grows unbounded.
 */
export function memberActions({
  games,
  remainingSessions,
  lowSessionThreshold = 3,
}: MemberActionInput): MemberAction[] {
  const actions: MemberAction[] = [];

  const due = games.filter(row => shareTone(row) === "due");
  const dueAmount = due.reduce((total, row) => total + shareAmountDue(row), 0);
  if (due.length > 0) {
    actions.push({
      id: "share_due",
      kind: "share_due",
      tone: dueAmount > 0 ? "action" : "warning",
      labelKey: "dash_action_share_due",
      hintKey:
        dueAmount > 0
          ? "dash_action_share_due_amount"
          : "dash_action_share_due_plain",
      href: null,
      count: due.length,
      amount: dueAmount,
      params: { n: due.length, amount: dueAmount },
    });
  }

  const pending = games.filter(row => shareTone(row) === "pending");
  if (pending.length > 0) {
    actions.push({
      id: "share_pending",
      kind: "share_pending",
      tone: "info",
      labelKey: "dash_action_share_pending",
      hintKey: "dash_action_share_pending_hint",
      href: "/dashboard/games",
      count: pending.length,
      amount: 0,
      params: { n: pending.length },
    });
  }

  if (remainingSessions === 0) {
    actions.push({
      id: "session_empty",
      kind: "session_empty",
      tone: "action",
      labelKey: "alert_subscription_empty",
      hintKey: "dash_action_session_empty_hint",
      href: "/profile",
      count: 0,
      amount: 0,
      params: { n: 0 },
    });
  } else if (
    typeof remainingSessions === "number" &&
    remainingSessions > 0 &&
    remainingSessions <= lowSessionThreshold
  ) {
    actions.push({
      id: "session_low",
      kind: "session_low",
      tone: "warning",
      labelKey: "alert_subscription_low",
      hintKey: "dash_action_session_low_hint",
      href: "/profile",
      count: 0,
      amount: 0,
      params: { n: remainingSessions },
    });
  }

  return actions;
}