"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Building2, Loader2 } from "lucide-react";
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
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { GoogleSignInButton, OrDivider } from "@/components/auth/google-signin-button";
import { authDestination } from "@/lib/auth-redirect";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";

const schema = (t: (k: any) => string) =>
  z.object({
    email: z.string().email(t("field_invalid_email")),
    password: z.string().min(1, t("field_required")),
  });

type FormValues = z.infer<ReturnType<typeof schema>>;

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("passwordUpdated") === "1") {
      toast.success(t("login_password_updated"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await signIn(values.email, values.password);
      router.push(authDestination(searchParams.get("redirectedFrom")));
      router.refresh();
    } catch {
      toast.error(t("login_error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pwa-pad-top relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-32 start-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-accent blur-3xl rtl:translate-x-1/2" />
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>
      <div className="absolute start-4 top-4">
        <Button asChild variant="ghost" className="gap-1.5">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("auth_back_home")}
          </Link>
        </Button>
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <AppLogo className="w-44" />
          <h1 className="text-2xl font-extrabold">{t("login_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("login_subtitle")}</p>
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
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t("login_forgot_password")}
                  </Link>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {loading ? t("login_loading") : t("login_button")}
                </Button>
              </form>
            </Form>
            <div className="mt-4">
              <OrDivider />
            </div>
            <GoogleSignInButton className="mt-4 w-full" />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t("login_no_account")}{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                {t("login_signup_link")}
              </Link>
            </p>
            <div className="mt-10 border-t border-border/60 pt-6">
              <Button asChild variant="outline" className="group h-auto min-h-14 w-full justify-start gap-3 whitespace-normal rounded-xl border-border bg-gradient-to-br from-card to-background px-4 py-3 text-start text-brand-950 shadow-sm transition-colors hover:border-brand-600/40 hover:bg-accent hover:text-brand-950 dark:border-brand-400/20 dark:from-brand-400/5 dark:to-transparent dark:text-brand-100 dark:hover:border-brand-400/40 dark:hover:bg-brand-400/10 dark:hover:text-brand-50">
                <Link href="/signup?mode=tenant">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-700/10 text-brand-700 dark:bg-brand-300/10 dark:text-brand-300"><Building2 className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                  <span className="flex-1 text-sm font-semibold">{t("signup_register_academy")}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-brand-700/70 dark:text-brand-300/70 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
              <p className="mx-auto mt-3 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">{t("signup_register_academy_hint")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}