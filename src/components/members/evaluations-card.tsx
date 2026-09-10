"use client";

import { TrainingGoals } from "@/components/workflows/player-workflows";
import { useState } from "react";
import { format } from "date-fns";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { EmptyState } from "@/components/shared/empty-state";
import { useRealtime } from "@/lib/useRealtime";
import { useI18n } from "@/lib/i18n";
import { errorMessage, todayInput } from "@/lib/utils";
import {
  useCoaches,
  useDeleteEvaluation,
  useEvaluations,
  useSaveEvaluation,
} from "@/lib/queries";
import type { PlayerEvaluation } from "@/lib/types";

const AXES = [
  { key: "technique", label: "eval_technique" },
  { key: "tactics", label: "eval_tactics" },
  { key: "fitness", label: "eval_fitness" },
  { key: "attitude", label: "eval_attitude" },
] as const;

interface EvaluationsCardProps {
  memberId: string;
  isAdmin: boolean;
}

export function EvaluationsCard({ memberId, isAdmin }: EvaluationsCardProps) {
  const { t, locale, lang } = useI18n();
  const ar = lang === "ar";
  useRealtime(["player_evaluations"]);
  const { data: evaluations, isLoading, isError, refetch } = useEvaluations(memberId);
  const { data: coaches } = useCoaches();
  const save = useSaveEvaluation();
  const remove = useDeleteEvaluation();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlayerEvaluation | null>(null);
  const [date, setDate] = useState(todayInput());
  const [coachId, setCoachId] = useState("none");
  const [scores, setScores] = useState<Record<string, number>>({
    technique: 3,
    tactics: 3,
    fitness: 3,
    attitude: 3,
  });
  const [notes, setNotes] = useState("");

  const openNew = () => {
    setEditing(null);
    setDate(todayInput());
    setCoachId("none");
    setScores({ technique: 3, tactics: 3, fitness: 3, attitude: 3 });
    setNotes("");
    setOpen(true);
  };

  const openEdit = (e: PlayerEvaluation) => {
    setEditing(e);
    setDate(e.evaluation_date);
    setCoachId(e.evaluated_by ?? "none");
    setScores({
      technique: e.technique,
      tactics: e.tactics,
      fitness: e.fitness,
      attitude: e.attitude,
    });
    setNotes(e.notes ?? "");
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        id: editing?.id,
        member_id: memberId,
        evaluation_date: date,
        evaluated_by: coachId === "none" ? null : coachId,
        technique: scores.technique,
        tactics: scores.tactics,
        fitness: scores.fitness,
        attitude: scores.attitude,
        notes: notes.trim() || null,
      });
      toast.success(t("eval_saved"));
      setOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success(t("eval_deleted"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const avg = (e: PlayerEvaluation) =>
    Math.round(((e.technique + e.tactics + e.fitness + e.attitude) / 4) * 10) / 10;

  const latest = evaluations?.[0];
  const previous = evaluations?.[1];

  return (
    <><TrainingGoals memberId={memberId} canEdit={isAdmin}/><Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-primary" />
          {t("eval_title")}
        </CardTitle>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" />
            {t("eval_add")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{ar ? "تابع تقييم المدرب وملاحظاته، وقارن آخر تقييم باللي قبله. كل درجة من 5." : "Review coach feedback and compare the latest evaluation with the previous one. Scores are out of 5."}</p>
        {isLoading ? <p role="status" className="text-sm text-muted-foreground">{ar ? "جاري تحميل التقييمات…" : "Loading evaluations…"}</p>
          : isError ? <div role="alert"><p className="text-sm text-error-ink">{ar ? "تعذر تحميل التقييمات" : "Could not load evaluations"}</p><Button variant="outline" onClick={() => void refetch()}>{ar ? "حاول تاني" : "Retry"}</Button></div>
          : !evaluations || evaluations.length === 0 ? (
          <EmptyState message={t("eval_empty")} icon={ClipboardList} />
        ) : (
          <>
            {latest && <div className="rounded-lg border bg-info/5 p-3 space-y-3">
              <h3 className="text-sm font-semibold">{ar ? "التطور من آخر تقييم" : "Change since previous evaluation"}</h3>
              {previous ? <p className="text-xs text-muted-foreground">{format(new Date(previous.evaluation_date + "T00:00:00"), "MMM d, yyyy", { locale })} → {format(new Date(latest.evaluation_date + "T00:00:00"), "MMM d, yyyy", { locale })}</p> : <p className="text-xs text-muted-foreground">{ar ? "ده أول تقييم. التغير هيظهر بعد التقييم الجاي." : "This is the first evaluation. Changes appear after the next assessment."}</p>}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{AXES.map(({key, label}) => {
                const change = previous ? latest[key] - previous[key] : null;
                return <div key={key}><p className="text-xs text-muted-foreground">{t(label)}</p><p className="font-semibold">{latest[key]}/5</p>
                  {change != null && <p className={`text-xs ${change > 0 ? "text-success-ink" : change < 0 ? "text-warning-ink" : "text-muted-foreground"}`}>{change > 0 ? "+" : ""}{change} {ar ? "نقطة" : "points"}</p>}
                </div>;
              })}</div>
            </div>}
          {evaluations.map((e) => (
              <div key={e.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {format(new Date(e.evaluation_date + "T00:00:00"), "MMM d, yyyy", { locale })}
                      <span className="font-mono text-xs text-muted-foreground">
                        {t("eval_average")}: {avg(e)}
                      </span>
                      {e.evaluated_by && (
                        <span className="text-xs text-muted-foreground">
                          {t("eval_by")}{" "}
                          {(coaches ?? []).find((c) => c.id === e.evaluated_by)?.name ?? (ar ? "المدرب" : "Coach")}
                        </span>
                      )}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                      {AXES.map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {t(label)}
                          </span>
                          <span className="font-mono text-xs font-bold">
                            {e[key]}/5
                          </span>
                        </div>
                      ))}
                    </div>
                    {e.notes && (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {e.notes}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={t("common_edit")}
                        onClick={() => openEdit(e)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        disabled={remove.isPending}
                        onClick={() => handleDelete(e.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("eval_edit") : t("eval_add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("eval_date")}</Label>
                <Input
                  type="date"
                  dir="ltr"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("eval_by")}</Label>
                <Select value={coachId} onValueChange={setCoachId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {(coaches ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {AXES.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{t(label)}</Label>
                  <span className="font-mono text-sm font-bold">{scores[key]}/5</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={scores[key]}
                  onChange={(e) =>
                    setScores((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                  }
                  className="w-full accent-primary"
                />
              </div>
            ))}
            <div className="space-y-2">
              <Label>{t("eval_notes")}</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common_cancel")}
            </Button>
            <Button disabled={save.isPending} onClick={handleSave}>
              {save.isPending ? t("common_saving") : t("common_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card></>
  );
}
