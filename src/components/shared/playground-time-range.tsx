"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { formatTime12h } from "@/lib/constants";
import {
  allowedIntervalsForDate,
  endTimeOptionsForDate,
  minutesOf,
  rangeOverlaps,
  timeOptionsForDate,
} from "@/lib/venue-slots";
import type { VenueUnavailableSlot } from "@/lib/types";

/**
 * Start ("from") and end ("to") time pickers whose options come from the
 * playground's working hours for the chosen date. Unavailable (blocked) and
 * fully-booked intervals are excluded, and the reservation duration is derived
 * automatically from the two picks and shown read-only. Renders three grid
 * cells so the parent can drop it inside its own layout grid.
 */
export function PlaygroundTimeRange({
  workingHours,
  busyIntervals,
  date,
  from,
  to,
  step = 60,
  onFromChange,
  onToChange,
}: {
  workingHours?: VenueUnavailableSlot[];
  /** Unavailable minute intervals (blocked + fully booked) for `date`. */
  busyIntervals?: Array<[number, number]>;
  date: string;
  from: string;
  to: string;
  step?: number;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const { t, lang } = useI18n();
  const busy = useMemo(() => busyIntervals ?? [], [busyIntervals]);

  const startOptions = useMemo(
    () =>
      timeOptionsForDate(workingHours, date, step).filter(
        (v) => !rangeOverlaps(minutesOf(v), minutesOf(v) + step, busy),
      ),
    [workingHours, date, step, busy],
  );
  const endOptions = useMemo(() => {
    if (!from) return [];
    const fromMin = minutesOf(from);
    return endTimeOptionsForDate(workingHours, date, from, step).filter(
      (v) => !rangeOverlaps(fromMin, minutesOf(v), busy),
    );
  }, [workingHours, date, from, step, busy]);

  const duration = from && to ? (minutesOf(to) - minutesOf(from)) / 60 : 0;
  const durationLabel =
    duration > 0
      ? `${Number.isInteger(duration) ? duration : duration.toFixed(1)} ${t("rentals_hours_short")}`
      : "—";

  // "24:00" is the end-of-day marker; 12-hour formatting would call it noon.
  const formatOption = (value: string) =>
    value === "24:00"
      ? lang === "ar"
        ? "12:00 ص"
        : "12:00 AM"
      : formatTime12h(value, lang);

  const handleFrom = (value: string) => {
    onFromChange(value);
    if (to) {
      const fromMin = minutesOf(value);
      const toMin = minutesOf(to);
      if (toMin <= fromMin || rangeOverlaps(fromMin, toMin, busy)) onToChange("");
    }
  };

  const closed = !!date && startOptions.length === 0;
  const closedDay =
    !!date &&
    !!workingHours?.length &&
    allowedIntervalsForDate(workingHours, date).length === 0;

  return (
    <>
      <div className="space-y-2">
        <Label>{t("community_from")}</Label>
        <Select
          value={from}
          onValueChange={handleFrom}
          disabled={!date || startOptions.length === 0}
        >
          <SelectTrigger aria-label={t("community_from")}>
            <SelectValue placeholder={t("community_time")} />
          </SelectTrigger>
          <SelectContent>
            {startOptions.map((v) => (
              <SelectItem key={v} value={v} data-sort={v}>
                {formatOption(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {closed && (
          <p className="text-xs text-muted-foreground">
            {closedDay ? t("wh_closed_day") : t("avail_no_times")}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label>{t("community_to")}</Label>
        <Select
          value={to}
          onValueChange={onToChange}
          disabled={!from || endOptions.length === 0}
        >
          <SelectTrigger aria-label={t("community_to")}>
            <SelectValue placeholder={t("community_time")} />
          </SelectTrigger>
          <SelectContent>
            {endOptions.map((v) => (
              <SelectItem key={v} value={v} data-sort={v}>
                {formatOption(v)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t("community_duration")}</Label>
        <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm font-bold">
          {durationLabel}
        </div>
      </div>
    </>
  );
}
