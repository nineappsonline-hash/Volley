"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { SKILL_LEVELS } from "@/lib/constants";
import { errorMessage, todayInput } from "@/lib/utils";
import {
  useCoaches,
  useSaveSession,
  useSessions,
  useSports,
  useVenues,
} from "@/lib/queries";
import type { TrainingSession } from "@/lib/types";

const schema = (t: (k: any) => string) =>
  z.object({
    date: z.string().min(1, t("field_required")),
    time: z.string().min(1, t("field_required")),
    duration_minutes: z.coerce.number().int().min(1).max(1440),
    court_number: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
    sport_id: z.string().optional(),
    venue_id: z.string().optional(),
    coach_id: z.string().optional(),
    age_group: z.string().optional(),
    skill_level: z.string().optional(),
  });

type FormValues = z.infer<ReturnType<typeof schema>>;

interface SessionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: TrainingSession | null;
}

export function SessionFormDialog({
  open,
  onOpenChange,
  session,
}: SessionFormDialogProps) {
  const { t, lang } = useI18n();
  const isEdit = !!session;
  const saveSession = useSaveSession();
  const { data: sports } = useSports();
  const { data: venues } = useVenues();
  const { data: coaches } = useCoaches();
  const { data: sessions } = useSessions();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: {
      date: todayInput(),
      time: "18:00",
      duration_minutes: 60,
      court_number: "auto",
      location: "",
      notes: "",
      sport_id: "none",
      venue_id: "none",
      coach_id: "none",
      age_group: "",
      skill_level: "none",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        date: session?.date ?? todayInput(),
        time: session?.time.slice(0, 5) ?? "18:00",
        duration_minutes: session?.duration_minutes ?? 60,
        court_number: session?.court_number ? String(session.court_number) : "auto",
        location: session?.location ?? "",
        notes: session?.notes ?? "",
        sport_id: session?.sport_id ?? "none",
        venue_id: session?.venue_id ?? "none",
        coach_id: session?.coach_id ?? "none",
        age_group: session?.age_group ?? "",
        skill_level: session?.skill_level ?? "none",
      });
    }
  }, [open, session, form]);

  // When a venue is picked, prefill the free-text location if empty.
  const onVenueChange = (venueId: string) => {
    form.setValue("venue_id", venueId);
    if (venueId !== "none") {
      const venue = (venues ?? []).find((v) => v.id === venueId);
      if (venue && !form.getValues("location")) {
        form.setValue("location", venue.name);
      }
    }
  };

  // Watch at render top-level so the conflict check re-runs when they change.
  const watchedVenue = form.watch("venue_id");
  const watchedDate = form.watch("date");
  const watchedTime = form.watch("time");

  const watchedDuration = form.watch("duration_minutes");
  const watchedCourt = form.watch("court_number");
  const watchedCoach = form.watch("coach_id");
  const conflict = useMemo(() => {
    if (!watchedDate || !watchedTime) return false;
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const start = minutes(watchedTime), end = start + Number(watchedDuration);
    if (end > 1440) return true;
    const overlapping = (sessions ?? []).filter(s => s.id !== session?.id && s.status !== "canceled" && s.date === watchedDate && minutes(s.time) < end && start < minutes(s.time) + (s.duration_minutes ?? 60));
    if (watchedCoach && watchedCoach !== "none" && overlapping.some(s => s.coach_id === watchedCoach)) return true;
    if (!watchedVenue || watchedVenue === "none") return false;
    const venue = (venues ?? []).find(v => v.id === watchedVenue);
    const occupied = new Set(overlapping.filter(s => s.venue_id === watchedVenue).map(s => s.court_number ?? 1));
    return watchedCourt && watchedCourt !== "auto" ? occupied.has(Number(watchedCourt)) : occupied.size >= (venue?.court_count ?? 1);
  }, [watchedVenue, watchedDate, watchedTime, watchedDuration, watchedCourt, watchedCoach, sessions, session, venues]);

  const onSubmit = async (values: FormValues) => {
    if (conflict) return;
    setSubmitting(true);
    try {
      await saveSession.mutateAsync({
        id: session?.id,
        date: values.date,
        time: values.time,
        duration_minutes: values.duration_minutes,
        court_number: values.court_number === "auto" || !values.court_number ? null : Number(values.court_number),
        location: values.location || null,
        notes: values.notes || null,
        sport_id: values.sport_id === "none" ? null : values.sport_id,
        venue_id: values.venue_id === "none" ? null : values.venue_id,
        coach_id: values.coach_id === "none" ? null : values.coach_id,
        age_group: values.age_group || null,
        skill_level:
          values.skill_level && values.skill_level !== "none"
            ? (values.skill_level as "beginner" | "intermediate" | "advanced")
            : null,
      });
      toast.success(t("schedule_saved"));
      onOpenChange(false);
    } catch (err) {
      console.error("[session-form] save failed", err);
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            {isEdit ? t("schedule_form_title_edit") : t("schedule_form_title_new")}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("schedule_date")}</FormLabel>
                  <FormControl>
                    <Input type="date" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("schedule_time")}</FormLabel>
                  <FormControl>
                    <Input type="time" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="duration_minutes" render={({ field }) => <FormItem><FormLabel>{lang === "ar" ? "المدة بالدقائق" : "Duration (minutes)"}</FormLabel><FormControl><Input type="number" min="1" max="1440" {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="court_number" render={({ field }) => <FormItem><FormLabel>{lang === "ar" ? "رقم الملعب" : "Court number"}</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="auto">{lang === "ar" ? "اختيار تلقائي" : "Automatic"}</SelectItem>{Array.from({ length: (venues ?? []).find(v => v.id === watchedVenue)?.court_count ?? 1 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="sport_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("schedule_sport")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="venue_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("venue_label")}</FormLabel>
                  <Select onValueChange={onVenueChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t("venue_none")}</SelectItem>
                      {(venues ?? []).map((venue) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="coach_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("coach_label")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t("coach_none")}</SelectItem>
                      {(coaches ?? []).map((coach) => (
                        <SelectItem key={coach.id} value={coach.id}>
                          {coach.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="skill_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("skill_level")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {SKILL_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {t(`skill_${level}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="age_group"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("age_group")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("age_group_placeholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("schedule_location")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {conflict && (
            <p className="flex items-start gap-2 rounded-md border border-attention-300/60 bg-attention-50 p-3 text-xs text-warning-ink dark:bg-attention-500/10 dark:text-attention-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {lang === "ar" ? "المدرب أو الملعب مش متاح في الوقت ده، أو الحصة بتنتهي بعد منتصف الليل. غيّر الميعاد أو المدة." : "The coach or court is unavailable during this interval, or the session ends after midnight. Change the time or duration."}
            </p>
          )}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("schedule_notes")}</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common_cancel")}
            </Button>
            <Button type="submit" disabled={submitting || conflict}>
              {submitting ? t("common_saving") : t("common_save")}
            </Button>
          </DialogFooter>
        </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
