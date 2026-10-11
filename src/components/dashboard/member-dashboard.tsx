"use client";

import Link from "next/link";
import { useTrainingBookings } from "@/lib/academy-training";
import { bookingBalance } from "@/lib/member-training";
import { MemberTrainingPreview } from "./member-training-preview";
import { CheckinQrCard } from "@/components/profile/checkin-qr-card";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock,
  QrCode,
  Users,
  Wallet,
} from "lucide-react";
import { QueryState } from "@/components/shared/query-state";
import { AcademySuggestionOnboarding } from "@/components/academies/academy-suggestion-onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MemberDiscoveryCards } from "./member-discovery-cards";
import { MyTournamentsCard } from "./my-tournaments-card";
import { DashboardNavigation, DashboardSection } from "./dashboard-navigation";
import { useI18n } from "@/lib/i18n";
import { EXPIRY_ALERT_THRESHOLD } from "@/lib/constants";
import { usedSessionsSincePayment } from "@/lib/calculations";
import { useAllPayments, useAttendance, useProfile, useSessions, useMyUpcomingGames } from "@/lib/queries";
import {
  memberActions,
  translateAction,
  type MemberAction,
} from "@/lib/member-dashboard";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types";

export function MemberDashboard({ profile }: { profile: Profile }) {
  const { t, lang } = useI18n();
  const { data: ownProfile } = useProfile(profile.id);
  const p = ownProfile ?? profile;
  const ar = lang === "ar";

  // Fed upward by the children that already own these queries, so the action
  // strip never triggers a second copy of the same request.
  const { data: games = [] } = useMyUpcomingGames(p.id);
  const [remaining, setRemaining] = useState<number | null>(null);

  const actions = useMemo(
    () => memberActions({ games, remainingSessions: remaining }),
    [games, remaining]
  );

  const sections = [
    { id: "activity", label: lang === "ar" ? "المباريات" : "Games" },
    ...(p.academy_id ? [{ id: "training", label: t("dash_section_training") }] : []),
    { id: "tournaments", label: t("dash_section_tournaments") },
  ];

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-8 pb-2">
      {p.checkin_code && <section id="checkin" className="scroll-mt-24"><CheckinQrCard code={p.checkin_code} memberName={p.name} profile={p} compact /></section>}
      <AcademySuggestionOnboarding
        memberName={p.name}
        hasAcademy={!!p.academy_id}
      />
      <DashboardNavigation hasQr={!!p.checkin_code} sections={sections} />

      <ActionStrip actions={actions} />

      <section id="activity" className="scroll-mt-24">
        <MemberDiscoveryCards memberId={p.id} hasAcademy={!!p.academy_id} preferences={p} mode="games" />
      </section>

      <MemberTrainingPreview profile={p} />

      {p.academy_id && (
        <DashboardSection id="training" title={t("dash_section_training")}>
          <div className="space-y-4">
            <MemberTraining profile={p} onRemainingChange={setRemaining} />
            {/* The QR member pass is at the top of this dashboard. */}
            {p.checkin_code && <CheckInCard />}
          </div>
        </DashboardSection>
      )}

      <DashboardSection id="tournaments" title={t("dash_section_tournaments")}>
        <div className="space-y-4">
          <MyTournamentsCard memberId={p.id} />
        </div>
      </DashboardSection>

      <nav
        aria-label={ar ? "روابط شخصية" : "Personal links"}
        className="flex flex-wrap gap-3 border-t pt-4"
      >
        <Button asChild variant="ghost" className="gap-2">
          <Link href="/academy-bookings">{ar ? "حجوزات الأكاديميات" : "Academy bookings"}</Link>
        </Button>
        <Button asChild variant="ghost" className="gap-2">
          <Link href="/profile">
            {ar ? "ملفي وتطوري" : "My profile & progress"}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" className="gap-2">
          <Link href="/parent">
            <Users className="h-4 w-4" />
            {ar ? "عيلتي" : "My family"}
          </Link>
        </Button>
      </nav>
    </div>
  );
}

const ACTION_TONES = {
  action: {
    icon: Wallet,
    className: "border-attention-500/40 bg-attention-100/70 dark:bg-attention-500/10",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-attention-500/40 bg-attention-100/70 dark:bg-attention-500/10",
  },
  info: {
    icon: Clock,
    className: "border-border bg-muted/40",
  },
} as const;

