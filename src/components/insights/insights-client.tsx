"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Download,
  Loader2,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n, type Dict } from "@/lib/i18n";
import { useTeams, useProfiles } from "@/lib/queries";
import {
  aiQueryKeys,
  useAcademyInsights,
  useAlerts,
  usePredictionSettings,
  usePredictionScores,
  useSetPredictionSettings,
} from "@/lib/queries-ai";
import { downloadCSV } from "@/lib/export";
import { errorMessage } from "@/lib/utils";
import type {
  AcademyAlert,
  AlertStatus,
  AlertType,
  PredictionScore,
  RiskLevel,
} from "@/lib/types";

const ALERT_TYPE_KEYS: Record<AlertType, keyof Dict> = {
  no_attendance: "insights_alert_type_no_attendance",
  payment_overdue: "insights_alert_type_payment_overdue",
  retention_trajectory: "insights_alert_type_retention_trajectory",
  utilization_low: "insights_alert_type_utilization_low",
  revenue_drop: "insights_alert_type_revenue_drop",
  enrollment_decline: "insights_alert_type_enrollment_decline",
};

const ALERT_STATUS_KEYS: Record<AlertStatus, keyof Dict> = {
  new: "insights_alert_status_new",
  acknowledged: "insights_alert_status_acknowledged",
  in_progress: "insights_alert_status_in_progress",
  resolved: "insights_alert_status_resolved",
  dismissed: "insights_alert_status_dismissed",
};

const LEVEL_KEYS: Record<RiskLevel, keyof Dict> = {
  low: "insights_score_level_low",
  medium: "insights_score_level_medium",
  high: "insights_score_level_high",
  not_enough_data: "insights_score_level_not_enough_data",
};

const DEFAULT_THRESHOLDS = {
  payment_gap_days: 90,
  attendance_gap_days: 30,
  utilization_low_pct: 30,
  revenue_drop_pct: 20,
  churn_high: 70,
  churn_medium: 40,
};

function scoreTone(level: RiskLevel): "success" | "warning" | "destructive" | "secondary" {
  switch (level) {
    case "low":
      return "success";
    case "medium":
      return "warning";
    case "high":
      return "destructive";
    default:
      return "secondary";
  }
}

function severityTone(severity: AcademyAlert["severity"]): "secondary" | "warning" | "destructive" {
  switch (severity) {
    case "high":
      return "destructive";
    case "medium":
      return "warning";
    default:
      return "secondary";
  }
}

function statusTone(status: AlertStatus): "default" | "secondary" | "warning" | "success" {
  switch (status) {
    case "resolved":
      return "success";
    case "in_progress":
      return "warning";
    case "new":
      return "default";
    default:
      return "secondary";
  }
}

interface ScoreComponents {
  factor: string;
  label: string;
  weight: number;
  contribution: number;
}

