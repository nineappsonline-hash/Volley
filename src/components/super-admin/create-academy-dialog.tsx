"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  CalendarClock,
  Check,
  CreditCard,
  ImagePlus,
  LandPlot,
  List,
  Loader2,
  Plus,
  Trash2,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { LocationFields } from "@/components/shared/location-fields";
import { CourtAvailabilityEditor } from "@/components/playgrounds/court-availability-editor";
import { uploadSignupCourtPhoto } from "@/lib/court-photo-upload";
import { missingCourtSubmissionFields } from "@/lib/court-submission";
import { COURT_REVIEW_FIELDS } from "@/lib/court-review";
import { parseAcademyPrices } from "@/lib/academy-pricing";
import { SPORT_LABEL_KEYS } from "@/lib/sport-labels";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import type { VenueUnavailableSlot } from "@/lib/types";

type Plan = "starter" | "plus" | "elite";
type Window = VenueUnavailableSlot & { court_number: number };

interface VenueDraft {
  id?: string;
  fromPool?: boolean;
  name: string;
  address: string;
  country: string;
  governorate: string;
  area: string;
  sport: string;
  capacity: string;
  school_name: string;
  rental_cost: string;
  rental_hours: string;
  court_count: string;
  location_link: string;
  contact_person: string;
  contact_phone: string;
  photos: string[];
  court_availability: Window[];
}

interface PlanDraft {
  name: string;
  sessions_count: string;
  price: string;
}

interface PoolVenue {
  id: string;
  name: string;
  address: string | null;
  country: string | null;
  governorate: string | null;
  area: string | null;
}

const SPORTS = Object.entries(SPORT_LABEL_KEYS).map(([value, key]) => ({ value, key }));
const DEFAULT_PLANS: PlanDraft[] = [
  { name: "Full", sessions_count: "8", price: "" },
  { name: "Half", sessions_count: "4", price: "" },
];

const emptyVenue = (country: string, governorate: string, area: string): VenueDraft => ({
  name: "",
  address: "",
  country,
  governorate,
  area,
  sport: "",
  capacity: "",
  school_name: "",
  rental_cost: "",
  rental_hours: "1",
  court_count: "1",
  location_link: "",
  contact_person: "",
  contact_phone: "",
  photos: [],
  court_availability: [],
});

interface CreateAcademyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (academyId: string) => void;
}

