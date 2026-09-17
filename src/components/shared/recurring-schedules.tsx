"use client";

import { useRecurringSchedules, useCreateRecurringSchedule, useDeleteRecurringSchedule, useGenerateSessions } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { formatTime12h } from "@/lib/constants";
import { RefreshCw, Trash2, Plus, Calendar } from "lucide-react";
import { useState } from "react";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function RecurringSchedulesList() {
  const { t: tk, lang } = useI18n();
  const t = (key: string) => tk(key as any);
  const { data: schedules = [] } = useRecurringSchedules();
  const deleteSchedule = useDeleteRecurringSchedule();
  const generateSessions = useGenerateSessions();
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    weekday: "0",
    time: "18:00",
    start_date: "",
    end_date: "",
    sport_id: "",
    venue_id: "",
    coach_id: "",
  });

  const createSchedule = useCreateRecurringSchedule();

  const handleCreate = async () => {
    await createSchedule.mutateAsync({
      academy_id: "", // Set server-side from RLS
      name: form.name,
      weekday: parseInt(form.weekday),
      time: form.time,
      sport_id: form.sport_id || null,
      venue_id: form.venue_id || null,
      coach_id: form.coach_id || null,
      age_group: null,
      skill_level: null,
      start_date: form.start_date,
      end_date: form.end_date,
      is_active: true,
    });
    toast.success(t("recurring_generated").replace("{n}", "?"));
    setShowForm(false);
    setForm({ name: "", weekday: "0", time: "18:00", start_date: "", end_date: "", sport_id: "", venue_id: "", coach_id: "" });
  };

  const handleGenerate = async (schedule: any) => {
    const sessionsCount = await generateSessions.mutateAsync(schedule);
    toast.success(t("recurring_generated").replace("{n}", String(sessionsCount ?? "—")));
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("recurring_delete_confirm"))) return;
    await deleteSchedule.mutateAsync(id);
    toast.success("Schedule deleted");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" />
            {t("recurring_title")}
          </CardTitle>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                {t("recurring_add")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("recurring_add")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("recurring_name")}</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t("recurring_name_placeholder")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("recurring_weekday")}</Label>
                    <Select value={form.weekday} onValueChange={(v) => setForm({ ...form, weekday: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((day, i) => (
                          <SelectItem key={i} value={String(i)} data-sort={i}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("recurring_time")}</Label>
                    <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t("recurring_start")}</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("recurring_end")}</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={!form.name || !form.start_date || !form.end_date || createSchedule.isPending}>
                  {t("recurring_generate")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("recurring_empty")}</p>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {WEEKDAYS[s.weekday]} at {formatTime12h(s.time, lang)} • {s.start_date} → {s.end_date}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => handleGenerate(s)} disabled={generateSessions.isPending}>
                    <Calendar className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