/**
 * Resolves `{n}`, `{amount}` and the English-only `{s}` plural suffix.
 */
const fill = translateAction;

/**
 * Surfaces whatever the member still owes or must do. A null href means "the
 * fix lives on this page", so it resolves to the games section anchor.
 */
function ActionStrip({ actions }: { actions: MemberAction[] }) {
  const { t, lang } = useI18n();
  if (!actions.length) return null;

  return (
    <section aria-labelledby="dash-actions-title" className="space-y-2">
      <h2 id="dash-actions-title" className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {t("dash_action_title")}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {actions.map(action => {
          const { icon: Icon, className } = ACTION_TONES[action.tone];
          return (
            <li key={action.id}>
              <div className={cn("flex h-full items-start gap-3 rounded-2xl border p-4", className)}>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/80">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{t(action.labelKey)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fill(t(action.hintKey), action.params, lang)}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href={action.href ?? "#my-upcoming-games"}>{t("dash_action_open")}</Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CheckInCard() {
  const { t } = useI18n();
  return (
    <Card className="rounded-2xl shadow-none">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <QrCode className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("dash_checkin_now")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("dash_checkin_hint")}</p>
          </div>
        </div>
        <Button asChild className="gap-2">
          <Link href="#checkin">
            <QrCode className="h-4 w-4" />
            {t("dash_checkin_now")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function MemberTraining({
  profile,
  onRemainingChange,
}: {
  profile: Profile;
  onRemainingChange: (remaining: number) => void;
}) {
  const { t, lang } = useI18n();
  const paymentsQuery = useAllPayments();
  const bookingsQuery = useTrainingBookings();
  const balance = bookingBalance(profile.id, bookingsQuery.data ?? []);
  const attendanceQuery = useAttendance();
  const sessionsQuery = useSessions();
  const payments = (paymentsQuery.data ?? []).filter(payment => payment.member_id === profile.id);
  const used = usedSessionsSincePayment(attendanceQuery.data ?? [], sessionsQuery.data ?? [], payments);
  const total = balance.hasBooking ? balance.total : profile.subscription_sessions;
  const remaining = balance.hasBooking ? balance.remaining : Math.max(total - used, 0);
  const progress =
    total > 0
      ? Math.min(100, Math.round(((total - remaining) / total) * 100))
      : 0;


  useEffect(() => {
    onRemainingChange(remaining);
  }, [remaining, onRemainingChange]);

  return (
    <QueryState queries={[paymentsQuery, bookingsQuery, attendanceQuery, sessionsQuery]}>
      <Card className="overflow-hidden rounded-2xl border-border/80 shadow-md shadow-black/5">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border/60 bg-blue-500/5 px-5 py-5">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="rounded-xl bg-blue-500/10 p-2.5"><CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-300" /></span>
            {lang === "ar" ? "تدريبي" : "My training"}
          </CardTitle>
          <Link
            href="/schedule"
            className="rounded-lg border border-border/70 bg-background px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent"
          >
            {t("nav_schedule")}
          </Link>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {(payments.length > 0 || balance.hasBooking) && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-muted/40 p-4 text-sm">
                <span>{balance.hasBooking ? (lang === "ar" ? "الجلسات المجدولة المتبقية" : "Scheduled sessions remaining") : t("dash_my_remaining")}</span>
                <span className="flex items-baseline gap-2"><strong className="text-3xl font-semibold tracking-tight">{remaining}</strong><span className="text-sm text-muted-foreground">/ {total}</span></span>
              </div>
              <Progress value={progress} className="h-2 rounded-full" />
              {remaining <= EXPIRY_ALERT_THRESHOLD && (
                <p
                  role="status"
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    remaining === 0 ? "text-error-ink" : "text-warning-ink"
                  )}
                >
                  {remaining === 0 ? (
                    <CircleAlert className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  {remaining === 0
                    ? t("alert_subscription_empty")
                    : t("alert_subscription_low").replace("{n}", String(remaining))}
                </p>
              )}
            </div>
          )}
          {!payments.length && !balance.hasBooking && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{lang === "ar" ? "لم يتم تسجيل اشتراك تدريب مؤكد بعد." : "No confirmed training subscription recorded yet."}</p>}
        </CardContent>
      </Card>
    </QueryState>
  );
}