"use client";

import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import type { MonthlyPoint } from "@/components/reports/financial-chart";

interface FinancialSummaryProps {
  points: MonthlyPoint[];
  avgProfitPerSession: number;
}

export function FinancialSummary({ points, avgProfitPerSession }: FinancialSummaryProps) {
  const { t, lang } = useI18n();

  const totalRevenue = points.reduce((s, p) => s + p.revenue, 0);
  const totalCosts = points.reduce((s, p) => s + p.costs, 0);
  const totalProfit = points.reduce((s, p) => s + p.profit, 0);
  const net = totalRevenue - totalCosts;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("reports_total_revenue")}
          value={formatMoney(totalRevenue, lang)}
          icon={Wallet}
          tone="default"
        />
        <StatCard
          title={t("reports_total_costs")}
          value={formatMoney(totalCosts, lang)}
          icon={TrendingDown}
          tone="warning"
        />
        <StatCard
          title={t("reports_net")}
          value={formatMoney(net, lang)}
          icon={TrendingUp}
          tone={net >= 0 ? "success" : "destructive"}
        />
        <StatCard
          title={t("reports_average_profit")}
          value={formatMoney(avgProfitPerSession, lang)}
          icon={TrendingUp}
          tone={avgProfitPerSession >= 0 ? "success" : "destructive"}
        />
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t("reports_month")}</TableHead>
              <TableHead className="text-end">{t("reports_revenue")}</TableHead>
              <TableHead className="text-end">{t("reports_costs")}</TableHead>
              <TableHead className="text-end">{t("reports_net")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  {t("reports_no_data")}
                </TableCell>
              </TableRow>
            ) : (
              [...points].reverse().map((p) => {
                const net = p.revenue - p.costs;
                return (
                  <TableRow key={p.label}>
                    <TableCell className="font-medium">{p.label}</TableCell>
                    <TableCell className="text-end font-mono">{formatMoney(p.revenue, lang)}</TableCell>
                    <TableCell className="text-end font-mono text-muted-foreground">
                      {formatMoney(p.costs, lang)}
                    </TableCell>
                    <TableCell className="text-end">
                      <Badge variant={net >= 0 ? "success" : "destructive"}>
                        {formatMoney(net, lang)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
