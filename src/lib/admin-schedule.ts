export interface RentalInterval { rental_date: string; start_time: string; hours: number }
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.round(value % 60)).padStart(2, "0")}`;

const occupiedOf = (intervals: Array<[number, number]>) => {
  let occupied = 0, cursor = 0;
  for (const [start, end] of intervals) {
    occupied += Math.max(0, end - Math.max(cursor, start));
    cursor = Math.max(cursor, end);
  }
  return occupied;
};
const gapsOf = (intervals: Array<[number, number]>) => {
  const gaps: string[] = [];
  let cursor = 0;
  for (const [start, end] of intervals) {
    if (start > cursor) gaps.push(`${clock(cursor)}–${clock(start)}`);
    cursor = Math.max(cursor, end);
  }
  if (cursor < 1440) gaps.push(`${clock(cursor)}–24:00`);
  return gaps;
};

/** Rental coverage for a date. Blocked minutes are the playground's weekly
 * excluded times resolved for that date — they count as unavailable when
 * finding gaps, but don't inflate the "rental hours today" figure. */
export function rentalCoverage(
  rentals: RentalInterval[],
  date: string,
  blocked: Array<[number, number]> = []
) {
  const day = Date.parse(`${date}T00:00:00Z`);
  const rentalIntervals = rentals.flatMap(rental => {
    const start = (Date.parse(`${rental.rental_date}T${rental.start_time}Z`) - day) / 60000;
    const end = start + Number(rental.hours) * 60;
    return Number.isFinite(start) && end > 0 && start < 1440 ? [[Math.max(0, start), Math.min(1440, end)] as [number, number]] : [];
  }).sort((a, b) => a[0] - b[0]);
  const blockedIntervals = blocked
    .map(([s, e]) => [Math.max(0, s), Math.min(1440, e)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const all = [...rentalIntervals, ...blockedIntervals].sort((a, b) => a[0] - b[0]);
  return { occupied: occupiedOf(rentalIntervals), gaps: gapsOf(all) };
}