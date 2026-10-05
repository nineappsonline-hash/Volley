/**
 * Session packages offered when a super admin signs a member up to a training
 * group. The database only accepts 8, 4 or a single session, so these are the
 * only options the UI may offer.
 *
 * Amounts are prorated from the group's own monthly price and must match
 * admin_assign_training exactly, otherwise the database rejects the booking
 * with "the group price changed".
 */
export const SESSION_PACKAGES = [8, 4, 1] as const;

export type SessionPackage = (typeof SESSION_PACKAGES)[number];

type GroupLike = {
  monthly_price?: unknown;
  monthly_sessions?: unknown;
  trial_price?: unknown;
  slots?: { seats_left?: unknown }[] | null;
};

const numeric = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Amount due for a package: the trial price for one session, else prorated. */
export function sessionPackageAmount(group: GroupLike | null | undefined, count: number): number {
  if (!group) return 0;
  if (count === 1) return numeric(group.trial_price);
  const monthly = numeric(group.monthly_price);
  const sessions = numeric(group.monthly_sessions);
  if (sessions <= 0) return 0;
  // Rounded to 2dp to line up with round(numeric, 2) in the database.
  return Math.round((monthly * count / sessions) * 100) / 100;
}

/** Sessions the database would still be able to reserve for this group. */
export function groupAvailableSessions(group: GroupLike | null | undefined): number {
  if (!group) return 0;
  return (group.slots ?? []).filter((slot) => numeric(slot?.seats_left) > 0).length;
}

export type SessionPackageOption = {
  count: SessionPackage;
  amount: number;
  available: boolean;
  /** Seats currently open across the group's schedule. */
  seats: number;
};

/**
 * The three packages with their amount and whether the group can actually
 * fulfil them, so an option that would fail at submit time is never selectable.
 */
export function sessionPackageOptions(group: GroupLike | null | undefined): SessionPackageOption[] {
  const seats = groupAvailableSessions(group);
  return SESSION_PACKAGES.map((count) => ({
    count,
    amount: sessionPackageAmount(group, count),
    available: seats >= count,
    seats,
  }));
}

/** The first package the group can fulfil, or null when it cannot fill any. */
export function defaultSessionPackage(group: GroupLike | null | undefined): SessionPackage | null {
  return sessionPackageOptions(group).find((option) => option.available)?.count ?? null;
}