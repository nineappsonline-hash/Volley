"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CircleDollarSign, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { useTeams } from "@/lib/queries";
import { useSaveTrainingPlan } from "@/lib/queries-ai";
import { useCurrentProfile } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";
import type { AiTrainingPlan } from "@/lib/ai/schemas";

interface PlanGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function PlanGenerator({ open, onOpenChange, onSaved }: PlanGeneratorProps) {
  const { t } = useI18n();
  const { data: teams } = useTeams();
  const { data: profile } = useCurrentProfile();
  const savePlan = useSaveTrainingPlan();

  const [teamId, setTeamId] = useState("");
  const [sport, setSport] = useState("Volleyball");
  const [mainObjective, setMainObjective] = useState("");
  const [skillFocus, setSkillFocus] = useState("");
  const [intensity, setIntensity] = useState<"light" | "moderate" | "intense">("moderate");
  const [duration, setDuration] = useState(90);
  const [players, setPlayers] = useState(12);
  const [coaches, setCoaches] = useState(2);
  const [ageGroup, setAgeGroup] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [gender, setGender] = useState("");
  const [equipment, setEquipment] = useState("");
  const [space, setSpace] = useState("");
  const [notes, setNotes] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<AiTrainingPlan | null>(null);
  const [meta, setMeta] = useState<{ fallback: boolean; provider: string | null; model: string | null; estimated_cost: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const canGenerate = !!profile?.academy_id && !generating && !saving;

  const reset = () => {
    setGenerated(null);
    setMeta(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) reset();
    onOpenChange(next);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/coach-ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: teamId === "none" || !teamId ? undefined : teamId,
          sport,
          sessionDurationMin: duration,
          numPlayers: players,
          numCoaches: coaches,
          ageGroup: ageGroup || undefined,
          skillLevel: (skillLevel || undefined) as "beginner" | "intermediate" | "advanced" | undefined,
          gender: (gender || undefined) as "male" | "female" | "mixed" | "all" | undefined,
          equipment: equipment.split(",").map((s) => s.trim()).filter(Boolean),
          space: space || undefined,
          intensityTheme: intensity,
          mainObjective: mainObjective || undefined,
          skillFocus: skillFocus.split(",").map((s) => s.trim()).filter(Boolean),
          notes: notes || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Generation failed");
      setGenerated(body.plan as AiTrainingPlan);
      setMeta(body.meta);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generated) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        team_id: teamId === "none" || !teamId ? null : teamId,
        sport,
        title: generated.title,
        main_objective: generated.main_objective,
        secondary_objectives: generated.secondary_objectives,
        skill_focus: generated.skill_focus,
        intensity_theme: generated.intensity_theme,
        session_duration_min: generated.session_duration_min,
        num_players: generated.num_players,
        num_coaches: generated.num_coaches,
        age_group: generated.age_group,
        skill_level: generated.skill_level,
        gender: generated.gender,
        equipment: generated.equipment,
        space: generated.space,
        notes: generated.notes,
        ai_provider: meta?.provider ?? null,
        ai_model: meta?.model ?? null,
        ai_estimated_cost: meta?.estimated_cost ?? 0,
        sections: generated.sections.map((s, i) => ({
          section_type: s.section_type,
          title: s.title,
          purpose: s.purpose,
          duration_min: s.duration_min,
          skill_focus: s.skill_focus,
          order_index: i,
          exercises: s.exercises.map((e, j) => ({
            name: e.name,
            purpose: e.purpose,
            duration_min: e.duration_min,
            num_players: e.num_players,
            equipment: e.equipment,
            setup: e.setup,
            instructions: e.instructions,
            coaching_points: e.coaching_points,
            difficulty: e.difficulty,
            order_index: j,
            ai_generated: true,
          })),
        })),
      };
      await savePlan.mutateAsync(payload);
      toast.success(t("coachai_generated"));
      onSaved?.();
      handleOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  const totalMin = useMemo(
    () => (generated?.sections ?? []).reduce((acc, s) => acc + (s.duration_min ?? 0), 0),
    [generated]
  );

