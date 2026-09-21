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
  endTimeOptionsForDate,
  minutesOf,
  timeOptionsForDate,
} from "@/lib/venue-slots";
import type { VenueUnavailableSlot } from "@/lib/types";

/**
 * Start ("from") and end ("to") time pickers whose options come from the
 * playground's working hours for the chosen date. The reservation duration is
 * derived automatically from the two picks and shown read-only. Renders three
 * grid cells so the parent can drop it inside its own layout grid.
 */
export function PlaygroundTimeRange({
  workingHours,
  date,
  from,
  to,
  onFromChange,
  onToChange,
}: {
  workingHours?: VenueUnavailableSlot[];
  date: string;
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const { t, lang } = useI18n();

  const startOptions = useMemo(
    () => timeOptionsForDate(workingHours, date),
    [workingHours, date],
  );
  const endOptions = useMemo(
    () => (from ? endTimeOptionsForDate(workingHours, date, from) : []),
    [workingHours, date, from],
  );

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
    if (to && minutesOf(to) <= minutesOf(value)) onToChange("");
  };

  const closed = !!date && startOptions.length === 0;

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
          <p className="text-xs text-muted-foreground">{t("wh_closed_day")}</p>
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
