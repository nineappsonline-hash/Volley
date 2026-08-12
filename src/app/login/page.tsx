"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

const schema = (t: (k: any) => string) =>
  z.object({
    email: z.string().email(t("field_invalid_email")),
    password: z.string().min(1, t("field_required")),
  });

type FormValues = z.infer<ReturnType<typeof schema>>;

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-32 start-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl rtl:translate-x-1/2" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 text-white shadow-lg shadow-blue-500/30">
            <Volleyball className="h-8 w-8" />
          </div>
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="animate-spin" />}
                  {loading ? t("login_loading") : t("login_button")}
                </Button>
              </form>
            </Form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t("login_no_account")}{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                {t("login_signup_link")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
