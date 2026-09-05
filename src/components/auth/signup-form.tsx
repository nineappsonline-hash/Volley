"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Loader2, Trophy, Volleyball } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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

type Role = "member" | "tenant";

const SPORTS = [
  { value: "Football", key: "sport_football" },
  { value: "Basketball", key: "sport_basketball" },
  { value: "Handball", key: "sport_handball" },
  { value: "Volleyball", key: "sport_volleyball" },
  { value: "Tennis", key: "sport_tennis" },
  { value: "Swimming", key: "sport_swimming" },
  { value: "Padel", key: "sport_padel" },
  { value: "Squash", key: "sport_squash" },
  { value: "Table Tennis", key: "sport_table_tennis" },
  { value: "Badminton", key: "sport_badminton" },
  { value: "Gymnastics", key: "sport_gymnastics" },
  { value: "Karate", key: "sport_karate" },
  { value: "Boxing", key: "sport_boxing" },
  { value: "Athletics", key: "sport_athletics" },
  { value: "Kung Fu", key: "sport_kungfu" },
  { value: "Taekwondo", key: "sport_taekwondo" },
  { value: "CrossFit", key: "sport_crossfit" },
  { value: "Judo", key: "sport_judo" },
  { value: "Kickboxing", key: "sport_kickboxing" },
  { value: "Wrestling", key: "sport_wrestling" },
  { value: "Archery", key: "sport_archery" },
  { value: "Fencing", key: "sport_fencing" },
  { value: "Equestrian", key: "sport_equestrian" },
  { value: "Cycling", key: "sport_cycling" },
  { value: "Weightlifting", key: "sport_weightlifting" },
  { value: "Parkour", key: "sport_parkour" },
] as const;

export function SignupForm() {
  const { t } = useI18n();
  const router = useRouter();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mode, setMode] = useState<Role>("member");

  const isTenant = mode === "tenant";

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

  const submitButton = (
    <Button type="submit" className="w-full" disabled={loading}>
      {loading && <Loader2 className="animate-spin" />}
      {loading ? t("signup_loading") : t("signup_button")}
    </Button>
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-32 start-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-blue-500/20 blur-3xl rtl:translate-x-1/2" />

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
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 text-white shadow-lg shadow-blue-500/30">
            {isTenant ? (
              <Building2 className="h-8 w-8" />
            ) : (
              <Volleyball className="h-8 w-8" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold">
            {isTenant ? t("signup_tenant_title") : t("signup_title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isTenant ? t("signup_tenant_subtitle") : t("signup_subtitle")}
          </p>
          {isTenant && (
            <p className="rounded-full border bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
              🎉 {t("signup_trial_info")}
            </p>
          )}
        </div>

        <Card>
          <CardContent className="p-6">
            {isTenant ? (
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
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t("signup_sports_placeholder")}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SPORTS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {t(s.key)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                  {submitButton}
                </form>
              </Form>
            ) : (
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
                  {submitButton}
                </form>
              </Form>
            )}

            {confirming && (
              <p className="mt-4 rounded-md bg-blue-50 p-3 text-center text-sm text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                {t("signup_check_email")}
              </p>
            )}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t("signup_have_account")}{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                {t("signup_login_link")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}