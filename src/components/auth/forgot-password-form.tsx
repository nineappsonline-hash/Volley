"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/layout/language-toggle";

const schema = (t: (k: any) => string) =>
  z.object({
    email: z.string().email(t("field_invalid_email")),
  });

type FormValues = z.infer<ReturnType<typeof schema>>;

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(
        values.email,
        {
          redirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/auth/update-password`
              : undefined,
        }
      );
      if (error) throw error;
      toast.success(t("forgot_sent"));
    } catch {
      toast.error(t("forgot_failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pwa-pad-top auth-page relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-32 start-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-accent blur-3xl rtl:translate-x-1/2" />
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>
      <div className="absolute start-4 top-4">
        <Button asChild variant="ghost" className="gap-1.5">
          <Link href="/login">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("forgot_back_login")}
          </Link>
        </Button>
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <AppLogo className="w-44" />
          <h1 className="text-2xl font-extrabold">{t("forgot_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("forgot_subtitle")}</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("login_email")}</FormLabel>
                      <FormControl>
                        <Input type="email" dir="ltr" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {loading ? t("forgot_loading") : t("forgot_button")}
                </Button>
              </form>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("forgot_back_login")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}