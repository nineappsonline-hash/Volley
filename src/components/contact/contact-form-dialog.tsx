"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { errorMessage } from "@/lib/utils";

const schema = (t: (k: any) => string) =>
  z.object({
    name: z.string().min(1, t("contact_name_required")),
    phone: z.string().min(1, t("contact_phone_required")),
    email: z
      .string()
      .email(t("field_invalid_email"))
      .optional()
      .or(z.literal("")),
    message: z.string().min(1, t("contact_message_required")),
    website: z.string().optional(),
  });

type FormValues = z.infer<ReturnType<typeof schema>>;

export function ContactFormDialog({ trigger, initialOpen = false }: { trigger?: ReactNode; initialOpen?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(initialOpen);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      message: "",
      website: "",
    },
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setSent(false);
      form.reset();
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("contact_error"));
      }
      setSent(true);
    } catch (err) {
      toast.error(errorMessage(err, t("contact_error")));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-positive-100 text-success-ink ">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle>{t("contact_success_title")}</DialogTitle>
            <p className="text-sm text-muted-foreground">{t("contact_success")}</p>
            <Button className="mt-2" onClick={() => setOpen(false)}>
              {t("contact_close")}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                {t("contact_title")}
              </DialogTitle>
              <DialogDescription>{t("contact_desc")}</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("contact_name")}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="name"
                          placeholder={t("contact_name_placeholder")}
                          {...field}
                        />
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
                      <FormLabel>{t("contact_phone")}</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          dir="ltr"
                          autoComplete="tel"
                          placeholder={t("contact_phone_placeholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("contact_email")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          dir="ltr"
                          autoComplete="email"
                          placeholder={t("contact_email_placeholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("contact_message")}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={5}
                          placeholder={t("contact_message_placeholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <input
                  type="text"
                  aria-hidden="true"
                  tabIndex={-1}
                  autoComplete="off"
                  className="hidden"
                  {...form.register("website")}
                />
                <Button type="submit" className="w-full gap-1.5" disabled={sending}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sending ? t("contact_sending") : t("contact_submit")}
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}