export function InsightsClient() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const insights = useAcademyInsights();
  const churn = usePredictionScores("churn_risk");
  const utilization = usePredictionScores("utilization_risk");
  const alerts = useAlerts(true);
  const settings = usePredictionSettings();
  const saveSettings = useSetPredictionSettings();
  const { data: profiles } = useProfiles();
  const { data: teams } = useTeams();

  const [tab, setTab] = useState("overview");
  const [predictView, setPredictView] = useState<"members" | "teams">("members");
  const [recalculating, setRecalculating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [whyOpenId, setWhyOpenId] = useState<string | null>(null);

  const memberName = useMemo(() => new Map((profiles ?? []).map((p) => [p.id, p.name])), [profiles]);
  const teamName = useMemo(() => new Map((teams ?? []).map((t) => [t.id, t.name])), [teams]);

  const latest = insights.data?.[0];
  const metrics = latest?.metrics as Record<string, unknown> | undefined;

  const latestPeriod = useMemo(() => {
    const period = churn.data?.[0]?.period_key;
    return churn.data?.filter((s) => s.period_key === period) ?? [];
  }, [churn.data]);

  const churnSummary = useMemo(() => {
    const byLevel: Record<string, number> = {};
    for (const s of latestPeriod) byLevel[s.level] = (byLevel[s.level] ?? 0) + 1;
    return byLevel;
  }, [latestPeriod]);

  const recalc = async () => {
    setRecalculating(true);
    try {
      const res = await fetch("/api/insights/recalculate", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Recalculation failed");
      await qc.invalidateQueries({ queryKey: aiQueryKeys.insights });
      await qc.invalidateQueries({ queryKey: aiQueryKeys.predictionScores() });
      await qc.invalidateQueries({ queryKey: aiQueryKeys.alerts() });
      toast.success(t("insights_recalculated"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setRecalculating(false);
    }
  };

  const exportCSV = () => {
    const headers = [t("insights_members_view"), t("insights_churn_risk"), t("insights_factor_weight"), t("insights_why_title")];
    const rows = latestPeriod.map((s) => [
      memberName.get(s.entity_id) ?? s.entity_id.slice(0, 8),
      s.score == null ? "—" : String(s.score),
      s.level,
      (s.explanation?.headline as string) ?? "",
    ]);
    downloadCSV(headers, rows, `insights-churn-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const actOnAlert = async (alert: AcademyAlert, action: string, note?: string) => {
    try {
      const res = await fetch(`/api/insights/alerts/${alert.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note ?? null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Action failed");
      await qc.invalidateQueries({ queryKey: aiQueryKeys.alerts() });
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const enabledAlertTypes = (settings.data?.enabled_alerts?.length ? settings.data.enabled_alerts : Object.keys(ALERT_TYPE_KEYS)) as AlertType[];

  const toggleAlert = (type: AlertType) => {
    const next = enabledAlertTypes.includes(type)
      ? enabledAlertTypes.filter((x) => x !== type)
      : [...enabledAlertTypes, type];
    saveSettings.mutate({ enabledAlerts: next });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("insights_title")} subtitle={t("insights_subtitle")}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4" />
            {t("insights_export_csv")}
          </Button>
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
            {t("insights_settings")}
          </Button>
          <Button onClick={recalc} disabled={recalculating}>
            {recalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            {recalculating ? t("insights_recalculating") : t("insights_recalculate")}
          </Button>
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview">{t("insights_kpis")}</TabsTrigger>
          <TabsTrigger value="predictions">{t("insights_predictions")}</TabsTrigger>
          <TabsTrigger value="alerts">{t("insights_alerts")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              icon={Users}
              label={t("insights_active_members")}
              value={typeof metrics?.active_members === "number" ? String(metrics.active_members) : "—"}
            />
            <StatCard
              icon={Wallet}
              label={t("insights_expected_paying")}
              value={typeof metrics?.expected_paying_members === "number" ? String(metrics.expected_paying_members) : "—"}
            />
            <StatCard
              icon={Activity}
              label={t("insights_expected_revenue")}
              value={typeof metrics?.expected_revenue_next === "number" ? `$${Number(metrics.expected_revenue_next).toFixed(0)}` : "—"}
            />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">{t("insights_churn_risk")}</CardTitle>
            </CardHeader>
            <CardContent>
              {latestPeriod.length === 0 ? (
                <EmptyState message={t("insights_empty")} icon={Users} />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(["high", "medium", "low", "not_enough_data"] as RiskLevel[]).map((level) => (
                    <div key={level} className="rounded-lg border bg-muted/30 p-3 text-center">
                      <p className="text-2xl font-bold">{churnSummary[level] ?? 0}</p>
                      <Badge variant={scoreTone(level)}>{t(LEVEL_KEYS[level])}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">{t("insights_recent_periods")}</CardTitle>
            </CardHeader>
            <CardContent>
              {(insights.data ?? []).length === 0 ? (
                <EmptyState message={t("insights_empty")} icon={Activity} />
              ) : (
                <div className="divide-y">
                  {(insights.data ?? []).slice(0, 12).map((row) => {
                    const m = row.metrics as Record<string, unknown>;
                    return (
                      <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span className="font-semibold">{row.period_key}</span>
                        <span className="text-muted-foreground">
                          {typeof m.active_members === "number" ? `${m.active_members} members` : "—"}
                        </span>
                        <span className="text-muted-foreground">
                          {typeof m.expected_revenue_next === "number" ? `$${Number(m.expected_revenue_next).toFixed(0)}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant={predictView === "members" ? "default" : "outline"} onClick={() => setPredictView("members")}>
              {t("insights_members_view")}
            </Button>
            <Button size="sm" variant={predictView === "teams" ? "default" : "outline"} onClick={() => setPredictView("teams")}>
              {t("insights_teams_view")}
            </Button>
          </div>

          {predictView === "members" ? (
            latestPeriod.length === 0 ? (
              <EmptyState message={t("insights_empty")} icon={Users} />
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {latestPeriod.map((s) => (
                  <ScoreCard
                    key={s.id}
                    score={s}
                    name={memberName.get(s.entity_id) ?? s.entity_id}
                    whyOpen={whyOpenId === s.id}
                    onToggleWhy={() => setWhyOpenId(whyOpenId === s.id ? null : s.id)}
                  />
                ))}
              </div>
            )
          ) : utilization.data?.length ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {utilization.data.slice(0, 12).map((s) => (
                <ScoreCard
                  key={s.id}
                  score={s}
                  name={teamName.get(s.entity_id) ?? s.entity_id}
                  whyOpen={whyOpenId === s.id}
                  onToggleWhy={() => setWhyOpenId(whyOpenId === s.id ? null : s.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState message={t("insights_empty")} icon={Activity} />
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertList alerts={alerts.data ?? []} loading={alerts.isLoading} names={{ memberName, teamName }} onAct={actOnAlert} t={t} />
        </TabsContent>
      </Tabs>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        enabledAlerts={enabledAlertTypes}
        onToggleAlert={toggleAlert}
        onSave={() => toast.success(t("insights_settings_saved"))}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreCard({ score, name, whyOpen, onToggleWhy }: {
  score: PredictionScore;
  name: string;
  whyOpen: boolean;
  onToggleWhy: () => void;
}) {
  const { t } = useI18n();
  const components = (score.explanation?.score_components as ScoreComponents[] | undefined) ?? [];
  const pct = typeof score.explanation?.utilization_pct === "number" ? Number(score.explanation.utilization_pct) : null;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-bold">{name}</p>
            <p className="text-xs text-muted-foreground">
              {score.score_type === "utilization_risk" && pct !== null ? `${pct}% utilization` : score.period_key}
            </p>
          </div>
          <Badge variant={scoreTone(score.level)}>{t(LEVEL_KEYS[score.level])}</Badge>
        </div>

        {score.score != null ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(0, Math.min(100, score.score))}%` }}
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("insights_score_level_not_enough_data")}</p>
        )}

        {components.length > 0 && (
          <>
            <button
              type="button"
              onClick={onToggleWhy}
              className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {t("insights_why_title")}
              <ChevronDown className={`h-4 w-4 transition-transform ${whyOpen ? "rotate-180" : ""}`} />
            </button>
            {whyOpen && (
              <div className="space-y-1.5">
                {components.map((c) => (
                  <div key={c.factor} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="font-semibold">
                      {c.contribution} <span className="text-muted-foreground">({Math.round(c.weight * 100)}% {t("insights_factor_weight")})</span>
                    </span>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-muted-foreground">
                  {typeof score.explanation?.headline === "string" ? score.explanation.headline : ""}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AlertList({ alerts, loading, names, onAct, t }: {
  alerts: AcademyAlert[];
  loading: boolean;
  names: { memberName: Map<string, string>; teamName: Map<string, string> };
  onAct: (alert: AcademyAlert, action: string, note?: string) => Promise<void>;
  t: (key: keyof Dict) => string;
}) {
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (loading) return <div className="space-y-2"><div className="h-24 rounded-lg bg-muted/50 animate-pulse" /><div className="h-24 rounded-lg bg-muted/50 animate-pulse" /></div>;
  if (alerts.length === 0) return <EmptyState message={t("insights_empty")} icon={AlertTriangle} />;

  const resolveName = (a: AcademyAlert) => {
    if (a.entity_type === "team") return names.teamName.get(a.entity_id) ?? null;
    if (a.entity_type === "member") return names.memberName.get(a.entity_id) ?? null;
    return null;
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const entityName = resolveName(alert);
        return (
          <Card key={alert.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={severityTone(alert.severity)}>{alert.severity}</Badge>
                <Badge variant="outline">{t(ALERT_TYPE_KEYS[alert.alert_type])}</Badge>
                <Badge variant={statusTone(alert.status)}>{t(ALERT_STATUS_KEYS[alert.status])}</Badge>
                {entityName && <span className="text-xs text-muted-foreground">{entityName}</span>}
              </div>
              <p className="text-sm font-semibold">{alert.title}</p>
              {alert.body && <p className="text-sm text-muted-foreground">{alert.body}</p>}
              {alert.recommended_action && (
                <p className="text-xs text-info-ink">{alert.recommended_action}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {alert.status === "new" && (
                  <Button size="sm" variant="outline" onClick={() => onAct(alert, "acknowledged")}>{t("insights_action_acknowledge")}</Button>
                )}
                {(alert.status === "new" || alert.status === "acknowledged") && (
                  <Button size="sm" variant="outline" onClick={() => onAct(alert, "in_progress")}>{t("insights_action_start")}</Button>
                )}
                {alert.status === "in_progress" && (
                  <Button size="sm" variant="outline" onClick={() => onAct(alert, "contacted")}>{t("insights_action_contacted")}</Button>
                )}
                {(alert.status === "acknowledged" || alert.status === "in_progress" || alert.status === "new") && (
                  <Button size="sm" variant="success" onClick={() => onAct(alert, "resolved")}>{t("insights_action_resolve")}</Button>
                )}
                {alert.status !== "dismissed" && (
                  <Button size="sm" variant="ghost" onClick={() => onAct(alert, "dismissed")}>{t("insights_action_dismiss")}</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => { setNoteFor(noteFor === alert.id ? null : alert.id); setNote(""); }}>
                  {t("insights_action_note")}
                </Button>
              </div>

              {noteFor === alert.id && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("insights_action_note")} className="min-w-48 flex-1" />
                  <Button
                    size="sm"
                    disabled={!note.trim()}
                    onClick={() => onAct(alert, "note", note.trim()).then(() => setNoteFor(null))}
                  >
                    {t("insights_save_settings")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SettingsDialog({ open, onOpenChange, enabledAlerts, onToggleAlert, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabledAlerts: AlertType[];
  onToggleAlert: (type: AlertType) => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const settings = usePredictionSettings();
  const saveSettings = useSetPredictionSettings();
  const [form, setForm] = useState<Record<string, string>>({});

  const current = settings.data?.thresholds ?? {};
  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const next: Record<string, number> = {};
    for (const key of ["payment_gap_days", "attendance_gap_days", "utilization_low_pct", "revenue_drop_pct", "churn_high", "churn_medium"]) {
      const raw = form[key];
      if (raw !== undefined && raw !== "" && !Number.isNaN(Number(raw))) next[key] = Number(raw);
    }
    if (Object.keys(next).length) saveSettings.mutate({ thresholds: next });
    onSave();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("insights_settings")}</DialogTitle>
          <DialogDescription>{t("insights_subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold">{t("insights_kpis")}</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["payment_gap_days", "insights_threshold_payment_gap"],
                ["attendance_gap_days", "insights_threshold_attendance_gap"],
                ["utilization_low_pct", "insights_threshold_utilization_low"],
                ["revenue_drop_pct", "insights_threshold_revenue_drop"],
                ["churn_high", "insights_threshold_churn_high"],
                ["churn_medium", "insights_threshold_churn_medium"],
              ] as const).map(([key, labelKey]) => (
                <div key={key} className="grid gap-1">
                  <Label>{t(labelKey)}</Label>
                  <Input
                    type="number"
                    defaultValue={String(current[key as keyof typeof current] ?? DEFAULT_THRESHOLDS[key as keyof typeof DEFAULT_THRESHOLDS])}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">{t("insights_enabled_alerts")}</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ALERT_TYPE_KEYS) as AlertType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onToggleAlert(type)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    enabledAlerts.includes(type)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-card text-muted-foreground"
                  }`}
                >
                  {t(ALERT_TYPE_KEYS[type])}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={submit}>{t("insights_save_settings")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}