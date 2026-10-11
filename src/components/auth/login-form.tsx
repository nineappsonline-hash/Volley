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
      <div className="pointer-events-none absolute -top-32 start-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-interactive-500/20 blur-3xl rtl:translate-x-1/2" />
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
            <div className="mt-10 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50 p-4 dark:border-teal-800 dark:from-teal-950/40 dark:to-emerald-950/40">
              <Button asChild className="min-h-11 w-full gap-2 bg-teal-800 text-white hover:bg-teal-900">
                <Link href="/signup?mode=tenant">
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                  {t("signup_register_academy")}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </Button>
              <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">{t("signup_register_academy_hint")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}