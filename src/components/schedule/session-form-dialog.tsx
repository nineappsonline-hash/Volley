"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
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
import { useI18n } from "@/lib/i18n";
import { errorMessage, todayInput } from "@/lib/utils";
import { useSaveSession } from "@/lib/queries";
import type { TrainingSession } from "@/lib/types";

const schema = (t: (k: any) => string) =>
  z.object({
    date: z.string().min(1, t("field_required")),
    time: z.string().min(1, t("field_required")),
    location: z.string().optional(),
    notes: z.string().optional(),
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
  const { t } = useI18n();
  const isEdit = !!session;
  const saveSession = useSaveSession();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: {
      date: todayInput(),
      time: "18:00",
      location: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        date: session?.date ?? todayInput(),
        time: session?.time.slice(0, 5) ?? "18:00",
        location: session?.location ?? "",
        notes: session?.notes ?? "",
      });
    }
  }, [open, session, form]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await saveSession.mutateAsync({
        id: session?.id,
        date: values.date,
        time: values.time,
        location: values.location || null,
        notes: values.notes || null,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            {isEdit ? t("schedule_form_title_edit") : t("schedule_form_title_new")}
          </DialogTitle>
        </DialogHeader>
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
            <Button type="submit" disabled={submitting}>
              {submitting ? t("common_saving") : t("common_save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
