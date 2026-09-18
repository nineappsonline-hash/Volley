"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, UserPlus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { useProfiles } from "@/lib/queries";
import { useSaveDevPlan } from "@/lib/queries-ai";
import { errorMessage } from "@/lib/utils";

interface DevPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDirty?: () => void;
}

export function DevPlanDialog({ open, onOpenChange, onDirty }: DevPlanDialogProps) {
  const { t } = useI18n();
  const { data: profiles } = useProfiles();
  const saveDevPlan = useSaveDevPlan();

  const [playerId, setPlayerId] = useState("");
  const [position, setPosition] = useState("");
  const [strengths, setStrengths] = useState("");
  const [areas, setAreas] = useState("");
  const [shortGoals, setShortGoals] = useState("");
  const [longGoals, setLongGoals] = useState("");
  const [drills, setDrills] = useState("");
  const [weekly, setWeekly] = useState("");
  const [checkpoints, setCheckpoints] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [visibility, setVisibility] = useState("academy");
  const [privateNotes, setPrivateNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const players = (profiles ?? []).filter((p) => p.role === "member");

  const reset = () => {
    setPlayerId(""); setPosition(""); setStrengths(""); setAreas("");
    setShortGoals(""); setLongGoals(""); setDrills(""); setWeekly("");
    setCheckpoints(""); setReviewDate(""); setVisibility("academy"); setPrivateNotes("");
  };

  const handleOpenChange = (next: boolean) => {
    if (next) reset();
    onOpenChange(next);
  };

  const splitList = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);

  const handleGenerate = async () => {
    if (!playerId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/coach-ai/development", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, existing: { strengths: splitList(strengths), areas_to_improve: splitList(areas) } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Generation failed");
      setPosition(body.plan.position ?? "");
      setStrengths((body.plan.strengths ?? []).join("\n"));
      setAreas((body.plan.areas_to_improve ?? []).join("\n"));
      setShortGoals((body.plan.short_term_goals ?? []).join("\n"));
      setLongGoals((body.plan.long_term_goals ?? []).join("\n"));
      setDrills((body.plan.recommended_drills ?? []).join("\n"));
      setWeekly(body.plan.weekly_focus ?? "");
      setCheckpoints((body.plan.progress_checkpoints ?? []).join("\n"));
      setReviewDate(body.plan.review_date ?? "");
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!playerId) return;
    setSaving(true);
    try {
      await saveDevPlan.mutateAsync({
        player_id: playerId,
        position: position || null,
        strengths: splitList(strengths),
        areas_to_improve: splitList(areas),
        short_term_goals: splitList(shortGoals),
        long_term_goals: splitList(longGoals),
        recommended_drills: splitList(drills),
        weekly_focus: weekly || null,
        progress_checkpoints: splitList(checkpoints),
        review_date: reviewDate || null,
        visibility,
        private_notes: privateNotes || null,
      });
      toast.success(t("coachai_dev_saved"));
      onDirty?.();
      handleOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("coachai_dev_title")}</DialogTitle>
          <DialogDescription>{t("coachai_dev_new")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>{t("coachai_dev_player")}</Label>
            <div className="flex gap-2">
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder={t("coachai_player")} /></SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleGenerate} disabled={!playerId || generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t("coachai_dev_position")}</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label>{t("coachai_dev_strengths")}</Label>
            <Textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} placeholder="one per line" />
          </div>
          <div className="grid gap-2">
            <Label>{t("coachai_dev_areas")}</Label>
            <Textarea value={areas} onChange={(e) => setAreas(e.target.value)} rows={2} placeholder="one per line" />
          </div>
          <div className="grid gap-2">
            <Label>{t("coachai_dev_short")}</Label>
            <Textarea value={shortGoals} onChange={(e) => setShortGoals(e.target.value)} rows={2} placeholder="one per line" />
          </div>
          <div className="grid gap-2">
            <Label>{t("coachai_dev_long")}</Label>
            <Textarea value={longGoals} onChange={(e) => setLongGoals(e.target.value)} rows={2} placeholder="one per line" />
          </div>
          <div className="grid gap-2">
            <Label>{t("coachai_dev_drills")}</Label>
            <Textarea value={drills} onChange={(e) => setDrills(e.target.value)} rows={2} placeholder="one per line" />
          </div>
          <div className="grid gap-2">
            <Label>{t("coachai_dev_weekly")}</Label>
            <Textarea value={weekly} onChange={(e) => setWeekly(e.target.value)} rows={2} />
          </div>
          <div className="grid gap-2">
            <Label>{t("coachai_dev_checkpoints")}</Label>
            <Textarea value={checkpoints} onChange={(e) => setCheckpoints(e.target.value)} rows={2} placeholder="one per line" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t("coachai_dev_review")}</Label>
              <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("coachai_dev_visibility")}</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">{t("coachai_dev_visibility_coach")}</SelectItem>
                  <SelectItem value="academy">{t("coachai_dev_visibility_academy")}</SelectItem>
                  <SelectItem value="player">{t("coachai_dev_visibility_player")}</SelectItem>
                  <SelectItem value="parent">{t("coachai_dev_visibility_parent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t("coachai_dev_private")}</Label>
            <Textarea value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!playerId || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {t("common_save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}