"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useCoachAvailability, useSaveCoachAvailability } from "@/lib/queries";
import type { Coach } from "@/lib/types";

interface CoachAvailabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coach: Coach | null;
}

const WEEKDAYS = [
  { value: 0, en: "Sunday", ar: "الأحد" },
  { value: 1, en: "Monday", ar: "الإثنين" },
  { value: 2, en: "Tuesday", ar: "الثلاثاء" },
  { value: 3, en: "Wednesday", ar: "الأربعاء" },
  { value: 4, en: "Thursday", ar: "الخميس" },
  { value: 5, en: "Friday", ar: "الجمعة" },
  { value: 6, en: "Saturday", ar: "السبت" },
];

interface Slot {
  weekday: number;
  start_time: string;
  end_time: string;
}

export function CoachAvailabilityDialog({
  open,
  onOpenChange,
  coach,
}: CoachAvailabilityDialogProps) {
  const { t, lang } = useI18n();
  const { data: availability } = useCoachAvailability(coach?.id);
  const save = useSaveCoachAvailability();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && availability) {
      setSlots(
        availability.map((a) => ({
          weekday: a.weekday,
          start_time: a.start_time.slice(0, 5),
          end_time: a.end_time.slice(0, 5),
        }))
      );
    } else if (open) {
      setSlots([]);
    }
  }, [open, availability]);

  const addSlot = () => {
    setSlots([...slots, { weekday: 0, start_time: "09:00", end_time: "10:00" }]);
  };

  const removeSlot = (index: number) => {
    setSlots(slots.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, field: keyof Slot, value: string | number) => {
    setSlots(slots.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleSave = async () => {
    if (!coach) return;
    setSaving(true);
    try {
      await save.mutateAsync({ coach_id: coach.id, slots });
      toast.success(t("coach_avail_saved"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {t("coach_avail_title")}
            {coach && <span className="text-muted-foreground">— {coach.name}</span>}
          </DialogTitle>
          <DialogDescription>{t("coach_avail_subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {slots.length === 0 && (
            <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
              {t("coach_avail_empty")}
            </p>
          )}

          {slots.map((slot, i) => (
            <div key={i} className="flex items-end gap-2 rounded-lg border p-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">{t("coach_avail_weekday")}</Label>
                <Select
                  value={String(slot.weekday)}
                  onValueChange={(v) => updateSlot(i, "weekday", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)} data-sort={d.value}>
                        {lang === "ar" ? d.ar : d.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28 space-y-1.5">
                <Label className="text-xs">{t("coach_avail_start")}</Label>
                <Input
                  type="time"
                  dir="ltr"
                  value={slot.start_time}
                  onChange={(e) => updateSlot(i, "start_time", e.target.value)}
                />
              </div>
              <div className="w-28 space-y-1.5">
                <Label className="text-xs">{t("coach_avail_end")}</Label>
                <Input
                  type="time"
                  dir="ltr"
                  value={slot.end_time}
                  onChange={(e) => updateSlot(i, "end_time", e.target.value)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => removeSlot(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addSlot} className="w-full">
            <Plus className="h-4 w-4" />
            {t("coach_avail_add")}
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common_saving") : t("coach_avail_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
