"use client";

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
import type { MonthlyCost, Payment, SessionCalculation, TrainingSession } from "@/lib/types";

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
        <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
        <Bar dataKey="costs" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        <Bar dataKey="profit" fill="#10B981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Builds monthly data points from payments, costs and session calculations.
 */
export function buildMonthlyPoints(
  payments: Payment[],
  costs: MonthlyCost[],
  calculations: SessionCalculation[],
  sessions: TrainingSession[]
): MonthlyPoint[] {
  const months = new Map<string, MonthlyPoint>();
  const key = (m: number, y: number) => `${y}-${String(m).padStart(2, "0")}`;

  const monthsOfSessions = new Set(
    sessions.map((s) => {
      const d = new Date(s.date + "T00:00:00");
      return key(d.getMonth() + 1, d.getFullYear());
    })
  );

  const allKeys = new Set<string>([
    ...costs.map((c) => key(c.month, c.year)),
    ...payments.map((p) => {
      const d = new Date(p.payment_date + "T00:00:00");
      return key(d.getMonth() + 1, d.getFullYear());
    }),
    ...monthsOfSessions,
  ]);

  const label = (k: string) => {
    const [y, m] = k.split("-");
    return `${MONTH_NAMES[Number(m) - 1]?.slice(0, 3)} ${y}`;
  };

  for (const k of [...allKeys].sort()) {
    months.set(k, { label: label(k), revenue: 0, costs: 0, profit: 0 });
  }

  for (const p of payments) {
    const d = new Date(p.payment_date + "T00:00:00");
    const k = key(d.getMonth() + 1, d.getFullYear());
    const point = months.get(k);
    if (point) point.revenue += Number(p.amount);
  }

  for (const c of costs) {
    const k = key(c.month, c.year);
    const point = months.get(k);
    if (point)
      point.costs +=
        Number(c.coach_fee_per_session) * Number(c.sessions_per_month) +
        Number(c.court_rental);
  }

  // Session profit belongs to its session's month
  const sessionMonth = new Map(sessions.map((s) => {
    const d = new Date(s.date + "T00:00:00");
    return [s.id, key(d.getMonth() + 1, d.getFullYear())];
  }));
  for (const calc of calculations) {
    const k = sessionMonth.get(calc.session_id);
    const point = k ? months.get(k) : undefined;
    if (point) point.profit += Number(calc.profit_loss);
  }

  return [...months.values()];
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
