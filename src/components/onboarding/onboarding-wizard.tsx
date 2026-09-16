"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  PartyPopper,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
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
import { AcademyMediaManager } from "@/components/media/academy-media-manager";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/dictionary";
import { errorMessage } from "@/lib/utils";
import {
  useAcademy,
  useUpdateAcademy,
  useSaveCoach,
  useSaveTemplate,
} from "@/lib/queries";

const STEPS = [
  "onboarding_step_photos",
  "onboarding_step_coaches",
  "onboarding_step_pricing",
  "onboarding_step_schedule",
] as const;

interface CoachDraft {
  name: string;
  phone: string;
  specialty: string;
}

interface SlotDraft {
  weekday: number;
  time: string;
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export function OnboardingWizard() {
  const { t } = useI18n();
  const router = useRouter();
  const { data: academy } = useAcademy();
  const updateAcademy = useUpdateAcademy();
  const saveCoach = useSaveCoach();
  const saveTemplate = useSaveTemplate();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  /* ── Pricing state ── */
  const [monthlySessions, setMonthlySessions] = useState(
    academy?.monthly_sessions != null ? String(academy.monthly_sessions) : ""
  );
  const [monthlyPrice, setMonthlyPrice] = useState(
    academy?.monthly_price != null ? String(academy.monthly_price) : ""
  );
  const [tryoutPrice, setTryoutPrice] = useState(
    academy?.tryout_price != null ? String(academy.tryout_price) : ""
  );
  const [copied, setCopied] = useState(false);

  /* ── Coaches state ── */
  const [coaches, setCoaches] = useState<CoachDraft[]>([]);

  /* ── Schedule state ── */
  const [slots, setSlots] = useState<SlotDraft[]>([]);

  const toNumOrNull = (v: string): number | null => {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  /* ── Coach helpers ── */
  const addCoach = () =>
    setCoaches((prev) => [...prev, { name: "", phone: "", specialty: "" }]);
  const removeCoach = (i: number) =>
    setCoaches((prev) => prev.filter((_, idx) => idx !== i));
  const updateCoach = (i: number, patch: Partial<CoachDraft>) =>
    setCoaches((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c))
    );

  /* ── Schedule helpers ── */
  const addSlot = () =>
    setSlots((prev) => [...prev, { weekday: 0, time: "18:00" }]);
  const removeSlot = (i: number) =>
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
  const updateSlot = (i: number, patch: Partial<SlotDraft>) =>
    setSlots((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );

  /* ── Finish ── */
  const finish = async () => {
    setSaving(true);
    try {
      if (academy) {
        await updateAcademy.mutateAsync({
          id: academy.id,
          monthly_sessions: toNumOrNull(monthlySessions),
          monthly_price: toNumOrNull(monthlyPrice),
          tryout_price: toNumOrNull(tryoutPrice),
        });
      }

      for (const c of coaches) {
        if (!c.name.trim()) continue;
        await saveCoach.mutateAsync({
          name: c.name.trim(),
          phone: c.phone.trim() || undefined,
          specialty: c.specialty.trim() || undefined,
        });
      }

      for (const s of slots) {
        const dayName = t(`avail_day_${s.weekday}` as keyof Dict);
        await saveTemplate.mutateAsync({
          name: dayName,
          weekday: s.weekday,
          time: s.time,
        });
      }

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
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-positive-100 text-success-ink dark:bg-positive-500/10 dark:text-positive-400 animate-pop-in">
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
          {/* ── Step 0: Photos ── */}
          {step === 0 && (
            <div className="space-y-4">
              <AcademyMediaManager />
              <p className="text-xs text-muted-foreground">
                {t("onboarding_photos_hint")}
              </p>
            </div>
          )}

          {/* ── Step 1: Coaches (optional) ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>{t("onboarding_coaches_label")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("onboarding_coaches_hint")}
                </p>
              </div>

              {coaches.map((c, ci) => (
                <div key={ci} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {t("onboarding_coach_number").replace(
                        "{n}",
                        String(ci + 1)
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeCoach(ci)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {t("sa_form_coach_name")}
                      </Label>
                      <Input
                        value={c.name}
                        onChange={(e) =>
                          updateCoach(ci, { name: e.target.value })
                        }
                        placeholder={t("onboarding_coach_name_placeholder")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {t("sa_form_coach_phone")}
                      </Label>
                      <Input
                        dir="ltr"
                        value={c.phone}
                        onChange={(e) =>
                          updateCoach(ci, { phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {t("sa_form_coach_specialty")}
                      </Label>
                      <Input
                        value={c.specialty}
                        onChange={(e) =>
                          updateCoach(ci, { specialty: e.target.value })
                        }
                        placeholder={t(
                          "onboarding_coach_specialty_placeholder"
                        )}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addCoach}>
                <Plus className="mr-1 h-4 w-4" />
                {t("onboarding_add_coach")}
              </Button>
            </div>
          )}

          {/* ── Step 2: Pricing ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("onboarding_pricing_label")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("onboarding_pricing_hint")}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("onboarding_monthly_sessions")}</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    dir="ltr"
                    value={monthlySessions}
                    onChange={(e) => setMonthlySessions(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("onboarding_monthly_price")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    dir="ltr"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("onboarding_tryout_price")}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    dir="ltr"
                    value={tryoutPrice}
                    onChange={(e) => setTryoutPrice(e.target.value)}
                  />
                </div>
              </div>

              {academy?.invite_code && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <KeyRound className="h-4 w-4 text-primary" />
                    {t("onboarding_invite_label")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("onboarding_invite_hint")}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Input dir="ltr" readOnly value={academy.invite_code} />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("cal_copy")}
                      onClick={() => {
                        navigator.clipboard
                          .writeText(academy.invite_code)
                          .then(() => {
                            setCopied(true);
                            toast.success(t("cal_copied"));
                            setTimeout(() => setCopied(false), 2000);
                          })
                          .catch(() => toast.error(t("common_error")));
                      }}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-success-ink" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Schedule ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>{t("onboarding_schedule_label")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("onboarding_schedule_hint")}
                </p>
              </div>

              {slots.map((s, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <Select
                    value={String(s.weekday)}
                    onValueChange={(v) =>
                      updateSlot(i, { weekday: Number(v) })
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d) => (
                        <SelectItem key={d} value={String(d)} textValue={String(d).padStart(2, "0")}>
                          {t(`avail_day_${d}` as keyof Dict)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    dir="ltr"
                    className="w-[130px]"
                    value={s.time}
                    onChange={(e) => updateSlot(i, { time: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive"
                    onClick={() => removeSlot(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addSlot}>
                <Plus className="mr-1 h-4 w-4" />
                {t("onboarding_add_slot")}
              </Button>
            </div>
          )}

          {/* ── Navigation ── */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                {t("common_back")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/dashboard")}
              >
                {t("onboarding_skip")}
              </Button>
            </div>
            {step === STEPS.length - 1 ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={finish}
              >
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                {saving ? t("common_saving") : t("onboarding_finish")}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setStep((s) => s + 1)}
              >
                {t("onboarding_next")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
