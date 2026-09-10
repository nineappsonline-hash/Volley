"use client";

import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { toast } from "sonner";
import { Activity, Clock3, LandPlot, PieChart as PieIcon } from "lucide-react";
import { downloadCSV, createPDF, addPDFTable, downloadPDF } from "@/lib/export";
import { ExportMenu } from "@/components/shared/export-menu"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  buildMonthlyPoints,
  FinancialChart,
} from "@/components/reports/financial-chart";
import { FinancialSummary } from "@/components/reports/financial-summary";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import {
  useVenueRentals, useSessionGuests,
  useAllPayments,
  useAttendance,
  useExpenses,
  useMonthlyCosts,
  useProfiles,
  useSessionCalculations,
  useSessions,
  useSports,
  useVenues,
} from "@/lib/queries";

export default function ReportsPage() {
  const { t, lang } = useI18n();
  const { data: payments, isLoading: loadingPayments } = useAllPayments();
  const { data: costs, isLoading: loadingCosts } = useMonthlyCosts();
  const { data: calculations, isLoading: loadingCalc } = useSessionCalculations();
  const { data: sessions, isLoading: loadingSessions } = useSessions();
  const { data: sports } = useSports();
  const { data: profiles } = useProfiles();
  const { data: attendance } = useAttendance();
  const { data: expenses } = useExpenses();
  const {data: rentals} = useVenueRentals();
  const {data: guests} = useSessionGuests();
  const { data: venues } = useVenues();

  const loading =
    loadingPayments || loadingCosts || loadingCalc || loadingSessions;

  const points = useMemo(
    () => buildMonthlyPoints(payments ?? [], costs ?? [], calculations ?? [], sessions ?? [], expenses ?? [], rentals ?? [], guests ?? []),
    [payments, costs, calculations, sessions, expenses, rentals, guests]
  );

  const avgProfitPerSession = useMemo(() => {
    const calcs = calculations ?? [];
    if (calcs.length === 0) return 0;
    const total = calcs.reduce((s, c) => s + Number(c.profit_loss), 0);
    return total / calcs.length;
  }, [calculations]);

  // ── Revenue by sport: sum per-session revenue grouped by session sport ──
  const revenueBySport = useMemo(() => {
    const revenueBySportId = new Map<string, number>();
    for (const c of calculations ?? []) {
      const session = (sessions ?? []).find((s) => s.id === c.session_id);
      if (!session?.sport_id) continue;
      revenueBySportId.set(
        session.sport_id,
        (revenueBySportId.get(session.sport_id) ?? 0) + Number(c.total_revenue)
      );
    }
    const rows = (sports ?? [])
      .map((sport) => ({
        id: sport.id,
        name: sport.name,
        revenue: Math.round((revenueBySportId.get(sport.id) ?? 0) * 100) / 100,
      }))
      .filter((r) => r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    return {
      rows: rows.map((r) => ({
        ...r,
        share: totalRevenue > 0 ? Math.round((r.revenue / totalRevenue) * 100) : 0,
      })),
    };
  }, [sports, sessions, calculations]);

  // ── Retention & churn ──
  const retention = useMemo(() => {
    const today = new Date();
    const cutoff30 = format(subDays(today, 30), "yyyy-MM-dd");
    const cutoff60 = format(subDays(today, 60), "yyyy-MM-dd");
    const cutoffNew = format(subDays(today, 30), "yyyy-MM-dd");

    const members = (profiles ?? []).filter((p) => p.role === "member");
    const presentSessions = new Set(
      (attendance ?? []).filter((a) => a.is_present).map((a) => a.session_id)
    );
    const lastAttendByMember = new Map<string, string>();
    for (const s of sessions ?? []) {
      if (!presentSessions.has(s.id)) continue;
      for (const a of attendance ?? []) {
        if (a.session_id !== s.id || !a.is_present) continue;
        const prev = lastAttendByMember.get(a.member_id);
        if (!prev || s.date > prev) lastAttendByMember.set(a.member_id, s.date);
      }
    }

    let active30 = 0;
    let inactive30 = 0;
    let inactive60 = 0;
    for (const m of members) {
      const last = lastAttendByMember.get(m.id);
      if (last && last >= cutoff30) active30 += 1;
      else if (last && last >= cutoff60) inactive30 += 1;
      else inactive60 += 1;
    }
    const newMembers = members.filter(
      (m) => m.join_date && m.join_date >= cutoffNew
    ).length;

    return { total: members.length, active30, inactive30, inactive60, newMembers };
  }, [profiles, attendance, sessions]);

  // ── Insights: peak hours + busiest venues (by attended member-sessions) ──
  const insights = useMemo(() => {
    const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]));
    const venueById = new Map((venues ?? []).map((v) => [v.id, v.name]));
    const hourCount = new Map<string, number>();
    const venueCount = new Map<string, number>();
    for (const a of attendance ?? []) {
      if (!a.is_present) continue;
      const s = sessionById.get(a.session_id);
      if (!s) continue;
      const hour = s.time.slice(0, 5);
      hourCount.set(hour, (hourCount.get(hour) ?? 0) + 1);
      if (s.venue_id) {
        venueCount.set(s.venue_id, (venueCount.get(s.venue_id) ?? 0) + 1);
      }
    }
    const peakHours = [...hourCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({ hour, count }));
    const busiestVenues = [...venueCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, count]) => ({ name: venueById.get(id) ?? "—", count }));
    return { peakHours, busiestVenues };
  }, [attendance, sessions, venues]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports_title")} subtitle={t("reports_subtitle")}>
        <ExportMenu
          options={[
            {
              label: t("export_payments_csv"),
              icon: "csv",
              onClick: () => {
                downloadCSV(
                  ["Member ID", "Amount", "Date", "Type", "Sessions", "Method"],
                  (payments ?? []).map((p) => [
                    p.member_id,
                    p.amount,
                    p.payment_date,
                    p.membership_type,
                    p.subscription_sessions,
                    p.method,
                  ]),
                  `payments-${new Date().toISOString().slice(0, 10)}.csv`
                );
                toast.success(t("export_success"));
              },
            },
            {
              label: t("export_report_pdf"),
              icon: "pdf",
              onClick: () => {
                const pdf = createPDF("Financial Report");
                let y = 28;
                // Monthly summary table
                if (points.length > 0) {
                  y = addPDFTable(
                    pdf,
                    ["Month", "Revenue", "Costs", "Net"],
                    [...points].reverse().map((p) => [
                      p.label,
                      p.revenue.toFixed(2),
                      p.costs.toFixed(2),
                      (p.revenue - p.costs).toFixed(2),
                    ]),
                    y
                  );
                  y += 10;
                }
                // Revenue by sport
                if (revenueBySport.rows.length > 0) {
                  addPDFTable(
                    pdf,
                    ["Sport", "Revenue", "%"],
                    revenueBySport.rows.map((r) => [
                      r.name,
                      r.revenue.toFixed(2),
                      `${r.share}%`,
                    ]),
                    y
                  );
                }
                downloadPDF(pdf, `report-${new Date().toISOString().slice(0, 10)}.pdf`);
                toast.success(t("export_success"));
              },
            },
          ]}
        />
      </PageHeader>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("reports_revenue_costs")}</CardTitle>
            </CardHeader>
            <CardContent className="p-2 sm:p-4">
              <FinancialChart points={points} />
            </CardContent>
          </Card>

          <FinancialSummary
            points={points}
            avgProfitPerSession={avgProfitPerSession}
          />

          {(expenses ?? []).length > 0 && (
            <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
              {t("reports_expenses_note")}
            </p>
          )}

          {/* Revenue by sport */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PieIcon className="h-4 w-4 text-primary" />
                {t("reports_by_sport")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenueBySport.rows.length === 0 ? (
                <EmptyState message={t("reports_by_sport_empty")} icon={PieIcon} />
              ) : (
                <div className="rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>{t("schedule_sport")}</TableHead>
                        <TableHead className="text-end">{t("attendance_revenue")}</TableHead>
                        <TableHead className="text-end">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueBySport.rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-end font-mono">
                            {formatMoney(r.revenue, lang)}
                          </TableCell>
                          <TableCell className="text-end">
                            <Badge variant="secondary" className="font-mono">
                              {r.share}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Retention & churn */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                {t("reports_retention")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("dash_total_members")}</p>
                <p className="mt-1 font-mono text-xl font-extrabold">{retention.total}</p>
              </div>
              <div className="rounded-lg border border-positive-300/50 bg-positive-50 p-3 text-center dark:bg-positive-500/10">
                <p className="text-xs text-muted-foreground">{t("reports_active_30")}</p>
                <p className="mt-1 font-mono text-xl font-extrabold text-success-ink dark:text-positive-400">
                  {retention.active30}
                </p>
              </div>
              <div className="rounded-lg border border-attention-300/50 bg-attention-50 p-3 text-center dark:bg-attention-500/10">
                <p className="text-xs text-muted-foreground">{t("reports_inactive_30")}</p>
                <p className="mt-1 font-mono text-xl font-extrabold text-warning-ink dark:text-attention-400">
                  {retention.inactive30}
                </p>
              </div>
              <div className="rounded-lg border border-negative-300/50 bg-negative-50 p-3 text-center dark:bg-negative-500/10">
                <p className="text-xs text-muted-foreground">{t("reports_inactive_60")}</p>
                <p className="mt-1 font-mono text-xl font-extrabold text-error-ink dark:text-negative-400">
                  {retention.inactive60}
                </p>
              </div>
              <div className="rounded-lg border border-interactive-300/50 bg-interactive-50 p-3 text-center dark:bg-interactive-500/10">
                <p className="text-xs text-muted-foreground">{t("reports_new_members")}</p>
                <p className="mt-1 font-mono text-xl font-extrabold text-info-ink dark:text-interactive-400">
                  {retention.newMembers}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Insights: peak hours + busiest venues */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                {t("reports_insights_title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {t("reports_peak_hours")}
                </p>
                {insights.peakHours.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("reports_insights_empty")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {insights.peakHours.map((p) => (
                      <Badge key={p.hour} variant="secondary" className="gap-1 font-mono">
                        {p.hour}
                        <span className="text-muted-foreground">· {p.count}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <LandPlot className="h-3.5 w-3.5" />
                  {t("reports_busiest_venues")}
                </p>
                {insights.busiestVenues.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("reports_insights_empty")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {insights.busiestVenues.map((v) => (
                      <Badge key={v.name} variant="secondary" className="gap-1">
                        {v.name}
                        <span className="text-muted-foreground">· {v.count}</span>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
