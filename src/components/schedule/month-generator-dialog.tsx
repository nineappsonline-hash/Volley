"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  startOfMonth,
} from "date-fns";
import { CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn, errorMessage } from "@/lib/utils";
import { useBulkCreateSessions, useSessions } from "@/lib/queries";

// date-fns getDay(): 0 = Sunday … 6 = Saturday
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

interface MonthGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MonthGeneratorDialog({
  open,
  onOpenChange,
}: MonthGeneratorDialogProps) {
  const { t, locale } = useI18n();
  const { data: sessions } = useSessions();
  const bulk = useBulkCreateSessions();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [days, setDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri
  const [time, setTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Only active sessions occupy a date — canceled/completed ones can be
  // regenerated (e.g. cancel a session, then re-generate the month).
  const existingDates = useMemo(
    () =>
      new Set(
        (sessions ?? [])
          .filter((s) => s.status === "scheduled")
          .map((s) => s.date)
      ),
    [sessions]
  );

  const datesToCreate = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1, 1));
    return eachDayOfInterval({ start, end: endOfMonth(start) })
      .filter((d) => days.includes(getDay(d)))
      .filter((d) => !existingDates.has(format(d, "yyyy-MM-dd")))
      .map((d) => format(d, "yyyy-MM-dd"))
      .sort();
  }, [year, month, days, existingDates]);

  const weekdayOptions = useMemo(() => {
    // 2026-01-05 is a Monday; walking 7 days yields Mon…Sun labels.
    const ref = new Date(2026, 0, 5);
    return WEEKDAYS.map((dow, i) => ({
      dow,
      label: format(addDays(ref, i), "EEEE", { locale }),
    }));
  }, [locale]);

  const toggleDay = (dow: number) =>
    setDays((prev) =>
      prev.includes(dow) ? prev.filter((x) => x !== dow) : [...prev, dow]
    );

  const handleGenerate = async () => {
    if (datesToCreate.length === 0) {
      toast.error(t("schedule_generate_none"));
      return;
    }
    setSaving(true);
    try {
      await bulk.mutateAsync(
        datesToCreate.map((date) => ({
          date,
          time,
          location: location || null,
          notes: notes || null,
        }))
      );
      toast.success(`${datesToCreate.length} ${t("schedule_generated")}`);
      onOpenChange(false);
    } catch (err) {
      console.error("[month-generator] bulk create failed", err);
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy", {
    locale,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            {t("schedule_generate_title")}
          </DialogTitle>
          <DialogDescription>{t("schedule_generate_subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {format(new Date(year, m - 1, 1), "MMMM", { locale })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("costs_year")}</Label>
              <Select
                value={String(year)}
                onValueChange={(v) => setYear(Number(v))}
              >
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

          <div className="space-y-2">
            <Label>{t("schedule_generate_days")}</Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {weekdayOptions.map((w) => (
                <label
                  key={w.dow}
                  className={cn(
                    "flex cursor-pointer select-none flex-col items-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-colors hover:bg-accent",
                    days.includes(w.dow)
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <Checkbox
                    checked={days.includes(w.dow)}
                    onCheckedChange={() => toggleDay(w.dow)}
                    className="sr-only"
                  />
                  <span className="capitalize">{w.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("schedule_time")}</Label>
              <Input
                type="time"
                dir="ltr"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("schedule_location")}</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("common_not_set")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("schedule_notes")}</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">
              {t("schedule_generate_preview")}
            </span>
            <span className="font-mono font-bold text-primary">
              {monthLabel} · {datesToCreate.length}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common_cancel")}
          </Button>
          <Button type="button" onClick={handleGenerate} disabled={saving}>
            {saving ? t("common_saving") : t("schedule_generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
