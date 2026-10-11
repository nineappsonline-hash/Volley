import type { Profile, RecurringSchedule, TrainingSession } from "./types";
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
  const booked = bookings.filter(b => b.member_id === member.id && b.status === "approved").flatMap(b => futureSlots(b.details.sessions, now).map(s => ({ date: s.session_date, time: s.starts_at, name: b.details.program, location: b.details.playground, academy: b.details.academy, confirmed: true })));
  const scheduled = sessions.filter(s => s.academy_id === member.academy_id && member.academy_id && !s.is_completed && s.status !== "canceled" && `${s.date}T${s.time}` > now).map(s => ({ date: s.date, time: s.time, name: "", location: s.location, academy: "", confirmed: false }));
  const weekly = recurring.filter(s => member.academy_id && s.academy_id === member.academy_id && s.is_active).flatMap(s => {
    const start = s.start_date > now.slice(0, 10) ? s.start_date : now.slice(0, 10);
    const day = new Date(`${start}T00:00:00Z`);
    for (let i = 0; i < 8; i++, day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      if (date > s.end_date) break;
      if (day.getUTCDay() === s.weekday && `${date}T${s.time}` > now && !sessions.some(existing => existing.academy_id === s.academy_id && existing.date === date && existing.time === s.time)) return [{ date, time: s.time, name: s.name, location: null, academy: "", confirmed: false }];
    }
    return [];
  });
  const groups = programs.filter(p => p.academy_id === member.academy_id && eligibleProgram(p, member)).flatMap(p => futureSlots(p.slots, now).map(s => ({ date: s.session_date, time: s.starts_at, name: p.name, location: p.venue_name, academy: p.academy_name, confirmed: false })));
  // A booked group is authoritative; other academy groups are only a schedule preview.
  return (booked.length ? booked : [...scheduled, ...weekly, ...groups]).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
}
