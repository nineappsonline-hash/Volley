import { ACTIVE_SPORTS } from "@/lib/active-sports";
export const CURRENCY = "EGP";
export const DEFAULT_SUBSCRIPTION_SESSIONS = 8;

// Plan subscription payment methods (screenshot-verified).
export const INSTAPAY_LINK = "https://ipn.eg/S/jimmydodo3/instapay/45APuk";
export const E_WALLET_NUMBER = "01023862436";

// Per-player margin folded into each friendly-game share price. It is hidden
// from members: the standalone per-player price already includes it.
export const GAME_PLATFORM_FEE = 20;

// Sport-specific per-player fee shown in the cost estimate (EGP).
// Football/Volleyball share rental; Padel has its own fixed rate.
export const SPORT_PLAYER_FEE: Record<string, number> = {
  Football: 20,
  Volleyball: 20,
  Padel: 40,
};

export function getPlayerFee(sport: string): number {
  return SPORT_PLAYER_FEE[sport] ?? 20;
}

// Default minimum players per sport when creating a game. The super admin can
// override these per sport in the platform panel (sport_settings table); these
// values are the built-in fallbacks.
export const SPORT_DEFAULT_MIN: Record<string, number> = {
  Football: 10,
  Volleyball: 10,
  "Beach Volleyball": 8,
  Padel: 4,
};

export function getDefaultMinPlayers(sport: string): number {
  return SPORT_DEFAULT_MIN[sport] ?? 2;
}

/**
 * Effective minimum players for a sport: the super-admin override
 * (sport_settings map from useSportSettings) wins over the built-in default.
 */
export function getSportMinPlayers(
  sport: string,
  overrides?: Map<string, number> | null
): number {
  const override = overrides?.get(sport);
  return typeof override === "number" && override >= 2 ? override : getDefaultMinPlayers(sport);
}

// The fixed headcount a sport's share is always split across, regardless of the
// minimum players the user picks at creation (Football/Volleyball 10, Padel 4).
export const SPORT_BILLABLE_PLAYERS: Record<string, number> = {
  Football: 10,
  Volleyball: 10,
  Padel: 4,
};

export function getBillablePlayers(sport: string, fallback: number): number {
  return SPORT_BILLABLE_PLAYERS[sport] ?? fallback;
}

// Membership plans: full = 8 sessions, half = 4 sessions (per payment cycle).
export const MEMBERSHIP_SESSIONS: Record<"full" | "half", number> = {
  full: 8,
  half: 4,
};

// Payment collection methods (i18n keys: method_<value>).
export const PAYMENT_METHODS = [
  "cash",
  "card",
  "wallet",
  "bank_transfer",
  "other",
] as const;

// Skill levels (i18n keys: skill_<value>).
export const SKILL_LEVELS = ["beginner", "intermediate", "advanced"] as const;

// Expense categories (i18n keys: expense_cat_<value>).
export const EXPENSE_CATEGORIES = [
  "equipment",
  "uniforms",
  "tournament",
  "travel",
  "other",
] as const;

// Trial request statuses (i18n keys: trial_status_<value>).
export const TRIAL_STATUSES = ["new", "contacted", "converted", "declined"] as const;

// Sports offered in the community (used by friendly-game creation). These are
// global, not per-academy, so members without an academy can still join.
export const COMMUNITY_SPORTS = ACTIVE_SPORTS;

/** Members whose remaining sessions are at or below this count get expiry alerts. */
export const EXPIRY_ALERT_THRESHOLD = 1;

export function sessionsForMembership(type: "full" | "half"): number {
  return MEMBERSHIP_SESSIONS[type] ?? DEFAULT_SUBSCRIPTION_SESSIONS;
}

export function formatMoney(
  amount: number,
  lang: "en" | "ar" = "en"
): string {
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${CURRENCY} ${amount.toFixed(2)}`;
  }
}

export function formatMoneyShort(amount: number, lang: "en" | "ar" = "en"): string {
  try {
    return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: CURRENCY,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${CURRENCY} ${Number(amount.toFixed?.(0) ?? amount).toFixed(0)}`;
  }
}

/**
 * Formats an "HH:mm" 24-hour time string as 12-hour with AM/PM (or ص/م in
 * Arabic). Keeps a fallback so a non-"HH:mm" value passes through untouched.
 */
export function formatTime12h(time: string | null | undefined, lang: "en" | "ar" = "en"): string {
  const value = (time ?? "").trim();
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  let hour = Number(match[1]) % 12;
  if (hour === 0) hour = 12;
  const suffix = Number(match[1]) >= 12
    ? (lang === "ar" ? "م" : "PM")
    : (lang === "ar" ? "ص" : "AM");
  return `${hour}:${match[2]} ${suffix}`;
}

/**
 * Adds a fractional number of hours to an "HH:mm" (or "HH:mm:ss") 24-hour
 * time string and returns the "HH:mm" end time, wrapping past midnight.
 * Returns an empty string when the input isn't a parseable time.
 */
export function addHoursToTime(time: string | null | undefined, hours: number): string {
  const match = (time ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match || !Number.isFinite(hours) || hours <= 0) return "";
  const total = Number(match[1]) * 60 + Number(match[2]) + Math.round(hours * 60);
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/**
 * Formats an "HH:mm" 24-hour time string as a compact 12-hour hour label
 * (e.g. "9 AM", "9 PM"; "9 ص" / "9 م" in Arabic) for chart axes and badges.
 * "24:00" (end of day) renders as "12 AM". Non-numeric values pass through
 * untouched.
 */
export function formatHour12(time: string | number | null | undefined, lang: "en" | "ar" = "en"): string {
  const raw = typeof time === "number" ? String(time) : (time ?? "").trim();
  const match = raw.match(/^(\d{1,2})/);
  if (!match) return raw;
  const parsed = Number(match[1]);
  if (parsed > 24) return raw;
  const h24 = parsed % 24;
  let hour = h24 % 12;
  if (hour === 0) hour = 12;
  const suffix = h24 >= 12 ? (lang === "ar" ? "م" : "PM") : (lang === "ar" ? "ص" : "AM");
  return `${hour} ${suffix}`;
}
