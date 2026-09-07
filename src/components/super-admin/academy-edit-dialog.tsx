"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trophy,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { cn, errorMessage } from "@/lib/utils";
import {
  useAcademyManagement,
  useSuperAdminDeleteAcademy,
  useSuperAdminUpdateAcademy,
} from "@/lib/queries";
import type { Academy, Coach, Venue } from "@/lib/types";
import { LocationFields } from "@/components/shared/location-fields";

const SPORT_OPTIONS = [
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

interface DraftVenue {
  id?: string | null;
  name: string;
  address: string;
  capacity: string;
  sport: string;
  school_name: string;
  rental_cost: string;
  rental_hours: string;
  country: string;
  governorate: string;
  area: string;
  contact_person: string;
  contact_phone: string;
}
interface DraftCoach {
  id?: string | null;
  name: string;
  phone: string;
  specialty: string;
  monthly_salary: string;
  is_active: boolean;
}

type Plan = "starter" | "plus" | "elite";
const PLANS: Plan[] = ["starter", "plus", "elite"];

interface AcademyEditDialogProps {
  academy: Academy | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function AcademyEditDialog({
  academy,
  onClose,
  onDeleted,
}: AcademyEditDialogProps) {
  const { t } = useI18n();
  const { data: detail, isLoading } = useAcademyManagement(academy?.id ?? null);
  const update = useSuperAdminUpdateAcademy();
  const remove = useSuperAdminDeleteAcademy();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [area, setArea] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [plan, setPlan] = useState<Plan>("starter");
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [sports, setSports] = useState<string[]>([]);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [venues, setVenues] = useState<DraftVenue[]>([]);
  const [coaches, setCoaches] = useState<DraftCoach[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!academy) return;
    setName(academy.name ?? "");
    setDescription(academy.description ?? "");
    setCountry(academy.country ?? "");
    setGovernorate(academy.governorate ?? "");
    setArea(academy.area ?? "");
    setIsPublic(Boolean(academy.is_public));
    setPlan((academy.plan as Plan) ?? "starter");
    setIsTrial(Boolean(academy.is_trial));
    setTrialEndsAt(
      academy.trial_ends_at ? academy.trial_ends_at.slice(0, 10) : ""
    );
  }, [academy]);

  useEffect(() => {
    if (!detail) return;
    setSports((detail.sports ?? []).map((s) => s.name));
    setAdminName(detail.admin?.name ?? "");
    setAdminEmail(detail.admin?.email ?? "");
    setAdminPhone(detail.admin?.phone ?? "");
    setVenues((detail.venues ?? []).map((v: Venue & { country?: string; governorate?: string; area?: string; contact_person?: string; contact_phone?: string }) => ({
      id: v.id,
      name: v.name,
      address: v.address ?? "",
      capacity: v.capacity != null ? String(v.capacity) : "",
      sport: v.sport_id ? (detail.sportsById?.[v.sport_id] ?? "") : "",
      school_name: v.school_name ?? "",
      rental_cost: v.rental_cost != null ? String(v.rental_cost) : "",
      rental_hours: v.rental_hours != null ? String(v.rental_hours) : "1",
      country: v.country ?? "",
      governorate: v.governorate ?? "",
      area: v.area ?? "",
      contact_person: v.contact_person ?? "",
      contact_phone: v.contact_phone ?? "",
    })));
    setCoaches((detail.coaches ?? []).map((c: Coach) => ({
      id: c.id,
      name: c.name,
      phone: c.phone ?? "",
      specialty: c.specialty ?? "",
      monthly_salary: c.monthly_salary != null ? String(c.monthly_salary) : "",
      is_active: c.is_active,
    })));
  }, [detail]);

  if (!academy) return null;

  const sportNames = (detail?.sports ?? []).map((s) => s.name);
  const trialAutoDate = isTrial && !trialEndsAt && academy.created_at
    ? new Date(
        new Date(academy.created_at).getTime() + 30 * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .slice(0, 10)
    : "";

  const setVenue = (i: number, patch: Partial<DraftVenue>) =>
    setVenues((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const removeVenue = (i: number) =>
    setVenues((vs) => vs.filter((_, idx) => idx !== i));
  const addVenue = () =>
    setVenues((vs) => [
      ...vs,
      {
        id: null,
        name: "",
        address: "",
        capacity: "",
        sport: "",
        school_name: "",
        rental_cost: "",
        rental_hours: "1",
        country: "",
        governorate: "",
        area: "",
        contact_person: "",
        contact_phone: "",
      },
    ]);
  const setCoach = (i: number, patch: Partial<DraftCoach>) =>
    setCoaches((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCoach = (i: number) =>
    setCoaches((cs) => cs.filter((_, idx) => idx !== i));
  const addCoach = () =>
    setCoaches((cs) => [
      ...cs,
      {
        id: null,
        name: "",
        phone: "",
        specialty: "",
        monthly_salary: "",
        is_active: true,
      },
    ]);

  // Auto-calculate trial end date if trial is active but no date is set
  const finalTrialEndsAt = isTrial
    ? trialEndsAt
      ? `${trialEndsAt}T23:59:59Z`
      : academy.created_at
        ? new Date(
            new Date(academy.created_at).getTime() + 30 * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .slice(0, 10) + "T23:59:59Z"
        : null
    : null;

  const payload = {
    name,
    description,
    country,
    governorate,
    area,
    is_public: isPublic,
    plan,
    is_trial: isTrial,
    trial_ends_at: finalTrialEndsAt,
    sports,
    venues: venues.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      name: v.name,
      address: v.address || null,
          capacity: v.capacity !== "" ? Number(v.capacity) : null,
      sport: v.sport || null,
      school_name: v.school_name || null,
      rental_cost: v.rental_cost !== "" ? Number(v.rental_cost) : null,
      rental_hours: v.rental_hours !== "" ? Number(v.rental_hours) : 1,
      country: v.country || null,
      governorate: v.governorate || null,
      area: v.area || null,
      contact_person: v.contact_person || null,
      contact_phone: v.contact_phone || null,
    })),
    coaches: coaches.map((c) => ({
      ...(c.id ? { id: c.id } : {}),
      name: c.name,
      phone: c.phone || null,
      specialty: c.specialty || null,
      monthly_salary: c.monthly_salary !== "" ? Number(c.monthly_salary) : null,
      is_active: c.is_active,
    })),
    admin_name: adminName,
    admin_email: adminEmail,
    admin_phone: adminPhone,
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("sa_form_name_required"));
      return;
    }
    try {
      await update.mutateAsync({ academyId: academy.id, payload });
      toast.success(t("super_admin_academy_updated"));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(academy.id);
      toast.success(t("super_admin_academy_deleted"));
      setConfirmDeleteOpen(false);
      onClose();
      onDeleted();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <Dialog open={!!academy} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            {t("super_admin_edit_academy")}
          </DialogTitle>
          <DialogDescription>{academy.name}</DialogDescription>
        </DialogHeader>

        {isLoading && !detail ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Identity */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {t("sa_form_identity")}
              </p>
              <div className="space-y-2">
                <Label>{t("sa_form_name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("sa_form_description")}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <LocationFields
                country={country}
                governorate={governorate}
                city={area}
                onCountryChange={(v) => {
                  setCountry(v);
                  setGovernorate("");
                  setArea("");
                }}
                onGovernorateChange={(v) => {
                  setGovernorate(v);
                  setArea("");
                }}
                onCityChange={setArea}
              />
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  {t("sa_form_sports")}
                </Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SPORT_OPTIONS.map((s) => {
                    const active = sports.includes(s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setSports(
                            active
                              ? sports.filter((v) => v !== s.value)
                              : [...sports, s.value]
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
                  {t("sa_form_sports_hint")}
                </p>
              </div>
            </div>

            {/* Subscription */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {t("sa_form_subscription")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("sa_form_plan")}</Label>
                  <Select
                    value={plan}
                    onValueChange={(v) => setPlan(v as Plan)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {t(`plans_tier_${p}` as any)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("sa_form_trial_until")}</Label>
                  <Input
                    type="date"
                    value={trialEndsAt}
                    onChange={(e) => setTrialEndsAt(e.target.value)}
                  />
                  {isTrial && !trialEndsAt && (
                    <p className="text-xs text-muted-foreground">
                      {t("sa_form_trial_auto").replace(
                        "{date}",
                        trialAutoDate
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex items-center justify-between rounded-lg border p-3 sm:flex-1">
                  <div>
                    <p className="text-sm font-medium">{t("sa_form_trial")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("sa_form_trial_hint")}
                    </p>
                  </div>
                  <Switch
                    checked={isTrial}
                    onCheckedChange={setIsTrial}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 sm:flex-1">
                  <div>
                    <p className="text-sm font-medium">{t("sa_form_public")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("sa_form_public_hint")}
                    </p>
                  </div>
                  <Switch
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {t("sa_form_contact")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("sa_form_contact_name")}</Label>
                  <Input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("sa_form_contact_phone")}</Label>
                  <Input
                    dir="ltr"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("sa_form_contact_email")}</Label>
                  <Input
                    dir="ltr"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {detail && detail.branches.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("sa_form_branches").replace(
                  "{count}",
                  String(detail.branches.length)
                )}
              </p>
            )}

            {/* Playgrounds */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {t("sa_form_playgrounds")}
              </p>
              <div className="space-y-3">
                {venues.map((v, i) => (
                  <div key={v.id ?? `new-${i}`} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="mb-0">{v.name || `#${i + 1}`}</Label>
                      <Button variant="ghost" size="sm" onClick={() => removeVenue(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("sa_form_playground_name")}</Label>
                        <Input value={v.name} onChange={(e) => setVenue(i, { name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("sa_form_playground_sport")}</Label>
                        <Select value={v.sport} onValueChange={(sport) => setVenue(i, { sport })}>
                          <SelectTrigger>
                            <SelectValue placeholder={t("common_select")} />
                          </SelectTrigger>
                          <SelectContent>
                            {sportNames.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("sa_form_playground_address")}</Label>
                        <Input value={v.address} onChange={(e) => setVenue(i, { address: e.target.value })} placeholder="e.g. 123 Street Name, City" />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("sa_form_playground_capacity")}</Label>
                        <Input type="number" min="0" value={v.capacity} onChange={(e) => setVenue(i, { capacity: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("sa_form_playground_school")}</Label>
                        <Input value={v.school_name} onChange={(e) => setVenue(i, { school_name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("sa_form_playground_cost")}</Label>
                        <Input type="number" min="0" value={v.rental_cost} onChange={(e) => setVenue(i, { rental_cost: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("sa_form_playground_hours")}</Label>
                        <Input type="number" min="0" step="0.5" value={v.rental_hours} onChange={(e) => setVenue(i, { rental_hours: e.target.value })} />
                      </div>
                    </div>
                    <div className="pt-3 border-t">
                      <LocationFields
                        country={v.country}
                        governorate={v.governorate}
                        city={v.area}
                        onCountryChange={(c) => setVenue(i, { country: c, governorate: "", area: "" })}
                        onGovernorateChange={(g) => setVenue(i, { governorate: g, area: "" })}
                        onCityChange={(a) => setVenue(i, { area: a })}
                        governorateLabel="Governorate"
                        cityLabel="City / Area"
                      />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mt-3">
                        <div className="space-y-2">
                          <Label>{t("sa_form_playground_contact_person")}</Label>
                          <Input value={v.contact_person} onChange={(e) => setVenue(i, { contact_person: e.target.value })} placeholder="Contact person name" />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("sa_form_playground_contact_phone")}</Label>
                          <Input value={v.contact_phone} onChange={(e) => setVenue(i, { contact_phone: e.target.value })} placeholder="Contact phone" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addVenue}>
                  <Plus className="h-4 w-4" />
                  {t("sa_form_add_playground")}
                </Button>
              </div>
            </div>

            {/* Coaches */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {t("sa_form_coaches")}
              </p>
              <div className="space-y-3">
                {coaches.map((c, i) => (
                  <div key={c.id ?? `new-${i}`} className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="mb-0">{c.name || `#${i + 1}`}</Label>
                      <Button variant="ghost" size="sm" onClick={() => removeCoach(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t("sa_form_coach_name")}</Label>
                        <Input value={c.name} onChange={(e) => setCoach(i, { name: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("sa_form_coach_phone")}</Label>
                        <Input dir="ltr" value={c.phone} onChange={(e) => setCoach(i, { phone: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("sa_form_coach_specialty")}</Label>
                        <Input value={c.specialty} onChange={(e) => setCoach(i, { specialty: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("sa_form_coach_salary")}</Label>
                        <Input type="number" min="0" value={c.monthly_salary} onChange={(e) => setCoach(i, { monthly_salary: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">{t("sa_form_coach_active")}</p>
                        <p className="text-xs text-muted-foreground">{t("sa_form_coach_active_hint")}</p>
                      </div>
                      <Switch checked={c.is_active} onCheckedChange={(v) => setCoach(i, { is_active: v })} />
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addCoach}>
                  <Plus className="h-4 w-4" />
                  {t("sa_form_add_coach")}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            className="gap-1"
            disabled={isLoading || remove.isPending}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t("sa_delete")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("common_cancel")}
            </Button>
            <Button
              size="sm"
              className="gap-1"
              disabled={isLoading || update.isPending}
              onClick={handleSave}
            >
              {update.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t("common_save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("super_admin_delete_confirm_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("super_admin_delete_confirm_body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {t("common_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={handleDelete}
              >
                {remove.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t("sa_delete")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}