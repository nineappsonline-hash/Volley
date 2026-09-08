"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Building2, List, Loader2, Plus, Trash2, Trophy, Volleyball } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LocationFields, CountryField } from "@/components/shared/location-fields";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useAuth, type SignupVenue } from "@/lib/auth";

const joinSchema = (t: (k: any) => string) =>
  z.object({
    name: z.string().min(1, t("field_required")),
    email: z.string().email(t("field_invalid_email")),
    phone: z.string().trim().min(1, t("field_required")),
    password: z.string().min(6, t("field_min_password")),
    academy_code: z.string().optional(),
  });

const createSchema = (t: (k: any) => string) =>
  z.object({
    name: z.string().min(1, t("field_required")),
    email: z.string().email(t("field_invalid_email")),
    phone: z.string().trim().min(1, t("field_required")),
    password: z.string().min(6, t("field_min_password")),
    password_confirm: z.string().min(6, t("field_min_password")),
    academy_name: z.string().min(2, t("field_required")),
    sports: z.array(z.string()).min(1, t("field_required")),
  })
    .refine((d) => d.password === d.password_confirm, {
      message: t("field_password_mismatch"),
      path: ["password_confirm"],
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

interface PoolVenue {
  id: string;
  name: string;
  address: string | null;
  capacity: number | null;
  country: string | null;
  governorate: string | null;
  area: string | null;
  school_name: string | null;
  rental_cost: number | null;
  rental_hours: number | null;
}

type NewVenueDraft = {
  id?: string;
  name: string;
  address: string;
  capacity: string;
  school_name: string;
  rental_cost: string;
  rental_hours: string;
  fromPool?: boolean;
};

export function SignupForm() {
  const { t } = useI18n();
  const router = useRouter();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mode, setMode] = useState<Role>("member");
  const [location, setLocation] = useState({
    country: "",
    governorate: "",
    city: "",
  });
  const [poolVenues, setPoolVenues] = useState<PoolVenue[]>([]);
  const [poolLoaded, setPoolLoaded] = useState(false);
  const [signupVenues, setSignupVenues] = useState<NewVenueDraft[]>([]);
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const { data } = await createClient()
          .from("venues")
          .select(
            "id, name, address, capacity, country, governorate, area, school_name, rental_cost, rental_hours"
          )
          .is("academy_id", null)
          .order("name");
        if (stale) return;
        setPoolVenues((data ?? []) as PoolVenue[]);
        setPoolLoaded(true);
      } catch {
        if (!stale) setPoolLoaded(true);
      }
    })();
    return () => {
      stale = true;
    };
  }, []);

  const isTenant = mode === "tenant";

  const joinForm = useForm<JoinValues>({
    resolver: zodResolver(joinSchema(t)),
    defaultValues: { name: "", email: "", phone: "", password: "", academy_code: "" },
  });

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema(t)),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      password_confirm: "",
      academy_name: "",
      sports: [],
    },
  });

  const finishSignup = async (
    email: string,
    password: string,
    name: string,
    phone: string | undefined,
    academy?: {
      code?: string;
      newName?: string;
      sports?: string;
      country?: string;
      governorate?: string;
      city?: string;
      venues?: SignupVenue[];
    }
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
    if (!location.country.trim()) {
      toast.error(t("field_required"));
      return;
    }
    await finishSignup(values.email, values.password, values.name, values.phone, {
      code: values.academy_code?.trim() || undefined,
      country: location.country.trim(),
    });
  };

  const onCreate = async (values: CreateValues) => {
    if (!location.country.trim() || !location.governorate.trim() || !location.city.trim()) {
      toast.error(t("field_required"));
      return;
    }
    if (signupVenues.some((v) => !v.name.trim())) {
      toast.error(t("signup_playground_name_required"));
      return;
    }
    const venues: SignupVenue[] = signupVenues.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      name: v.name.trim(),
      address: v.address.trim() || null,
      capacity: v.capacity.trim() !== "" ? Number(v.capacity) : null,
      school_name: v.school_name.trim() || null,
      rental_cost: v.rental_cost.trim() !== "" ? Number(v.rental_cost) : null,
      rental_hours:
        v.rental_hours.trim() !== "" ? Number(v.rental_hours) : 1,
    }));
    await finishSignup(values.email, values.password, values.name, values.phone, {
      newName: values.academy_name.trim(),
      sports: values.sports.join(","),
      country: location.country.trim(),
      governorate: location.governorate.trim(),
      city: location.city.trim(),
      venues,
    });
  };

  const addNewVenueDraft = () =>
    setSignupVenues((vs) => [
      ...vs,
      { id: undefined, name: "", address: "", capacity: "", school_name: "", rental_cost: "", rental_hours: "1" },
    ]);
  const addPoolVenueDraft = (v: PoolVenue) =>
    setSignupVenues((vs) => [
      ...vs,
      {
        id: v.id,
        fromPool: true,
        name: v.name,
        address: v.address ?? "",
        capacity: v.capacity != null ? String(v.capacity) : "",
        school_name: v.school_name ?? "",
        rental_cost: v.rental_cost != null ? String(v.rental_cost) : "",
        rental_hours: v.rental_hours != null ? String(v.rental_hours) : "1",
      },
    ]);
  const setSignupVenue = (i: number, patch: Partial<NewVenueDraft>) =>
    setSignupVenues((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const removeSignupVenue = (i: number) =>
    setSignupVenues((vs) => vs.filter((_, idx) => idx !== i));
  const takenPoolIds = new Set(signupVenues.map((v) => v.id).filter((id): id is string => !!id));
  const availablePoolVenues = poolVenues.filter(
    (v) =>
      !takenPoolIds.has(v.id) &&
      [v.name, v.address, v.country, v.governorate, v.area].join(" ").toLowerCase().includes(poolSearch.toLowerCase())
  );

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
                        <FormControl>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {SPORTS.map((s) => {
                              const active = field.value.includes(s.value);
                              return (
                                <button
                                  key={s.value}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() =>
                                    field.onChange(
                                      active
                                        ? field.value.filter((v) => v !== s.value)
                                        : [...field.value, s.value]
                                    )
                                  }
                                  className={cn(
                                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                                    active
                                      ? "border-primary bg-primary/10 font-medium text-primary"
                                      : "border-input bg-background text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <span className="truncate">{t(s.key)}</span>
                                  {active && (
                                    <Check className="h-4 w-4 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {t("signup_sports_hint")}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <LocationFields
                    country={location.country}
                    governorate={location.governorate}
                    city={location.city}
                    onCountryChange={(v) =>
                      setLocation((l) => ({ ...l, country: v }))
                    }
                    onGovernorateChange={(v) =>
                      setLocation((l) => ({ ...l, governorate: v }))
                    }
                    onCityChange={(v) =>
                      setLocation((l) => ({ ...l, city: v }))
                    }
                  />
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground">
                      <List className="me-1 inline h-4 w-4" />
                      {t("signup_playgrounds_label")}
                    </p>
                    {poolLoaded && poolVenues.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("signup_playgrounds_available").replace(
                          "{count}",
                          String(poolVenues.length)
                        )}
                      </p>
                    )}
                    <div className="space-y-3">
                      {signupVenues.map((v, i) => (
                        <div
                          key={v.id ?? `new-${i}`}
                          className="space-y-3 rounded-lg border p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {v.name || `Playground #${i + 1}`}
                              </span>
                              {v.fromPool && (
                                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                  {t("signup_playground_from_pool")}
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSignupVenue(i)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Input
                              type="text"
                              placeholder={t("signup_playground_name")}
                              value={v.name}
                              onChange={(e) => setSignupVenue(i, { name: e.target.value })}
                            />
                            <Input
                              type="text"
                              placeholder={t("signup_playground_address")}
                              value={v.address}
                              onChange={(e) => setSignupVenue(i, { address: e.target.value })}
                            />
                            <Input
                              type="number"
                              min="0"
                              placeholder={t("signup_playground_capacity")}
                              value={v.capacity}
                              onChange={(e) => setSignupVenue(i, { capacity: e.target.value })}
                            />
                            <Input
                              type="text"
                              placeholder={t("signup_playground_school")}
                              value={v.school_name}
                              onChange={(e) => setSignupVenue(i, { school_name: e.target.value })}
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={t("signup_playground_cost")}
                              value={v.rental_cost}
                              onChange={(e) => setSignupVenue(i, { rental_cost: e.target.value })}
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder={t("signup_playground_hours")}
                              value={v.rental_hours}
                              onChange={(e) => setSignupVenue(i, { rental_hours: e.target.value })}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={poolLoaded && poolVenues.length === 0}
                          onClick={() => { setPoolSearch(""); setPoolPickerOpen(true); }}
                        >
                          <List className="h-4 w-4" />
                          {t("signup_playground_add_existing")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addNewVenueDraft}
                        >
                          <Plus className="h-4 w-4" />
                          {t("signup_playground_add_new")}
                        </Button>
                      </div>
                    </div>
                  </div>
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
                  <FormField
                    control={createForm.control}
                    name="password_confirm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("signup_confirm_password")}</FormLabel>
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
                  <CountryField
                    country={location.country}
                    onCountryChange={(v) =>
                      setLocation((l) => ({ ...l, country: v }))
                    }
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

        <Dialog open={poolPickerOpen} onOpenChange={setPoolPickerOpen}>
          <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("signup_playground_picker_title")}</DialogTitle>
              <DialogDescription>
                {t("signup_playground_picker_hint")}
              </DialogDescription>
            </DialogHeader>
            <Input
              className="mb-3"
              placeholder={t("signup_playground_picker_search")}
              value={poolSearch}
              onChange={(e) => setPoolSearch(e.target.value)}
            />
            <div className="space-y-2">
              {availablePoolVenues.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("signup_playground_picker_empty")}
                </p>
              )}
              {availablePoolVenues.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[v.country, v.governorate, v.area, v.address]
                        .filter(Boolean)
                        .join(" · ") || v.name}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => { addPoolVenueDraft(v); setPoolPickerOpen(false); }}
                  >
                    {t("signup_playground_picker_add")}
                  </Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}