"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  LandPlot,
  List,
  Loader2,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppLogo } from "@/components/shared/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PushPrompt } from "@/components/shared/push-prompt";
import { LocationFields } from "@/components/shared/location-fields";
import { UsernameField } from "@/components/shared/username-field";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { useAuth, type SignupVenue } from "@/lib/auth";

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

export function OwnerSignupForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pushPromptOpen, setPushPromptOpen] = useState(false);
  const pendingNav = useRef<(() => void) | null>(null);

  const [location, setLocation] = useState({ country: "", governorate: "", city: "" });
  const [businessName, setBusinessName] = useState("");
  const [account, setAccount] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    password_confirm: "",
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
          .is("owner_profile_id", null)
          .order("name");
        if (stale) return;
        setPoolVenues((data ?? []) as PoolVenue[]);
      } catch {
        /* pool picker is optional; fail silently */
      } finally {
        if (!stale) setPoolLoaded(true);
      }
    })();
    return () => {
      stale = true;
    };
  }, []);

  const setAccountField = (k: keyof typeof account, v: string) =>
    setAccount((a) => ({ ...a, [k]: v }));

  const finishSignup = async () => {
    setLoading(true);
    try {
      const destination = "/playgrounds";
      const venues: SignupVenue[] = signupVenues.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        name: v.name.trim(),
        address: v.address.trim() || null,
        capacity: v.capacity.trim() !== "" ? Number(v.capacity) : null,
        school_name: v.school_name.trim() || null,
        rental_cost: v.rental_cost.trim() !== "" ? Number(v.rental_cost) : null,
        rental_hours: v.rental_hours.trim() !== "" ? Number(v.rental_hours) : 1,
      }));
      const { session } = await signUp(
        account.email,
        account.password,
        account.name,
        account.username,
        account.phone,
        {
          ownerMode: true,
          businessName: businessName.trim(),
          country: location.country.trim(),
          governorate: location.governorate.trim(),
          city: location.city.trim(),
          ownerVenues: venues,
        },
        destination
      );
      if (session) {
        toast.success(t("signup_success"));
        pendingNav.current = () => {
          router.push(destination);
          router.refresh();
        };
        setPushPromptOpen(true);
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

  const onSubmit = () => {
    if (!businessName.trim()) {
      toast.error(t("field_required"));
      return;
    }
    if (!account.name.trim()) {
      toast.error(t("field_required"));
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(account.username.trim())) {
      toast.error(t("field_username_invalid"));
      return;
    }
    if (!account.phone.trim()) {
      toast.error(t("field_required"));
      return;
    }
    if (!account.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) {
      toast.error(t("field_invalid_email"));
      return;
    }
    if (account.password.length < 6) {
      toast.error(t("field_min_password"));
      return;
    }
    if (account.password !== account.password_confirm) {
      toast.error(t("field_password_mismatch"));
      return;
    }
    if (!location.country.trim()) {
      toast.error(t("field_required"));
      return;
    }
    if (signupVenues.some((v) => !v.name.trim())) {
      toast.error(t("signup_playground_name_required"));
      return;
    }
    void finishSignup();
  };

  const addNewVenueDraft = () =>
    setSignupVenues((vs) => [
      ...vs,
      { name: "", address: "", capacity: "", school_name: "", rental_cost: "", rental_hours: "1" },
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
      [v.name, v.address, v.country, v.governorate, v.area]
        .join(" ")
        .toLowerCase()
        .includes(poolSearch.toLowerCase())
  );

  return (
    <main className="pwa-pad-top relative flex min-h-screen overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-32 start-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-interactive-500/20 blur-3xl rtl:translate-x-1/2" />
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>

      <div className="relative mx-auto my-auto w-full max-w-lg py-16">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <AppLogo className="w-44" />
          <h1 className="text-2xl font-extrabold">{t("owner_signup_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("owner_signup_subtitle")}</p>
          <p className="rounded-full border bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            {t("owner_signup_review_info")}
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("owner_business_name")}</label>
              <Input
                autoComplete="organization"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t("owner_business_name_placeholder")}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("owner_contact_name")}</label>
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
            <LocationFields
              country={location.country}
              governorate={location.governorate}
              city={location.city}
              onCountryChange={(v) => setLocation((l) => ({ ...l, country: v }))}
              onGovernorateChange={(v) => setLocation((l) => ({ ...l, governorate: v }))}
              onCityChange={(v) => setLocation((l) => ({ ...l, city: v }))}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("signup_phone")}</label>
                <Input dir="ltr" value={account.phone} onChange={(e) => setAccountField("phone", e.target.value)} />
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
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

            <div className="pt-2">
              <div className="mb-2 flex items-center gap-2">
                <LandPlot className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">{t("owner_playgrounds_title")}</h2>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("owner_playgrounds_hint")}
              </p>
              <div className="space-y-3">
                {signupVenues.map((v, i) => (
                  <div key={v.id ?? `new-${i}`} className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {v.name || `Playground #${i + 1}`}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSignupVenue(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Input
                        placeholder={t("signup_playground_name")}
                        value={v.name}
                        onChange={(e) => setSignupVenue(i, { name: e.target.value })}
                      />
                      <Input
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
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t("signup_playground_cost")}
                        value={v.rental_cost}
                        onChange={(e) => setSignupVenue(i, { rental_cost: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={poolLoaded && availablePoolVenues.length === 0}
                    onClick={() => { setPoolSearch(""); setPoolPickerOpen(true); }}
                  >
                    <List className="h-4 w-4" />
                    {t("signup_playground_add_existing")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addNewVenueDraft}>
                    <Plus className="h-4 w-4" />
                    {t("signup_playground_add_new")}
                  </Button>
                </div>
              </div>
            </div>

            {confirming && (
              <p className="rounded-md bg-interactive-50 p-3 text-center text-sm text-info-ink dark:bg-interactive-500/10 dark:text-interactive-300">
                {t("signup_check_email")}
              </p>
            )}
            <Button type="button" className="w-full" disabled={loading} onClick={onSubmit}>
              {loading && <Loader2 className="animate-spin" />}
              <Rocket className="h-4 w-4" />
              {loading ? t("signup_loading") : t("owner_signup_submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("signup_have_account")}{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {t("signup_login_link")}
              </Link>
            </p>
          </CardContent>
        </Card>

        <Dialog open={poolPickerOpen} onOpenChange={setPoolPickerOpen}>
          <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("signup_playground_picker_title")}</DialogTitle>
              <DialogDescription>{t("signup_playground_picker_hint")}</DialogDescription>
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
                <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{v.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[v.country, v.governorate, v.area, v.address].filter(Boolean).join(" · ") || v.name}
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