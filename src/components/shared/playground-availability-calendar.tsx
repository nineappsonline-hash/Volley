"use client";

import { useMemo, useState } from "react";
import { Ban, CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { formatHour12, formatTime12h } from "@/lib/constants";
import {
  allowedIntervalsForDate,
  blockedIntervalsForDate,
  closedIntervalsFromWorkingHours,
  hasFreeSlotForDate,
  padMinutes,
  weekdayOf,
} from "@/lib/venue-slots";
import { cn } from "@/lib/utils";
import type { Dict } from "@/lib/i18n/dictionary";
import type { VenueUnavailableSlot } from "@/lib/types";

const WEEK_START = 0; // Sunday

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function PlaygroundAvailabilityCalendar({
  unavailableSlots,
  workingHours,
  busyForDate,
  selectedDate,
  onSelectDate,
  className,
  minDate,
}: {
  unavailableSlots?: VenueUnavailableSlot[];
  workingHours?: VenueUnavailableSlot[];
  /** Unavailable minute intervals (blocked + fully booked) for a given date. */
  busyForDate?: (date: string) => Array<[number, number]>;
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  className?: string;
  /** Earliest selectable "YYYY-MM-DD"; earlier days are disabled. */
  minDate?: string;
}) {
  const { t, lang } = useI18n();
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const anchor = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
    const day = anchor.getDay();
    return addDays(anchor, -((day - WEEK_START + 7) % 7));
  });

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const todayIso = toDateInput(new Date());

  const busyOn = (iso: string): Array<[number, number]> =>
    busyForDate ? busyForDate(iso) : blockedIntervalsForDate(unavailableSlots ?? [], iso);

  const dayStatus = (iso: string): "closed" | "full" | "blocked" | "open" => {
    const allowed = allowedIntervalsForDate(workingHours, iso);
    if (!!workingHours?.length && allowed.length === 0) return "closed";
    const busy = busyOn(iso);
    if (busy.length === 0) return "open";
    return hasFreeSlotForDate(workingHours, busy, iso) ? "blocked" : "full";
  };

  const slotsFor = (iso: string) =>
    (unavailableSlots ?? [])
      .filter((s) => s.weekday === weekdayOf(iso))
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start));

  const workingFor = (iso: string) => {
    const intervals = (workingHours ?? [])
      .filter((s) => s.weekday === weekdayOf(iso))
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start));
    if (intervals.length === 0) return null; // unrestricted
    return intervals.map((s) => `${formatHour12(s.start, lang)}–${formatHour12(s.end, lang)}`).join(", ");
  };

  const dayName = (iso: string) => t(`avail_day_${weekdayOf(iso)}` as keyof Dict);
  const dayNumber = (iso: string) => Number(iso.slice(8, 10));

  const closedLabel = (iso: string): string | null => {
    const closed = closedIntervalsFromWorkingHours(workingHours, iso);
    if (closed.length === 0) return null;
    if (closed.some(([s, e]) => s === 0 && e === 1440)) return t("wh_closed_day");
    return closed.map(([s, e]) => `${formatHour12(padMinutes(s), lang)}–${formatHour12(padMinutes(e), lang)}`).join(", ");
  };

  return (
    <div className={cn("space-y-3 rounded-lg border p-3", className)}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarDays className="h-4 w-4 text-primary" />
          {t("avail_title")}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t("avail_prev_week")}
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t("avail_next_week")}
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>

      {/* Week strip */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const iso = toDateInput(d);
          const status = dayStatus(iso);
          const isSelected = selectedDate === iso;
          const isToday = iso === todayIso;
          const unavailable = status === "closed" || status === "full";
          const disabled = (!!minDate && iso < minDate) || unavailable;
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate?.(iso)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md border p-1.5 text-xs transition-colors",
                isSelected ? "border-primary bg-primary/10" : "hover:bg-muted",
                disabled ? "cursor-not-allowed opacity-40" : status !== "open" && !isSelected && "opacity-70"
              )}
            >
              <span className="text-[10px] text-muted-foreground">{dayName(iso)}</span>
              <span className={cn("font-semibold", isToday && "text-primary")}>{dayNumber(iso)}</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  unavailable ? "bg-destructive" : status === "blocked" ? "bg-warning-ink" : "bg-success-ink"
                )}
                aria-label={
                  status === "closed"
                    ? t("avail_closed")
                    : status === "full"
                      ? t("avail_full")
                      : status === "blocked"
                        ? t("avail_blocked")
                        : t("avail_open")
                }
              />
            </button>
          );
        })}
      </div>

      {/* Selected day details */}
      {selectedDate && (
        <div className="space-y-1.5 rounded-md bg-muted/40 p-2.5 text-xs">
          <p className="font-medium">
            {dayName(selectedDate)} · {dayNumber(selectedDate)}
          </p>
          {dayStatus(selectedDate) === "closed" ? (
            <p className="text-destructive">{t("wh_closed_day")}</p>
          ) : dayStatus(selectedDate) === "full" ? (
            <p className="text-destructive">{t("avail_no_times")}</p>
          ) : (
            <>
              {workingFor(selectedDate) && (
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {lang === "ar" ? "ساعات العمل: " : "Opening hours: "}{workingFor(selectedDate)}
                </p>
              )}
              {slotsFor(selectedDate).map((slot, i) => (
                <p key={i} className="flex items-center gap-1.5 text-destructive">
                  <Ban className="h-3.5 w-3.5 shrink-0" />
                  {formatTime12h(slot.start, lang)} {t("avail_to")} {formatTime12h(slot.end, lang)}
                </p>
              ))}
              {busyOn(selectedDate).length === 0 && closedLabel(selectedDate) === null && (
                <p className="text-muted-foreground">{t("avail_all_free")}</p>
              )}
              {closedLabel(selectedDate) !== null && (
                <p className="text-muted-foreground">{closedLabel(selectedDate)}</p>
              )}
            </>
          )}
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-muted-foreground">
        {t("avail_legend")}<br />
        {t("avail_desc")}
      </p>
    </div>
  );
}
