"use client";

import { uploadSignupCourtPhoto } from "@/lib/court-photo-upload";
import { missingCourtSubmissionFields } from "@/lib/court-submission";
import { COURT_REVIEW_FIELDS } from "@/lib/court-review";
import { useEffect, useRef, useState } from "react";
import { RegistrationStart } from "@/components/analytics/business-analytics";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import {
  ImagePlus,
  LandPlot,
  List,
  Loader2,
  Plus,
  Rocket,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CourtOwnerBenefits } from "./court-owner-benefits";
import { AppLogo } from "@/components/shared/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PushPrompt } from "@/components/shared/push-prompt";
import { LocationFields } from "@/components/shared/location-fields";
import { CourtAvailabilityEditor } from "@/components/playgrounds/court-availability-editor";
import { workingHoursFromCourtAvailability } from "@/lib/venue-slots";
import { UsernameField } from "@/components/shared/username-field";
import { COMMUNITY_SPORTS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { errorMessage } from "@/lib/utils";
import { useAuth, type SignupVenue } from "@/lib/auth";
import type { VenueUnavailableSlot } from "@/lib/types";

interface PoolVenue {
  id: string;
  name: string;
  address: string | null;
  country: string | null;
  governorate: string | null;
  area: string | null;
  rental_cost: number | null;
  rental_hours: number | null;
}

type NewVenueDraft = {
  contact_phone?: string;
  id?: string;
  name: string;
  address: string;
  country: string;
  governorate: string;
  area: string;
  sport: string;
  location_link: string;
  photos: string[];
  court_availability: (VenueUnavailableSlot & { court_number: number })[];
  rental_cost: string;
  court_count: string;
  fromPool?: boolean;
};

export function OwnerSignupForm() {
  const { t, lang } = useI18n();
  const defaultCountry = lang === "ar" ? "مصر" : "Egypt";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pushPromptOpen, setPushPromptOpen] = useState(false);
  const pendingNav = useRef<(() => void) | null>(null);

  const [location, setLocation] = useState({ country: defaultCountry, governorate: "", city: "" });
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
  const [uploadingPhoto, setUploadingPhoto] = useState<number | null>(null);
  const photoInputs = useRef<(HTMLInputElement | null)[]>([]);

  const upload = useMutation({
    mutationFn: async ({ files, index }: { files: File[]; index: number }) => {
      const urls: string[] = [];
      for (const file of files) urls.push(await uploadSignupCourtPhoto(file));
      return { urls, index };
    },
    onSuccess: ({ urls, index }) => {
      setSignupVenues((vs) =>
        vs.map((v, idx) => (idx === index ? { ...v, photos: [...v.photos, ...urls] } : v))
      );
    },
    onError: (err) => toast.error(errorMessage(err, t("sa_photo_failed"))),
  });

  const handlePhotoInput = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadingPhoto(index);
    upload.mutate({ files, index }, {
      onSettled: () => {
        setUploadingPhoto(null);
        if (photoInputs.current[index]) photoInputs.current[index].value = "";
      },
    });
  };

  const removeVenuePhoto = (index: number, url: string) =>
    setSignupVenues((vs) =>
      vs.map((v, idx) =>
        idx === index ? { ...v, photos: v.photos.filter((p) => p !== url) } : v
      )
    );

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const { data } = await createClient()
          .from("venues")
          .select("id, name, address, country, governorate, area, rental_hours")
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
        name: v.name.trim() || businessName.trim(),
        address: v.address.trim() || null,
        contact_phone: v.contact_phone?.trim() || account.phone.trim(),
        ...(v.country ? { country: v.country } : {}),
        ...(v.governorate ? { governorate: v.governorate } : {}),
        ...(v.area ? { area: v.area } : {}),
        sport: v.sport && v.sport !== "none" ? v.sport.trim() : null,
        location_link: v.location_link.trim() || null,
        ...(v.photos.length ? { photos: v.photos } : {}),
        ...(v.court_availability.length
          ? {
              court_availability: v.court_availability,
              working_hours: workingHoursFromCourtAvailability(v.court_availability),
            }
          : {}),
        rental_cost: v.rental_cost.trim() !== "" ? Number(v.rental_cost) : null,
        court_count: v.court_count.trim() !== "" ? Number(v.court_count) : 1,
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
    if (uploadingPhoto !== null) { toast.error(t("common_loading")); return; }
    for (const [index, venue] of signupVenues.entries()) {
      if (venue.fromPool) continue;
      const missing = missingCourtSubmissionFields({ name: venue.name, address: venue.address,
        sport_id: venue.sport && venue.sport !== "none" ? venue.sport : null, contact_phone: venue.contact_phone ?? account.phone,
        country: venue.country, governorate: venue.governorate, area: venue.area, location_link: venue.location_link,
        photos: venue.photos, court_availability: venue.court_availability, rental_cost: venue.rental_cost === "" ? null : Number(venue.rental_cost),
        rental_hours: 1, court_count: Number(venue.court_count) });
      if (missing.length) { toast.error(`${lang === "ar" ? "الملعب" : "Court"} ${index + 1}: ${missing.map(field => COURT_REVIEW_FIELDS[field][lang === "ar" ? "ar" : "en"]).join(" · ")}`); return; }
    }
    void finishSignup();
  };

  const addNewVenueDraft = () =>
    setSignupVenues((vs) => [
      ...vs,
      {
        name: "",
        address: "",
        country: defaultCountry,
        governorate: location.governorate,
        area: location.city,
        sport: "",
        location_link: "",
        photos: [],
        court_availability: [],
        rental_cost: "",
        court_count: "1",
      },
    ]);
  const addPoolVenueDraft = (v: PoolVenue) =>
    setSignupVenues((vs) => [
      ...vs,
      {
        id: v.id,
        fromPool: true,
        name: v.name,
        address: v.address ?? "",
        country: defaultCountry,
        governorate: location.governorate,
        area: location.city,
        sport: "",
        location_link: "",
        photos: [],
        court_availability: [],
        rental_cost: v.rental_cost != null ? String(v.rental_cost) : "",
        court_count: "1",
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
      <RegistrationStart event="venue_registration_started" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-32 start-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-accent blur-3xl rtl:translate-x-1/2" />
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

        <CourtOwnerBenefits registrationLink={false} />
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
                <Input type="tel" autoComplete="tel" dir="ltr" value={account.phone} onChange={(e) => setAccountField("phone", e.target.value)} />
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
                <p className="text-sm text-muted-foreground">{lang === "ar" ? "كل ملعب جديد يحتاج إلى الرياضة والعنوان والموقع ورابط الخريطة والسعر وعدد الملاعب والصور ومواعيد العمل. يمكنك استخدام رقم حسابك للتواصل مع الملعب أو تغييره." : "Each new court requires a sport, full address and location, map link, price, court count, photos and working hours. The court contact starts with your account phone and can be changed."}</p>
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
                    <div className="space-y-3">
                      {!v.fromPool && <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>{t("venues_name")} *</Label><Input value={v.name} onChange={event => setSignupVenue(i, { name: event.target.value })} /></div><div className="space-y-2"><Label>{lang === "ar" ? "رقم التواصل للملعب" : "Court contact phone"} *</Label><Input type="tel" dir="ltr" value={v.contact_phone ?? account.phone} onChange={event => setSignupVenue(i, { contact_phone: event.target.value })} /></div></div>}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>{t("owner_playground_sport")}</Label>
                          <Select
                            value={v.sport}
                            onValueChange={(val) => setSignupVenue(i, { sport: val })}
                          >
                            <SelectTrigger aria-label={t("owner_playground_sport")}>
                              <SelectValue placeholder={t("owner_playground_sport_placeholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t("venues_no_sport")}</SelectItem>
                              {COMMUNITY_SPORTS.map((name) => (
                                <SelectItem key={name} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("venues_court_count")}</Label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            dir="ltr"
                            placeholder="1"
                            value={v.court_count}
                            onChange={(e) => setSignupVenue(i, { court_count: e.target.value })}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {t("venues_court_count_hint")}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>{t("owner_playground_cost")}</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={v.rental_cost}
                            onChange={(e) => setSignupVenue(i, { rental_cost: e.target.value })}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            {t("owner_playground_cost_hint")}
                          </p>
                        </div>
                      </div>
                      {!v.fromPool && (
                        <LocationFields
                          country={v.country}
                          governorate={v.governorate}
                          city={v.area}
                          onCountryChange={(val) => setSignupVenue(i, { country: val })}
                          onGovernorateChange={(val) => setSignupVenue(i, { governorate: val })}
                          onCityChange={(val) => setSignupVenue(i, { area: val })}
                        />
                      )}
                      <div className="space-y-2">
                        <Label>{t("venues_address")} *</Label>
                        <Input
                          type="text"
                          placeholder={t("venues_address")}
                          value={v.address}
                          onChange={(e) => setSignupVenue(i, { address: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("owner_playground_location_link")} *</Label>
                        <Input
                          dir="ltr"
                          placeholder={t("owner_playground_location_link_placeholder")}
                          value={v.location_link}
                          onChange={(e) => setSignupVenue(i, { location_link: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("owner_playground_photos")} *</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          {v.photos.map((url) => (
                            <div key={url} className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={t("owner_playground_photos")}
                                className="h-16 w-20 rounded-lg object-cover"
                              />
                              <button
                                type="button"
                                aria-label={t("common_delete")}
                                onClick={() => removeVenuePhoto(i, url)}
                                className="absolute -right-2 -top-2 rounded-full bg-background p-0.5 shadow-sm ring-1 ring-border"
                              >
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingPhoto !== null}
                            onClick={() => photoInputs.current[i]?.click()}
                          >
                            {uploadingPhoto === i ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ImagePlus className="h-4 w-4" />
                            )}
                            {t("owner_playground_add_photos")}
                          </Button>
                          <input
                            ref={(el) => {
                              photoInputs.current[i] = el;
                            }}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            hidden
                            onChange={(e) => handlePhotoInput(e, i)}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {t("owner_playground_photos_hint")}
                        </p>
                      </div>
                      {!v.fromPool && (
                        <CourtAvailabilityEditor
                          value={v.court_availability}
                          onChange={(val) => setSignupVenue(i, { court_availability: val })}
                          courtCount={Math.max(1, Number(v.court_count) || 1)}
                        />
                      )}
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
                    {t(signupVenues.length > 0 ? "signup_playground_add_another" : "signup_playground_add_new")}
                  </Button>
                </div>
              </div>
            </div>

            {confirming && (
              <p className="rounded-md bg-interactive-50 p-3 text-center text-sm text-info-ink ">
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