"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { BadgeDollarSign } from "lucide-react";
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
import { PAYMENT_METHODS, sessionsForMembership } from "@/lib/constants";
import { triggerEmail } from "@/lib/email-triggers";
import { todayInput } from "@/lib/utils";
import {
  usePlans,
  useSavePayment,
  useUpdatePayment,
} from "@/lib/queries";
import type { Payment, PaymentMethod } from "@/lib/types";

const schema = (t: (k: any) => string) =>
  z.object({
    amount: z.coerce.number().positive(t("field_required")),
    payment_date: z.string().min(1, t("field_required")),
    plan_choice: z.string().min(1),
    subscription_sessions: z.coerce.number().min(1),
    method: z.string().min(1),
    notes: z.string().optional(),
  });

type FormValues = z.infer<ReturnType<typeof schema>>;

interface PaymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  defaultSessions?: number;
  /** When set, the dialog edits this payment instead of creating a new one. */
  payment?: Payment | null;
}

export function PaymentFormDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  defaultSessions = 8,
  payment = null,
}: PaymentFormDialogProps) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const savePayment = useSavePayment();
  const updatePayment = useUpdatePayment();
  const { data: plans } = usePlans();
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!payment;

  const defaultPlanChoice = () => {
    if (defaultSessions > 0 && defaultSessions <= 4) return "half";
    return "full";
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: {
      amount: undefined as unknown as number,
      payment_date: todayInput(),
      plan_choice: defaultPlanChoice(),
      subscription_sessions: sessionsForMembership(defaultPlanChoice()),
      method: PAYMENT_METHODS[0],
      notes: "",
    },
  });

  // Picking a plan fills in the session count (and price when known).
  const onPlanChoiceChange = (choice: string) => {
    form.setValue("plan_choice", choice);
    if (choice === "full" || choice === "half") {
      form.setValue("subscription_sessions", sessionsForMembership(choice));
      return;
    }
    const plan = (plans ?? []).find((p) => p.id === choice);
    if (plan) {
      form.setValue("subscription_sessions", plan.sessions_count);
      if (plan.price != null && !isEditing) {
        form.setValue("amount", Number(plan.price));
      }
    }
  };

  // Refresh the form whenever the dialog opens — prefilled when editing.
  useEffect(() => {
    if (open) {
      if (payment) {
        form.reset({
          amount: Number(payment.amount),
          payment_date: payment.payment_date,
          plan_choice: payment.plan_id ?? defaultPlanChoice(),
          subscription_sessions: payment.subscription_sessions,
          method: payment.method ?? PAYMENT_METHODS[0],
          notes: payment.notes ?? "",
        });
      } else {
        form.reset({
          amount: undefined as unknown as number,
          payment_date: todayInput(),
          plan_choice: defaultPlanChoice(),
          subscription_sessions: sessionsForMembership(defaultPlanChoice()),
          method: PAYMENT_METHODS[0],
          notes: "",
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment, defaultSessions, form]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try
    {
      const isLegacyType =
        values.plan_choice === "full" || values.plan_choice === "half";
      const payload = {
        amount: values.amount,
        payment_date: values.payment_date,
        membership_type: isLegacyType
          ? (values.plan_choice as "full" | "half")
          : ("full" as const),
        plan_id:
          values.plan_choice !== "full" && values.plan_choice !== "half"
            ? values.plan_choice
            : null,
        subscription_sessions: values.subscription_sessions,
        method: values.method as PaymentMethod,
        notes: values.notes || null,
      };
      if (payment) {
        await updatePayment.mutateAsync({ id: payment.id, ...payload });
        toast.success(t("member_payment_updated"));
        onOpenChange(false);
      } else {
        const id = await savePayment.mutateAsync({
          member_id: memberId,
          ...payload,
        });
        toast.success(t("member_payment_added"));
        onOpenChange(false);
        // Fire-and-forget email
        triggerEmail("payment", memberId, {
          amount: values.amount,
          sessions: values.subscription_sessions,
        });
        router.push(`/receipts/${id}`);
      }
      form.reset();
    } catch {
      toast.error(t("common_error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5 text-primary" />
            {isEditing ? t("member_edit_payment") : t("member_add_payment")} —{" "}
            {memberName}
          </DialogTitle>
          <DialogDescription>
            {t("member_payment_notes_placeholder")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("member_payment_amount")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      dir="ltr"
                      placeholder={t("member_payment_placeholder_amount")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("member_payment_date")}</FormLabel>
                  <FormControl>
                    <Input type="date" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="plan_choice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("payment_plan")}</FormLabel>
                <Select onValueChange={onPlanChoiceChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="full">
                      {t("membership_full")} · {t("membership_full_hint")}
                    </SelectItem>
                    <SelectItem value="half">
                      {t("membership_half")} · {t("membership_half_hint")}
                    </SelectItem>
                    {(plans ?? []).map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} · {plan.sessions_count}{" "}
                        {lang === "ar" ? "حصص" : "sessions"}
                        {plan.price != null ? ` · ${Number(plan.price)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="subscription_sessions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("plans_sessions")}</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("payment_method")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {t(`method_${m}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("member_payment_notes")}</FormLabel>
                <FormControl>
                  <Input {...field} />
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
        </Form>
      </DialogContent>
    </Dialog>
  );
}
