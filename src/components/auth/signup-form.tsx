"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { registrationDestination, authLink } from "@/lib/auth-redirect";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  LandPlot,
  List,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Rocket,
  Trash2,
  Trophy,
  UserRound,
  Volleyball,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PushPrompt } from "@/components/shared/push-prompt";
import { JoinAcademySuggestion } from "@/components/academies/join-academy-suggestion";
import { LocationFields } from "@/components/shared/location-fields";
import { UsernameField } from "@/components/shared/username-field";
import { SPORT_LABEL_KEYS } from "@/lib/sport-labels";
import type { Dict } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { GoogleSignInButton, OrDivider } from "@/components/auth/google-signin-button";
import { useAuth, type SignupVenue } from "@/lib/auth";

const joinSchema = (t: (k: any) => string) =>
  z
    .object({
      name: z.string().min(1, t("field_required")),
      username: z
        .string()
        .regex(/^[a-z0-9_]{3,20}$/, t("field_username_invalid")),
      gender: z.enum(["male", "female"], { message: t("field_required") }),
      birth_date: z.string().min(1, t("field_required")),
      email: z.string().email(t("field_invalid_email")),
      phone: z.string().trim().min(1, t("field_required")),
      password: z.string().min(6, t("field_min_password")),
      password_confirm: z.string().min(6, t("field_min_password")),
      academy_code: z.string().optional(),
    })
    .refine((d) => d.password === d.password_confirm, {
      message: t("field_password_mismatch"),
      path: ["password_confirm"],
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

type Role = "member" | "tenant";

const SPORTS = (Object.entries(SPORT_LABEL_KEYS) as [string, keyof Dict][]).map(
  ([value, key]) => ({ value, key })
);

/** Set at signup, read once by the dashboard after email confirmation. */
export const SUGGEST_ACADEMY_KEY = "volley:suggest-academy";

const MEMBER_STEPS = [
  { key: "signup_ws_about_you", icon: UserRound },
  { key: "signup_ws_location", icon: MapPin },
  { key: "signup_ws_account", icon: Lock },
] as const;

const WIZARD_STEPS = [
  { key: "signup_ws_basics", icon: Building2 },
  { key: "signup_ws_sports", icon: Trophy },
  { key: "signup_ws_location", icon: MapPin },
  { key: "signup_ws_playgrounds", icon: LandPlot },
  { key: "signup_ws_account", icon: UserRound },
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
  sport_name: string | null;
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
  const searchParams = useSearchParams();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pushPromptOpen, setPushPromptOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const pendingNav = useRef<(() => void) | null>(null);
  const initialMode: Role = searchParams.get("mode") === "tenant" ? "tenant" : "member";
  const [mode, setMode] = useState<Role>(initialMode);
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

  const [academyName, setAcademyName] = useState("");
  const [sports, setSports] = useState<string[]>([]);
  const [account, setAccount] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    gender: "",
    birth_date: "",
    password: "",
    password_confirm: "",
  });
  const [step, setStep] = useState(0);
  const [memberStep, setMemberStep] = useState(0);

  // The academy the visitor picked before being sent here. Signup itself never
  // offers a choice or attaches anyone; it only lets the post-signup
  // suggestion put that academy first.
  const joiningAcademyId = searchParams.get("academy");

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
          .is("owner_profile_id", null)
          .order("name");
        if (stale) return;
        const venues = (data ?? []) as PoolVenue[];
        const labels = await createClient().rpc("playground_sport_labels");
        const sportsByVenue = new Map<string, string>(
          (labels.data ?? []).map(
            (row: { venue_id: string; sport_name: string }) => [
              row.venue_id,
              row.sport_name,
            ]
          )
        );
        setPoolVenues(
          venues.map((v) => ({ ...v, sport_name: sportsByVenue.get(v.id) ?? null }))
        );
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
    defaultValues: { name: "", username: "", gender: "" as JoinValues["gender"], birth_date: "", email: "", phone: "", password: "", password_confirm: "", academy_code: "" },
  });

  const finishSignup = async (
    email: string,
    password: string,
    name: string,
    username: string,
    phone: string | undefined,
    academy?: {
      code?: string;
      newName?: string;
      sports?: string;
      country?: string;
      governorate?: string;
      city?: string;
      gender?: string;
      birth_date?: string;
      venues?: SignupVenue[];
    }
  ) => {
    setLoading(true);
    try {
      const gameInvite = searchParams.get("gameInvite");
      const destination = academy?.newName ? "/onboarding" : registrationDestination(searchParams.get("redirectedFrom"), gameInvite);
      const { session } = await signUp(email, password, name, username, phone, academy, destination);
      if (session) {
        toast.success(t("signup_success"));
        const navigate = () => {
          router.push(destination);
          router.refresh();
        };
        if (destination !== "/dashboard" && !academy?.newName) {
          navigate();
        } else if (academy?.newName) {
          // Someone opening an academy has no use for an academy suggestion,
          // but they do want to hear about new bookings, so they keep the push
          // prompt on its own.
          pendingNav.current = navigate;
          setPushPromptOpen(true);
        } else {
          // Members see one dialog, not two: the academy suggestion, then the
          // dashboard. Asking for push permission on top of that is too much at
          // the exact moment they have just signed up.
          pendingNav.current = navigate;
          setSuggestOpen(true);
        }
      } else {
        // No session until the email is confirmed, so remember the offer and
        // let the dashboard raise it instead of losing it. Academy owners have
        // no use for it, and a game invite already knows where it is going.
        if (destination === "/dashboard" && !academy?.newName) {
          try {
            localStorage.setItem(SUGGEST_ACADEMY_KEY, joiningAcademyId ?? "1");
          } catch {
            // Private browsing can refuse storage; the offer is simply skipped.
          }
        }
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
    await finishSignup(values.email, values.password, values.name, values.username, values.phone, {
      code: values.academy_code?.trim() || undefined,
      country: location.country.trim(),
      gender: values.gender,
      birth_date: values.birth_date,
    });
  };

  // Fields each member step owns, so "Next" validates only what is on screen
  // instead of demanding the whole form up front.
  const MEMBER_STEP_FIELDS: (keyof JoinValues)[][] = [
    ["name", "username", "gender", "birth_date"],
    [],
    ["email", "phone", "password", "password_confirm"],
  ];

  const nextMemberStep = async () => {
    if (memberStep === 1 && !location.country.trim()) {
      toast.error(t("field_required"));
      return;
    }
    const fields = MEMBER_STEP_FIELDS[memberStep] ?? [];
    if (fields.length) {
      const valid = await joinForm.trigger(fields, { shouldFocus: true });
      if (!valid) return;
    }
    setMemberStep((s) => Math.min(s + 1, MEMBER_STEPS.length - 1));
  };

  const onCreate = async () => {
    if (!location.country.trim() || !location.governorate.trim() || !location.city.trim()) {
      toast.error(t("field_required"));
      return;
    }
    if (!account.gender || !account.birth_date.trim()) {
      toast.error(t("field_required"));
      return;
    }
    if (signupVenues.some((v) => !v.name.trim())) {
      toast.error(t("signup_playground_name_required"));
      return;
    }
    const parsed = createSchema(t).safeParse({
      name: account.name,
      email: account.email,
      phone: account.phone,
      password: account.password,
      password_confirm: account.password_confirm,
      academy_name: academyName,
      sports,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("common_error"));
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
    await finishSignup(account.email, account.password, account.name, account.username, account.phone, {
      newName: academyName.trim(),
      sports: sports.join(","),
      country: location.country.trim(),
      governorate: location.governorate.trim(),
      city: location.city.trim(),
      gender: account.gender,
      birth_date: account.birth_date,
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
  const matchingPoolVenues = poolVenues.filter(
    (v) => v.sport_name == null || sports.includes(v.sport_name)
  );
  const availablePoolVenues = matchingPoolVenues.filter(
    (v) =>
      !takenPoolIds.has(v.id) &&
      [v.name, v.address, v.country, v.governorate, v.area].join(" ").toLowerCase().includes(poolSearch.toLowerCase())
  );

  const setAccountField = (k: keyof typeof account, v: string) =>
    setAccount((a) => ({ ...a, [k]: v }));

  const canContinue =
    step === 0
      ? academyName.trim().length >= 2
      : step === 1
        ? sports.length > 0
        : step === 2
          ? !!(location.country.trim() && location.governorate.trim() && location.city.trim())
          : step === 3
            ? signupVenues.every((v) => v.name.trim().length > 0)
            : true;

  const stepTitle = (key: string) => {
    switch (key) {
      case "signup_ws_basics":
        return t("signup_ws_basics_title");
      case "signup_ws_sports":
        return t("signup_ws_sports_title");
      case "signup_ws_location":
        return t("signup_ws_location_title");
      case "signup_ws_playgrounds":
        return t("signup_ws_playgrounds_title");
      default:
        return t("signup_ws_account_title");
    }
  };

  return (
    <main className="pwa-pad-top relative flex min-h-screen overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-32 start-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-accent blur-3xl rtl:translate-x-1/2" />
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>

      <div className={cn("relative mx-auto my-auto w-full py-16", isTenant ? "max-w-xl" : "max-w-md")}>
        <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {(["member", "tenant", "owner"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => (r === "owner" ? router.push("/signup/owner") : setMode(r))}
              aria-pressed={r === "owner" ? false : mode === r}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition-all",
                r !== "owner" && mode === r
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r === "member" ? t("auth_role_member") : r === "tenant" ? t("auth_role_tenant") : t("auth_role_owner")}
            </button>
          ))}
        </div>

        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <AppLogo className="w-44" />
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

        {isTenant && (
          <div className="mb-4 flex items-center">
            {WIZARD_STEPS.map((s, i) => (
              <div
                key={s.key}
                className={cn(
                  "flex items-center",
                  i < WIZARD_STEPS.length - 1 && "flex-1"
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                      i < step
                        ? "border-primary bg-primary text-primary-foreground"
                        : i === step
                          ? "border-primary bg-background text-primary"
                          : "border-muted bg-background text-muted-foreground"
                    )}
                  >
                    {i < step ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <s.icon className="h-4 w-4" />
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-[10px] font-medium",
                      i <= step ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {t(s.key)}
                  </p>
                </div>
                {i < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 flex-1 rounded-full",
                      i < step ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            {isTenant ? (
              <div key={step} className="animate-fade-in-up space-y-4">
                <div>
                  <h2 className="text-lg font-bold">{stepTitle(WIZARD_STEPS[step].key)}</h2>
                  <p className="text-xs text-muted-foreground">
                    {step === 0 && t("signup_ws_basics_hint")}
                    {step === 1 && t("signup_ws_sports_hint")}
                    {step === 2 && t("signup_ws_location_hint")}
                    {step === 3 && t("signup_ws_playgrounds_hint")}
                    {step === 4 && t("signup_ws_account_hint")}
                  </p>
                </div>

                {step === 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t("signup_new_academy_name")}
                    </label>
                    <Input
                      autoComplete="organization"
                      value={academyName}
                      onChange={(e) => setAcademyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (canContinue) setStep(1);
                        }
                      }}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("signup_create_hint")}
                    </p>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {SPORTS.map((s) => {
                        const active = sports.includes(s.value);
                        return (
                          <button
                            key={s.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setSports((prev) =>
                                active ? prev.filter((v) => v !== s.value) : [...prev, s.value]
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
                            {active && <Check className="h-4 w-4 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("signup_sports_hint")}
                    </p>
                  </div>
                )}

                {step === 2 && (
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
                )}

                {step === 3 && (
                  <div className="space-y-3">
                    {poolLoaded && matchingPoolVenues.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("signup_playgrounds_available").replace(
                          "{count}",
                          String(matchingPoolVenues.length)
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
                          disabled={poolLoaded && matchingPoolVenues.length === 0}
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
                )}

                {step === 4 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("signup_name")}</label>
                      <Input
                        autoComplete="name"
                        value={account.name}
                        onChange={(e) => setAccountField("name", e.target.value)}
                      />
                    </div>
                    <UsernameField
                      value={account.username}
                      onChange={(v) => setAccountField("username", v)}
                    />
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("login_email")}</label>
                      <Input
                        type="email"
                        dir="ltr"
                        autoComplete="email"
                        value={account.email}
                        onChange={(e) => setAccountField("email", e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("profile_gender")}</label>
                        <Select
                          value={account.gender}
                          onValueChange={(v) => setAccountField("gender", v)}
                        >
                          <SelectTrigger aria-label={t("profile_gender")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">{t("games_gender_male")}</SelectItem>
                            <SelectItem value="female">{t("games_gender_female")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("profile_birth_date")}</label>
                        <Input
                          type="date"
                          dir="ltr"
                          max={new Date().toISOString().slice(0, 10)}
                          value={account.birth_date}
                          onChange={(e) => setAccountField("birth_date", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("signup_phone")}</label>
                        <Input
                          dir="ltr"
                          value={account.phone}
                          onChange={(e) => setAccountField("phone", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("login_password")}</label>
                        <Input
                          type="password"
                          dir="ltr"
                          autoComplete="new-password"
                          value={account.password}
                          onChange={(e) => setAccountField("password", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("signup_confirm_password")}</label>
                      <Input
                        type="password"
                        dir="ltr"
                        autoComplete="new-password"
                        value={account.password_confirm}
                        onChange={(e) => setAccountField("password_confirm", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {step < WIZARD_STEPS.length - 1 ? (
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={step === 0}
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      {t("common_back")}
                    </Button>
                    <Button
                      type="button"
                      disabled={!canContinue}
                      onClick={() => setStep((s) => s + 1)}
                    >
                      {step === 3 && signupVenues.length === 0
                        ? t("signup_ws_skip_playgrounds")
                        : t("signup_ws_continue")}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={loading}
                    onClick={onCreate}
                  >
                    {loading && <Loader2 className="animate-spin" />}
                    <Rocket className="h-4 w-4" />
                    {loading ? t("signup_loading") : t("signup_ws_create")}
                  </Button>
                )}
                {step === 3 && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <LandPlot className="h-3.5 w-3.5" />
                    {t("signup_ws_playgrounds_optional")}
                  </p>
                )}
              </div>
            ) : (
              <>
                <GoogleSignInButton className="w-full" destination={registrationDestination(searchParams.get("redirectedFrom"), searchParams.get("gameInvite"))} />
                <div className="my-4">
                  <OrDivider />
                </div>
                <div className="mb-4 flex items-center" aria-hidden="true">
                  {MEMBER_STEPS.map((s, i) => (
                    <div
                      key={s.key}
                      className={cn("flex items-center", i < MEMBER_STEPS.length - 1 && "flex-1")}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                            i < memberStep
                              ? "border-primary bg-primary text-primary-foreground"
                              : i === memberStep
                                ? "border-primary bg-background text-primary"
                                : "border-muted bg-background text-muted-foreground"
                          )}
                        >
                          {i < memberStep ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                        </div>
                        <p className={cn("text-[10px] font-medium", i <= memberStep ? "text-foreground" : "text-muted-foreground")}>
                          {t(s.key)}
                        </p>
                      </div>
                      {i < MEMBER_STEPS.length - 1 && (
                        <div className={cn("mx-2 h-0.5 flex-1 rounded-full", i < memberStep ? "bg-primary" : "bg-muted")} />
                      )}
                    </div>
                  ))}
                </div>
                <Form {...joinForm}>
                <form onSubmit={joinForm.handleSubmit(onJoin)} className="space-y-4">
                  <p className="sr-only" aria-live="polite">
                    {t(MEMBER_STEPS[memberStep].key)}
                  </p>
                  <div key={memberStep} className="animate-fade-in-up space-y-4">
                  {memberStep === 0 && (
                    <>
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
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <UsernameField
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={joinForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile_gender")}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger aria-label={t("profile_gender")}>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">
                                {t("games_gender_male")}
                              </SelectItem>
                              <SelectItem value="female">
                                {t("games_gender_female")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={joinForm.control}
                      name="birth_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("profile_birth_date")}</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              dir="ltr"
                              max={new Date().toISOString().slice(0, 10)}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                    </>
                  )}
                  {memberStep === 1 && (
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
                  )}
                  {memberStep === 2 && (
                    <>
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
                  <FormField
                    control={joinForm.control}
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
                    </>
                  )}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2">
                    {memberStep > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setMemberStep((s) => s - 1)}
                      >
                        {t("signup_step_back")}
                      </Button>
                    ) : (
                      <span />
                    )}
                    {memberStep < MEMBER_STEPS.length - 1 ? (
                      <Button type="button" onClick={nextMemberStep}>
                        {t("signup_step_next")}
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                      </Button>
                    ) : (
                      <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="animate-spin" />}
                        {loading ? t("signup_loading") : t("signup_button")}
                      </Button>
                    )}
                  </div>
                </form>
              </Form>
                <div className="mt-10 border-t border-border/60 pt-6">
                  <Button type="button" onClick={() => setMode("tenant")} variant="outline" className="group h-auto min-h-14 w-full justify-start gap-3 whitespace-normal rounded-xl border-border bg-gradient-to-br from-card to-background px-4 py-3 text-start text-brand-950 shadow-sm transition-colors hover:border-brand-600/40 hover:bg-accent hover:text-brand-950 dark:border-brand-400/20 dark:from-brand-400/5 dark:to-transparent dark:text-brand-100 dark:hover:border-brand-400/40 dark:hover:bg-brand-400/10 dark:hover:text-brand-50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-700/10 text-brand-700 dark:bg-brand-300/10 dark:text-brand-300"><Building2 className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                    <span className="flex-1 text-sm font-semibold">{t("signup_register_academy")}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-brand-700/70 dark:text-brand-300/70 rtl:rotate-180" aria-hidden="true" />
                  </Button>
                  <p className="mx-auto mt-3 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">{t("signup_register_academy_hint")}</p>
                </div>
              </>
            )}

            {confirming && (
              <p className="mt-4 rounded-md bg-interactive-50 p-3 text-center text-sm text-info-ink dark:bg-interactive-500/10 dark:text-interactive-300">
                {t("signup_check_email")}
              </p>
            )}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {t("signup_have_account")}{" "}
              <Link
                href={authLink("/login", registrationDestination(searchParams.get("redirectedFrom"), searchParams.get("gameInvite")))}
                className="font-medium text-primary hover:underline"
              >
                {t("signup_login_link")}
              </Link>
            </p>
            <p className="mt-2 text-center text-sm">
              <Link
                href="/signup/owner"
                className="font-medium text-primary hover:underline"
              >
                {t("owner_signup_link")} →
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

      <JoinAcademySuggestion
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        memberName={joinForm.getValues("name")}
        highlightAcademyId={joiningAcademyId}
        onDone={() => {
          try {
            localStorage.removeItem(SUGGEST_ACADEMY_KEY);
          } catch {
            // Nothing to clean up if storage is unavailable.
          }
          if (pendingNav.current) {
            const go = pendingNav.current;
            pendingNav.current = null;
            go();
          }
        }}
      />
      <PushPrompt
        open={pushPromptOpen}
        onOpenChange={(o) => {
          setPushPromptOpen(o);
          if (!o && pendingNav.current) {
            const nav = pendingNav.current;
            pendingNav.current = null;
            nav();
          }
        }}
      />
      </div>
    </main>
  );
}