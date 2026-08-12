"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Receipt,
  StickyNote,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ProfitLossIndicator } from "@/components/shared/profit-loss-indicator";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { memberPerSessionValue } from "@/lib/calculations";
import {
  useAttendance,
  useMemberSessionCosts,
  useMonthlyCosts,
  usePayments,
  useProfiles,
} from "@/lib/queries";
import { initials } from "@/lib/utils";
import type { TrainingSession } from "@/lib/types";

interface SessionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: TrainingSession | null;
  isAdmin: boolean;
  /** Current user's profile id — used to show a member their own attendance. */
  memberId?: string;
}

export function SessionDetailsDialog({
  open,
  onOpenChange,
  session,
  isAdmin,
  memberId,
}: SessionDetailsDialogProps) {
  const { t, lang, locale } = useI18n();

  // Queries are cache-keyed, so opening the dialog reuses data already
  // loaded by the schedule page (no extra network round-trips).
  const { data: attendance, isLoading: loadingAttendance } = useAttendance(
    session?.id
  );
  const { data: profiles } = useProfiles();
  const { data: payments } = usePayments();
  const { data: costs } = useMonthlyCosts();
  // monthly_costs is admin-only; members read the safe view instead.
  const { data: memberCosts } = useMemberSessionCosts();

  const members = useMemo(
    () => (profiles ?? []).filter((p) => p.role === "member"),
    [profiles]
  );

  const sessionAttendance = useMemo(
    () => (attendance ?? []).filter((a) => a.session_id === session?.id),
    [attendance, session?.id]
  );

  const byMember = useMemo(
    () => new Map(sessionAttendance.map((a) => [a.member_id, a.is_present])),
    [sessionAttendance]
  );

  const attendees = useMemo(
    () => members.filter((m) => byMember.get(m.id) === true),
    [members, byMember]
  );
  const absentees = useMemo(
    () => members.filter((m) => byMember.get(m.id) === false),
    [members, byMember]
  );
  const unmarked = useMemo(
    () => members.filter((m) => !byMember.has(m.id)),
    [members, byMember]
  );

  const totalRevenue = useMemo(() => {
    let sum = 0;
    for (const m of attendees) {
      sum += memberPerSessionValue(m.id, payments ?? []);
    }
    return Math.round(sum * 100) / 100;
  }, [attendees, payments]);

  const monthCost = useMemo(() => {
    if (!session) return undefined;
    const d = new Date(session.date + "T00:00:00");
    return (costs ?? []).find(
      (c) => c.month === d.getMonth() + 1 && c.year === d.getFullYear()
    );
  }, [session, costs]);

  const costPerSession = monthCost ? Number(monthCost.cost_per_session) : 0;
  const profitLoss = Math.round((totalRevenue - costPerSession) * 100) / 100;

  const sessionDate = session ? new Date(session.date + "T00:00:00") : null;
  const memberMonthCost = sessionDate
    ? (memberCosts ?? []).find(
        (c) =>
          c.month === sessionDate.getMonth() + 1 &&
          c.year === sessionDate.getFullYear()
      )
    : undefined;

  const myAttendance = session && memberId ? byMember.get(memberId) : undefined;

  const statusBadge = session?.status === "canceled" ? "destructive" : session?.status === "completed" ? "outline" : "default";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {t("session_details_title")}
          </DialogTitle>
          {session && (
            <DialogDescription>
              {format(new Date(session.date + "T00:00:00"), "EEEE, MMMM d, yyyy", {
                locale,
              })}{" "}
              · {session.time.slice(0, 5)}
            </DialogDescription>
          )}
        </DialogHeader>

        {!session ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div className="space-y-5">
            {/* Session info */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusBadge} className="gap-1">
                <Clock className="h-3 w-3" />
                {session.time.slice(0, 5)}
              </Badge>
              {session.status === "canceled" && (
                <Badge variant="destructive">{t("schedule_canceled")}</Badge>
              )}
              {session.status === "completed" && (
                <Badge variant="outline">{t("schedule_completed")}</Badge>
              )}
              {session.location && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  {session.location}
                </span>
              )}
            </div>
            {session.notes && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {session.notes}
              </p>
            )}

            {isAdmin ? (
              <>
                {/* Attendees */}
                <section className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-bold">
                    <Users className="h-4 w-4 text-primary" />
                    {t("session_details_attendees")}
                    <span className="font-mono text-xs font-medium text-muted-foreground">
                      {attendees.length} / {members.length}
                    </span>
                  </h4>
                  {loadingAttendance ? (
                    <Skeleton className="h-24 w-full" />
                  ) : members.length === 0 ? (
                    <EmptyState message={t("attendance_no_members")} icon={Users} />
                  ) : sessionAttendance.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      {t("session_details_no_attendance")}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {attendees.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 text-sm dark:border-emerald-500/20 dark:bg-emerald-500/5"
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarFallback>{initials(m.name)}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {m.name}
                          </span>
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        </div>
                      ))}
                      {absentees.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm opacity-70"
                        >
                          <Avatar className="h-7 w-7">
                            <AvatarFallback>{initials(m.name)}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {m.name}
                          </span>
                          <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>
                      ))}
                      {unmarked.length > 0 && (
                        <p className="px-1 pt-1 text-xs text-muted-foreground">
                          {unmarked.length} {t("session_details_unmarked")}
                        </p>
                      )}
                    </div>
                  )}
                </section>

                {/* Revenue breakdown */}
                <section className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-bold">
                    <Receipt className="h-4 w-4 text-primary" />
                    {t("session_details_revenue")}
                  </h4>
                  {attendees.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      {t("session_details_no_revenue")}
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      {attendees.map((m) => {
                        const value = memberPerSessionValue(m.id, payments ?? []);
                        const latest = (payments ?? [])
                          .filter((p) => p.member_id === m.id)
                          .sort(
                            (a, b) =>
                              b.payment_date.localeCompare(a.payment_date) ||
                              b.created_at.localeCompare(a.created_at)
                          )[0];
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{m.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {value > 0
                                  ? `${t("session_details_share_note")}: ${formatMoney(
                                      Number(latest?.amount ?? 0),
                                      lang
                                    )} ÷ ${latest?.subscription_sessions ?? 0}`
                                  : t("session_details_no_payment")}
                              </p>
                            </div>
                            <span className="shrink-0 font-mono font-semibold">
                              {value > 0 ? formatMoney(value, lang) : "—"}
                            </span>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-sm font-bold">
                        <span>{t("session_details_total")}</span>
                        <span className="font-mono">{formatMoney(totalRevenue, lang)}</span>
                      </div>
                    </div>
                  )}
                </section>

                {/* Cost breakdown */}
                <section className="space-y-2">
                  <h4 className="flex items-center gap-2 text-sm font-bold">
                    <Wallet className="h-4 w-4 text-primary" />
                    {t("session_details_cost")}
                  </h4>
                  {!monthCost ? (
                    <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                      {t("session_details_no_costs")} — {t("session_details_no_costs_hint")}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border">
                      <div className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0">
                        <span>
                          {t("costs_coach_fee_per_session")}
                          <span className="block text-xs text-muted-foreground">
                            {t("session_details_flat")}
                          </span>
                        </span>
                        <span className="font-mono font-semibold">
                          {formatMoney(Number(monthCost.coach_fee_per_session), lang)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0">
                        <span>
                          {t("session_details_cost_rent")}
                          <span className="block text-xs text-muted-foreground">
                            {formatMoney(Number(monthCost.court_rental), lang)} ÷{" "}
                            {monthCost.sessions_per_month}{" "}
                            {t("member_payment_sessions").toLowerCase()}
                          </span>
                        </span>
                        <span className="font-mono font-semibold">
                          {formatMoney(
                            monthCost.sessions_per_month > 0
                              ? Number(monthCost.court_rental) /
                                  monthCost.sessions_per_month
                              : 0,
                            lang
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-sm font-bold">
                        <span>{t("session_details_cost_total")}</span>
                        <span className="font-mono">
                          {formatMoney(costPerSession, lang)}
                          <span className="ms-1 text-xs font-medium text-muted-foreground">
                            {t("schedule_per_session")}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </section>

                {/* Net result */}
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <span className="text-sm font-semibold">{t("session_details_net")}</span>
                  <ProfitLossIndicator value={profitLoss} />
                </div>
              </>
            ) : (
              /* Member view: only their own attendance + a pointer to pay */
              <div className="space-y-2">
                {myAttendance === undefined ? (
                  <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {t("session_details_not_marked_you")}
                  </p>
                ) : myAttendance ? (
                  <p className="flex items-center gap-2 rounded-lg border border-emerald-200/70 bg-emerald-50/60 p-3 text-sm text-emerald-800 dark:bg-emerald-500/5 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    {t("session_details_attended_you")}
                  </p>
                ) : (
                  <p className="flex items-center gap-2 rounded-lg border border-red-200/70 bg-red-50/60 p-3 text-sm text-red-800 dark:bg-red-500/5 dark:text-red-300">
                    <XCircle className="h-4 w-4" />
                    {t("session_details_absent_you")}
                  </p>
                )}
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    {t("session_details_cost_total")}
                  </span>
                  <span className="font-mono font-semibold">
                    {memberMonthCost
                      ? formatMoney(Number(memberMonthCost.cost_per_session), lang)
                      : "—"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