export function CreateAcademyDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateAcademyDialogProps) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const copy = (en: string, arText: string) => (ar ? arText : en);
  const queryClient = useQueryClient();

  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState({
    name: "",
    description: "",
    country: ar ? "مصر" : "Egypt",
    governorate: "",
    area: "",
    plan: "elite" as Plan,
    is_trial: true,
    trial_ends_at: "",
    is_public: true,
  });
  const [sports, setSports] = useState<string[]>([]);
  const [monthlySessions, setMonthlySessions] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [tryoutPrice, setTryoutPrice] = useState("");
  const [plans, setPlans] = useState<PlanDraft[]>(DEFAULT_PLANS);
  const [admin, setAdmin] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    invite: true,
    password: "",
  });
  const [venues, setVenues] = useState<VenueDraft[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState<number | null>(null);
  const photoInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [poolPickerOpen, setPoolPickerOpen] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");

  const poolQuery = useQuery({
    queryKey: ["platform-pool-venues"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from("venues")
        .select("id, name, address, country, governorate, area")
        .is("academy_id", null)
        .is("owner_profile_id", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as PoolVenue[];
    },
  });

  const reset = () => {
    setDetails({
      name: "",
      description: "",
      country: ar ? "مصر" : "Egypt",
      governorate: "",
      area: "",
      plan: "elite",
      is_trial: true,
      trial_ends_at: "",
      is_public: true,
    });
    setSports([]);
    setMonthlySessions("");
    setMonthlyPrice("");
    setTryoutPrice("");
    setPlans(DEFAULT_PLANS);
    setAdmin({ name: "", username: "", email: "", phone: "", invite: true, password: "" });
    setVenues([]);
    setPoolPickerOpen(false);
    setPoolSearch("");
  };

  const setDetail = (key: keyof typeof details, value: string | boolean) =>
    setDetails((prev) => ({ ...prev, [key]: value }));
  const setAdminField = (key: keyof typeof admin, value: string | boolean) =>
    setAdmin((prev) => ({ ...prev, [key]: value }));
  const setPlan = (index: number, patch: Partial<PlanDraft>) =>
    setPlans((prev) => prev.map((plan, i) => (i === index ? { ...plan, ...patch } : plan)));
  const setVenue = (index: number, patch: Partial<VenueDraft>) =>
    setVenues((prev) => prev.map((venue, i) => (i === index ? { ...venue, ...patch } : venue)));
  const removeVenue = (index: number) =>
    setVenues((prev) => prev.filter((_, i) => i !== index));
  const addVenue = () =>
    setVenues((prev) => [
      ...prev,
      emptyVenue(details.country, details.governorate, details.area),
    ]);
  const addPoolVenue = (venue: PoolVenue) => {
    setVenues((prev) => [
      ...prev,
      {
        ...emptyVenue(venue.country ?? details.country, venue.governorate ?? details.governorate, venue.area ?? details.area),
        id: venue.id,
        fromPool: true,
        name: venue.name,
        address: venue.address ?? "",
      },
    ]);
    setPoolPickerOpen(false);
  };

  const handlePhotoInput = async (
    event: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploadingPhoto(index);
    try {
      const urls: string[] = [];
      for (const file of files) urls.push(await uploadSignupCourtPhoto(file));
      setVenue(index, { photos: [...venues[index].photos, ...urls] });
    } catch (error) {
      toast.error(errorMessage(error, copy("Could not upload photo", "تعذر رفع الصورة")));
    } finally {
      setUploadingPhoto(null);
      if (photoInputs.current[index]) photoInputs.current[index]!.value = "";
    }
  };

  const takenPoolIds = new Set(venues.map((venue) => venue.id).filter(Boolean));
  const availablePoolVenues = (poolQuery.data ?? []).filter(
    (venue) =>
      !takenPoolIds.has(venue.id) &&
      [venue.name, venue.address, venue.country, venue.governorate, venue.area]
        .join(" ")
        .toLowerCase()
        .includes(poolSearch.toLowerCase())
  );

  const submit = async () => {
    if (details.name.trim().length < 2) {
      toast.error(copy("Academy name is required", "اسم الأكاديمية مطلوب"));
      return;
    }
    if (!details.country.trim() || !details.governorate.trim() || !details.area.trim()) {
      toast.error(copy("Academy location is required", "موقع الأكاديمية مطلوب"));
      return;
    }
    if (!sports.length) {
      toast.error(copy("Choose at least one sport", "اختر رياضة واحدة على الأقل"));
      return;
    }
    if (!admin.name.trim() || !admin.email.trim() || !admin.phone.trim()) {
      toast.error(copy("Founder name, email and phone are required", "اسم المؤسس والبريد والهاتف مطلوبة"));
      return;
    }
    if (admin.username.trim() && !/^[a-z0-9_]{3,20}$/.test(admin.username.trim())) {
      toast.error(t("field_username_invalid"));
      return;
    }
    if (!admin.invite && admin.password.length < 6) {
      toast.error(t("field_min_password"));
      return;
    }
    for (const [index, plan] of plans.entries()) {
      if (!plan.name.trim() || !/^[0-9]+$/.test(plan.sessions_count) || Number(plan.sessions_count) < 1) {
        toast.error(
          copy(`Plan ${index + 1} needs a name and session count`, `الخطة ${index + 1} تحتاج اسمًا وعدد حصص`)
        );
        return;
      }
    }
    let prices;
    try {
      prices = parseAcademyPrices(monthlySessions, monthlyPrice, tryoutPrice);
    } catch {
      toast.error(t("field_required"));
      return;
    }
    if (uploadingPhoto !== null) {
      toast.error(t("common_loading"));
      return;
    }
    for (const [index, venue] of venues.entries()) {
      if (venue.fromPool) continue;
      const missing = missingCourtSubmissionFields({
        name: venue.name,
        address: venue.address,
        sport_id: venue.sport || null,
        contact_phone: venue.contact_phone,
        country: venue.country,
        governorate: venue.governorate,
        area: venue.area,
        location_link: venue.location_link,
        rental_cost: venue.rental_cost === "" ? null : Number(venue.rental_cost),
        rental_hours: venue.rental_hours === "" ? null : Number(venue.rental_hours),
        court_count: Number(venue.court_count),
        photos: venue.photos,
        cover_url: null,
        court_availability: venue.court_availability,
      });
      if (missing.length) {
        toast.error(
          `${copy("Court", "الملعب")} ${index + 1}: ${missing
            .map((field) => COURT_REVIEW_FIELDS[field][ar ? "ar" : "en"])
            .join(" · ")}`
        );
        return;
      }
    }

    setBusy(true);
    try {
      const response = await fetch("/api/platform-admin/academies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: details.name.trim(),
          description: details.description.trim(),
          country: details.country.trim(),
          governorate: details.governorate.trim(),
          area: details.area.trim(),
          plan: details.plan,
          is_public: details.is_public,
          is_trial: details.is_trial,
          trial_ends_at:
            details.is_trial && details.trial_ends_at
              ? `${details.trial_ends_at}T23:59:59Z`
              : null,
          ...prices,
          sports,
          membership_plans: plans.map((plan) => ({
            name: plan.name.trim(),
            sessions_count: Number(plan.sessions_count),
            price: plan.price === "" ? null : Number(plan.price),
          })),
          venues: venues.map((venue) => ({
            ...(venue.id ? { id: venue.id } : {}),
            name: venue.name.trim(),
            address: venue.address.trim() || null,
            capacity: venue.capacity === "" ? null : Number(venue.capacity),
            sport: venue.sport || null,
            school_name: venue.school_name.trim() || null,
            rental_cost: venue.rental_cost === "" ? null : Number(venue.rental_cost),
            rental_hours: venue.rental_hours === "" ? null : Number(venue.rental_hours),
            court_count: venue.court_count === "" ? 1 : Number(venue.court_count),
            location_link: venue.location_link.trim() || null,
            contact_phone: venue.contact_phone.trim() || null,
            contact_person: venue.contact_person.trim() || null,
            country: venue.country || null,
            governorate: venue.governorate || null,
            area: venue.area || null,
            photos: venue.photos,
            court_availability: venue.court_availability,
          })),
          admin: {
            name: admin.name.trim(),
            username: admin.username.trim() || undefined,
            email: admin.email.trim(),
            phone: admin.phone.trim(),
            invite: admin.invite,
            ...(admin.invite ? {} : { password: admin.password }),
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || copy("Could not create academy", "تعذر إنشاء الأكاديمية"));
      toast.success(copy("Academy created", "تم إنشاء الأكاديمية"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["all-academies"] }),
        queryClient.invalidateQueries({ queryKey: ["platform-records"] }),
        queryClient.invalidateQueries({ queryKey: ["super-admin-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["academy-management"] }),
      ]);
      const id = result.id as string;
      reset();
      onOpenChange(false);
      onCreated(id);
    } catch (error) {
      toast.error(errorMessage(error, copy("Could not create academy", "تعذر إنشاء الأكاديمية")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            if (!value) reset();
            onOpenChange(value);
          }
        }}
      >
        <DialogContent className="training-mobile max-h-[92dvh] overflow-y-auto p-3 sm:max-w-3xl sm:p-6">
          <DialogHeader>
            <DialogTitle>{copy("Create academy", "إنشاء أكاديمية")}</DialogTitle>
            <DialogDescription>
              {copy(
                "Everything a self-serve academy gets: founder account, sports, plans, pricing and playgrounds.",
                "كل ما تحصل عليه الأكاديمية عند التسجيل الذاتي: حساب المؤسس والرياضات والخطط والأسعار والملاعب."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-primary" />
                {copy("Academy identity", "بيانات الأكاديمية")}
              </h3>
              <Label className="block space-y-1 text-sm">
                <span>{copy("Academy name", "اسم الأكاديمية")} *</span>
                <Input
                  maxLength={60}
                  value={details.name}
                  onChange={(event) => setDetail("name", event.target.value)}
                />
              </Label>
              <Label className="block space-y-1 text-sm">
                <span>{copy("Description", "الوصف")}</span>
                <Textarea
                  rows={2}
                  maxLength={2000}
                  value={details.description}
                  onChange={(event) => setDetail("description", event.target.value)}
                />
              </Label>
              <LocationFields
                country={details.country}
                governorate={details.governorate}
                city={details.area}
                onCountryChange={(value) => {
                  setDetail("country", value);
                  setDetail("governorate", "");
                  setDetail("area", "");
                }}
                onGovernorateChange={(value) => {
                  setDetail("governorate", value);
                  setDetail("area", "");
                }}
                onCityChange={(value) => setDetail("area", value)}
              />
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="h-4 w-4 text-primary" />
                {copy("Subscription", "الاشتراك")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label className="block space-y-1 text-sm">
                  <span>{copy("Plan", "الخطة")}</span>
                  <Select value={details.plan} onValueChange={(value) => setDetail("plan", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["starter", "plus", "elite"] as Plan[]).map((plan) => (
                        <SelectItem key={plan} value={plan}>
                          {t(`plans_tier_${plan}` as any)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>
                <Label className="block space-y-1 text-sm">
                  <span>{copy("Trial ends (blank = 30 days)", "انتهاء التجربة (فارغ = 30 يومًا)")}</span>
                  <Input
                    type="date"
                    value={details.trial_ends_at}
                    disabled={!details.is_trial}
                    onChange={(event) => setDetail("trial_ends_at", event.target.value)}
                  />
                </Label>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 items-center justify-between rounded-lg border p-3">
                  <p className="text-sm font-medium">{copy("Free trial", "تجربة مجانية")}</p>
                  <Switch
                    checked={details.is_trial}
                    onCheckedChange={(value) => setDetail("is_trial", value)}
                  />
                </div>
                <div className="flex flex-1 items-center justify-between rounded-lg border p-3">
                  <p className="text-sm font-medium">{copy("Public directory", "الدليل العام")}</p>
                  <Switch
                    checked={details.is_public}
                    onCheckedChange={(value) => setDetail("is_public", value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Label className="block space-y-1 text-sm">
                  <span>{copy("Monthly sessions", "حصص الشهر")}</span>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    dir="ltr"
                    value={monthlySessions}
                    onChange={(event) => setMonthlySessions(event.target.value)}
                  />
                </Label>
                <Label className="block space-y-1 text-sm">
                  <span>{copy("Monthly price", "سعر الشهر")}</span>
                  <Input
                    type="number"
                    min="0"
                    dir="ltr"
                    value={monthlyPrice}
                    onChange={(event) => setMonthlyPrice(event.target.value)}
                  />
                </Label>
                <Label className="block space-y-1 text-sm">
                  <span>{copy("Trial session price", "سعر الحصة التجريبية")}</span>
                  <Input
                    type="number"
                    min="0"
                    dir="ltr"
                    value={tryoutPrice}
                    onChange={(event) => setTryoutPrice(event.target.value)}
                  />
                </Label>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Trophy className="h-4 w-4 text-primary" />
                {copy("Sports", "الرياضات")}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SPORTS.map((sport) => {
                  const active = sports.includes(sport.value);
                  return (
                    <button
                      key={sport.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setSports((prev) =>
                          active ? prev.filter((value) => value !== sport.value) : [...prev, sport.value]
                        )
                      }
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        active
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-input bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="truncate">{t(sport.key)}</span>
                      {active && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <UserRound className="h-4 w-4 text-primary" />
                {copy("Founder account", "حساب المؤسس")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Label className="block space-y-1 text-sm">
                  <span>{copy("Name", "الاسم")} *</span>
                  <Input
                    value={admin.name}
                    onChange={(event) => setAdminField("name", event.target.value)}
                  />
                </Label>
                <Label className="block space-y-1 text-sm">
                  <span>{copy("Username (optional)", "اسم المستخدم (اختياري)")}</span>
                  <Input
                    dir="ltr"
                    placeholder="auto-generated"
                    value={admin.username}
                    onChange={(event) => setAdminField("username", event.target.value)}
                  />
                </Label>
                <Label className="block space-y-1 text-sm">
                  <span>{copy("Email", "البريد الإلكتروني")} *</span>
                  <Input
                    type="email"
                    dir="ltr"
                    value={admin.email}
                    onChange={(event) => setAdminField("email", event.target.value)}
                  />
                </Label>
                <Label className="block space-y-1 text-sm">
                  <span>{copy("Phone", "الهاتف")} *</span>
                  <Input
                    type="tel"
                    dir="ltr"
                    value={admin.phone}
                    onChange={(event) => setAdminField("phone", event.target.value)}
                  />
                </Label>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{copy("Send email invitation", "إرسال دعوة بالبريد")}</p>
                    <p className="text-xs text-muted-foreground">
                      {copy("The founder sets their own password.", "يحدد المؤسس كلمة المرور بنفسه.")}
                    </p>
                  </div>
                  <Switch
                    checked={admin.invite}
                    onCheckedChange={(value) => setAdminField("invite", value)}
                  />
                </div>
                {!admin.invite && (
                  <Label className="block flex-1 space-y-1 text-sm">
                    <span>{copy("Password", "كلمة المرور")} *</span>
                    <Input
                      type="password"
                      dir="ltr"
                      value={admin.password}
                      onChange={(event) => setAdminField("password", event.target.value)}
                    />
                  </Label>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarClock className="h-4 w-4 text-primary" />
                {copy("Membership plans", "خطط العضوية")}
              </h3>
              {plans.map((plan, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_120px_120px_auto]">
                  <Input
                    aria-label={copy("Plan name", "اسم الخطة")}
                    placeholder={copy("Plan name", "اسم الخطة")}
                    value={plan.name}
                    onChange={(event) => setPlan(index, { name: event.target.value })}
                  />
                  <Input
                    aria-label={copy("Sessions", "الحصص")}
                    type="number"
                    min="1"
                    dir="ltr"
                    placeholder={copy("Sessions", "الحصص")}
                    value={plan.sessions_count}
                    onChange={(event) => setPlan(index, { sessions_count: event.target.value })}
                  />
                  <Input
                    aria-label={copy("Price", "السعر")}
                    type="number"
                    min="0"
                    dir="ltr"
                    placeholder={copy("Price (optional)", "السعر (اختياري)")}
                    value={plan.price}
                    onChange={(event) => setPlan(index, { price: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={copy("Remove plan", "حذف الخطة")}
                    onClick={() => setPlans((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPlans((prev) => [...prev, { name: "", sessions_count: "", price: "" }])}
              >
                <Plus className="h-4 w-4" />
                {copy("Add plan", "إضافة خطة")}
              </Button>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <LandPlot className="h-4 w-4 text-primary" />
                {copy("Playgrounds", "الملاعب")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {copy(
                  "Each new court needs a sport, full address and location, map link, price, court count, photos and working hours.",
                  "كل ملعب جديد يحتاج رياضة وعنوانًا وموقعًا ورابط خريطة وسعرًا وعدد ملاعب وصورًا ومواعيد عمل."
                )}
              </p>
              {venues.map((venue, index) => (
                <div key={venue.id ?? `new-${index}`} className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {venue.name || `${copy("Playground", "ملعب")} #${index + 1}`}
                      </span>
                      {venue.fromPool && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {copy("existing", "موجود")}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVenue(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {!venue.fromPool && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("Court name", "اسم الملعب")} *</span>
                          <Input
                            value={venue.name}
                            onChange={(event) => setVenue(index, { name: event.target.value })}
                          />
                        </Label>
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("Sport", "الرياضة")} *</span>
                          <Select
                            value={venue.sport}
                            onValueChange={(value) => setVenue(index, { sport: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={copy("Choose sport", "اختر الرياضة")} />
                            </SelectTrigger>
                            <SelectContent>
                              {SPORTS.map((sport) => (
                                <SelectItem key={sport.value} value={sport.value}>
                                  {t(sport.key)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Label>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("Court count", "عدد الملاعب")}</span>
                          <Input
                            type="number"
                            min="1"
                            dir="ltr"
                            value={venue.court_count}
                            onChange={(event) => setVenue(index, { court_count: event.target.value })}
                          />
                        </Label>
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("Rental price", "سعر الإيجار")}</span>
                          <Input
                            type="number"
                            min="0"
                            dir="ltr"
                            value={venue.rental_cost}
                            onChange={(event) => setVenue(index, { rental_cost: event.target.value })}
                          />
                        </Label>
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("Rental hours", "ساعات الإيجار")}</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            dir="ltr"
                            value={venue.rental_hours}
                            onChange={(event) => setVenue(index, { rental_hours: event.target.value })}
                          />
                        </Label>
                      </div>
                      <LocationFields
                        country={venue.country}
                        governorate={venue.governorate}
                        city={venue.area}
                        onCountryChange={(value) =>
                          setVenue(index, { country: value, governorate: "", area: "" })
                        }
                        onGovernorateChange={(value) =>
                          setVenue(index, { governorate: value, area: "" })
                        }
                        onCityChange={(value) => setVenue(index, { area: value })}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("Address", "العنوان")} *</span>
                          <Input
                            value={venue.address}
                            onChange={(event) => setVenue(index, { address: event.target.value })}
                          />
                        </Label>
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("Map link", "رابط الخريطة")} *</span>
                          <Input
                            dir="ltr"
                            placeholder="https://maps.google.com/..."
                            value={venue.location_link}
                            onChange={(event) => setVenue(index, { location_link: event.target.value })}
                          />
                        </Label>
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("Contact phone", "هاتف التواصل")} *</span>
                          <Input
                            type="tel"
                            dir="ltr"
                            value={venue.contact_phone}
                            onChange={(event) => setVenue(index, { contact_phone: event.target.value })}
                          />
                        </Label>
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("Contact person", "مسؤول التواصل")}</span>
                          <Input
                            value={venue.contact_person}
                            onChange={(event) => setVenue(index, { contact_person: event.target.value })}
                          />
                        </Label>
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("Capacity", "السعة")}</span>
                          <Input
                            type="number"
                            min="0"
                            dir="ltr"
                            value={venue.capacity}
                            onChange={(event) => setVenue(index, { capacity: event.target.value })}
                          />
                        </Label>
                        <Label className="block space-y-1 text-sm">
                          <span>{copy("School name", "اسم المدرسة")}</span>
                          <Input
                            value={venue.school_name}
                            onChange={(event) => setVenue(index, { school_name: event.target.value })}
                          />
                        </Label>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">{copy("Photos", "الصور")} *</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          {venue.photos.map((url) => (
                            <div key={url} className="relative">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={copy("Court photo", "صورة الملعب")}
                                className="h-16 w-20 rounded-lg object-cover"
                              />
                              <button
                                type="button"
                                aria-label={t("common_delete")}
                                onClick={() =>
                                  setVenue(index, {
                                    photos: venue.photos.filter((photo) => photo !== url),
                                  })
                                }
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
                            onClick={() => photoInputs.current[index]?.click()}
                          >
                            {uploadingPhoto === index ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ImagePlus className="h-4 w-4" />
                            )}
                            {copy("Add photos", "إضافة صور")}
                          </Button>
                          <input
                            ref={(element) => {
                              photoInputs.current[index] = element;
                            }}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            hidden
                            onChange={(event) => void handlePhotoInput(event, index)}
                          />
                        </div>
                      </div>
                      <CourtAvailabilityEditor
                        value={venue.court_availability}
                        onChange={(value) => setVenue(index, { court_availability: value })}
                        courtCount={Math.max(1, Number(venue.court_count) || 1)}
                      />
                    </>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPoolSearch("");
                    setPoolPickerOpen(true);
                  }}
                >
                  <List className="h-4 w-4" />
                  {copy("Use existing playground", "استخدام ملعب موجود")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={addVenue}>
                  <Plus className="h-4 w-4" />
                  {copy("Add playground", "إضافة ملعب")}
                </Button>
              </div>
            </section>

            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                {t("common_cancel")}
              </Button>
              <Button type="button" disabled={busy} onClick={submit}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Building2 className="h-4 w-4" />
                )}
                {busy ? t("common_saving") : copy("Create academy", "إنشاء الأكاديمية")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={poolPickerOpen} onOpenChange={setPoolPickerOpen}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{copy("Choose an existing playground", "اختر ملعبًا موجودًا")}</DialogTitle>
            <DialogDescription>
              {copy(
                "Unassigned playgrounds from the platform pool.",
                "ملاعب غير مرتبطة من مجموعة المنصة."
              )}
            </DialogDescription>
          </DialogHeader>
          <Input
            className="mb-3"
            placeholder={copy("Search playgrounds", "بحث في الملاعب")}
            value={poolSearch}
            onChange={(event) => setPoolSearch(event.target.value)}
          />
          <div className="space-y-2">
            {availablePoolVenues.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {copy("No unassigned playgrounds.", "لا توجد ملاعب غير مرتبطة.")}
              </p>
            )}
            {availablePoolVenues.map((venue) => (
              <div key={venue.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{venue.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[venue.country, venue.governorate, venue.area, venue.address]
                      .filter(Boolean)
                      .join(" · ") || venue.name}
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => addPoolVenue(venue)}>
                  {copy("Add", "إضافة")}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
