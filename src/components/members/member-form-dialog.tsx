"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { KeyRound, UserPlus } from "lucide-react";
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
import { useUpdateMember } from "@/lib/queries";
import type { Profile } from "@/lib/types";

const createSchema = (t: (k: any) => string, isEdit: boolean) =>
  z.object({
    name: z.string().min(1, t("field_required")),
    email: isEdit
      ? z.string().email(t("field_invalid_email"))
      : z.string().min(1, t("field_required")).email(t("field_invalid_email")),
    password: isEdit
      ? z.string().optional()
      : z.string().min(6, t("field_min_password")),
    phone: z.string().optional(),
    join_date: z.string().optional(),
    membership_type: z.enum(["full", "half"]),
  });

type FormValues = z.infer<ReturnType<typeof createSchema>>;

interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: Profile | null;
  onCreated?: () => void;
}

export function MemberFormDialog({
  open,
  onOpenChange,
  member,
  onCreated,
}: MemberFormDialogProps) {
  const { t } = useI18n();
  const isEdit = !!member;
  const updateMember = useUpdateMember();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(createSchema(t, isEdit)),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      join_date: todayInput(),
      membership_type: "full",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: member?.name ?? "",
        email: member?.email ?? "",
        password: "",
        phone: member?.phone ?? "",
        join_date: member?.join_date ?? todayInput(),
        membership_type:
          member?.membership_type ??
          (member?.subscription_sessions && member.subscription_sessions <= 4
            ? "half"
            : "full"),
      });
    }
  }, [open, member, form]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      if (isEdit && member) {
        await updateMember.mutateAsync({
          id: member.id,
          name: values.name,
          phone: values.phone || null,
          join_date: values.join_date || null,
          membership_type: values.membership_type,
          subscription_sessions: sessionsForMembership(values.membership_type),
        });
      } else {
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
            name: values.name,
            phone: values.phone || "",
            join_date: values.join_date || todayInput(),
            membership_type: values.membership_type,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed");
        }
        onCreated?.();
      }
      toast.success(isEdit ? t("members_save_success") : t("signup_success"));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common_error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? (
              <>{t("members_edit")}</>
            ) : (
              <>
                <UserPlus className="h-5 w-5 text-primary" />
                {t("members_create")}
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {!isEdit && (
              <span className="flex items-center gap-1.5 text-xs">
                <KeyRound className="h-3 w-3" />
                {t("members_credential_hint")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("signup_name")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login_email")}</FormLabel>
                  <FormControl>
                    <Input type="email" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("login_password")}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      dir="ltr"
                      placeholder={isEdit ? "••••••" : undefined}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("signup_phone")}</FormLabel>
                  <FormControl>
                    <Input dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="join_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("members_col_join")}</FormLabel>
                  <FormControl>
                    <Input type="date" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
          </div>
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
