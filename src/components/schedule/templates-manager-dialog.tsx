"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Copy, LayoutTemplate, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { errorMessage } from "@/lib/utils";
import {
  useDeleteTemplate,
  useSaveTemplate,
  useTemplates,
} from "@/lib/queries";
import type { ScheduleTemplate } from "@/lib/types";

// date-fns getDay(): 0 = Sunday … 6 = Saturday
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

interface TemplatesManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplatesManagerDialog({
  open,
  onOpenChange,
}: TemplatesManagerDialogProps) {
  const { t, locale } = useI18n();
  const { data: templates, isLoading } = useTemplates();
  const saveTemplate = useSaveTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [name, setName] = useState("");
  const [weekday, setWeekday] = useState("1");
  const [time, setTime] = useState("18:00");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      resetForm();
      setEditingId(null);
      setConfirmDeleteId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetForm = () => {
    setName("");
    setWeekday("1");
    setTime("18:00");
  };

  const startEdit = (tpl: ScheduleTemplate) => {
    setEditingId(tpl.id);
    setName(tpl.name);
    setWeekday(String(tpl.weekday));
    setTime(tpl.time.slice(0, 5));
    setConfirmDeleteId(null);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await saveTemplate.mutateAsync({
        id: editingId ?? undefined,
        name: name.trim(),
        weekday: Number(weekday),
        time,
      });
      toast.success(t("tpl_saved"));
      if (!editingId) resetForm();
      else setEditingId(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success(t("tpl_deleted"));
      setConfirmDeleteId(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setBusy(false);
    }
  };

  // 2026-01-05 is a Monday; walking 7 days yields Mon…Sun labels.
  const weekdayLabel = (dow: number) =>
    format(new Date(2026, 0, 5 + WEEKDAYS.indexOf(dow)), "EEEE", { locale });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary" />
            {t("tpl_title")}
          </DialogTitle>
          <DialogDescription>{t("tpl_subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-1.5">
              <Label>{t("tpl_name")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("schedule_title")}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>{t("tpl_weekday")}</Label>
                <Select value={weekday} onValueChange={setWeekday}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((dow) => (
                      <SelectItem key={dow} value={String(dow)}>
                        {weekdayLabel(dow)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("tpl_time")}</Label>
                <Input
                  type="time"
                  dir="ltr"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingId(null);
                    resetForm();
                  }}
                >
                  <X className="h-4 w-4" />
                  {t("common_cancel")}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={busy || !name.trim()}
                onClick={handleSave}
              >
                <Plus className="h-4 w-4" />
                {editingId ? t("common_save") : t("tpl_add")}
              </Button>
            </div>
          </div>

          <div className="space-y-1 rounded-lg border p-1">
            {isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("common_loading")}
              </p>
            ) : (templates ?? []).length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("tpl_empty")}
              </p>
            ) : (
              (templates ?? []).map((tpl) =>
                confirmDeleteId === tpl.id ? (
                  <div
                    key={tpl.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm"
                  >
                    <span className="text-destructive">{tpl.name}</span>
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={busy}
                        onClick={() => handleDelete(tpl.id)}
                      >
                        {t("common_confirm")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("common_cancel")}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                ) : (
                  <div
                    key={tpl.id}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-start"
                      onClick={() => startEdit(tpl)}
                      title={t("common_edit")}
                    >
                      <p className="truncate text-sm font-medium">{tpl.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {weekdayLabel(tpl.weekday)} · {tpl.time.slice(0, 5)}
                      </p>
                    </button>
                    <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("common_edit")}
                        onClick={() => startEdit(tpl)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        onClick={() => setConfirmDeleteId(tpl.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                )
              )
            )}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Copy className="h-3.5 w-3.5" />
            {t("tpl_apply_hint")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
