"use client";

import { PlatformRecords } from "./platform-records";
import { PlatformAnalytics } from "./platform-analytics";
import { AcademyEditDialog } from "./academy-edit-dialog";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  Crown,
  ExternalLink,
  Eye,
  Flag,
  Pencil,
  Plus,
  Receipt,
  Shield,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import type { Academy } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  useAllAcademies,
  useCommunityMembers,
  useConvertToPaid,
  useExtendTrial,
  usePendingGameFees,
  useReports,
  useResolveReport,
  useReviewGameFee,
  useSetAcademyPlan,
} from "@/lib/queries";

type AcademyPlan = "starter" | "plus" | "elite";

const PLAN_ORDER: AcademyPlan[] = ["starter", "plus", "elite"];

export function SuperAdminDashboard() {
  const { t, lang, locale } = useI18n();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const { data: academies, isLoading } = useAllAcademies();
  const extendTrial = useExtendTrial();
  const convertToPaid = useConvertToPaid();
  const { data: reports } = useReports();
  const { data: members } = useCommunityMembers();
  const resolve = useResolveReport();
  const { data: pendingFees } = usePendingGameFees();
  const reviewGameFee = useReviewGameFee();
  const setAcademyPlan = useSetAcademyPlan();
  const [openingReceipt, setOpeningReceipt] = useState<string | null>(null);
  const [editing, setEditing] = useState<Academy | null>(null);

  const memberName = (id: string) =>
    (members ?? []).find((m) => m.id === id)?.name ?? id.slice(0, 8);

  const stats = useMemo(() => {
    const list = academies ?? [];
    const now = new Date();
    const total = list.length;
    const trials = list.filter((a) => a.is_trial);
    const activeTrials = trials.filter(
      (a) => a.trial_ends_at && new Date(a.trial_ends_at) > now
    );
    const expiredTrials = trials.filter(
      (a) => a.trial_ends_at && new Date(a.trial_ends_at) <= now
    );
    const paid = list.filter((a) => !a.is_trial);
    return { total, trials: trials.length, activeTrials: activeTrials.length, expiredTrials: expiredTrials.length, paid: paid.length };
  }, [academies]);

  const handleExtend = async (academyId: string, days: number) => {
    try {
      await extendTrial.mutateAsync({ academy_id: academyId, days });
      toast.success(t("super_admin_trial_extended"));
    } catch {
      toast.error(t("common_error"));
    }
  };

  const handleConvert = async (academyId: string) => {
    try {
      await convertToPaid.mutateAsync(academyId);
      toast.success(t("super_admin_converted"));
    } catch {
      toast.error(t("common_error"));
    }
  };

  const handleSetPlan = async (academyId: string, plan: AcademyPlan) => {
    try {
      await setAcademyPlan.mutateAsync({ academyId, plan });
      toast.success(t("super_admin_plan_updated"));
    } catch {
      toast.error(t("common_error"));
    }
  };

  const handleReviewFee = async (gameId: string, approve: boolean) => {
    try {
      await reviewGameFee.mutateAsync({ gameId, approve });
      toast.success(
        approve ? t("super_admin_fee_approved") : t("super_admin_fee_rejected")
      );
    } catch {
      toast.error(t("common_error"));
    }
  };

  const handleViewReceipt = async (path: string | null) => {
    if (!path) return;
    setOpeningReceipt(path);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("game-fee-receipts")
        .createSignedUrl(path, 600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("super_admin_fee_receipt_fail"));
    } finally {
      setOpeningReceipt(null);
    }
  };

  const getAcademyStatus = (academy: any) => {
    if (!academy.is_trial) return "paid";
    if (!academy.trial_ends_at) return "trial";
    return new Date(academy.trial_ends_at) > new Date() ? "active_trial" : "expired";
  };

  const getTrialDaysLeft = (academy: any) => {
    if (!academy.trial_ends_at) return null;
    const diff = Math.ceil(
      (new Date(academy.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, diff);
  };

  // The record browser (Members / Academies / Friendly games / Playgrounds)
  // is only shown on its dedicated tabbed routes (/admin?tab=...).
  if (tab) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("super_admin_title")} subtitle={t("super_admin_subtitle")} />
        <PlatformRecords />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("super_admin_title")} subtitle={t("super_admin_subtitle")} />

      <PlatformAnalytics />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("super_admin_all_academies")}</p>
            <p className="mt-1 font-mono text-2xl font-extrabold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("super_admin_active")}</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-emerald-600">{stats.paid}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("super_admin_trial")}</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-amber-600">{stats.activeTrials}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("super_admin_expired")}</p>
            <p className="mt-1 font-mono text-2xl font-extrabold text-red-600">{stats.expiredTrials}</p>
          </CardContent>
        </Card>
      </div>

      {/* Academies table */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="h-48 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ) : !academies || academies.length === 0 ? (
        <EmptyState message={t("super_admin_all_academies")} icon={Crown} />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-primary" />
              {t("super_admin_all_academies")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("super_admin_academy_name")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("super_admin_admin_email")}</TableHead>
                    <TableHead>{t("super_admin_status")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("super_admin_plan_label")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("super_admin_trial_ends")}</TableHead>
                    <TableHead className="text-end">{t("super_admin_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {academies.map((academy) => {
                    const status = getAcademyStatus(academy);
                    const daysLeft = getTrialDaysLeft(academy);
                    return (
                      <TableRow key={academy.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{academy.name}</p>
                            {academy.slug && (
                              <a
                                href={`/a/${academy.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">
                          —
                        </TableCell>
                        <TableCell>
                          {status === "paid" ? (
                            <Badge variant="success" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("super_admin_active")}
                            </Badge>
                          ) : status === "active_trial" ? (
                            <Badge variant="secondary" className="gap-1">
                              <CalendarClock className="h-3 w-3" />
                              {t("super_admin_trial")} · {daysLeft}d
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              {t("super_admin_expired")}
                            </Badge>
                          )}
                        </TableCell>
<TableCell className="hidden md:table-cell">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  {t(`plans_tier_${academy.plan ?? "starter"}` as any)}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {PLAN_ORDER.map((p) => (
                                  <DropdownMenuItem
                                    key={p}
                                    onClick={() =>
                                      handleSetPlan(academy.id, p)
                                    }
                                  >
                                    {t(`plans_tier_${p}` as any)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                            {academy.trial_ends_at
                              ? format(new Date(academy.trial_ends_at), "MMM d, yyyy", { locale })
                              : "—"}
                          </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={t("sa_edit")}
                              onClick={() => setEditing(academy)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {academy.is_trial && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="gap-1">
                                    <Plus className="h-3 w-3" />
                                    {t("super_admin_extend_trial")}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleExtend(academy.id, 7)}>
                                    {t("super_admin_extend_7")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleExtend(academy.id, 14)}>
                                    {t("super_admin_extend_14")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleExtend(academy.id, 30)}>
                                    {t("super_admin_extend_30")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            {academy.is_trial && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-emerald-600 hover:text-emerald-600"
                                onClick={() => handleConvert(academy.id)}
                              >
                                <Shield className="h-3 w-3" />
                                {t("super_admin_convert_paid")}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Game fee review */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" />
            {t("super_admin_game_fees")}
            {(pendingFees ?? []).length > 0 && (
              <Badge variant="destructive">{(pendingFees ?? []).length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!pendingFees || pendingFees.length === 0 ? (
            <EmptyState
              message={t("super_admin_game_fees_empty")}
              hint={t("super_admin_game_fees_hint")}
              icon={Receipt}
            />
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("community_game_title")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("community_organizer")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("community_sport")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("game_fee_title")}</TableHead>
                    <TableHead className="text-end">{t("super_admin_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pendingFees ?? []).map((game) => (
                    <TableRow key={game.id}>
                      <TableCell>
                        <p className="truncate font-medium">{game.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {game.game_date} · {game.start_time}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {memberName(game.creator_id)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {game.sport}
                        {game.area ? ` · ${game.area}` : ""}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {game.fee_method
                          ? t(`game_fee_method_${game.fee_method}` as any)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            disabled={openingReceipt !== null}
                            onClick={() =>
                              handleViewReceipt(game.fee_receipt_url)
                            }
                          >
                            <Eye className="h-3 w-3" />
                            {t("super_admin_fee_view_receipt")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-emerald-600 hover:text-emerald-600"
                            disabled={reviewGameFee.isPending}
                            onClick={() => handleReviewFee(game.id, true)}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {t("super_admin_fee_approve")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-muted-foreground"
                            disabled={reviewGameFee.isPending}
                            onClick={() => handleReviewFee(game.id, false)}
                          >
                            <XCircle className="h-3 w-3" />
                            {t("super_admin_fee_reject")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Community moderation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            {t("moderation_title")}
            {(reports ?? []).filter((r) => r.status === "open").length > 0 && (
              <Badge variant="destructive">
                {(reports ?? []).filter((r) => r.status === "open").length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!reports || reports.length === 0 ? (
            <EmptyState
              message={t("moderation_empty")}
              hint={t("moderation_empty_hint")}
              icon={Flag}
            />
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("moderation_target")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("moderation_reason")}</TableHead>
                    <TableHead>{t("moderation_status")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("moderation_date")}</TableHead>
                    <TableHead className="text-end">{t("moderation_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(reports ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {r.target_type === "game" ? t("moderation_type_game") : t("moderation_type_member")}
                          </Badge>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {r.target_type === "member"
                                ? memberName(r.target_id)
                                : r.target_id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("moderation_reported_by")} {memberName(r.reporter_id)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden max-w-[280px] sm:table-cell">
                        <p className="line-clamp-2 text-xs text-muted-foreground">{r.reason}</p>
                      </TableCell>
                      <TableCell>
                        {r.status === "open" ? (
                          <Badge variant="destructive">{t("moderation_open")}</Badge>
                        ) : r.status === "resolved" ? (
                          <Badge variant="success">{t("moderation_resolved")}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("moderation_dismissed")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {format(new Date(r.created_at), "MMM d, yyyy", { locale })}
                      </TableCell>
                      <TableCell className="text-end">
                        {r.status === "open" ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-emerald-600 hover:text-emerald-600"
                              onClick={() =>
                                resolve
                                  .mutateAsync({ reportId: r.id, status: "resolved" })
                                  .then(() => toast.success(t("moderation_resolved_ok")))
                                  .catch(() => toast.error(t("common_error")))
                              }
                              disabled={resolve.isPending}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {t("moderation_resolve")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-muted-foreground"
                              onClick={() =>
                                resolve
                                  .mutateAsync({ reportId: r.id, status: "dismissed" })
                                  .catch(() => toast.error(t("common_error")))
                              }
                              disabled={resolve.isPending}
                            >
                              <XCircle className="h-3 w-3" />
                              {t("moderation_dismiss")}
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AcademyEditDialog
        academy={editing}
        onClose={() => setEditing(null)}
        onDeleted={() => setEditing(null)}
      />
    </div>
  );
}
