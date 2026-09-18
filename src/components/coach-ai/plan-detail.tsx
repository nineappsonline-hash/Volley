"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Check,
  Copy,
  Heart,
  Loader2,
  Star,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useI18n, type Dict } from "@/lib/i18n";
import {
  useArchivePlan,
  useAssignPlan,
  useDecideTrainingPlan,
  useDuplicatePlan,
  useRestorePlan,
  useSavePostSessionReport,
  useSubmitTrainingPlan,
  useTogglePlanFlags,
  useTrainingPlan,
  useUnassignPlan,
} from "@/lib/queries-ai";
import { useCurrentProfile, useUpcomingSessions } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";
import type { TrainingPlan } from "@/lib/types";

const STATUS_KEYS = {
  draft: "coachai_status_draft",
  submitted: "coachai_status_submitted",
  approved: "coachai_status_approved",
  rejected: "coachai_status_rejected",
  archived: "coachai_status_archived",
} as const;

function statusTone(status: TrainingPlan["status"]) {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "destructive";
    case "submitted":
      return "warning";
    case "archived":
      return "secondary";
    default:
      return "default";
  }
}

interface PlanDetailProps {
  planId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDirty?: () => void;
}

export function PlanDetail({ planId, open, onOpenChange, onDirty }: PlanDetailProps) {
  const { t } = useI18n();
  const { data: profile } = useCurrentProfile();
  const { data: plan, isLoading } = useTrainingPlan(planId);
  const { data: upcomingSessions } = useUpcomingSessions();

  const isAdmin = profile?.role === "admin";

  const submit = useSubmitTrainingPlan();
  const decide = useDecideTrainingPlan();
  const archive = useArchivePlan();
  const restore = useRestorePlan();
  const duplicate = useDuplicatePlan();
  const toggleFlags = useTogglePlanFlags();
  const assign = useAssignPlan();
  const unassign = useUnassignPlan();
  const saveReport = useSavePostSessionReport();

  const [decisionNote, setDecisionNote] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [aiReport, setAiReport] = useState<{ skills_improved: string[]; skills_need_work: string[]; performance_rating: number | null; intensity_rating: number | null; engagement_rating: number | null; summary: string } | null>(null);
  const [drafting, setDrafting] = useState(false);

  const run = async (fn: () => Promise<unknown>, successKey: keyof Dict) => {
    try {
      await fn();
      toast.success(t(successKey));
      onDirty?.();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleAIDraft = async () => {
    if (!plan || !reportNotes.trim()) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/coach-ai/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, notes: reportNotes }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Drafting failed");
      setAiReport(body.report);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setDrafting(false);
    }
  };

  const handleSaveReport = async () => {
    if (!plan) return;
    await run(
      () =>
        saveReport.mutateAsync({
          plan_id: plan.id,
          notes: reportNotes || aiReport?.summary || null,
          skills_improved: aiReport?.skills_improved ?? [],
          skills_need_work: aiReport?.skills_need_work ?? [],
          performance_rating: aiReport?.performance_rating ?? null,
          intensity_rating: aiReport?.intensity_rating ?? null,
          engagement_rating: aiReport?.engagement_rating ?? null,
        }),
      "coachai_report_saved"
    );
  };

  const isLocked = plan?.status === "approved" || plan?.status === "archived";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{plan?.title ?? t("coachai_open")}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {plan && (
              <>
                <Badge variant={statusTone(plan.status) as "success" | "destructive" | "warning" | "secondary" | "default"}>
                  {t(STATUS_KEYS[plan.status] ?? "coachai_status_draft")}
                </Badge>
                {plan.team_id && <span>{t("coachai_team")}</span>}
                {plan.sport && <span>{plan.sport}</span>}
                <span>{plan.session_duration_min}{t("coachai_duration_minutes")}</span>
                <span>{t("coachai_version")} {plan.version}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !plan ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("common_error")}</p>
        ) : (
          <div className="space-y-4">
            {plan.main_objective && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <strong>{t("coachai_main_objective")}: </strong>
                {plan.main_objective}
              </div>
            )}
            {plan.secondary_objectives.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {plan.secondary_objectives.map((o, i) => (
                  <Badge key={i} variant="outline">{o}</Badge>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {plan.status === "draft" || plan.status === "rejected" ? (
                <Button size="sm" onClick={() => run(() => submit.mutateAsync(plan.id), "coachai_submitted_ok")}>
                  {t("coachai_submit")}
                </Button>
              ) : null}
              {plan.status === "submitted" && (
                <>
                  <Button size="sm" variant="success" onClick={() => run(() => decide.mutateAsync({ id: plan.id, approved: true, reason: decisionNote }), "coachai_decided_ok")}>
                    <Check className="h-4 w-4" /> {t("coachai_approve")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => run(() => decide.mutateAsync({ id: plan.id, approved: false, reason: decisionNote }), "coachai_decided_ok")}>
                    <X className="h-4 w-4" /> {t("coachai_reject")}
                  </Button>
                </>
              )}
              {(plan.status === "draft" || plan.status === "rejected" || plan.status === "approved") && (
                <Button size="sm" variant="outline" onClick={() => run(() => archive.mutateAsync(plan.id), "coachai_archived_ok")}>
                  <Archive className="h-4 w-4" /> {t("coachai_archive")}
                </Button>
              )}
              {plan.status === "archived" && (
                <Button size="sm" variant="outline" onClick={() => run(() => restore.mutateAsync(plan.id), "coachai_restored_ok")}>
                  {t("coachai_restore")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => run(() => duplicate.mutateAsync(plan.id), "coachai_duplicated_ok")}>
                <Copy className="h-4 w-4" /> {t("coachai_duplicate")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => run(() => toggleFlags.mutateAsync({ id: plan.id, favorite: !plan.is_favorite }), "coachai_saved_ok")}>
                <Heart className={`h-4 w-4 ${plan.is_favorite ? "fill-negative-400 text-negative-500" : ""}`} /> {t("coachai_favorite")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => run(() => toggleFlags.mutateAsync({ id: plan.id, isTemplate: !plan.is_template }), "coachai_saved_ok")}>
                <Star className={`h-4 w-4 ${plan.is_template ? "fill-attention-400 text-attention-500" : ""}`} /> {t("coachai_templates")}
              </Button>
            </div>

            {plan.status === "submitted" && (
              <div className="grid gap-2">
                <Label>{t("coachai_approval_note")}</Label>
                <Textarea value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} rows={2} />
              </div>
            )}
            {plan.approval_note && (
              <p className="text-xs text-muted-foreground">{t("coachai_approval_reason")}: {plan.approval_note}</p>
            )}

            {/* Sections */}
            <div className="space-y-3">
              {(plan.sections ?? []).map((section, i) => (
                <Card key={section.id ?? i}>
                  <CardHeader className="flex flex-row items-center justify-between py-3">
                    <CardTitle className="text-sm font-bold">
                      {i + 1}. {section.title}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">{section.duration_min}{t("coachai_duration_minutes")}</span>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {section.exercises?.map((ex, j) => (
                      <div key={ex.id ?? j} className="rounded-lg border bg-muted/30 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{ex.name}</p>
                          <span className="text-xs text-muted-foreground">{ex.duration_min}{t("coachai_duration_minutes")}</span>
                        </div>
                        {ex.equipment?.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">{t("coachai_equipment_missing")}: {ex.equipment.join(", ")}</p>
                        )}
                        {ex.instructions?.length > 0 && (
                          <ol className="mt-2 list-inside list-decimal space-y-0.5 text-xs text-muted-foreground">
                            {ex.instructions.map((step, k) => <li key={k}>{step}</li>)}
                          </ol>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Assign to session */}
            <div className="grid gap-2">
              <Label>{t("coachai_assign")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={sessionId} onValueChange={setSessionId}>
                  <SelectTrigger className="min-w-52"><SelectValue placeholder={t("coachai_select_session")} /></SelectTrigger>
                  <SelectContent>
                    {(upcomingSessions ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.date} {s.time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" disabled={!sessionId} onClick={() => run(() => assign.mutateAsync({ planId: plan.id, sessionIds: [sessionId] }), "coachai_assign_success")}>
                  {t("coachai_save")}
                </Button>
              </div>
            </div>

            {/* Post-session report */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-bold">{t("coachai_report_title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <Label>{t("coachai_report_notes")}</Label>
                  <Textarea value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} rows={3} placeholder="e.g. Reception improved late in the session; serve accuracy needs work…" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleAIDraft} disabled={drafting || !reportNotes.trim()}>
                    {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SparklesIcon />} {t("coachai_report_ai")}
                  </Button>
                  <Button size="sm" onClick={handleSaveReport}>{t("coachai_report_save")}</Button>
                </div>
                {aiReport && (
                  <div className="space-y-3 text-sm">
                    {aiReport.summary && <p className="rounded-lg border bg-muted/30 p-3">{aiReport.summary}</p>}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("coachai_report_skills_improved")}</p>
                        {(aiReport.skills_improved ?? []).map((s, i) => <Badge key={i} variant="outline" className="mb-1 me-1">{s}</Badge>)}
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("coachai_report_skills_work")}</p>
                        {(aiReport.skills_need_work ?? []).map((s, i) => <Badge key={i} variant="outline" className="mb-1 me-1">{s}</Badge>)}
                      </div>
                    </div>
                    {(aiReport.performance_rating ?? aiReport.intensity_rating ?? aiReport.engagement_rating) && (
                      <p className="text-xs text-muted-foreground">
                        {t("coachai_report_performance")}: {aiReport.performance_rating ?? "—"} · {t("coachai_report_intensity")}: {aiReport.intensity_rating ?? "—"} · {t("coachai_report_engagement")}: {aiReport.engagement_rating ?? "—"}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SparklesIcon() {
  return <span className="text-[10px] leading-none">✦</span>;
}