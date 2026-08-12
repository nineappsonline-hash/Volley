"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CostCalculator } from "@/components/costs/cost-calculator";
import { useI18n } from "@/lib/i18n";
import { formatMoney, sessionsForMembership } from "@/lib/constants";
import { useMonthlyCosts } from "@/lib/queries";
import type { MonthlyCost } from "@/lib/types";

const MONTH_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default function CostsPage() {
  const { t, lang } = useI18n();
  const { data: costs, isLoading } = useMonthlyCosts();
  const [selected, setSelected] = useState<MonthlyCost | null>(null);

  const sorted = useMemo(
    () =>
      [...(costs ?? [])].sort(
        (a, b) => b.year - a.year || b.month - a.month
      ),
    [costs]
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("costs_title")} subtitle={t("costs_subtitle")} />

      <CostCalculator selected={selected} />

      <div>
        <h2 className="mb-3 text-lg font-bold">{t("costs_history")}</h2>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : sorted.length === 0 ? (
          <EmptyState message={t("costs_no_history")} />
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("costs_month")}</TableHead>
                  <TableHead className="text-end">{t("costs_coach_fee")}</TableHead>
                  <TableHead className="text-end">{t("costs_court_rental")}</TableHead>
                  <TableHead className="text-end">{t("costs_sessions_per_month")}</TableHead>
                  <TableHead className="text-end">{t("costs_cost_per_session")}</TableHead>
                  <TableHead className="text-end">{t("common_edit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {lang === "ar" ? MONTH_AR[c.month - 1] : MONTH_EN[c.month - 1]}{" "}
                      {c.year}
                    </TableCell>
                    <TableCell className="text-end">
                      <span className="font-mono">{formatMoney(Number(c.coach_fee), lang)}</span>
                      <span className="ms-2 text-xs text-muted-foreground">
                        / {sessionsForMembership(c.coach_fee_basis)}
                      </span>
                    </TableCell>
                    <TableCell className="text-end font-mono">
                      {formatMoney(Number(c.court_rental), lang)}
                    </TableCell>
                    <TableCell className="text-end">{c.sessions_per_month}</TableCell>
                    <TableCell className="text-end font-mono font-semibold text-primary">
                      {formatMoney(Number(c.cost_per_session), lang)}
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelected(c)}
                        aria-label={t("costs_edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
