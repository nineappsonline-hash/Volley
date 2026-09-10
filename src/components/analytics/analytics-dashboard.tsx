"use client";

import { useMemo } from "react";
import { format, subDays, startOfWeek, endOfWeek, eachWeekOfInterval, startOfMonth, eachMonthOfInterval } from "date-fns";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  CalendarCheck,
  CreditCard,
  Trophy,
  UserCheck,
  Clock,
  Target,
  Activity,
  PieChart,
  DollarSign,
  Zap,
  UserPlus,
  Layers,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { downloadCSV } from "@/lib/export";
import { useSessions, useAttendance, useProfiles, useAllPayments, useExpenses, useMonthlyCosts, useCoaches, useSessionCalculations, useSports, useSessionGuests, useVenueRentals } from "@/lib/queries";
import { buildMonthlyPoints } from "@/lib/financial-summary";
import { QueryState } from "@/components/shared/query-state";

export function AnalyticsDashboard() {
  const { t, lang } = useI18n();
  const sessionsQuery = useSessions();
  const attendanceQuery = useAttendance();
  const profilesQuery = useProfiles();
  const paymentsQuery = useAllPayments();
  const expensesQuery = useExpenses();
  const costsQuery = useMonthlyCosts();
  const coachesQuery = useCoaches();
  const calculationsQuery = useSessionCalculations();
  const sportsQuery = useSports();
  const rentalsQuery = useVenueRentals();
  const guestsQuery = useSessionGuests();
  const { data: sessions = [] } = sessionsQuery;
  const { data: attendance = [] } = attendanceQuery;
  const { data: profiles = [] } = profilesQuery;
  const { data: payments = [] } = paymentsQuery;
  const { data: expenses = [] } = expensesQuery;
  const { data: monthlyCosts = [] } = costsQuery;
  const { data: coaches = [] } = coachesQuery;
  const { data: calculations = [] } = calculationsQuery;
  const { data: rentals = [] } = rentalsQuery;
  const { data: guests = [] } = guestsQuery;

  // Attendance eligibility: only completed (held) sessions count toward rates,
  // so cancelled sessions can never penalise or inflate a member's percentage.
  const completedSessionIds = useMemo(
    () => new Set(sessions.filter((s) => s.status === "completed").map((s) => s.id)),
    [sessions]
  );

  // ── Overview Stats ──
  const stats = useMemo(() => {
    const activeMembers = profiles.filter((p) => p.is_active && p.role === "member");
    const totalMembers = profiles.filter((p) => p.role === "member").length;
    const completedSessions = sessions.filter((s) => s.status === "completed");
    // Use the same reconciled source as the financial reports page: revenue =
    // payments + paid rentals + guest walk-ins; costs = monthly overhead + expenses.
    const points = buildMonthlyPoints(
      payments, monthlyCosts, [], sessions, expenses, rentals, guests
    );
    const totalRevenue = points.reduce((s, p) => s + p.revenue, 0);
    const totalCosts = points.reduce((s, p) => s + p.costs, 0);
    const profit = totalRevenue - totalCosts;
    const totalPresent = attendance.filter((a) => a.is_present && completedSessionIds.has(a.session_id)).length;

    return {
      activeMembers,
      totalMembers,
      totalSessions: completedSessions.length,
      totalRevenue,
      totalExpenses: totalCosts,
      profit,
      attendanceRate: completedSessions.length > 0
        ? ((totalPresent / (completedSessions.length * activeMembers.length)) * 100).toFixed(0)
        : "0",
    };
  }, [profiles, sessions, attendance, payments, expenses, monthlyCosts, rentals, guests, completedSessionIds]);

  // ── Weekly Attendance Trend (last 12 weeks) ──
  const weeklyTrend = useMemo(() => {
    const now = new Date();
    const twelveWeeksAgo = subDays(now, 84);
    const weeks = eachWeekOfInterval({ start: twelveWeeksAgo, end: now });

    return weeks.map((weekStart) => {
      const weekEnd = endOfWeek(weekStart);
      const weekSessions = sessions.filter((s) => {
        const d = new Date(s.date);
        return s.status === "completed" && d >= weekStart && d <= weekEnd;
      });
      const weekAttendance = attendance.filter((a) => {
        if (!a.is_present) return false;
        return weekSessions.some((s) => s.id === a.session_id);
      });

      return {
        label: format(weekStart, "MMM d"),
        sessions: weekSessions.length,
        attendance: weekAttendance.length,
        rate: weekSessions.length > 0
          ? Math.round((weekAttendance.length / (weekSessions.length * Math.max(stats.activeMembers.length, 1))) * 100)
          : 0,
      };
    });
  }, [sessions, attendance, stats.activeMembers]);

  const maxWeeklyAttendance = Math.max(...weeklyTrend.map((w) => w.attendance), 1);

  // ── Monthly Revenue vs Expenses ──
  const monthlyFinancials = useMemo(() => {
    const monthMap = new Map<string, { revenue: number; expenses: number }>();

    payments.forEach((p) => {
      const key = p.payment_date.slice(0, 7);
      const existing = monthMap.get(key) || { revenue: 0, expenses: 0 };
      existing.revenue += Number(p.amount);
      monthMap.set(key, existing);
    });

    expenses.forEach((e) => {
      const key = e.expense_date.slice(0, 7);
      const existing = monthMap.get(key) || { revenue: 0, expenses: 0 };
      existing.expenses += Number(e.amount);
      monthMap.set(key, existing);
    });

    // Monthly overhead (coach fee + court rental) is a recurring cost each month.
    monthlyCosts.forEach((c) => {
      const key = `${c.year}-${String(c.month).padStart(2, "0")}`;
      const existing = monthMap.get(key) || { revenue: 0, expenses: 0 };
      existing.expenses += Number(c.coach_fee) + Number(c.court_rental);
      monthMap.set(key, existing);
    });

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, data]) => ({
        label: format(new Date(month + "-01"), "MMM yyyy"),
        ...data,
      }));
  }, [payments, expenses, monthlyCosts]);

  const maxMonthlyRevenue = Math.max(...monthlyFinancials.map((m) => m.revenue), 1);

  // ── Member Retention (members with no attendance in last 14/30 days) ──
  const retention = useMemo(() => {
    const now = new Date();
    const fourteenDaysAgo = subDays(now, 14);
    const thirtyDaysAgo = subDays(now, 30);

    const activeMembers = profiles.filter((p) => p.is_active && p.role === "member");

    const recentAttendees = new Set(
      attendance
        .filter((a) => a.is_present && completedSessionIds.has(a.session_id) && new Date(a.marked_at) >= fourteenDaysAgo)
        .map((a) => a.member_id)
    );

    const monthAttendees = new Set(
      attendance
        .filter((a) => a.is_present && completedSessionIds.has(a.session_id) && new Date(a.marked_at) >= thirtyDaysAgo)
        .map((a) => a.member_id)
    );

    const churnRisk = activeMembers.filter((m) => !recentAttendees.has(m.id));
    const atRisk = activeMembers.filter((m) => !monthAttendees.has(m.id));
    const healthy = activeMembers.filter((m) => recentAttendees.has(m.id));

    return {
      healthy: healthy.length,
      atRisk: churnRisk.length,
      churned: atRisk.length,
      total: activeMembers.length,
    };
  }, [profiles, attendance, completedSessionIds]);

  // ── Top Attendees ──
  const topAttendees = useMemo(() => {
    const activeMembers = profiles.filter((p) => p.is_active && p.role === "member");
    const completedSessions = sessions.filter((s) => s.status === "completed");

    return activeMembers
      .map((m) => {
        const attended = attendance.filter((a) => a.member_id === m.id && a.is_present && completedSessionIds.has(a.session_id)).length;
        return {
          name: m.name,
          attended,
          total: completedSessions.length,
          rate: completedSessions.length > 0
            ? Math.round((attended / completedSessions.length) * 100)
            : 0,
        };
      })
      .sort((a, b) => b.attended - a.attended)
      .slice(0, 8);
  }, [profiles, sessions, attendance, completedSessionIds]);

  // ── Coach Performance ──
  const coachPerformance = useMemo(() => {
    const coachSessions = coaches.map((c) => {
      const sessionsForCoach = sessions.filter((s) => s.coach_id === c.id && s.status === "completed");
      const attendanceForCoach = attendance.filter((a) =>
        sessionsForCoach.some((s) => s.id === a.session_id) && a.is_present
      );

      return {
        name: c.name,
        sessions: sessionsForCoach.length,
        totalAttendance: attendanceForCoach.length,
        avgAttendance: sessionsForCoach.length > 0
          ? Math.round(attendanceForCoach.length / sessionsForCoach.length)
          : 0,
      };
    });

    return coachSessions.sort((a, b) => b.avgAttendance - a.avgAttendance);
  }, [coaches, sessions, attendance]);

  // ── Revenue by Payment Method ──
  const revenueByMethod = useMemo(() => {
    const methods = new Map<string, number>();
    payments.forEach((p) => {
      const current = methods.get(p.method) || 0;
      methods.set(p.method, current + Number(p.amount));
    });
    return Array.from(methods.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([method, amount]) => ({ method, amount }));
  }, [payments]);

  const totalPaymentAmount = revenueByMethod.reduce((s, r) => s + r.amount, 0);

  const METHOD_COLORS: Record<string, string> = {
    cash: "bg-positive-500",
    card: "bg-interactive-500",
    wallet: "bg-brand-500",
    bank_transfer: "bg-attention-500",
    other: "bg-neutral-500",
  };

  // ── Expense Breakdown by Category ──
  const expenseBreakdown = useMemo(() => {
    const categories = new Map<string, number>();
    expenses.forEach((e) => {
      const cat = e.category || "other";
      categories.set(cat, (categories.get(cat) || 0) + Number(e.amount));
    });
    const total = Array.from(categories.values()).reduce((s, v) => s + v, 0);
    return Array.from(categories.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([category, amount]) => ({
        category,
        amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));
  }, [expenses]);

  const CATEGORY_COLORS: Record<string, string> = {
    equipment: "bg-interactive-500",
    uniforms: "bg-brand-500",
    tournament: "bg-attention-500",
    travel: "bg-positive-500",
    other: "bg-neutral-400",
  };

  // ── Revenue Forecast (simple linear trend) ──
  const revenueForecast = useMemo(() => {
    const monthMap = new Map<string, number>();
    payments.forEach((p) => {
      const key = p.payment_date.slice(0, 7);
      monthMap.set(key, (monthMap.get(key) || 0) + Number(p.amount));
    });
    const sorted = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (sorted.length < 2) return [];

    const values = sorted.map(([, v]) => v);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const growth = (values[values.length - 1] - values[0]) / values.length;

    const now = new Date();
    const forecast: { label: string; actual: number | null; predicted: number }[] = [];

    sorted.forEach(([month, value]) => {
      forecast.push({ label: format(new Date(month + "-01"), "MMM yy"), actual: value, predicted: value });
    });

    // Project next 3 months
    const lastVal = values[values.length - 1];
    for (let i = 1; i <= 3; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      forecast.push({
        label: format(futureDate, "MMM yy"),
        actual: null,
        predicted: Math.max(0, Math.round(lastVal + growth * i)),
      });
    }
    return forecast;
  }, [payments]);

  const maxForecast = Math.max(...revenueForecast.map((f) => Math.max(f.actual ?? 0, f.predicted)), 1);

  // ── Session Time Heatmap ──
  const sessionTimeHeatmap = useMemo(() => {
    const hourCounts = new Map<number, number>();
    for (let h = 6; h <= 22; h++) hourCounts.set(h, 0);
    sessions.forEach((s) => {
      const hour = parseInt(s.time.slice(0, 2), 10);
      if (hour >= 6 && hour <= 22) {
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      }
    });
    const maxCount = Math.max(...hourCounts.values(), 1);
    return Array.from(hourCounts.entries()).map(([hour, count]) => ({
      hour,
      count,
      intensity: count / maxCount,
    }));
  }, [sessions]);

  // ── Member Growth (cumulative join dates) ──
  const memberGrowth = useMemo(() => {
    const memberProfiles = profiles.filter((p) => p.role === "member" && p.join_date);
    if (memberProfiles.length === 0) return [];

    const sorted = memberProfiles
      .map((p) => p.join_date!)
      .sort();

    const startDate = new Date(sorted[0]);
    const endDate = new Date();
    const months = eachMonthOfInterval({ start: startDate, end: endDate });

    let cumulative = 0;
    return months.map((month) => {
      const monthStr = format(month, "yyyy-MM");
      const joinedThisMonth = memberProfiles.filter((p) => p.join_date!.startsWith(monthStr)).length;
      cumulative += joinedThisMonth;
      return {
        label: format(month, "MMM yy"),
        total: cumulative,
        newMembers: joinedThisMonth,
      };
    });
  }, [profiles]);

  const maxMemberGrowth = Math.max(...memberGrowth.map((m) => m.total), 1);

  // ── Session Status Distribution ──
  const sessionStatus = useMemo(() => {
    const statusCounts = new Map<string, number>();
    sessions.forEach((s) => {
      statusCounts.set(s.status, (statusCounts.get(s.status) || 0) + 1);
    });
    return Array.from(statusCounts.entries())
      .map(([status, count]) => ({ status, count }));
  }, [sessions]);

  const STATUS_COLORS: Record<string, string> = {
    completed: "bg-positive-500",
    scheduled: "bg-interactive-500",
    canceled: "bg-negative-500",
  };

  // ── Guest Revenue Trend ──
  const guestRevenue = useMemo(() => {
    const monthMap = new Map<string, number>();
    sessions.forEach((s) => {
      if (s.status !== "completed") return;
      const key = s.date.slice(0, 7);
      monthMap.set(key, monthMap.get(key) || 0);
    });
    // Guest revenue is already in calculations but we can show from session_calculations
    const calcBySession = new Map(calculations.map((c) => [c.session_id, Number(c.total_revenue)]));
    sessions.forEach((s) => {
      if (s.status !== "completed") return;
      const key = s.date.slice(0, 7);
      // We approximate guest revenue as part of total
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, _]) => ({
        label: format(new Date(month + "-01"), "MMM yy"),
        revenue: calculations
          .filter((c) => {
            const sess = sessions.find((s) => s.id === c.session_id);
            return sess && sess.date.startsWith(month) && sess.status === "completed";
          })
          .reduce((s, c) => s + Number(c.total_revenue), 0),
      }));
  }, [sessions, calculations]);

  const maxGuestRevenue = Math.max(...guestRevenue.map((g) => g.revenue), 1);

  const handleExport = () => {
    downloadCSV(
      [t("analytics_monthly_revenue"), t("reports_costs"), t("analytics_net_profit")],
      [
        ...(monthlyFinancials.length > 0
          ? monthlyFinancials.map((m) => [m.label, m.revenue, m.expenses, m.revenue - m.expenses])
          : [["—", 0, 0, 0]]),
        [],
        [t("analytics_active_members"), stats.activeMembers.length],
        [t("analytics_total_sessions"), stats.totalSessions],
        [t("analytics_attendance_rate"), `${stats.attendanceRate}%`],
        [t("analytics_net_profit"), stats.profit],
      ].map((r) => r as (string | number)[]),
      `analytics-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  return (
    <QueryState queries={[sessionsQuery, attendanceQuery, profilesQuery, paymentsQuery, expensesQuery, costsQuery, coachesQuery, calculationsQuery, sportsQuery, rentalsQuery, guestsQuery]}>
    <div className="space-y-6">
      {/* Export */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t("analytics_export_csv")}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-interactive-100 p-2 dark:bg-interactive-900/30">
                <Users className="h-5 w-5 text-info-ink" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeMembers.length}</p>
                <p className="text-xs text-muted-foreground">{t("analytics_active_members")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-positive-100 p-2 dark:bg-positive-900/30">
                <CalendarCheck className="h-5 w-5 text-success-ink" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSessions}</p>
                <p className="text-xs text-muted-foreground">{t("analytics_sessions_completed")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-attention-100 p-2 dark:bg-attention-900/30">
                <Target className="h-5 w-5 text-warning-ink" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.attendanceRate}%</p>
                <p className="text-xs text-muted-foreground">{t("analytics_attendance_rate")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${stats.profit >= 0 ? "bg-positive-100 dark:bg-positive-900/30" : "bg-negative-100 dark:bg-negative-900/30"}`}>
                {stats.profit >= 0
                  ? <TrendingUp className="h-5 w-5 text-success-ink" />
                  : <TrendingDown className="h-5 w-5 text-error-ink" />
                }
              </div>
              <div>
                <p className={`text-2xl font-bold ${stats.profit >= 0 ? "" : "text-error-ink"}`}>
                  {formatMoney(stats.profit, lang)}
                </p>
                <p className="text-xs text-muted-foreground">{t("analytics_net_profit")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Trend + Member Retention */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              {t("analytics_trend")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-48">
              {weeklyTrend.map((week, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary/80 rounded-t transition-all hover:bg-primary"
                    style={{
                      height: `${(week.attendance / maxWeeklyAttendance) * 100}%`,
                      minHeight: week.attendance > 0 ? "4px" : "0",
                    }}
                  />
                  <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                    {week.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              {t("analytics_member_health")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-3xl font-bold">{retention.total}</p>
              <p className="text-xs text-muted-foreground">{t("analytics_total_active")}</p>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-positive-500" />
                    {t("analytics_healthy")}
                  </span>
                  <span className="font-semibold">{retention.healthy}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-positive-500 rounded-full"
                    style={{ width: `${retention.total > 0 ? (retention.healthy / retention.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-attention-500" />
                    {t("analytics_at_risk")}
                  </span>
                  <span className="font-semibold">{retention.atRisk}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-attention-500 rounded-full"
                    style={{ width: `${retention.total > 0 ? (retention.atRisk / retention.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-negative-500" />
                    {t("analytics_churned")}
                  </span>
                  <span className="font-semibold">{retention.churned}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-negative-500 rounded-full"
                    style={{ width: `${retention.total > 0 ? (retention.churned / retention.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue + Payment Methods + Top Attendees */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Monthly Revenue vs Expenses */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              {t("analytics_monthly_revenue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyFinancials.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("analytics_no_financial_data")}</p>
            ) : (
              <div className="space-y-3">
                {monthlyFinancials.map((m, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{m.label}</span>
                      <span className="font-mono font-semibold">{formatMoney(m.revenue, lang)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(m.revenue / maxMonthlyRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              {t("analytics_revenue_by_method")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByMethod.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("analytics_no_payments_yet")}</p>
            ) : (
              <div className="space-y-3">
                {revenueByMethod.map((r) => (
                  <div key={r.method}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 capitalize">
                        <span className={`h-2.5 w-2.5 rounded-full ${METHOD_COLORS[r.method] || "bg-neutral-400"}`} />
                        {r.method.replace("_", " ")}
                      </span>
                      <span className="font-mono text-xs font-semibold">
                        {formatMoney(r.amount, lang)}
                        <span className="text-muted-foreground ml-1">
                          ({totalPaymentAmount > 0 ? Math.round((r.amount / totalPaymentAmount) * 100) : 0}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${METHOD_COLORS[r.method] || "bg-neutral-400"}`}
                        style={{ width: `${totalPaymentAmount > 0 ? (r.amount / totalPaymentAmount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Attendees */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4" />
              {t("analytics_top_attendees")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topAttendees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("analytics_no_data")}</p>
            ) : (
              <div className="space-y-2">
                {topAttendees.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="truncate font-medium">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.rate}%</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${m.rate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coach Performance */}
      {coachPerformance.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              {t("analytics_coach_performance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {coachPerformance.map((c, i) => (
                <div key={i} className="rounded-lg border p-4 text-center">
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-2xl font-bold">{c.avgAttendance}</p>
                  <p className="text-xs text-muted-foreground">{t("analytics_avg_attendance_session")}</p>
                  <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                    <span>{c.sessions} {t("analytics_sessions_count")}</span>
                    <span>•</span>
                    <span>{c.totalAttendance} {t("analytics_total_present")}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Forecast */}
      {revenueForecast.length > 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              {t("analytics_revenue_forecast")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-40">
              {revenueForecast.map((f, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-[9px] font-mono text-muted-foreground mb-0.5">
                      {f.actual !== null ? formatMoney(f.actual, lang) : "—"}
                    </span>
                    <div
                      className={`w-full rounded-t ${f.actual !== null ? "bg-primary/80" : "bg-primary/30 border border-dashed border-primary/50"}`}
                      style={{
                        height: `${((f.actual ?? f.predicted) / maxForecast) * 100}%`,
                        minHeight: "4px",
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              {t("analytics_forecast_note")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Expense Breakdown + Session Status + Session Time Heatmap */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Expense Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4" />
              {t("analytics_expense_breakdown")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("analytics_no_expenses")}</p>
            ) : (
              <div className="space-y-3">
                {expenseBreakdown.map((e) => (
                  <div key={e.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2 capitalize">
                        <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_COLORS[e.category] || "bg-neutral-400"}`} />
                        {e.category}
                      </span>
                      <span className="font-mono text-xs font-semibold">
                        {formatMoney(e.amount, lang)}
                        <span className="text-muted-foreground ml-1">({e.percent}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${CATEGORY_COLORS[e.category] || "bg-neutral-400"}`}
                        style={{ width: `${e.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" />
              {t("analytics_session_status")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sessionStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("analytics_no_sessions_yet")}</p>
            ) : (
              <div className="space-y-4">
                {sessionStatus.map((s) => {
                  const totalSessions = sessionStatus.reduce((sum, ss) => sum + ss.count, 0);
                  const pct = totalSessions > 0 ? Math.round((s.count / totalSessions) * 100) : 0;
                  return (
                    <div key={s.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 capitalize">
                          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[s.status] || "bg-neutral-400"}`} />
                          {s.status}
                        </span>
                        <span className="font-mono text-xs font-semibold">
                          {s.count} <span className="text-muted-foreground">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${STATUS_COLORS[s.status] || "bg-neutral-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Time Heatmap */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              {t("analytics_time_heatmap")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-0.5 h-40">
              {sessionTimeHeatmap.map((h) => (
                <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{
                      height: `${h.intensity * 100}%`,
                      minHeight: h.count > 0 ? "4px" : "0",
                      opacity: Math.max(0.15, h.intensity),
                    }}
                  />
                  <span className="text-[8px] text-muted-foreground">
                    {h.hour}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              {t("analytics_heatmap_note")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Member Growth Over Time */}
      {memberGrowth.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              {t("analytics_member_growth")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {memberGrowth.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-[9px] font-mono text-muted-foreground mb-0.5">
                      {m.total}
                    </span>
                    <div
                      className="w-full bg-positive-500/80 rounded-t"
                      style={{ height: `${(m.total / maxMemberGrowth) * 100}%`, minHeight: "4px" }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </QueryState>
  );
}
