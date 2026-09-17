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
import { CalendarRange, LayoutTemplate } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { formatTime12h } from "@/lib/constants";
import { cn, errorMessage } from "@/lib/utils";
import {
  useBulkCreateSessions,
  useSessions,
  useSports,
  useTemplates,
} from "@/lib/queries";

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
  const { t, lang, locale } = useI18n();
  const { data: sessions } = useSessions();
  const { data: sports } = useSports();
  const { data: templates, isLoading: loadingTemplates } = useTemplates();
  const bulk = useBulkCreateSessions();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [days, setDays] = useState<number[]>([1, 3, 5]); // Mon, Wed, Fri
  const [time, setTime] = useState("18:00");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [sportId, setSportId] = useState("none");
  const [saving, setSaving] = useState(false);

  // Only active sessions occupy a date — canceled/completed ones can be
  // regenerated (e.g. cancel a session, then re-generate the month).
  const existingSlots = useMemo(
    () =>
      new Set(
        (sessions ?? [])
          .filter((s) => s.status === "scheduled")
          .map((s) => `${s.date}|${s.time.slice(0, 5)}`)
      ),
    [sessions]
  );

  const datesToCreate = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1, 1));
    return eachDayOfInterval({ start, end: endOfMonth(start) })
      .filter((d) => days.includes(getDay(d)))
      .filter((d) => !existingSlots.has(`${format(d, "yyyy-MM-dd")}|${time}`))
      .map((d) => format(d, "yyyy-MM-dd"))
      .sort();
  }, [year, month, days, time, existingSlots]);

  // Template mode: expand each selected template into its dates for the month.
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const templateSlots = useMemo(() => {
    const start = startOfMonth(new Date(year, month - 1, 1));
    const chosen = (templates ?? []).filter((tpl) =>
      selectedTemplates.includes(tpl.id)
    );
    const slots: { date: string; templateId: string }[] = [];
    for (const tpl of chosen) {
      for (const d of eachDayOfInterval({ start, end: endOfMonth(start) })) {
        if (getDay(d) !== tpl.weekday) continue;
        const date = format(d, "yyyy-MM-dd");
        if (!existingSlots.has(`${date}|${tpl.time.slice(0, 5)}`)) {
          slots.push({ date, templateId: tpl.id });
        }
      }
    }
    return slots.sort((a, b) => a.date.localeCompare(b.date));
  }, [year, month, templates, selectedTemplates, existingSlots]);

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

  const toggleTemplate = (id: string) =>
    setSelectedTemplates((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
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
          sport_id: sportId === "none" ? null : sportId,
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

  const handleGenerateFromTemplates = async () => {
    if (templateSlots.length === 0) {
      toast.error(t("tpl_apply_none"));
      return;
    }
    setSaving(true);
    try {
      const templateById = new Map((templates ?? []).map((tpl) => [tpl.id, tpl]));
      await bulk.mutateAsync(
        templateSlots.map(({ date, templateId }) => {
          const tpl = templateById.get(templateId)!;
          return {
            date,
            time: tpl.time.slice(0, 5),
            location: null,
            notes: null,
            sport_id: null,
          };
        })
      );
      toast.success(`${templateSlots.length} ${t("tpl_apply_done")}`);
      onOpenChange(false);
    } catch (err) {
      console.error("[month-generator] template create failed", err);
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  const monthLabel = format(new Date(year, month - 1, 1), "MMMM yyyy", {
    locale,
  });

  const monthYearPickers = (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>{t("costs_month")}</Label>
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
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
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            {t("schedule_generate_title")}
          </DialogTitle>
          <DialogDescription>{t("schedule_generate_subtitle")}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manual">{t("schedule_generate_manual")}</TabsTrigger>
            <TabsTrigger value="templates">{t("tpl_manage")}</TabsTrigger>
          </TabsList>

          {/* ── Manual weekly pattern ── */}
          <TabsContent value="manual" className="mt-4 space-y-4">
            {monthYearPickers}

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
              <Label>{t("schedule_sport")}</Label>
              <Select value={sportId} onValueChange={setSportId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("schedule_sport_none")}
                  </SelectItem>
                  {(sports ?? []).map((sport) => (
                    <SelectItem key={sport.id} value={sport.id}>
                      {sport.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </TabsContent>

          {/* ── From saved templates ── */}
          <TabsContent value="templates" className="mt-4 space-y-4">
            {monthYearPickers}

            {loadingTemplates ? (
              <Skeleton className="h-24 w-full" />
            ) : (templates ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                {t("tpl_empty")}
              </p>
            ) : (
              <div className="space-y-1 rounded-lg border p-1">
                {(templates ?? []).map((tpl) => (
                  <label
                    key={tpl.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Checkbox
                        checked={selectedTemplates.includes(tpl.id)}
                        onCheckedChange={() => toggleTemplate(tpl.id)}
                      />
                      <span className="truncate font-medium">{tpl.name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {weekdayOptions.find((w) => w.dow === tpl.weekday)?.label} ·{" "}
                      {formatTime12h(tpl.time, lang)}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <LayoutTemplate className="h-4 w-4 text-primary" />
                {t("schedule_generate_preview")}
              </span>
              <span className="font-mono font-bold text-primary">
                {monthLabel} · {templateSlots.length}
              </span>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("common_cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleGenerateFromTemplates}
                disabled={saving || selectedTemplates.length === 0}
              >
                {saving ? t("common_saving") : t("tpl_apply")}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
