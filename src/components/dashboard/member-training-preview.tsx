"use client";
import styles from "./dashboard.module.css";
import { AcademyLogo } from "@/components/academies/academy-logo";
import { useMemberTraining } from "@/lib/use-member-training";
import Link from "next/link";
import { CalendarDays, MapPin, Clock, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { eligibleProgram, futureSlots } from "@/lib/member-training";
import { formatTime12h } from "@/lib/constants";
import type { Profile } from "@/lib/types";
import { QueryState } from "@/components/shared/query-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function MemberTrainingPreview({ profile }: { profile: Profile }) {
  const { lang, locale } = useI18n();
  const ar = lang === "ar";
  const { bookings, programs, sessions, recurring, agenda } = useMemberTraining(profile);
  const next = agenda[0];
  const suggestions = (programs.data ?? []).filter(p => eligibleProgram(p, profile)).map(p => ({ p, slot: futureSlots(p.slots).find(s => s.seats_left > 0) })).filter(item => item.slot).sort((a, b) => {
    const matches = (sport: string) => Number(profile.interested_sports?.some(s => s.toLowerCase() === sport.toLowerCase()));
    return matches(b.p.sport) - matches(a.p.sport) || `${a.slot!.session_date}${a.slot!.starts_at}`.localeCompare(`${b.slot!.session_date}${b.slot!.starts_at}`);
  }).slice(0, 3);
  const dateLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(locale?.code ?? (ar ? "ar" : "en"), { weekday: "long", month: "short", day: "numeric" });
  return <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
    <CardHeader className={`${styles.colorCardHeader} ${styles.compactCardHeader} bg-gradient-to-br from-brand to-brand-900`}><CardTitle className="flex items-center gap-3 text-base"><span className="rounded-lg bg-white/10 p-2"><CalendarDays className="h-5 w-5 text-white" /></span>{ar ? "التدريب الجاي" : "Upcoming training"}</CardTitle><p className={styles.colorCardHint}>{ar ? "موعدك الجاي في الأكاديمية، وكل التفاصيل في مكان واحد." : "Your next academy session, with every detail in one place."}</p></CardHeader>
    <CardContent className="space-y-3 p-4">
      <QueryState queries={profile.academy_id ? [bookings, sessions, recurring, programs] : [bookings]}>
        {next && <div className="space-y-3">
          <div className="flex items-start gap-3">
            {next.academyId && <AcademyLogo academyId={next.academyId} name={next.academy || next.name} />}
            <div className="min-w-0 flex-1"><p className="text-xs font-medium text-muted-foreground">{next.academy}</p><h3 className="mt-1 text-base font-semibold leading-snug tracking-tight">{next.name || (ar ? "تدريب الأكاديمية" : "Academy training")}</h3><span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 ">{next.confirmed && <CheckCircle2 className="h-3.5 w-3.5" />}{next.confirmed ? (ar ? "حجز مؤكد" : "Confirmed booking") : (ar ? "جدول الأكاديمية" : "Academy schedule")}</span></div>
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/40 p-3"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4" />{ar ? "اليوم والتاريخ" : "Day & date"}</dt><dd className="mt-1 text-sm font-semibold">{dateLabel(next.date)}</dd></div>
            <div className="rounded-lg bg-muted/40 p-3"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-4 w-4" />{ar ? "الوقت" : "Time"}</dt><dd className="mt-1 text-sm font-semibold">{formatTime12h(next.time, lang)}</dd></div>
            {next.location && <div className="rounded-lg bg-muted/40 p-3 col-span-2"><dt className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-4 w-4" />{ar ? "الملعب" : "Playground"}</dt><dd className="mt-1 text-sm font-semibold">{next.location}</dd></div>}
          </dl>
          <div className="border-t border-border/60 pt-3"><Button asChild variant="outline" className="w-full gap-2 rounded-lg sm:w-auto"><Link href={next.href}>{ar ? "عرض تفاصيل التدريب" : "View training details"}<ArrowUpRight className="h-4 w-4" /></Link></Button></div>
        </div>}
        {!next && profile.academy_id && <p className="text-sm text-muted-foreground">{ar ? "مفيش جلسات قادمة في جدول أكاديميتك." : "No upcoming sessions in your academy schedule."}</p>}
      </QueryState>
      {!profile.academy_id && <QueryState queries={[programs]}><p className="text-sm text-muted-foreground">{ar ? "جرّب جلسة تدريب واكتشف أكاديميتك الجاية." : "Try a training session and find your next academy."}</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{suggestions.map(({ p, slot }) => <article key={p.id} className="flex flex-col rounded-xl border bg-background/80 p-3"><p className="text-xs font-medium text-emerald-700 ">{p.sport}</p><h3 className="mt-1 font-semibold">{p.name}</h3><p className="text-sm text-muted-foreground">{p.academy_name}</p><p className="mt-3 text-sm">{dateLabel(slot!.session_date)} · {formatTime12h(slot!.starts_at, lang)}</p><p className="mt-1 text-xs text-muted-foreground">{p.venue_name} · {slot!.seats_left} {ar ? "أماكن متاحة" : "places available"}</p><p className="my-3 font-semibold">{p.trial_price} {ar ? "ج.م / تجربة" : "EGP / trial"}</p><Button asChild size="sm" className="mt-auto"><Link href={`/academy-bookings#training-${p.id}`}>{ar ? "احجز تجربة" : "Book a trial"}</Link></Button></article>)}</div>{!suggestions.length && <Button asChild variant="outline" className="mt-3"><Link href="/academies">{ar ? "اكتشف الأكاديميات" : "Explore academies"}</Link></Button>}</QueryState>}
    </CardContent>
  </Card>;
}
