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

// Default minimum players per sport when creating a game.
export const SPORT_DEFAULT_MIN: Record<string, number> = {
  Football: 10,
  Volleyball: 10,
  Padel: 4,
};

export function getDefaultMinPlayers(sport: string): number {
  return SPORT_DEFAULT_MIN[sport] ?? 2;
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
export const COMMUNITY_SPORTS = [
  "Volleyball", "Beach Volleyball", "Football", "Basketball", "Handball", "Tennis", "Swimming",
  "Padel", "Squash", "Table Tennis", "Badminton", "Gymnastics", "Karate",
  "Boxing", "Athletics", "Kung Fu", "Taekwondo", "CrossFit", "Judo",
  "Kickboxing", "Wrestling", "Archery", "Fencing", "Equestrian", "Cycling",
  "Weightlifting", "Parkour",
] as const;

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
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${CURRENCY} ${Math.round(amount)}`;
  }
}
