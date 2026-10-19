import type { Expense, MonthlyCost, Payment, SessionCalculation, TrainingSession, VenueRental, SessionGuest } from "./types";
export interface MonthlyPoint { label: string; revenue: number; costs: number; profit: number; }
/**
 * Builds monthly data points from payments, costs and session calculations.
 */
export function buildMonthlyPoints(
  payments: Payment[],
  costs: MonthlyCost[],
  calculations: SessionCalculation[],
  sessions: TrainingSession[],
  expenses: Expense[] = [],
  rentals: VenueRental[] = [],
  guests: SessionGuest[] = [],
  trainingLedger: {kind:string;amount:number;created_at:string}[] = []
): MonthlyPoint[] {
  const months = new Map<string, MonthlyPoint>();
  const key = (m: number, y: number) => `${y}-${String(m).padStart(2, "0")}`;

  const monthsOfSessions = new Set(
    sessions.map((s) => {
      const d = new Date(s.date + "T00:00:00");
      return key(d.getMonth() + 1, d.getFullYear());
    })
  );

  const allKeys = new Set<string>([
    ...costs.map((c) => key(c.month, c.year)),
    ...payments.map((p) => {
      const d = new Date(p.payment_date + "T00:00:00");
      return key(d.getMonth() + 1, d.getFullYear());
    }),
    ...monthsOfSessions,
    ...trainingLedger.filter(l => ["payment", "refund"].includes(l.kind)).map(l => new Date(l.created_at).toLocaleDateString("en-CA", {timeZone:"Africa/Cairo"}).slice(0,7)),
    ...rentals.filter(r => r.is_paid).map(r => r.rental_date.slice(0,7)),
    ...expenses.map((e) => {
      const d = new Date(e.expense_date + "T00:00:00");
      return key(d.getMonth() + 1, d.getFullYear());
    }),
  ]);

  const label = (k: string) => {
    const [y, m] = k.split("-");
    return `${MONTH_NAMES[Number(m) - 1]?.slice(0, 3)} ${y}`;
  };

  for (const k of [...allKeys].sort()) {
    months.set(k, { label: label(k), revenue: 0, costs: 0, profit: 0 });
  }

  for (const p of payments) {
    const d = new Date(p.payment_date + "T00:00:00");
    const k = key(d.getMonth() + 1, d.getFullYear());
    const point = months.get(k);
    if (point) point.revenue += Number(p.amount);
  }

  for (const entry of trainingLedger) {
    if (!["payment", "refund"].includes(entry.kind)) continue;
    const point = months.get(new Date(entry.created_at).toLocaleDateString("en-CA", {timeZone:"Africa/Cairo"}).slice(0,7));
    if (point) point.revenue += Number(entry.amount);
  }
  // Cash receipts use transaction dates; session allocations are not counted twice.
  for (const rental of rentals.filter(r => r.is_paid)) {
    const point = months.get(rental.rental_date.slice(0,7));
    if (point) point.revenue += Number(rental.price) * Number(rental.hours);
  }
  for (const guest of guests) {
    const session = sessions.find(s => s.id === guest.session_id && s.status !== "canceled");
    const point = session ? months.get(session.date.slice(0,7)) : undefined;
    if (point) point.revenue += Number(guest.amount_paid);
  }
  for (const c of costs) {
    const k = key(c.month, c.year);
    const point = months.get(k);
    if (point) point.costs += Number(c.coach_fee) + Number(c.court_rental);
  }

  for (const e of expenses) {
    const d = new Date(e.expense_date + "T00:00:00");
    const k = key(d.getMonth() + 1, d.getFullYear());
    const point = months.get(k);
    if (point) point.costs += Number(e.amount);
  }

  // Session profit belongs to its session's month
  const sessionMonth = new Map(sessions.map((s) => {
    const d = new Date(s.date + "T00:00:00");
    return [s.id, key(d.getMonth() + 1, d.getFullYear())];
  }));
  for (const calc of calculations) {
    const k = sessionMonth.get(calc.session_id);
    const point = k ? months.get(k) : undefined;
    if (point) point.profit += Number(calc.profit_loss);
  }

  return [...months.values()];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
