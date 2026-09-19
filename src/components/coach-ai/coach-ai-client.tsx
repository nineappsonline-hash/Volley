"use client";

import { useMemo, useState } from "react";
import { Archive, FileText, Plus, Search, Sparkles, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n, type Dict } from "@/lib/i18n";
import { useDevelopmentPlans, usePostSessionReports, useTrainingPlans } from "@/lib/queries-ai";
import { useCurrentProfile } from "@/lib/queries";
import type { TrainingPlan } from "@/lib/types";
import { PlanGenerator } from "./plan-generator";
import { PlanDetail } from "./plan-detail";
import { DevPlanDialog } from "./dev-plan-dialog";

const STATUS_KEYS: Record<string, keyof Dict> = {
  draft: "coachai_status_draft",
  submitted: "coachai_status_submitted",
  approved: "coachai_status_approved",
  rejected: "coachai_status_rejected",
  archived: "coachai_status_archived",
};

function statusTone(status: TrainingPlan["status"]) {
  switch (status) {
    case "approved": return "success";
    case "rejected": return "destructive";
    case "submitted": return "warning";
    case "archived": return "secondary";
    default: return "default";
  }
}

export function CoachAiClient() {
  const { t } = useI18n();
  const { data: profile } = useCurrentProfile();
  const { data: plans, isLoading } = useTrainingPlans();
  const { data: devPlans } = useDevelopmentPlans();
  const { data: reports } = usePostSessionReports();
  const isAdmin = profile?.role === "admin";

  const [tab, setTab] = useState("plans");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (plans ?? []).filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.main_objective ?? "").toLowerCase().includes(q) ||
        (p.sport ?? "").toLowerCase().includes(q)
      );
    });
  }, [plans, search, statusFilter]);

  const templates = useMemo(() => (plans ?? []).filter((p) => p.is_template && p.status !== "archived"), [plans]);
  const activePlans = useMemo(() => filtered.filter((p) => p.status !== "archived"), [filtered]);
  const archivedPlans = useMemo(() => filtered.filter((p) => p.status === "archived"), [filtered]);

  const dirty = () => setOpenPlanId((v) => v);

  return (
    <div className="space-y-6">
      <PageHeader title={t("coachai_title")} subtitle={t("coachai_subtitle")}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDevOpen(true)}>
            <Users className="h-4 w-4" />
            {t("coachai_dev_plans")}
          </Button>
          <Button onClick={() => setGeneratorOpen(true)}>
            <Sparkles className="h-4 w-4" />
            {t("coachai_new_plan")}
          </Button>
        </div>
      </PageHeader>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="plans">{t("coachai_plans")}</TabsTrigger>
          <TabsTrigger value="templates">
            <Star className="h-3.5 w-3.5" />
            {t("coachai_templates")}
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileText className="h-3.5 w-3.5" />
            {t("coachai_my_reports")}
          </TabsTrigger>
        </TabsList>

        {/* Plans */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="ps-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("coachai_search")} />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border bg-transparent px-3 py-2 text-sm"
            >
              <option value="all">{t("coachai_all_statuses")}</option>
              {Object.keys(STATUS_KEYS).map((s) => (
                <option key={s} value={s}>{t(STATUS_KEYS[s])}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : activePlans.length === 0 && archivedPlans.length === 0 ? (
            <EmptyState message={t("coachai_empty")} icon={Sparkles} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activePlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} onOpen={() => setOpenPlanId(plan.id)} statusKey={t(STATUS_KEYS[plan.status] ?? "coachai_status_draft")} tone={statusTone(plan.status)} isAdmin={isAdmin} onDirty={dirty} />
                ))}
              </div>
              {archivedPlans.length > 0 && (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Archive className="h-4 w-4" /> {t("coachai_status_archived")}
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {archivedPlans.map((plan) => (
                      <PlanCard key={plan.id} plan={plan} onOpen={() => setOpenPlanId(plan.id)} statusKey={t("coachai_status_archived")} tone="secondary" isAdmin={isAdmin} onDirty={dirty} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates" className="space-y-4">
          {templates.length === 0 ? (
            <EmptyState message={t("coachai_no_templates")} icon={Star} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((plan) => (
                <PlanCard key={plan.id} plan={plan} onOpen={() => setOpenPlanId(plan.id)} statusKey={plan.template_name ?? t("coachai_templates")} tone="default" isAdmin={isAdmin} onDirty={dirty} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="space-y-4">
          {!reports || reports.length === 0 ? (
            <EmptyState message={t("coachai_no_reports")} icon={FileText} />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-bold">
                        {report.plan?.title ?? t("coachai_report_no_plan")}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t("coachai_report_updated")} {new Date(report.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    {report.notes && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{report.notes}</p>
                    )}
                    {(report.skills_improved ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {report.skills_improved.slice(0, 4).map((s, i) => (
                          <Badge key={i} variant="success" className="text-[11px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PlanGenerator open={generatorOpen} onOpenChange={setGeneratorOpen} onSaved={dirty} />
      <DevPlanDialog open={devOpen} onOpenChange={setDevOpen} onDirty={dirty} />
      {openPlanId && <PlanDetail planId={openPlanId} open onOpenChange={(o) => !o && setOpenPlanId(null)} onDirty={dirty} />}
    </div>
  );
}

function PlanCard({ plan, onOpen, statusKey, tone, isAdmin, onDirty }: {
  plan: TrainingPlan;
  onOpen: () => void;
  statusKey: string;
  tone: "default" | "success" | "destructive" | "warning" | "secondary";
  isAdmin: boolean;
  onDirty: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md" onClick={onOpen}>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-bold">{plan.title}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {plan.sport ?? "—"} · {plan.session_duration_min}{t("coachai_duration_minutes")} · {t("coachai_version")} {plan.version}
            </p>
          </div>
          <Badge variant={tone as "default" | "success" | "destructive" | "warning" | "secondary"}>{statusKey}</Badge>
        </div>
        {plan.main_objective && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{plan.main_objective}</p>
        )}
        {(plan.skill_focus ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {plan.skill_focus.slice(0, 4).map((s, i) => (
              <Badge key={i} variant="outline" className="text-[11px]">{s}</Badge>
            ))}
          </div>
        )}
        {plan.is_favorite && (
          <span className="ms-auto text-attention-500"><Star className="h-4 w-4 fill-attention-400" /></span>
        )}
      </CardContent>
    </Card>
  );
}