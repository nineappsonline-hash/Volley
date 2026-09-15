"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Crown,
  Flame,
  HandCoins,
  Timer,
  UsersRound,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Reveal } from "@/components/shared/reveal";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { AddChildDialog } from "@/components/profile/add-child-dialog";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/constants";
import { usedSessionsSincePayment } from "@/lib/calculations";
import {
  useAllPayments,
  useAttendance,
  useChildren,
  useSessions,
} from "@/lib/queries";
import type { Profile } from "@/lib/types";

type StreakStats = { current: number; best: number };

function computeStreaks(dates: string[]): StreakStats {
  const unique = [...new Set(dates)].sort();
  const dayOf = (s: string) => new Date(s + "T12:00:00");
  let best = 0;
  let run = 0;
  for (let i = 0; i < unique.length; i++) {
    if (
      i > 0 &&
      new Date(dayOf(unique[i - 1]).getTime() + 86400000).toISOString().slice(0, 10) ===
        unique[i]
    ) {
      run += 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
  }
  const set = new Set(unique);
  const keyOf = (d: Date) => d.toISOString().slice(0, 10);
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!set.has(keyOf(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let current = 0;
  while (set.has(keyOf(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, best };
}

export function ParentDashboard() {
  const { t, lang, locale } = useI18n();
  const { data: children, isLoading } = useChildren();
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const { data: payments } = useAllPayments();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t("parent_dashboard_title")}
          subtitle={t("parent_dashboard_subtitle")}
        />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const allPayments = payments ?? [];
  const allSessions = sessions ?? [];
  const sessionById = new Map(allSessions.map((s) => [s.id, s]));

  const cutoffStr = new Date(
    Date.now() - 30 * 86400000
  )
    .toISOString()
    .slice(0, 10);
  const recentSessions = allSessions.filter(
    (s) => s.date >= cutoffStr && s.status !== "canceled"
  );
  const recentIds = new Set(recentSessions.map((s) => s.id));

  const cards =
    (children ?? []).map((child) => {
      const myAttendance = (attendance ?? []).filter(
        (a) => a.member_id === child.id
      );
      const myPayments = allPayments.filter((p) => p.member_id === child.id);
      const used = usedSessionsSincePayment(
        myAttendance,
        allSessions,
        myPayments
      );
      const remaining = Math.max(child.subscription_sessions - used, 0);
      const progress =
        child.subscription_sessions > 0
          ? Math.min(100, Math.round((used / child.subscription_sessions) * 100))
          : 0;
      const hasPlan = myPayments.length > 0;
      const attended30d = myAttendance.filter(
        (a) => a.is_present && recentIds.has(a.session_id)
      ).length;
      const presentDates = myAttendance
        .filter((a) => a.is_present)
        .map((a) => sessionById.get(a.session_id)?.date)
        .filter((d): d is string => Boolean(d));
      const streaks = computeStreaks(presentDates);
      const lastPayment = myPayments[0];
      const totalPaid = myPayments.reduce((s, x) => s + Number(x.amount), 0);

      return {
        child,
        used,
        remaining,
        progress,
        hasPlan,
        attended30d,
        streaks,
        lastPayment,
        totalPaid,
      };
    }) ?? [];

  const cardAccents = [
  "from-interactive-500 to-positive-400",
  "from-attention-400 to-attention-600",
  "from-brand-500 to-interactive-500",
  "from-negative-400 to-attention-400",
];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("parent_dashboard_title")}
        subtitle={t("parent_dashboard_subtitle")}
      />

      {cards.length === 0 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <EmptyState message={t("parent_no_children")} icon={UsersRound} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDialogOpen(true)}>
                {t("parent_add_child")}
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile#family">{t("parent_manage_family")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {cards.map(
              (
                {
                  child,
                  used,
                  remaining,
                  progress,
                  hasPlan,
                  attended30d,
                  streaks,
                  lastPayment,
                  totalPaid,
                },
                cardIndex
              ) => (
                <Reveal key={child.id} index={cardIndex} className="h-full">
                <Card className="group relative h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
                      cardAccents[cardIndex % cardAccents.length]
                    )}
                  />
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProfileAvatar
                          name={child.name}
                          url={child.avatar_url}
                          className="h-12 w-12 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold">
                            {child.name}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge
                              variant={
                                child.membership_type === "half"
                                  ? "outline"
                                  : "default"
                              }
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {child.membership_type === "half"
                                ? t("membership_half")
                                : t("membership_full")}
                            </Badge>
                            {child.member_plan === "premium" && (
                              <Badge className="bg-info/15 px-1.5 py-0 text-[10px] text-info-ink">
                                <Crown className="mr-0.5 h-2.5 w-2.5" />
                                Premium
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          !hasPlan
                            ? "outline"
                            : remaining > 0
                              ? "success"
                              : "warning"
                        }
                        className="shrink-0"
                      >
                        {!hasPlan
                          ? t("membership_none")
                          : remaining > 0
                            ? t("dash_active")
                            : t("dash_expired")}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {used} {t("dash_sessions_used")}{" "}
                          {t("member_sessions_remaining_of")}{" "}
                          {child.subscription_sessions}
                        </span>
                        <span className="font-semibold">
                          {remaining} {t("profile_sessions_left")}
                        </span>
                      </div>
                      <Progress value={progress} className="h-2.5" />
                    </div>

                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:grid-cols-3 text-center">
                      <div className="rounded-lg border border-attention-300/40 bg-attention-50/70 p-2 dark:bg-attention-500/10">
                        <p className="flex items-center justify-center gap-1 text-lg font-bold">
                          <Flame className="h-4 w-4 text-warning-ink" />
                          {streaks.current}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {t("streak_current")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-interactive-300/40 bg-interactive-50/70 p-2 dark:bg-interactive-500/10">
                        <p className="flex items-center justify-center gap-1 text-lg font-bold">
                          <Zap className="h-4 w-4 text-info-ink" />
                          {streaks.best}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {t("streak_best")}
                        </p>
                      </div>
                      <div className="rounded-lg border border-positive-300/40 bg-success/10 p-2 dark:bg-positive-500/10">
                        <p className="flex items-center justify-center gap-1 text-lg font-bold text-success-ink">
                          {attended30d}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {t("parent_attended_30d")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <span className="text-muted-foreground">
                        {t("member_last_payment")}
                      </span>
                      <span className="font-medium">
                        {lastPayment
                          ? `${formatMoney(
                              Number(lastPayment.amount),
                              lang
                            )} · ${format(
                              new Date(lastPayment.payment_date + "T00:00:00"),
                              "MMM d, yyyy",
                              { locale }
                            )}`
                          : t("common_never")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <HandCoins className="h-4 w-4" />
                        {t("member_total_paid")}
                      </span>
                      <span className="font-mono font-bold">
                        {formatMoney(totalPaid, lang)}
                      </span>
                    </div>
                  </CardContent>
                  <div className="px-6 pb-6">
                    <Button asChild variant="outline" className="w-full">
                      <Link href={`/profile/children/${child.id}`}>
                        <Timer className="h-4 w-4" />
                        {t("family_view_progress")}
                        <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />
                      </Link>
                    </Button>
                  </div>
                </Card>
                </Reveal>
              )
            )}
          </div>

          <Reveal index={3}>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">
              {t("family_subtitle")}
            </p>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/profile#family">{t("parent_manage_family")}</Link>
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                {t("parent_add_child")}
              </Button>
            </div>
          </div>
          </Reveal>
        </>
      )}

      <AddChildDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}