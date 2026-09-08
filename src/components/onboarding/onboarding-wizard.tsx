"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, PartyPopper, Sparkles, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MapPicker } from "@/components/shared/map-picker";
import { AcademyMediaManager } from "@/components/media/academy-media-manager";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
  useAcademy,
  useSports,
  useSaveSport,
  useUpdateAcademy,
} from "@/lib/queries";

const STEPS = [
  "onboarding_step_basics",
  "onboarding_step_location",
  "onboarding_step_sports",
  "onboarding_step_photos",
] as const;

export function OnboardingWizard() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: academy } = useAcademy();
  const { data: sports } = useSports();
  const saveSport = useSaveSport();
  const updateAcademy = useUpdateAcademy();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [name, setName] = useState(academy?.name ?? "");
  const [description, setDescription] = useState(academy?.description ?? "");
  const [area, setArea] = useState(academy?.area ?? "");
  const [governorate, setGovernorate] = useState(academy?.governorate ?? "");
  const [lat, setLat] = useState<number | null>(academy?.lat ?? null);
  const [lng, setLng] = useState<number | null>(academy?.lng ?? null);
  const [address, setAddress] = useState<string | null>(academy?.address ?? null);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [newSport, setNewSport] = useState("");

  const picking = useMemo(
    () => new Set(selectedSports),
    [selectedSports]
  );

  const toggleSport = (id: string) => {
    setSelectedSports((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleNewSport = () => {
    const value = newSport.trim();
    if (!value) return;
    setSelectedSports((prev) => [...prev, `new:${value}`]);
    setNewSport("");
  };

  const canNext =
    step === 0
      ? name.trim().length > 0
      : step === 1
        ? lat != null && lng != null
        : true;

  const finish = async () => {
    setSaving(true);
    try {
      if (academy) {
        await updateAcademy.mutateAsync({
          id: academy.id,
          name: name.trim(),
          description: description.trim() || null,
          area: area.trim() || null,
          governorate: governorate.trim() || null,
          lat,
          lng,
          address: address ?? null,
        });
      }
      const newNames = selectedSports
        .filter((s) => s.startsWith("new:"))
        .map((s) => s.slice(4));
      for (const n of newNames) await saveSport.mutateAsync({ name: n });
      setDone(true);
      toast.success(t("onboarding_done"));
      setTimeout(() => router.push("/dashboard"), 900);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 animate-pop-in">
            <PartyPopper className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">{t("onboarding_welcome")}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("onboarding_done_hint")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={t("onboarding_title")}
        subtitle={t("onboarding_subtitle")}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((key, i) => (
          <div key={key} className="flex flex-1 flex-col gap-1">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                i <= step ? "bg-primary" : "bg-muted"
              }`}
            />
            <p
              className={`text-[11px] font-medium ${
                i <= step ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {t(key)}
            </p>
          </div>
        ))}
      </div>

      <Card className="animate-fade-in-up">
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("onboarding_name")}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("onboarding_name_placeholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("onboarding_description")}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("onboarding_description_placeholder")}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("onboarding_area")}</Label>
                  <Input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder={t("onboarding_area_placeholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("onboarding_governorate")}</Label>
                  <Input
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    placeholder={t("onboarding_governorate_placeholder")}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <MapPicker
                lat={lat}
                lng={lng}
                onChange={(pick) => {
                  setLat(pick.lat);
                  setLng(pick.lng);
                  if (pick.label) setAddress(pick.label);
                }}
                hint={t("onboarding_map_hint")}
              />
              {address && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span dir="auto">{address}</span>
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("onboarding_sports_label")}</Label>
                <div className="flex flex-wrap gap-2">
                  {(sports ?? []).map((s) => (
                    <Badge
                      key={s.id}
                      variant={picking.has(s.id) ? "default" : "secondary"}
                      className="cursor-pointer select-none"
                      onClick={() => toggleSport(s.id)}
                    >
                      {picking.has(s.id) && <Check className="me-1 h-3 w-3" />}
                      {s.name}
                    </Badge>
                  ))}
                  {selectedSports
                    .filter((s) => s.startsWith("new:"))
                    .map((s) => (
                      <Badge
                        key={s}
                        variant="default"
                        className="cursor-pointer select-none"
                        onClick={() =>
                          setSelectedSports((prev) =>
                            prev.filter((x) => x !== s)
                          )
                        }
                      >
                        <Check className="me-1 h-3 w-3" />
                        {s.slice(4)}
                      </Badge>
                    ))}
                </div>
                {(sports ?? []).length === 0 && selectedSports.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("onboarding_sports_empty")}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newSport}
                  onChange={(e) => setNewSport(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      toggleNewSport();
                    }
                  }}
                  placeholder={t("onboarding_sports_placeholder")}
                />
                <Button type="button" variant="outline" onClick={toggleNewSport}>
                  + {t("common_add")}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <AcademyMediaManager />
              <p className="text-xs text-muted-foreground">
                {t("onboarding_photos_hint")}
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              {t("common_back")}
            </Button>
            {step === STEPS.length - 1 ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={finish}
                >
                  {t("onboarding_skip_photos")}
                </Button>
                <Button type="button" variant="outline" disabled={saving} onClick={finish}>
                  {saving ? t("common_saving") : t("onboarding_finish")}
                </Button>
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  {t("common_back")}
                </Button>
                <Button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                  {t("onboarding_next")}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {step === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          {t("onboarding_basics_hint")}
        </p>
      )}
    </>
  );
}