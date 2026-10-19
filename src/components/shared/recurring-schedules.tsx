"use client";

import { useSports, useVenues, useCoaches, useRecurringSchedules, useCreateRecurringSchedule, useDeleteRecurringSchedule, useGenerateSessions } from "@/lib/queries";
import { QueryState } from "@/components/shared/query-state";
import { errorMessage } from "@/lib/utils";
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
  const schedulesQuery = useRecurringSchedules();
  const { data: schedules = [] } = schedulesQuery;
  const { data: sports = [] } = useSports();
  const { data: venues = [] } = useVenues();
  const { data: coaches = [] } = useCoaches();
  const copy = (en: string, ar: string) => lang === "ar" ? ar : en;
  const deleteSchedule = useDeleteRecurringSchedule();
  const generateSessions = useGenerateSessions();
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    weekday: "0",
    time: "18:00",
    duration_minutes: "60",
    start_date: "",
    end_date: "",
    sport_id: "",
    venue_id: "",
    coach_id: "",
  });

  const createSchedule = useCreateRecurringSchedule();

  const handleCreate = async () => {
    if (createSchedule.isPending) return;
    if (form.end_date < form.start_date || (Date.parse(form.end_date) - Date.parse(form.start_date)) / 86400000 > 366) {
      toast.error(copy("Choose a date range of up to one year, ending after it starts.", "اختار فترة لحد سنة، وتاريخ النهاية بعد البداية.")); return;
    }
    try {
    await createSchedule.mutateAsync({
      name: form.name.trim(),
      weekday: parseInt(form.weekday),
      time: form.time,
      duration_minutes: Number(form.duration_minutes),
      sport_id: form.sport_id || null,
      venue_id: form.venue_id || null,
      coach_id: form.coach_id || null,
      age_group: null,
      skill_level: null,
      start_date: form.start_date,
      end_date: form.end_date,
      is_active: true,
    });
    toast.success(copy("Weekly schedule saved. Use Generate sessions to add it to your calendar.", "تم حفظ الجدول الأسبوعي. اضغط إنشاء الحصص لإضافتها للتقويم."));
    setShowForm(false);
    setForm({ name: "", weekday: "0", time: "18:00", duration_minutes: "60", start_date: "", end_date: "", sport_id: "", venue_id: "", coach_id: "" });
    } catch (error) { toast.error(errorMessage(error, t("common_error"))); }
  };

  const handleGenerate = async (schedule: any) => {
    if (generateSessions.isPending) return;
    try {
      const sessionsCount = await generateSessions.mutateAsync(schedule);
      toast.success(t("recurring_generated").replace("{n}", String(sessionsCount)));
    } catch (error) { toast.error(errorMessage(error, t("common_error"))); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("recurring_delete_confirm"))) return;
    try {
      await deleteSchedule.mutateAsync(id);
      toast.success(copy("Schedule deleted. Generated sessions remain in your calendar.", "تم حذف الجدول. الحصص اللي اتعملت بتفضل في التقويم."));
    } catch (error) { toast.error(errorMessage(error, t("common_error"))); }
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
                          <SelectItem key={i} value={String(i)} data-sort={i}>{tk(`avail_day_${i}` as any)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("recurring_time")}</Label>
                    <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1"><Label>{copy("Duration (minutes)", "المدة بالدقائق")}</Label><Input type="number" min="1" max="1440" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} /></div>
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
                {([{ key: "sport_id", label: tk("schedule_sport"), options: sports }, { key: "venue_id", label: tk("venue_label"), options: venues }, { key: "coach_id", label: tk("coach_label"), options: coaches }] as const).map(field => <div key={field.key} className="space-y-1"><Label>{field.label}</Label><Select value={form[field.key] || "none"} onValueChange={value => setForm({ ...form, [field.key]: value === "none" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{copy("Not assigned", "غير محدد")}</SelectItem>{field.options.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select></div>)}
                <Button onClick={handleCreate} disabled={!form.name.trim() || !form.start_date || !form.end_date || createSchedule.isPending}>
                  {copy("Save weekly schedule", "حفظ الجدول الأسبوعي")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent><QueryState queries={[schedulesQuery]}>
        {schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("recurring_empty")}</p>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tk(`avail_day_${s.weekday}` as any)} · {formatTime12h(s.time, lang)} • {s.start_date} → {s.end_date}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" aria-label={copy("Generate sessions", "إنشاء الحصص")} onClick={() => handleGenerate(s)} disabled={generateSessions.isPending}>
                    <Calendar className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={copy("Delete weekly schedule", "حذف الجدول الأسبوعي")} disabled={deleteSchedule.isPending} onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState></CardContent>
    </Card>
  );
}
