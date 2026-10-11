"use client";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTrainingBookings, useTrainingPrograms } from "@/lib/academy-training";
import { useRecurringSchedules, useSessions } from "@/lib/queries";
import { cairoNow, eligibleProgram, futureSlots, nextTraining } from "@/lib/member-training";
import { formatTime12h } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { QueryState } from "@/components/shared/query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function MemberTrainingPreview({ profile }: { profile: Profile }) {
  const { lang, locale } = useI18n();
  const ar = lang === "ar";
  const bookings = useTrainingBookings();
  const sessions = useSessions();
  const recurring = useRecurringSchedules();
  const programs = useTrainingPrograms();
  const next = nextTraining(profile, bookings.data ?? [], sessions.data ?? [], recurring.data ?? [], cairoNow(), programs.data ?? []);
  const suggestions = (programs.data ?? []).filter(p => eligibleProgram(p, profile)).map(p => ({ p, slot: futureSlots(p.slots).find(s => s.seats_left > 0) })).filter(item => item.slot).sort((a, b) => {
    const matches = (sport: string) => Number(profile.interested_sports?.some(s => s.toLowerCase() === sport.toLowerCase()));
    return matches(b.p.sport) - matches(a.p.sport) || `${a.slot!.session_date}${a.slot!.starts_at}`.localeCompare(`${b.slot!.session_date}${b.slot!.starts_at}`);
  }).slice(0, 3);
  const dateLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(locale?.code ?? (ar ? "ar" : "en"), { weekday: "long", month: "short", day: "numeric" });
  return <Card className="overflow-hidden rounded-2xl border-emerald-300/30 bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30">
    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5 text-emerald-600" />{ar ? "التدريب القادم" : "Upcoming training"}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <QueryState queries={profile.academy_id ? [bookings, sessions, recurring, programs] : [bookings]}>
        {next && <div className="rounded-xl border bg-background/80 p-4"><p className="text-xs text-muted-foreground">{next.confirmed ? (ar ? "حجز مؤكد" : "Confirmed booking") : (ar ? "جدول الأكاديمية" : "Academy schedule")}</p><p className="mt-1 font-semibold">{next.name || (ar ? "تدريب الأكاديمية" : "Academy training")}</p><p className="mt-2 text-sm">{dateLabel(next.date)} · {formatTime12h(next.time, lang)}</p>{next.academy && <p className="text-sm">{next.academy}</p>}{next.location && <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{next.location}</p>}<Button asChild variant="outline" size="sm" className="mt-3"><Link href={next.confirmed ? "/academy-bookings" : "/schedule"}>{ar ? "عرض التفاصيل" : "View details"}</Link></Button></div>}
        {!next && profile.academy_id && <p className="text-sm text-muted-foreground">{ar ? "لا توجد جلسات قادمة في جدول أكاديميتك." : "No upcoming sessions in your academy schedule."}</p>}
      </QueryState>
      {!profile.academy_id && <QueryState queries={[programs]}><p className="text-sm text-muted-foreground">{ar ? "جرّب جلسة تدريب واكتشف أكاديميتك القادمة." : "Try a training session and find your next academy."}</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{suggestions.map(({ p, slot }) => <article key={p.id} className="flex flex-col rounded-xl border bg-background/80 p-4"><p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{p.sport}</p><h3 className="mt-1 font-semibold">{p.name}</h3><p className="text-sm text-muted-foreground">{p.academy_name}</p><p className="mt-3 text-sm">{dateLabel(slot!.session_date)} · {formatTime12h(slot!.starts_at, lang)}</p><p className="mt-1 text-xs text-muted-foreground">{p.venue_name} · {slot!.seats_left} {ar ? "أماكن متاحة" : "places available"}</p><p className="my-3 font-semibold">{p.trial_price} {ar ? "ج.م / تجربة" : "EGP / trial"}</p><Button asChild size="sm" className="mt-auto"><Link href={`/academy-bookings#training-${p.id}`}>{ar ? "احجز تجربة" : "Book a trial"}</Link></Button></article>)}</div>{!suggestions.length && <Button asChild variant="outline" className="mt-3"><Link href="/academies">{ar ? "اكتشف الأكاديميات" : "Explore academies"}</Link></Button>}</QueryState>}
    </CardContent>
  </Card>;
}
