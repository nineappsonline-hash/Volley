"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { errorMessage, todayInput } from "@/lib/utils";
import { useSubmitTrialRequest } from "@/lib/queries";

const schema = (t: (k: any) => string) =>
  z.object({
    full_name: z.string().min(1, t("field_required")),
    email: z.string().email(t("field_invalid_email")).optional().or(z.literal("")),
    phone: z.string().min(1, t("field_required")),
    sport_id: z.string().optional(),
    preferred_date: z.string().optional(),
  });

type FormValues = z.infer<ReturnType<typeof schema>>;

interface TrialFormProps {
  academyId: string;
  sports: { id: string; name: string }[];
}

export function TrialForm({ academyId, sports }: TrialFormProps) {
  const { t } = useI18n();
  const submit = useSubmitTrialRequest();
  const [done, setDone] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      sport_id: "none",
      preferred_date: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await submit.mutateAsync({
        academy_id: academyId,
        name: values.full_name.trim(),
        email: values.email || null,
        phone: values.phone.trim(),
        sport_id: values.sport_id === "none" ? null : values.sport_id,
        preferred_date: values.preferred_date || null,
      });
      setDone(true);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  if (done) {
    return (
      <Card id="trial">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive-100 text-success-ink dark:bg-positive-500/15">
            <CalendarCheck className="h-6 w-6" />
          </div>
          <p className="font-medium">{t("trial_success")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="trial">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="h-4 w-4 text-primary" />
          {t("trial_book")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("trial_name")}</FormLabel>
                    <FormControl>
                      <Input autoComplete="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("trial_phone")}</FormLabel>
                    <FormControl>
                      <Input dir="ltr" autoComplete="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("trial_email")}</FormLabel>
                  <FormControl>
                    <Input type="email" dir="ltr" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="sport_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("trial_sport")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {(sports ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
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
                name="preferred_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("trial_date")}</FormLabel>
                    <FormControl>
                      <Input type="date" dir="ltr" min={todayInput()} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submit.isPending}>
              {submit.isPending ? t("common_saving") : t("trial_submit")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
