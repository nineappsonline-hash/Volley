"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Trophy, Volleyball } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

const joinSchema = (t: (k: any) => string) =>
  z.object({
    name: z.string().min(1, t("field_required")),
    email: z.string().email(t("field_invalid_email")),
    phone: z.string().optional(),
    password: z.string().min(6, t("field_min_password")),
    academy_code: z.string().optional(),
  });

const createSchema = (t: (k: any) => string) =>
  z.object({
    name: z.string().min(1, t("field_required")),
    email: z.string().email(t("field_invalid_email")),
    phone: z.string().optional(),
    password: z.string().min(6, t("field_min_password")),
    academy_name: z.string().min(2, t("field_required")),
    sports: z.string().min(1, t("field_required")),
  });

type JoinValues = z.infer<ReturnType<typeof joinSchema>>;
type CreateValues = z.infer<ReturnType<typeof createSchema>>;

export default function SignupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const joinForm = useForm<JoinValues>({
    resolver: zodResolver(joinSchema(t)),
    defaultValues: { name: "", email: "", phone: "", password: "", academy_code: "" },
  });

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: { name: "", email: "", phone: "", password: "", academy_name: "", sports: "Volleyball" },
  });

  const finishSignup = async (
    email: string,
    password: string,
    name: string,
    phone: string | undefined,
    academy?: { code?: string; newName?: string; sports?: string }
  ) => {
    setLoading(true);
    try {
      const { session } = await signUp(email, password, name, phone, academy);
      if (session) {
        toast.success(t("signup_success"));
        // Members who signed up without an invite code pick their academy
        // from the public directory next.
        const hasAcademy = !!academy?.code || !!academy?.newName;
        router.push(hasAcademy ? "/dashboard" : "/academies");
        router.refresh();
      } else {
        setConfirming(true);
        toast.info(t("signup_check_email"));
      }
    } catch {
      toast.error(t("signup_error"));
    } finally {
      setLoading(false);
    }
  };

  const onJoin = async (values: JoinValues) => {
    await finishSignup(values.email, values.password, values.name, values.phone, {
      code: values.academy_code?.trim() || undefined,
    });
  };

  const onCreate = async (values: CreateValues) => {
    await finishSignup(values.email, values.password, values.name, values.phone, {
      newName: values.academy_name.trim(),
      sports: values.sports.trim(),
    });
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
          <h1 className="text-2xl font-extrabold">{t("signup_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("signup_subtitle")}</p>
          <p className="rounded-full border bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            🎉 {t("signup_trial_info")}
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <Tabs defaultValue="join">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="join">{t("signup_tab_join")}</TabsTrigger>
                <TabsTrigger value="create">{t("signup_tab_create")}</TabsTrigger>
              </TabsList>

              {/* ── Join an existing academy as a member ── */}
              <TabsContent value="join" className="mt-4">
                <CardContent className="p-0">
                  <Form {...joinForm}>
                    <form onSubmit={joinForm.handleSubmit(onJoin)} className="space-y-4">
                      <FormField
                        control={joinForm.control}
                        name="academy_code"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("signup_academy_code")}</FormLabel>
                            <FormControl>
                              <Input
                                dir="ltr"
                                autoComplete="off"
                                placeholder="ABC123"
                                className="uppercase"
                                {...field}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              {t("signup_academy_code_hint")}
                            </p>
                            <p className="text-xs text-primary">
                              {t("signup_academy_code_optional")}
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={joinForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("signup_name")}</FormLabel>
                            <FormControl>
                              <Input autoComplete="name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={joinForm.control}
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
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={joinForm.control}
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
                          control={joinForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("login_password")}</FormLabel>
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
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="animate-spin" />}
                        {loading ? t("signup_loading") : t("signup_button")}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </TabsContent>

              {/* ── Create a brand-new academy (become its admin) ── */}
              <TabsContent value="create" className="mt-4">
                <CardContent className="p-0">
                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
                      <FormField
                        control={createForm.control}
                        name="academy_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("signup_new_academy_name")}</FormLabel>
                            <FormControl>
                              <Input autoComplete="organization" {...field} />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              {t("signup_create_hint")}
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="sports"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Trophy className="h-4 w-4" />
                              {t("signup_sports_label")}
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("signup_sports_placeholder")}
                                {...field}
                              />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              {t("signup_sports_hint")}
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("signup_name")}</FormLabel>
                            <FormControl>
                              <Input autoComplete="name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
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
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={createForm.control}
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
                          control={createForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("login_password")}</FormLabel>
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
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <Loader2 className="animate-spin" />}
                        {loading ? t("signup_loading") : t("signup_button")}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </TabsContent>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-0">
            {confirming && (
              <p className="mt-4 rounded-md bg-blue-50 p-3 text-center text-sm text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                {t("signup_check_email")}
              </p>
            )}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t("signup_have_account")}{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("signup_login_link")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
