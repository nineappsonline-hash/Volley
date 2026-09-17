"use client";

import { QueryState } from "@/components/shared/query-state";
import { attendanceSummary } from "@/lib/calculations";
import { ParentDashboard } from "@/components/workflows/parent-dashboard";
import Link from "next/link";
import { DashboardNavigation, DashboardSection } from "./dashboard-navigation";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  AlarmClock,
  CalendarDays,
  CreditCard,
  Crown,
  Receipt,
  ShieldCheck,
  Timer,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/shared/stat-card";
import { Reveal } from "@/components/shared/reveal";
import { EmptyState } from "@/components/shared/empty-state";
import { AnnouncementsCard } from "@/components/dashboard/announcements-card";
import { MyUpcomingGames } from "./my-upcoming-games";
import { MyTournamentsCard } from "@/components/dashboard/my-tournaments-card";
import { MemberPlanBanner } from "@/components/upgrade/plan-benefit-banner";
import { UpcomingTournamentsCard } from "@/components/dashboard/upcoming-tournaments-card";
import { useI18n } from "@/lib/i18n";
import { EXPIRY_ALERT_THRESHOLD, formatMoney, formatTime12h } from "@/lib/constants";
import { usedSessionsSincePayment } from "@/lib/calculations";
import {
  useAllPayments,
  useAttendance,
  useProfile,
  useSessions,
  useUpcomingSessions,
} from "@/lib/queries";
import type { Profile } from "@/lib/types";

interface MemberDashboardProps {
  profile: Profile;
}

