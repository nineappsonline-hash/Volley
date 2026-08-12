"use client";

import { useEffect, useState } from "react";
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
import { sessionsForMembership } from "@/lib/constants";
import { todayInput } from "@/lib/utils";
import { useSavePayment, useUpdatePayment } from "@/lib/queries";
import type { Payment } from "@/lib/types";

const schema = (t: (k: any) => string) =>
  z.object({
    amount: z.coerce.number().positive(t("field_required")),
    payment_date: z.string().min(1, t("field_required")),
    membership_type: z.enum(["full", "half"]),
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
  const { t } = useI18n();
  const savePayment = useSavePayment();
  const updatePayment = useUpdatePayment();
  const [submitting, setSubmitting] = useState(false);

  const isEditing = !!payment;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: {
      amount: undefined as unknown as number,
      payment_date: todayInput(),
      membership_type:
        defaultSessions > 0 && defaultSessions <= 4 ? "half" : "full",
      notes: "",
    },
  });

  // Refresh the form whenever the dialog opens — prefilled when editing.
  useEffect(() => {
    if (open) {
      if (payment) {
        form.reset({
          amount: Number(payment.amount),
          payment_date: payment.payment_date,
          membership_type: payment.membership_type,
          notes: payment.notes ?? "",
        });
      } else {
        form.reset({
          amount: undefined as unknown as number,
          payment_date: todayInput(),
          membership_type:
            defaultSessions > 0 && defaultSessions <= 4 ? "half" : "full",
          notes: "",
        });
      }
    }
  }, [open, payment, defaultSessions, form]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        amount: values.amount,
        payment_date: values.payment_date,
        membership_type: values.membership_type,
        subscription_sessions: sessionsForMembership(values.membership_type),
        notes: values.notes || null,
      };
      if (payment) {
        await updatePayment.mutateAsync({ id: payment.id, ...payload });
        toast.success(t("member_payment_updated"));
      } else {
        await savePayment.mutateAsync({
          member_id: memberId,
          ...payload,
        });
        toast.success(t("member_payment_added"));
      }
      onOpenChange(false);
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
            name="membership_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("members_membership_label")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
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
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
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
