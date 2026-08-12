"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import {
  buildMonthlyPoints,
  FinancialChart,
} from "@/components/reports/financial-chart";
import { FinancialSummary } from "@/components/reports/financial-summary";
import { useI18n } from "@/lib/i18n";
import {
  useAllPayments,
  useMonthlyCosts,
  useSessionCalculations,
  useSessions,
} from "@/lib/queries";

export default function ReportsPage() {
  const { t } = useI18n();
  const { data: payments, isLoading: loadingPayments } = useAllPayments();
  const { data: costs, isLoading: loadingCosts } = useMonthlyCosts();
  const { data: calculations, isLoading: loadingCalc } = useSessionCalculations();
  const { data: sessions, isLoading: loadingSessions } = useSessions();

  const loading = loadingPayments || loadingCosts || loadingCalc || loadingSessions;

  const points = useMemo(
    () => buildMonthlyPoints(payments ?? [], costs ?? [], calculations ?? [], sessions ?? []),
    [payments, costs, calculations, sessions]
  );

  const avgProfitPerSession = useMemo(() => {
    const calcs = calculations ?? [];
    if (calcs.length === 0) return 0;
    const total = calcs.reduce((s, c) => s + Number(c.profit_loss), 0);
    return total / calcs.length;
  }, [calculations]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("reports_title")} subtitle={t("reports_subtitle")} />

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
        </>
      )}
    </div>
  );
}
