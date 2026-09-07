export interface RentalInterval { rental_date: string; start_time: string; hours: number }
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.round(value % 60)).padStart(2, "0")}`;
/** Rental coverage only: unknown training durations must not be inferred. */
export function rentalCoverage(rentals: RentalInterval[], date: string) {
  const day = Date.parse(`${date}T00:00:00Z`);
  const intervals = rentals.flatMap(rental => {
    const start = (Date.parse(`${rental.rental_date}T${rental.start_time}Z`) - day) / 60000;
    const end = start + Number(rental.hours) * 60;
    return Number.isFinite(start) && end > 0 && start < 1440 ? [[Math.max(0, start), Math.min(1440, end)]] : [];
  }).sort((a, b) => a[0] - b[0]);
  let cursor = 0, occupied = 0;
  const gaps: string[] = [];
  for (const [start, end] of intervals) {
    if (start > cursor) gaps.push(`${clock(cursor)}–${clock(start)}`);
    occupied += Math.max(0, end - Math.max(cursor, start));
    cursor = Math.max(cursor, end);
  }
  if (cursor < 1440) gaps.push(`${clock(cursor)}–24:00`);
  return { occupied, gaps };
}