  if (generated) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("coachai_generated")}</DialogTitle>
            <DialogDescription>
              {generated.title} · {generated.sections.length} {t("coachai_sections").toLowerCase()} · ~{totalMin}{t("coachai_duration_minutes")}
              {meta?.provider ? ` · ${t("coachai_provider_status")}: ${meta.provider}` : ""}
              {meta?.estimated_cost ? ` · ${t("coachai_estimated_cost")}: $${meta.estimated_cost.toFixed(4)}` : ""}
            </DialogDescription>
          </DialogHeader>

          {meta?.fallback && (
            <div className="rounded-lg border border-attention-300 bg-attention-50 p-3 text-xs text-warning-ink dark:bg-attention-500/10">
              {t("coachai_fallback")}
            </div>
          )}

          <div className="space-y-4">
            {generated.sections.map((section, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 py-3">
                  <CardTitle className="text-sm font-bold">
                    {i + 1}. {section.title}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {section.duration_min}{t("coachai_duration_minutes")}
                  </span>
                </CardHeader>
                <CardContent className="space-y-3 py-3">
                  {section.exercises.map((ex, j) => (
                    <div key={j} className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{ex.name}</p>
                        <span className="text-xs text-muted-foreground">{ex.duration_min}{t("coachai_duration_minutes")}</span>
                      </div>
                      {ex.instructions.length > 0 && (
                        <ol className="mt-2 list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
                          {ex.instructions.map((step, k) => (
                            <li key={k}>{step}</li>
                          ))}
                        </ol>
                      )}
                      {ex.coaching_points.length > 0 && (
                        <p className="mt-2 text-xs text-info-ink"><strong>{t("coaching_points_hint")}:</strong> {ex.coaching_points.join(" · ")}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={reset} disabled={saving}>
              {t("coachai_back")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
              {saving ? t("coachai_saving") : t("coachai_save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("coachai_new_plan")}</DialogTitle>
          <DialogDescription>{t("coachai_subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>{t("coachai_team")}</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder={t("coachai_no_team")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("coachai_no_team")}</SelectItem>
                {(teams ?? []).map((team) => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t("coachai_sport")}</Label>
            <Input
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              placeholder="Volleyball"
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("coachai_main_objective")}</Label>
            <Textarea
              value={mainObjective}
              onChange={(e) => setMainObjective(e.target.value)}
              placeholder={t("coachai_objective_placeholder")}
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t("coachai_skill_focus")}</Label>
            <Input
              value={skillFocus}
              onChange={(e) => setSkillFocus(e.target.value)}
              placeholder="reception, serve, positioning"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("coachai_intensity")}</Label>
              <Select value={intensity} onValueChange={(v) => setIntensity(v as typeof intensity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("coachai_intensity_light")}</SelectItem>
                  <SelectItem value="moderate">{t("coachai_intensity_moderate")}</SelectItem>
                  <SelectItem value="intense">{t("coachai_intensity_intense")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("coachai_duration")}</Label>
              <Input type="number" min={5} max={360} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("coachai_num_players")}</Label>
              <Input type="number" min={1} max={40} value={players} onChange={(e) => setPlayers(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label>{t("coachai_num_coaches")}</Label>
              <Input type="number" min={1} max={12} value={coaches} onChange={(e) => setCoaches(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("coachai_age_group")}</Label>
              <Input value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} placeholder="U14" />
            </div>
            <div className="grid gap-2">
              <Label>{t("coachai_skill_level")}</Label>
              <Select value={skillLevel} onValueChange={setSkillLevel}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner" data-sort={0}>{t("coachai_skill_beginner")}</SelectItem>
                  <SelectItem value="intermediate" data-sort={1}>{t("coachai_skill_intermediate")}</SelectItem>
                  <SelectItem value="advanced" data-sort={2}>{t("coachai_skill_advanced")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("coachai_gender")}</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t("coachai_gender_male")}</SelectItem>
                  <SelectItem value="female">{t("coachai_gender_female")}</SelectItem>
                  <SelectItem value="mixed">{t("coachai_gender_mixed")}</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("coachai_space")}</Label>
              <Input value={space} onChange={(e) => setSpace(e.target.value)} placeholder="Indoor court" />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t("coachai_equipment")}</Label>
            <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="balls, cones, net" />
          </div>

          <div className="grid gap-2">
            <Label>{t("coachai_notes")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleGenerate} disabled={!canGenerate}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? t("coachai_generating") : t("coachai_generate")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}