"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Building2, Loader2, Volleyball } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useAuth } from "@/lib/auth";

const schema = (t: (k: any) => string) =>
  z.object({
    email: z.string().email(t("field_invalid_email")),
    password: z.string().min(1, t("field_required")),
  });

type FormValues = z.infer<ReturnType<typeof schema>>;

type Role = "member" | "tenant";

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Role>("member");

  const isTenant = mode === "tenant";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await signIn(values.email, values.password);
      router.push("/dashboard");
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
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["member", "tenant"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setMode(r)}
              aria-pressed={mode === r}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition-all",
                mode === r
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r === "member" ? t("auth_role_member") : t("auth_role_tenant")}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <AppLogo className="w-44" />
          <h1 className="text-2xl font-extrabold">
            {isTenant ? t("login_tenant_title") : t("login_member_title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isTenant ? t("login_tenant_subtitle") : t("login_member_subtitle")}
          </p>
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {loading ? t("login_loading") : t("login_button")}
                </Button>
              </form>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {isTenant ? t("login_tenant_no_account") : t("login_no_account")}{" "}
              <Link
                href="/signup"
                className="font-medium text-primary hover:underline"
              >
                {isTenant
                  ? t("login_tenant_signup_link")
                  : t("login_signup_link")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}