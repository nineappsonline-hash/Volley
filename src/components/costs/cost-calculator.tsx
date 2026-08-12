"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { computeCostPerSession } from "@/lib/calculations";
import { useMonthlyCosts, useSaveCosts } from "@/lib/queries";
import type { MonthlyCost } from "@/lib/types";

interface CostCalculatorProps {
  selected?: MonthlyCost | null;
}

const MONTHS = [
  { value: 1, en: "January", ar: "يناير" },
  { value: 2, en: "February", ar: "فبراير" },
  { value: 3, en: "March", ar: "مارس" },
  { value: 4, en: "April", ar: "أبريل" },
  { value: 5, en: "May", ar: "مايو" },
  { value: 6, en: "June", ar: "يونيو" },
  { value: 7, en: "July", ar: "يوليو" },
  { value: 8, en: "August", ar: "أغسطس" },
  { value: 9, en: "September", ar: "سبتمبر" },
  { value: 10, en: "October", ar: "أكتوبر" },
  { value: 11, en: "November", ar: "نوفمبر" },
  { value: 12, en: "December", ar: "ديسمبر" },
];

export function CostCalculator({ selected }: CostCalculatorProps) {
  const { t, lang } = useI18n();
  const saveCosts = useSaveCosts();
  const { data: costs } = useMonthlyCosts();

  const now = new Date();
  const [month, setMonth] = useState(selected?.month ?? now.getMonth() + 1);
  const [year, setYear] = useState(selected?.year ?? now.getFullYear());
  const [coachSalary, setCoachSalary] = useState(
    selected?.coach_salary?.toString() ?? ""
  );
  const [courtRental, setCourtRental] = useState(
    selected?.court_rental?.toString() ?? ""
  );
  const [sessionsPerMonth, setSessionsPerMonth] = useState(
    selected?.sessions_per_month?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selected) {
      setMonth(selected.month);
      setYear(selected.year);
      setCoachSalary(selected.coach_salary.toString());
      setCourtRental(selected.court_rental.toString());
      setSessionsPerMonth(selected.sessions_per_month.toString());
    }
  }, [selected]);

  const costPerSession = useMemo(
    () =>
      computeCostPerSession({
        coachSalary: Number(coachSalary) || 0,
        courtRental: Number(courtRental) || 0,
        sessionsPerMonth: Number(sessionsPerMonth) || 0,
      }),
    [coachSalary, courtRental, sessionsPerMonth]
  );

  const monthLabel = MONTHS.find((m) => m.value === month);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCosts.mutateAsync({
        month,
        year,
        coach_salary: Number(coachSalary) || 0,
        court_rental: Number(courtRental) || 0,
        sessions_per_month: Number(sessionsPerMonth) || 0,
        cost_per_session: costPerSession,
      });
      toast.success(t("costs_saved"));
    } catch {
      toast.error(t("common_error"));
    } finally {
      setSaving(false);
    }
  };

  const existing = costs?.find((c) => c.month === month && c.year === year);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          {t("costs_title")}
        </CardTitle>
        <CardDescription>{t("costs_explanation")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("costs_month")}</Label>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.value} value={String(m.value)}>
                    {lang === "ar" ? m.ar : m.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("costs_year")}</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
                  (y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("costs_coach_salary")}</Label>
            <Input
              type="number"
              min={0}
              dir="ltr"
              placeholder={t("costs_placeholder_coach")}
              value={coachSalary}
              onChange={(e) => setCoachSalary(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("costs_court_rental")}</Label>
            <Input
              type="number"
              min={0}
              dir="ltr"
              placeholder={t("costs_placeholder_rental")}
              value={courtRental}
              onChange={(e) => setCourtRental(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("costs_sessions_per_month")}</Label>
            <Input
              type="number"
              min={1}
              dir="ltr"
              placeholder={t("costs_placeholder_sessions")}
              value={sessionsPerMonth}
              onChange={(e) => setSessionsPerMonth(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("costs_cost_per_session")}
            </p>
            <p className="text-2xl font-extrabold font-mono text-primary">
              {formatMoney(costPerSession, lang)}
            </p>
          </div>
          <div className="text-end text-xs text-muted-foreground">
            <p>
              {monthLabel ? (lang === "ar" ? monthLabel.ar : monthLabel.en) : ""} {year}
            </p>
            {existing && (
              <p className="mt-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                ✓ {t("costs_edit")} — {formatMoney(existing.cost_per_session, lang)}
              </p>
            )}
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common_saving") : t("costs_save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
