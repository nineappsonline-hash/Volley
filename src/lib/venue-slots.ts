import type { VenueUnavailableSlot } from "@/lib/types";

export const minutesOf = (time: string): number => {
  const [h, m] = time.split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
};

/** Local weekday (0 = Sunday … 6 = Saturday) of a "YYYY-MM-DD" date string. */
export const weekdayOf = (date: string): number =>
  new Date(`${date}T00:00:00`).getDay();

/** Blocked intervals (minutes-of-day) of a weekly slot list for one date. */
export function blockedIntervalsForDate(
  slots: VenueUnavailableSlot[],
  date: string
): Array<[number, number]> {
  const weekday = weekdayOf(date);
  return slots
    .filter((s) => s.weekday === weekday)
    .map((s) => [minutesOf(s.start), minutesOf(s.end)] as [number, number])
    .filter(([s, e]) => e > s);
}

/** Returns the slot that overlaps a booking, or null when the time is free. */
export function findBlockedOverlap(
  slots: VenueUnavailableSlot[],
  date: string,
  startTime: string,
  durationHours: number
): VenueUnavailableSlot | null {
  const weekday = weekdayOf(date);
  const myStart = minutesOf(startTime);
  const myEnd = myStart + durationHours * 60;
  for (const slot of slots) {
    if (slot.weekday !== weekday) continue;
    const bs = minutesOf(slot.start);
    const be = minutesOf(slot.end);
    if (be <= bs) continue;
    if (myEnd <= bs || be <= myStart) continue;
    return slot;
  }
  return null;
}

/** Half-open interval overlap: two "HH:MM"-started bookings clash in time. */
export function timeSlotsOverlap(
  aStart: string,
  aHours: number,
  bStart: string,
  bHours: number
): boolean {
  const as = minutesOf(aStart);
  const ae = as + aHours * 60;
  const bs = minutesOf(bStart);
  const be = bs + bHours * 60;
  return as < be && bs < ae;
}

/** Human-readable slot label, e.g. "Sun 08:00–10:00". */
export function formatBlockedSlot(
  slot: VenueUnavailableSlot,
  weekdayName: (weekday: number) => string
): string {
  return `${weekdayName(slot.weekday)} ${slot.start.slice(0, 5)}–${slot.end.slice(0, 5)}`;
}

/** Validate a slot list before saving (used by the admin form). */
export function isValidSlotList(
  slots: VenueUnavailableSlot[] | undefined
): boolean {
  if (!slots || slots.length === 0) return true;
  return slots.every(
    (s) =>
      Number.isInteger(s.weekday) &&
      s.weekday >= 0 &&
      s.weekday <= 6 &&
      /^\d{2}:\d{2}$/.test(s.start) &&
      /^\d{2}:\d{2}$/.test(s.end) &&
      minutesOf(s.start) < minutesOf(s.end)
  );
}