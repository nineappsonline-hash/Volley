"use client";

import { QueryState } from "@/components/shared/query-state";
import { buildMonthlyPoints } from "@/lib/financial-summary";
import { useExpenses, useVenueRentals, useSessionGuests } from "@/lib/queries";
import { TrainingRenewal } from "@/components/workflows/player-workflows";
import Link from "next/link";
import { DashboardNavigation, DashboardSection } from "./dashboard-navigation";
import { format } from "date-fns";
import {
  CalendarClock,
  CreditCard,
  PiggyBank,
  Receipt,
  Rocket,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { Reveal } from "@/components/shared/reveal";
import { EmptyState } from "@/components/shared/empty-state";
import { UpcomingSessions } from "@/components/schedule/upcoming-sessions";
import { ProfitLossIndicator } from "@/components/shared/profit-loss-indicator";
import { AdminAlerts } from "@/components/dashboard/admin-alerts";
import { AnnouncementsCard } from "@/components/dashboard/announcements-card";
import { TrialsCard } from "@/components/dashboard/trials-card";
import { AdminPlanBanner } from "@/components/upgrade/plan-benefit-banner";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatTime12h } from "@/lib/constants";
import {
  useAcademy,
  useAttendanceCounts,
  useAllPayments,
  useMonthlyCosts,
  useProfiles,
  useSessionCalculations,
  useSessions,
} from "@/lib/queries";

export function AdminDashboard() {
  const { t, lang, locale } = useI18n();
  const profilesQuery = useProfiles();
  const { data: profiles, isLoading: loadingProfiles } = profilesQuery;
  const paymentsQuery = useAllPayments();
  const { data: payments } = paymentsQuery;
  const costsQuery = useMonthlyCosts();
  const { data: costs } = costsQuery;
  const sessionsQuery = useSessions();
  const { data: sessions } = sessionsQuery;
  const calculationsQuery = useSessionCalculations();
  const { data: calculations } = calculationsQuery;
  const academyQuery = useAcademy();
  const { data: academy } = academyQuery;
  const attendanceQuery = useAttendanceCounts();

  const expensesQuery = useExpenses();
  const rentalsQuery = useVenueRentals();
  const guestsQuery = useSessionGuests();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const members = (profiles ?? []).filter((p) => p.role === "member");
  const monthlyPayments = (payments ?? []).filter((p) => {
    const d = new Date(p.payment_date + "T00:00:00");
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const point = buildMonthlyPoints(
    payments ?? [], costs ?? [], calculations ?? [], sessions ?? [], expensesQuery.data ?? [], rentalsQuery.data ?? [], guestsQuery.data ?? []
  ).find(p => p.label === `${now.toLocaleString("en-US", {month:"short"})} ${year}`);
  const monthlyRevenue = point?.revenue ?? 0;
  const monthlyCosts = point?.costs ?? 0;
  const net = monthlyRevenue - monthlyCosts;

  const recentSessions = (sessions ?? [])
    .filter((s) => s.date <= format(now, "yyyy-MM-dd"))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    .slice(0, 5);

  const calcBySession = new Map(
    (calculations ?? []).map((c) => [c.session_id, c])
  );

  const incomplete = academy != null && !academy.logo_url;

  return (
    <QueryState queries={[profilesQuery,paymentsQuery,costsQuery,sessionsQuery,calculationsQuery,expensesQuery,rentalsQuery,guestsQuery,academyQuery,attendanceQuery]}><div className="space-y-8">
      <DashboardNavigation admin />
      {incomplete && (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up">
          <div className="flex items-center gap-3">
            <Rocket className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("onboarding_banner_title")}</p>
              <p className="text-xs text-muted-foreground">
                {t("onboarding_banner_hint")}
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link href="/onboarding">{t("onboarding_banner_cta")}</Link>
          </Button>
        </div>
      )}
      {academy && (
        <AdminPlanBanner plan={academy.plan} isTrial={academy.is_trial} />
      )}
      <AdminAlerts />
      <DashboardSection id="overview" title={lang === "ar" ? "نظرة عامة" : "Overview"} hint={lang === "ar" ? "أهم الأرقام في مكان واحد" : "Your key numbers at a glance"}>
      <Reveal>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingProfiles ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : (
          <>
            <StatCard
              colorful
              title={t("dash_total_members")}
              value={String(members.length)}
              icon={Users}
              tone="info"
              hint={members.length > 0 ? `${members.length} ${t("role_member")}` : undefined}
              index={0}
            />
            <StatCard
              colorful
              title={t("dash_monthly_revenue")}
              value={formatMoney(monthlyRevenue, lang)}
              icon={Receipt}
              tone="success"
              hint={`${monthlyPayments.length} ${t("notif_new_payment").toLowerCase()}`}
              index={1}
            />
            <StatCard
              colorful
              title={t("dash_monthly_costs")}
              value={formatMoney(monthlyCosts, lang)}
              icon={CreditCard}
              tone="warning"
              index={2}
            />
            <StatCard
              colorful
              title={t("dash_net_profit")}
              value={formatMoney(net, lang)}
              icon={PiggyBank}
              tone={net >= 0 ? "success" : "destructive"}
              hint={t("dash_net_profit_hint")}
              index={3}
            />
          </>
        )}
      </div>
      </Reveal>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("dash_net_profit_note")}
        <Link href="/reports" className="font-medium text-primary hover:underline">
          {t("dash_financial_report_link")}
        </Link>
      </p>

      </DashboardSection>

      <DashboardSection id="training" title={lang === "ar" ? "التدريب والمتابعة" : "Training & activity"} hint={lang === "ar" ? "مواعيدك وتفاصيل المتابعة" : "Schedules and activity details"}>
      <Reveal index={1}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingSessions isAdmin />
        <Card className="overflow-hidden rounded-2xl">
          <CardHeader className="mb-4 flex-row flex-wrap items-center justify-between gap-3 space-y-0 bg-gradient-to-br from-blue-800 to-indigo-800 text-white">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5 text-blue-200" />
              {t("dash_attendance_summary")}
            </CardTitle>
            <Link
              href="/reports"
              className="text-sm font-medium text-white underline-offset-4 hover:underline"
            >
              {t("nav_reports")}
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSessions.length === 0 ? (
              <EmptyState message={t("dash_no_sessions")} icon={CalendarClock} />
            ) : (
              recentSessions.map((s) => {
                const calc = calcBySession.get(s.id);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {format(new Date(s.date + "T00:00:00"), "EEE, MMM d", {
                          locale,
                        })}{" "}
                        · {formatTime12h(s.time, lang)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.status === "canceled"
                          ? t("schedule_canceled")
                          : s.status === "completed"
                            ? t("schedule_completed")
                            : t("schedule_today")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs font-semibold">{attendanceQuery.data?.[s.id]?.present ?? 0} / {attendanceQuery.data?.[s.id]?.total ?? 0} {lang === "ar" ? "حاضر" : "present"}</span>
                      <Link href={`/schedule?session=${s.id}`} className="text-xs font-medium text-primary underline underline-offset-4">{lang === "ar" ? "تفاصيل الحصة" : "Session details"}</Link>
                    {calc && (
                      <ProfitLossIndicator value={calc.profit_loss} showLabel={false} />
                    )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
      </Reveal>
      </DashboardSection>
      <DashboardSection id="updates" title={lang === "ar" ? "الأخبار والتنبيهات" : "Updates"}>
        <Reveal index={2}>
        <div className="space-y-5"><TrainingRenewal admin /><AnnouncementsCard isAdmin /><TrialsCard /></div>
        </Reveal>
      </DashboardSection>
    </div></QueryState>
  );
}
