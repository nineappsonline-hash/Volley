"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DayPicker } from "react-day-picker";
import { format } from "date-fns";
import { enUS, ar } from "date-fns/locale";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import "react-day-picker/dist/style.css";
import { Button } from "@/components/ui/button";
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
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useSaveVenue } from "@/lib/queries";
import type { Venue, VenueBlockedDate } from "@/lib/types";

interface AvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: Venue | null;
}

const isoKey = (d: Date) => format(d, "yyyy-MM-dd");

export function AvailabilityDialog({ open, onOpenChange, venue }: AvailabilityDialogProps) {
  const { t, lang } = useI18n();
  const save = useSaveVenue();
  const [blocks, setBlocks] = useState<VenueBlockedDate[]>(venue?.blocked_dates ?? []);
  const [dateInput, setDateInput] = useState("");
  const [startInput, setStartInput] = useState("09:00");
  const [endInput, setEndInput] = useState("17:00");

  useEffect(() => {
    if (venue) {
      setBlocks(venue.blocked_dates ?? []);
      setDateInput("");
    }
  }, [venue]);

  const blockedByDate = useMemo(() => new Map(blocks.map((b) => [b.date, b])), [blocks]);

  const removeBlocksFor = (date: string) =>
    setBlocks((prev) => prev.filter((b) => b.date !== date));

  const handleDayToggle = (day: Date) => {
    const key = isoKey(day);
    if (blockedByDate.has(key)) removeBlocksFor(key);
    else setBlocks((prev) => [...prev, { date: key, all_day: true }]);
  };

  const addWindow = () => {
    const date = dateInput?.trim();
    const start = startInput?.trim();
    const end = endInput?.trim();
    if (!date || !start || !end) {
      toast.error(t("field_required"));
      return;
    }
    if (start >= end) {
      toast.error(t("owner_availability_invalid_range"));
      return;
    }
    setBlocks((prev) => [...prev.filter((b) => b.date !== date), { date, start, end }]);
    setDateInput("");
  };

  const handleSave = async () => {
    if (!venue) return;
    try {
      await save.mutateAsync({
        id: venue.id,
        name: venue.name,
        blocked_dates: blocks,
      });
      toast.success(t("owner_availability_saved"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("owner_availability_title")}</DialogTitle>
          <DialogDescription>{t("owner_availability_hint")}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center rounded-lg border p-2">
          <DayPicker
            mode="single"
            selected={undefined}
            onDayClick={handleDayToggle}
            locale={lang === "ar" ? ar : enUS}
            showOutsideDays={false}
            modifiersClassNames={{ blocked: "rd-blocked" }}
            modifiers={{
              blocked: (d: Date) => blockedByDate.has(isoKey(d)),
            }}
          />
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <Label>{t("owner_availability_window_title")}</Label>
          <div className="grid grid-cols-3 gap-2">
            <Input type="date" dir="ltr" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
            <Input type="time" dir="ltr" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
            <Input type="time" dir="ltr" value={endInput} onChange={(e) => setEndInput(e.target.value)} />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addWindow}>
            <Plus className="h-4 w-4" />
            {t("owner_availability_add_window")}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("owner_availability_list_title")}</p>
          {blocks.length === 0 ? (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {t("owner_availability_empty")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...blocks]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((b) => (
                  <li key={b.date} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <CalendarOff className="h-4 w-4 shrink-0 text-destructive" />
                      <span className="truncate" dir="ltr">
                        {lang === "ar" ? format(new Date(`${b.date}T00:00:00`), "yyyy/MM/dd") : b.date}
                        {b.all_day ? ` · ${t("owner_availability_all_day")}` : ` · ${b.start}–${b.end}`}
                      </span>
                    </span>
                    <Button variant="ghost" size="icon" aria-label={t("common_delete")} onClick={() => removeBlocksFor(b.date)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!venue || save.isPending}>
            {save.isPending ? t("common_loading") : t("common_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}