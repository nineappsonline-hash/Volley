import type { Profile, RecurringSchedule, TrainingSession, Payment } from "./types";
import type { TrainingBooking, TrainingProgram, TrainingSlot } from "./academy-training";

export function cairoNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}`;
}
export function futureSlots(slots: TrainingSlot[], now = cairoNow()) {
  return slots.filter(s => `${s.session_date}T${s.starts_at}` > now).sort((a, b) => `${a.session_date}T${a.starts_at}`.localeCompare(`${b.session_date}T${b.starts_at}`));
}
export function profileAge(birth: string | null, today = cairoNow().slice(0, 10)) {
  if (!birth) return null;
  const age = Number(today.slice(0, 4)) - Number(birth.slice(0, 4)) - Number(today.slice(5) < birth.slice(5));
  return Number.isFinite(age) && age >= 0 ? age : null;
}
export function eligibleProgram(p: TrainingProgram, member: Profile) {
  const age = profileAge(member.birth_date);
  return p.active && (p.gender === "mixed" || p.gender === member.gender)
    && (p.min_age == null || (age != null && age >= p.min_age))
    && (p.max_age == null || (age != null && age <= p.max_age));
}
export function nextTraining(member: Profile, bookings: TrainingBooking[], sessions: TrainingSession[], recurring: RecurringSchedule[], now = cairoNow(), programs: TrainingProgram[] = []) {
  return trainingAgenda(member, bookings, sessions, recurring, programs, now)[0];
}


export function trainingPaymentHistory(memberId: string, payments: Payment[], bookings: TrainingBooking[]) {
  return [
    ...payments.filter(p => p.member_id === memberId).map(p => ({ id: p.id, amount: Number(p.amount), date: p.payment_date, sessions: p.subscription_sessions, label: p.membership_type === "half" ? "half" : "full", source: "legacy" })),
    ...bookings.filter(b => b.member_id === memberId && b.status === "approved" && Number(b.amount) > 0).map(b => ({ id: b.id, amount: Number(b.amount), date: b.reviewed_at ? cairoNow(new Date(b.reviewed_at)).slice(0, 10) : b.registered_on, sessions: b.details.sessions.length, label: b.details.program, source: "booking" })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
export function bookingBalance(memberId: string, bookings: TrainingBooking[], now = cairoNow()) {
  const active = bookings.filter(b => b.member_id === memberId && b.status === "approved" && b.expires_on > now.slice(0, 10));
  return { hasBooking: active.length > 0, total: active.reduce((n, b) => n + b.details.sessions.length, 0), remaining: active.reduce((n, b) => n + futureSlots(b.details.sessions, now).length, 0) };
}

export type TrainingAgendaItem = { id: string; date: string; time: string; name: string; location: string | null; academyId: string | null; academy: string; href: string; confirmed: boolean };
export function trainingAgenda(member: Profile, bookings: TrainingBooking[], sessions: TrainingSession[], recurring: RecurringSchedule[], programs: TrainingProgram[], now = cairoNow()): TrainingAgendaItem[] {
  const booked = bookings.filter(b => b.member_id === member.id && b.status === "approved").flatMap(b => futureSlots(b.details.sessions, now).map(s => ({ id: `booking:${b.id}:${s.session_date}:${s.starts_at}`, date: s.session_date, time: s.starts_at, name: b.details.program, location: b.details.playground, academyId: programs.find(p => p.id === b.program_id)?.academy_id ?? member.academy_id, academy: b.details.academy, href: "/academy-bookings", confirmed: true })));
  const legacy = sessions.filter(s => member.academy_id && s.academy_id === member.academy_id && !s.is_completed && s.status !== "canceled" && `${s.date}T${s.time}` > now).map(s => ({ id: s.id, date: s.date, time: s.time, name: s.notes || "", location: s.location, academyId: s.academy_id, academy: "", href: `/schedule?session=${s.id}`, confirmed: false }));
  const weekly: TrainingAgendaItem[] = [];
  for (const s of recurring.filter(s => member.academy_id && s.academy_id === member.academy_id && s.is_active)) {
    const day = new Date(`${now.slice(0, 10)}T00:00:00Z`);
    for (let i = 0; i < 90; i++, day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      if (date > s.end_date) break;
      if (date >= s.start_date && day.getUTCDay() === s.weekday && `${date}T${s.time}` > now && !sessions.some(e => e.academy_id === s.academy_id && e.date === date && e.time.slice(0, 5) === s.time.slice(0, 5))) weekly.push({ id: `weekly:${s.id}:${date}`, date, time: s.time, name: s.name, location: null, academyId: s.academy_id, academy: "", href: "/schedule", confirmed: false });
    }
  }
  const groups = programs.filter(p => member.academy_id && p.academy_id === member.academy_id && eligibleProgram(p, member)).flatMap(p => futureSlots(p.slots, now).map(s => ({ id: `program:${p.id}:${s.session_date}:${s.starts_at}`, date: s.session_date, time: s.starts_at, name: p.name, location: p.venue_name, academyId: p.academy_id, academy: p.academy_name, href: `/academy-bookings#training-${p.id}`, confirmed: false })));
  const result = booked.length ? booked : [...legacy, ...weekly, ...groups];
  return result.filter((item, index) => result.findIndex(other => other.date === item.date && other.time.slice(0, 5) === item.time.slice(0, 5) && other.academyId === item.academyId && other.name === item.name) === index).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}
