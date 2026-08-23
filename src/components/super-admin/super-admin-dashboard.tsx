"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  Crown,
  ExternalLink,
  Plus,
  Shield,
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
import { useI18n } from "@/lib/i18n";
import { useAllAcademies, useConvertToPaid, useExtendTrial } from "@/lib/queries";

export function SuperAdminDashboard() {
  const { t, lang, locale } = useI18n();
  const { data: academies, isLoading } = useAllAcademies();
  const extendTrial = useExtendTrial();
  const convertToPaid = useConvertToPaid();

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

  return (
    <div className="space-y-6">
      <PageHeader title={t("super_admin_title")} subtitle={t("super_admin_subtitle")} />

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
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {academy.trial_ends_at
                            ? format(new Date(academy.trial_ends_at), "MMM d, yyyy", { locale })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1">
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
    </div>
  );
}
