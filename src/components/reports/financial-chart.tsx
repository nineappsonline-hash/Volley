"use client";

import { CHART_COLORS } from "@/lib/brand";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { formatMoneyShort } from "@/lib/constants";
import type { Expense, MonthlyCost, Payment, SessionCalculation, TrainingSession } from "@/lib/types";

export interface MonthlyPoint {
  label: string;
  revenue: number;
  costs: number;
  profit: number;
}

interface FinancialChartProps {
  points: MonthlyPoint[];
  height?: number;
}

export function FinancialChart({ points, height = 300 }: FinancialChartProps) {
  const { t, lang } = useI18n();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v: number) => formatMoneyShort(v, lang)}
        />
        <Tooltip
          formatter={(value: number | string, name: string) => [
            formatMoneyShort(Number(value), lang),
            name === "revenue"
              ? t("reports_revenue")
              : name === "costs"
                ? t("reports_costs")
                : t("reports_profit"),
          ]}
          contentStyle={{
            background: "hsl(var(--card))",
                    color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend
          formatter={(value: string) =>
            value === "revenue"
              ? t("reports_revenue")
              : value === "costs"
                ? t("reports_costs")
                : t("reports_profit")
          }
        />
        <Bar dataKey="revenue" fill={CHART_COLORS.interaction} radius={[4, 4, 0, 0]} />
        <Bar dataKey="costs" fill={CHART_COLORS.attention} radius={[4, 4, 0, 0]} />
        <Bar dataKey="profit" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export { buildMonthlyPoints } from "@/lib/financial-summary";
