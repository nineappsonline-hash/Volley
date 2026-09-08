"use client";

import Link from "next/link";
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
import { EmptyState } from "@/components/shared/empty-state";
import { UpcomingSessions } from "@/components/schedule/upcoming-sessions";
import { ProfitLossIndicator } from "@/components/shared/profit-loss-indicator";
import { AdminAlerts } from "@/components/dashboard/admin-alerts";
import { AnnouncementsCard } from "@/components/dashboard/announcements-card";
import { TrialsCard } from "@/components/dashboard/trials-card";
import { AdminPlanBanner } from "@/components/upgrade/plan-benefit-banner";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import {
  useAcademy,
  useAllPayments,
  useMonthlyCosts,
  useProfiles,
  useSessionCalculations,
  useSessions,
} from "@/lib/queries";

export function AdminDashboard() {
  const { t, lang, locale } = useI18n();
  const { data: profiles, isLoading: loadingProfiles } = useProfiles();
  const { data: payments } = useAllPayments();
  const { data: costs } = useMonthlyCosts();
  const { data: sessions } = useSessions();
  const { data: calculations } = useSessionCalculations();
  const { data: academy } = useAcademy();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const members = (profiles ?? []).filter((p) => p.role === "member");
  const monthlyPayments = (payments ?? []).filter((p) => {
    const d = new Date(p.payment_date + "T00:00:00");
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const monthlyRevenue = monthlyPayments.reduce((s, p) => s + Number(p.amount), 0);
  const monthCost = (costs ?? []).find((c) => c.month === month && c.year === year);
  const monthlyCosts = monthCost
    ? Number(monthCost.coach_fee) + Number(monthCost.court_rental)
    : 0;
  const net = monthlyRevenue - monthlyCosts;

  const recentSessions = (sessions ?? [])
    .filter((s) => s.date <= now.toISOString().slice(0, 10))
    .slice(0, 5);

  const calcBySession = new Map(
    (calculations ?? []).map((c) => [c.session_id, c])
  );

  const incomplete =
    academy != null &&
    (!academy.name.trim() || academy.lat == null || academy.lng == null);

  return (
    <div className="space-y-6">
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
              title={t("dash_total_members")}
              value={String(members.length)}
              icon={Users}
              hint={members.length > 0 ? `${members.length} ${t("role_member")}` : undefined}
            />
            <StatCard
              title={t("dash_monthly_revenue")}
              value={formatMoney(monthlyRevenue, lang)}
              icon={Receipt}
              tone="success"
              hint={`${monthlyPayments.length} ${t("notif_new_payment").toLowerCase()}`}
            />
            <StatCard
              title={t("dash_monthly_costs")}
              value={formatMoney(monthlyCosts, lang)}
              icon={CreditCard}
              tone="warning"
            />
            <StatCard
              title={t("dash_net_profit")}
              value={formatMoney(net, lang)}
              icon={PiggyBank}
              tone={net >= 0 ? "success" : "destructive"}
            />
          </>
        )}
      </div>

      <AdminAlerts />
      <AnnouncementsCard isAdmin />
      <TrialsCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingSessions isAdmin />
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              {t("dash_attendance_summary")}
            </CardTitle>
            <Link
              href="/reports"
              className="text-sm font-medium text-primary hover:underline"
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
                        · {s.time.slice(0, 5)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.status === "canceled"
                          ? t("schedule_canceled")
                          : s.status === "completed"
                            ? t("schedule_completed")
                            : t("schedule_today")}
                      </p>
                    </div>
                    {calc && (
                      <ProfitLossIndicator value={calc.profit_loss} showLabel={false} />
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
