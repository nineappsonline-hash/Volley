"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight, CalendarDays, QrCode, Users } from "lucide-react";
import { QueryState } from "@/components/shared/query-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MemberDiscoveryCarousels } from "./member-discovery-carousels";
import { MyUpcomingGames } from "./my-upcoming-games";
import { useI18n } from "@/lib/i18n";
import { EXPIRY_ALERT_THRESHOLD, formatTime12h } from "@/lib/constants";
import { usedSessionsSincePayment } from "@/lib/calculations";
import { useAllPayments, useAttendance, useProfile, useSessions, useUpcomingSessions } from "@/lib/queries";
import type { Profile } from "@/lib/types";

export function MemberDashboard({ profile }: { profile: Profile }) {
  const { lang } = useI18n();
  const { data: ownProfile } = useProfile(profile.id);
  const p = ownProfile ?? profile;
  const ar = lang === "ar";

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 py-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {ar ? "أهلاً" : "Hi"}, {p.name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ar ? "جاهز تلعب؟ شوف ماتشك الجاي." : "Ready to play? Your next game starts here."}
          </p>
        </div>
        {p.checkin_code && <Button asChild variant="outline" className="gap-2 rounded-full">
          <Link href="/profile#checkin"><QrCode className="h-4 w-4" />{ar ? "كود الحضور" : "Check-in QR"}</Link>
        </Button>}
      </header>

      <MemberDiscoveryCarousels />

      <MyUpcomingGames memberId={p.id} />
      {p.academy_id && <MemberTraining profile={p} />}

      <nav aria-label={ar ? "روابط شخصية" : "Personal links"} className="flex flex-wrap gap-3 border-t pt-4">
        <Button asChild variant="ghost" className="gap-2"><Link href="/profile">{ar ? "ملفي وتطوري" : "My profile & progress"}<ArrowUpRight className="h-4 w-4" /></Link></Button>
        <Button asChild variant="ghost" className="gap-2"><Link href="/parent"><Users className="h-4 w-4" />{ar ? "عيلتي" : "My family"}</Link></Button>
      </nav>
    </div>
  );
}

function MemberTraining({ profile }: { profile: Profile }) {
  const { t, lang, locale } = useI18n();
  const paymentsQuery = useAllPayments();
  const attendanceQuery = useAttendance();
  const sessionsQuery = useSessions();
  const upcomingQuery = useUpcomingSessions();
  const payments = (paymentsQuery.data ?? []).filter(payment => payment.member_id === profile.id);
  const used = usedSessionsSincePayment(attendanceQuery.data ?? [], sessionsQuery.data ?? [], payments);
  const remaining = Math.max(profile.subscription_sessions - used, 0);
  const progress = profile.subscription_sessions > 0 ? Math.min(100, Math.round(used / profile.subscription_sessions * 100)) : 0;
  const nextSession = upcomingQuery.data?.[0];

  return (
    <QueryState queries={[paymentsQuery, attendanceQuery, sessionsQuery, upcomingQuery]}>
      <Card className="rounded-2xl shadow-none">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-base">{lang === "ar" ? "تدريبي" : "My training"}</CardTitle>
          <Link href="/schedule" className="text-sm font-medium text-primary underline-offset-4 hover:underline">{t("nav_schedule")}</Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 text-sm">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            {nextSession ? <div>
              <p className="font-medium">{format(new Date(nextSession.date + "T00:00:00"), "EEEE, MMM d", { locale })}</p>
              <p className="mt-1 text-muted-foreground">{formatTime12h(nextSession.time, lang)}{nextSession.location ? ` · ${nextSession.location}` : ""}</p>
            </div> : <p className="text-muted-foreground">{t("profile_no_upcoming")}</p>}
          </div>
          {payments.length > 0 && <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between gap-2 text-sm"><span>{t("dash_my_remaining")}</span><span className="font-semibold">{remaining} / {profile.subscription_sessions}</span></div>
            <Progress value={progress} className="h-2" />
            {remaining <= EXPIRY_ALERT_THRESHOLD && <p role="status" className={remaining === 0 ? "text-sm text-error-ink" : "text-sm text-warning-ink"}>{remaining === 0 ? t("alert_subscription_empty") : t("alert_subscription_low").replace("{n}", String(remaining))}</p>}
          </div>}
        </CardContent>
      </Card>
    </QueryState>
  );
}
