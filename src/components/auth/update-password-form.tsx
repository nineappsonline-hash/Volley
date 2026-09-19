"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  z
    .object({
      password: z.string().min(6, t("field_min_password")),
      confirm: z.string().min(6, t("field_min_password")),
    })
    .refine((v) => v.password === v.confirm, {
      message: t("field_password_mismatch"),
      path: ["confirm"],
    });

type FormValues = z.infer<ReturnType<typeof schema>>;

type Status = "checking" | "ready" | "error";

export function UpdatePasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema(t)),
    defaultValues: { password: "", confirm: "" },
  });

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const code = searchParams.get("code");
      try {
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            type: type as "recovery" | "email" | "invite",
            token_hash: tokenHash,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) throw new Error("missing-token");
        }
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (values: FormValues) => {
    const supabase = createClient();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) throw error;
      await supabase.auth.signOut();
      router.replace("/login?passwordUpdated=1");
    } catch (err) {
      toast.error(t("updatepwd_link_invalid"));
    } finally {
      setBusy(false);
    }
  };

  const backLink = (
    <Button asChild variant="ghost" className="gap-1.5">
      <Link href="/login">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t("forgot_back_login")}
      </Link>
    </Button>
  );

  return (
    <main className="pwa-pad-top relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-32 start-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-interactive-500/20 blur-3xl rtl:translate-x-1/2" />
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>
      <div className="absolute start-4 top-4">{backLink}</div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <AppLogo className="w-44" />
          <h1 className="text-2xl font-extrabold">
            {status === "error" ? t("forgot_title") : t("updatepwd_title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {status === "error"
              ? t("updatepwd_link_invalid")
              : t("updatepwd_subtitle")}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {status === "checking" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {t("updatepwd_checking")}
                </p>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("updatepwd_link_invalid")}
                </p>
                <Button asChild className="w-full">
                  <Link href="/auth/forgot-password">
                    {t("forgot_button")}
                  </Link>
                </Button>
              </div>
            )}

            {status === "ready" && (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("updatepwd_new")}</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            dir="ltr"
                            autoComplete="new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("updatepwd_confirm")}</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            dir="ltr"
                            autoComplete="new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    {busy ? t("updatepwd_loading") : t("updatepwd_button")}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}