export function MemberDashboard({ profile }: MemberDashboardProps) {
  const { t, lang, locale } = useI18n();
  const { data: ownProfile } = useProfile(profile.id);
  const paymentsQuery = useAllPayments();
  const {data: payments} = paymentsQuery;
  const attendanceQuery = useAttendance();
  const {data: attendance} = attendanceQuery;
  const sessionsQuery = useSessions();
  const {data: sessions} = sessionsQuery;
  const upcomingQuery = useUpcomingSessions();
  const {data: upcoming} = upcomingQuery;

  const p = ownProfile ?? profile;
  const myPayments = (payments ?? []).filter((x) => x.member_id === p.id);
  const totalPaid = myPayments.reduce((s, x) => s + Number(x.amount), 0);
  const lastPayment = myPayments[0] ?? null;

  const hasPlan = myPayments.length > 0;
  const used = usedSessionsSincePayment(attendance ?? [], sessions ?? [], myPayments);
  const remaining = Math.max(p.subscription_sessions - used, 0);
  const progress =
    p.subscription_sessions > 0
      ? Math.min(100, Math.round((used / p.subscription_sessions) * 100))
      : 0;

  const now = new Date();
  const {attended: attendedCount, rate: attendanceRate} = attendanceSummary(p.id, sessions ?? [], attendance ?? [], p.join_date, format(now,"yyyy-MM-dd"));

  const perSessionValue =
    myPayments.length > 0
      ? Number(myPayments[0].amount) / Math.max(myPayments[0].subscription_sessions, 1)
      : 0;

  return (
    <QueryState queries={[paymentsQuery,attendanceQuery,sessionsQuery,upcomingQuery]}><div className="space-y-8">
      <DashboardNavigation hasQr={!!p.checkin_code} />
      <ParentDashboard />
      <MemberPlanBanner memberPlan={p.member_plan} />
      {p.is_active === false && (
        <div className="flex items-center gap-3 rounded-lg border border-attention-300/60 bg-attention-50 p-4 text-sm dark:bg-attention-500/10">
          <Timer className="h-5 w-5 shrink-0 text-warning-ink" />
          <p className="text-warning-ink dark:text-attention-300">
            {t("members_pending_approval")}
          </p>
        </div>
      )}
      {p.member_plan === "premium" && (
        <div className="flex items-center gap-3 rounded-lg border border-attention-300/60 bg-attention-50 p-4 text-sm dark:bg-attention-500/10">
          <Crown className="h-5 w-5 shrink-0 text-warning-ink" />
          <p className="font-medium text-warning-ink dark:text-attention-300">
            {t("premium_active_message")}
          </p>
        </div>
      )}
      {hasPlan && remaining > 0 && remaining <= EXPIRY_ALERT_THRESHOLD && (
        <div className="flex items-center gap-3 rounded-lg border border-attention-300/60 bg-attention-50 p-4 text-sm dark:bg-attention-500/10">
          <AlarmClock className="h-5 w-5 shrink-0 text-warning-ink" />
          <p className="text-warning-ink dark:text-attention-300">
            {t("alert_subscription_low").replace("{n}", String(remaining))}
          </p>
        </div>
      )}
      {hasPlan && remaining <= 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-negative-300/60 bg-negative-50 p-4 text-sm dark:bg-negative-500/10">
          <AlarmClock className="h-5 w-5 shrink-0 text-error-ink" />
          <p className="text-error-ink dark:text-negative-300">
            {t("alert_subscription_empty")}
          </p>
        </div>
      )}
      <MyUpcomingGames memberId={p.id} />
      <DashboardSection id="overview" title={lang === "ar" ? "نظرة عامة" : "Overview"} hint={lang === "ar" ? "أهم الأرقام في مكان واحد" : "Your key numbers at a glance"}>
      <Reveal>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("dash_my_remaining")}
          value={hasPlan ? `${remaining} / ${p.subscription_sessions}` : t("membership_none")}
          icon={Timer}
          tone={hasPlan ? (remaining > 0 ? "success" : "destructive") : "default"}
          hint={hasPlan ? t("dash_sessions_used") : undefined}
          index={0}
        />
        <StatCard
          title={t("dash_my_last_payment")}
          value={lastPayment ? formatMoney(Number(lastPayment.amount), lang) : "—"}
          icon={Receipt}
          tone="info"
          hint={
            lastPayment
              ? format(new Date(lastPayment.payment_date + "T00:00:00"), "MMM d, yyyy", { locale })
              : t("common_never")
          }
          index={1}
        />
        <StatCard
          title={t("dash_my_attendance_rate")}
          value={attendanceRate === null ? "—" : `${attendanceRate}%`}
          icon={TrendingUp}
          tone={(attendanceRate ?? 0) >= 70 ? "success" : "warning"}
          hint={`${attendedCount} ${t("schedule_attending")}`}
          index={2}
        />
        <StatCard
          title={t("dash_my_status")}
          value={
            hasPlan ? (remaining > 0 ? t("dash_active") : t("dash_expired")) : t("membership_none")
          }
          icon={ShieldCheck}
          tone={hasPlan ? (remaining > 0 ? "brand" : "destructive") : "default"}
          index={3}
        />
      </div>
      </Reveal>
      </DashboardSection>

      <DashboardSection id="training" title={lang === "ar" ? "التدريب والمتابعة" : "Training & activity"} hint={lang === "ar" ? "مواعيدك وتفاصيل المتابعة" : "Schedules and activity details"}>
      <Reveal index={1}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="h-4 w-4 text-positive-500" />
              {t("dash_my_remaining")}
              {hasPlan && (
                <Badge variant={p.membership_type === "half" ? "outline" : "secondary"}>
                  {p.membership_type === "half" ? t("membership_half") : t("membership_full")}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasPlan ? (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {used} {t("dash_sessions_used")}
                  </span>
                  <span className="font-semibold">
                    {remaining} {t("profile_sessions_left")}
                  </span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <Timer className="h-4 w-4 shrink-0" />
                {t("members_no_plan_msg")}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              <div className="rounded-lg border border-positive-300/50 bg-positive-50/70 p-3 dark:bg-positive-500/10">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5 text-success-ink" />
                  {t("member_total_paid")}
                </p>
                <p className="mt-1 font-extrabold font-mono text-success-ink">{formatMoney(totalPaid, lang)}</p>
              </div>
              <div className="rounded-lg border border-interactive-300/50 bg-interactive-50/70 p-3 dark:bg-interactive-500/10">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5 text-info-ink" />
                  {t("profile_your_share")}
                </p>
                <p className="mt-1 font-extrabold font-mono text-info-ink">
                  {perSessionValue > 0 ? formatMoney(perSessionValue, lang) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-interactive-500" />
              {t("profile_upcoming_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!upcoming || upcoming.length === 0 ? (
              <EmptyState message={t("profile_no_upcoming")} icon={CalendarDays} />
            ) : (
              (upcoming ?? []).slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {format(new Date(s.date + "T00:00:00"), "EEEE, MMM d", { locale })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime12h(s.time, lang)}
                      {s.location ? ` · ${s.location}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {formatTime12h(s.time, lang)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
      </Reveal>
      </DashboardSection>
      <DashboardSection id="tournaments" title={t("td_my_tournaments")} hint={lang === "ar" ? "بطولاتك ونتائجك في مكان واحد" : "Your tournaments and results in one place"}>
        <MyTournamentsCard memberId={p.id} />
      </DashboardSection>
      <DashboardSection id="updates" title={lang === "ar" ? "الأخبار والتنبيهات" : "Updates"}>
        <Reveal index={2}>
        <div className="space-y-5">
          <UpcomingTournamentsCard />
          <AnnouncementsCard isAdmin={false} />
        </div>
        </Reveal>
      </DashboardSection>
    </div></QueryState>
  );
}
