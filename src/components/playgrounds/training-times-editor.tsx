"use client";

import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VenueUnavailableSlot } from "@/lib/types";

/**
 * Weekly training windows for one playground. The chosen windows are stored as
 * the venue's `unavailable_slots`, so rentals and games cannot be booked while
 * the academy is training there.
 */
export function TrainingTimesEditor({
  value,
  onChange,
}: {
  value: VenueUnavailableSlot[];
  onChange: (value: VenueUnavailableSlot[]) => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const days = ar
    ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const update = (index: number, patch: Partial<VenueUnavailableSlot>) =>
    onChange(value.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));

  return (
    <fieldset className="space-y-3 rounded-xl border p-3">
      <legend className="px-1 font-bold">
        {ar ? "مواعيد التدريب (محجوزة للإيجار)" : "Training times (blocked for rentals)"}
      </legend>
      <p className="text-xs text-muted-foreground">
        {ar
          ? "حدد أيام وفترات التدريب لهذا الملعب. هذه الفترات ستُحجز تلقائيًا وتمنع تأجير الملعب فيها."
          : "Set the weekly training windows for this playground. They are booked automatically and cannot be rented."}
      </p>
      {value.map((slot, index) => (
        <div
          key={index}
          className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2 sm:grid-cols-4"
        >
          <Label className="space-y-1 text-xs">
            <span>{ar ? "اليوم" : "Day"}</span>
            <select
              className="h-9 w-full rounded border bg-card px-2"
              value={slot.weekday}
              onChange={(event) =>
                update(index, { weekday: Number(event.target.value) })
              }
            >
              {days.map((day, dayIndex) => (
                <option key={day} value={dayIndex}>
                  {day}
                </option>
              ))}
            </select>
          </Label>
          <Label className="space-y-1 text-xs">
            <span>{ar ? "من" : "From"}</span>
            <Input
              dir="ltr"
              type="time"
              value={slot.start}
              onChange={(event) => update(index, { start: event.target.value })}
            />
          </Label>
          <Label className="space-y-1 text-xs">
            <span>{ar ? "إلى" : "To"}</span>
            <Input
              dir="ltr"
              type="time"
              value={slot.end}
              onChange={(event) => update(index, { end: event.target.value })}
            />
          </Label>
          <Button
            type="button"
            variant="outline"
            className="self-end"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            {ar ? "حذف" : "Remove"}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([...value, { weekday: 0, start: "18:00", end: "20:00" }])
        }
      >
        {ar ? "إضافة موعد تدريب" : "Add training time"}
      </Button>
    </fieldset>
  );
}
