import type { VenueUnavailableSlot } from "@/lib/types";
import { formatTime12h, formatHour12 } from "@/lib/constants";

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
  return `${weekdayName(slot.weekday)} ${formatTime12h(slot.start)}–${formatTime12h(slot.end)}`;
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

/** Minutes-of-day → "HH:MM". */
export function padMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Allowed working intervals (minutes-of-day) for one date.
 * An empty `hours` list means "no restriction"; a weekday with no entry in a
 * non-empty list means the playground is closed all day. */
export function workingIntervalsForDate(
  hours: VenueUnavailableSlot[] | undefined,
  date: string
): Array<[number, number]> {
  if (!hours || hours.length === 0) return [];
  const weekday = weekdayOf(date);
  return hours
    .filter((s) => s.weekday === weekday)
    .map((s) => [minutesOf(s.start), minutesOf(s.end)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
}

/** True when a booking fits entirely inside the playground's working hours.
 * Venues without a working-hours configuration are always allowed. */
export function isWithinWorkingHours(
  hours: VenueUnavailableSlot[] | undefined,
  date: string,
  startTime: string,
  durationHours: number
): boolean {
  if (!hours || hours.length === 0) return true;
  const start = minutesOf(startTime);
  const end = start + durationHours * 60;
  return workingIntervalsForDate(hours, date).some(
    ([openStart, openEnd]) => start >= openStart && end <= openEnd
  );
}

/** Closed intervals (minutes-of-day) of a working-hours list for one date —
 * the complement of the allowed windows, or the whole day when unconfigured.
 * Feed these to `blockedIntervalsForDate` callers (schedule day view). */
export function closedIntervalsFromWorkingHours(
  hours: VenueUnavailableSlot[] | undefined,
  date: string
): Array<[number, number]> {
  if (!hours || hours.length === 0) return [];
  const allowed = workingIntervalsForDate(hours, date);
  if (allowed.length === 0) return [[0, 1440]];
  const closed: Array<[number, number]> = [];
  let cursor = 0;
  for (const [openStart, openEnd] of allowed) {
    const start = Math.max(cursor, openStart);
    if (start > cursor) closed.push([cursor, start]);
    cursor = Math.max(cursor, openEnd);
  }
  if (cursor < 1440) closed.push([cursor, 1440]);
  return closed;
}

/** "10 AM–10 PM" label for a date's working hours, or null when the day is
 * closed (or hours aren't configured). */
export function dayWorkingHoursLabel(
  hours: VenueUnavailableSlot[] | undefined,
  date: string,
  lang: "en" | "ar" = "en"
): string | null {
  if (!hours || hours.length === 0) return null;
  const intervals = workingIntervalsForDate(hours, date);
  if (intervals.length === 0) return null;
  return intervals.map(([s, e]) => `${formatHour12(padMinutes(s), lang)}–${formatHour12(padMinutes(e), lang)}`).join(", ");
}

/** Default start/end window when a playground has no working-hours config
 * (06:00 → 24:00). */
export const DEFAULT_WORKING_WINDOW: Array<[number, number]> = [[360, 1440]];

/** Working intervals for a date, falling back to the default window when the
 * playground has no working-hours config (rather than "closed"). */
export function allowedIntervalsForDate(
  hours: VenueUnavailableSlot[] | undefined,
  date: string
): Array<[number, number]> {
  return hours && hours.length > 0
    ? workingIntervalsForDate(hours, date)
    : DEFAULT_WORKING_WINDOW;
}

/** A game booking used when checking whether a slot is already taken. */
export interface GameBooking {
  game_date: string;
  start_time: string;
  duration_hours: number;
  court_number?: number | null;
}

/** True when [startMin, endMin) overlaps any of the minute intervals. */
export function rangeOverlaps(
  startMin: number,
  endMin: number,
  intervals: Array<[number, number]>
): boolean {
  return intervals.some(([s, e]) => startMin < e && s < endMin);
}

/** Minute intervals on `date` during which every court is occupied. */
export function fullyBookedIntervals(
  games: GameBooking[] | undefined,
  date: string,
  courtCount = 1
): Array<[number, number]> {
  const count = Math.max(1, courtCount || 1);
  const courtsByMinute = new Map<number, Set<number>>();
  for (const g of games ?? []) {
    if (g.game_date !== date) continue;
    const start = minutesOf(g.start_time);
    const end = start + Math.round((Number(g.duration_hours) || 1) * 60);
    const court = g.court_number ?? 1;
    for (let m = Math.max(0, start); m < Math.min(1440, end); m++) {
      let set = courtsByMinute.get(m);
      if (!set) {
        set = new Set();
        courtsByMinute.set(m, set);
      }
      set.add(court);
    }
  }
  const busy = new Array<boolean>(1440).fill(false);
  for (const [m, set] of courtsByMinute) {
    if (set.size >= count) busy[m] = true;
  }
  const out: Array<[number, number]> = [];
  let runStart = -1;
  for (let m = 0; m <= 1440; m++) {
    const isBusy = m < 1440 && busy[m];
    if (isBusy && runStart < 0) runStart = m;
    else if (!isBusy && runStart >= 0) {
      out.push([runStart, m]);
      runStart = -1;
    }
  }
  return out;
}

/** Merge overlapping/adjacent minute intervals. */
function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
  const sorted = intervals
    .filter(([s, e]) => e > s)
    .slice()
    .sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Represent each court's closed hours as busy intervals, preserving per-court capacity. */
export function courtClosedBookings(windows: (VenueUnavailableSlot & {court_number:number})[] | undefined, date: string, courtCount: number): GameBooking[] {
  if (!windows?.length) return [];
  const result: GameBooking[] = [];
  const time = (m:number) => `${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
  for(let court=1;court<=courtCount;court++) {
    const open = mergeIntervals(windows.filter(w=>w.court_number===court && w.weekday===weekdayOf(date)).map(w=>[minutesOf(w.start),minutesOf(w.end)]));
    let previous=0;
    for(const [start,end] of [...open,[1440,1440]]) { if(start>previous)result.push({game_date:date,start_time:time(previous),duration_hours:(start-previous)/60,court_number:court}); previous=Math.max(previous,end); }
  }
  return result;
}

/** Unavailable intervals (minutes-of-day) on a date: venue blocks plus times
 * where every court is already booked. */
export function unavailableIntervalsForDate(
  unavailableSlots: VenueUnavailableSlot[] | undefined,
  games: GameBooking[] | undefined,
  date: string,
  courtCount = 1,
  courtAvailability?: (VenueUnavailableSlot & {court_number:number})[]
): Array<[number, number]> {
  return mergeIntervals([
    ...blockedIntervalsForDate(unavailableSlots ?? [], date),
    ...fullyBookedIntervals([...(games??[]),...courtClosedBookings(courtAvailability,date,courtCount)], date, courtCount),
  ]);
}

/** Whether at least one `step`-minute slot inside the working hours is free. */
export function hasFreeSlotForDate(
  hours: VenueUnavailableSlot[] | undefined,
  busy: Array<[number, number]>,
  date: string,
  step = 60
): boolean {
  for (const [start, end] of allowedIntervalsForDate(hours, date)) {
    for (let m = start; m + step <= end; m += step) {
      if (!rangeOverlaps(m, m + step, busy)) return true;
    }
  }
  return false;
}

/** "HH:MM" start-time options for one date, stepped by `step` minutes inside
 * the playground's working windows. Falls back to the default window when
 * working hours aren't configured. */
export function timeOptionsForDate(
  hours: VenueUnavailableSlot[] | undefined,
  date: string,
  step = 60
): string[] {
  const intervals = allowedIntervalsForDate(hours, date);
  if (intervals.length === 0) return [];
  const out: string[] = [];
  for (const [start, end] of intervals) {
    for (let m = start; m < end; m += step) {
      out.push(padMinutes(Math.min(m, 1439)));
    }
  }
  return [...new Set(out)];
}

/** "HH:MM" end-time options after `from` within the same working window on
 * that date. Falls back to the default window when hours aren't configured. */
export function endTimeOptionsForDate(
  hours: VenueUnavailableSlot[] | undefined,
  date: string,
  from: string,
  step = 60
): string[] {
  const intervals = allowedIntervalsForDate(hours, date);
  if (intervals.length === 0) return [];
  const fromMin = minutesOf(from);
  const window = intervals.find(([s, e]) => fromMin >= s && fromMin < e);
  if (!window) return [];
  const [, end] = window;
  const out: string[] = [];
  for (let m = fromMin + step; m <= end; m += step) {
    out.push(padMinutes(m));
  }
  return out;
}