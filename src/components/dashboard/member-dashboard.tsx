"use client";

import { format } from "date-fns";
import {
  CalendarDays,
  CalendarClock,
  CreditCard,
  Receipt,
  ShieldCheck,
  Timer,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { usedSessionsSincePayment } from "@/lib/calculations";
import {
  useAllPayments,
  useAttendance,
  useMonthlyCosts,
  useProfile,
  useSessions,
  useUpcomingSessions,
} from "@/lib/queries";
import type { Profile } from "@/lib/types";

interface MemberDashboardProps {
  profile: Profile;
}

export function MemberDashboard({ profile }: MemberDashboardProps) {
  const { t, lang, locale } = useI18n();
  const { data: ownProfile } = useProfile(profile.id);
  const { data: payments } = useAllPayments();
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const { data: upcoming } = useUpcomingSessions();
  const { data: costs } = useMonthlyCosts();

  const p = ownProfile ?? profile;
  const myPayments = (payments ?? []).filter((x) => x.member_id === p.id);
  const totalPaid = myPayments.reduce((s, x) => s + Number(x.amount), 0);
  const lastPayment = myPayments[0] ?? null;

  const used = usedSessionsSincePayment(attendance ?? [], sessions ?? [], myPayments);
  const remaining = Math.max(p.subscription_sessions - used, 0);
  const progress =
    p.subscription_sessions > 0
      ? Math.min(100, Math.round((used / p.subscription_sessions) * 100))
      : 0;

  const now = new Date();
  const pastSessions = (sessions ?? []).filter((s) => s.date < now.toISOString().slice(0, 10));
  const attendedIds = new Set(
    (attendance ?? []).filter((a) => a.member_id === p.id && a.is_present).map((a) => a.session_id)
  );
  const attendedCount = pastSessions.filter((s) => attendedIds.has(s.id)).length;
  const attendanceRate =
    pastSessions.length > 0 ? Math.round((attendedCount / pastSessions.length) * 100) : 0;

  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  const monthCost = (costs ?? []).find((c) => c.month === m && c.year === y);
  const perSessionValue =
    myPayments.length > 0
      ? Number(myPayments[0].amount) / Math.max(myPayments[0].subscription_sessions, 1)
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("dash_my_remaining")}
          value={`${remaining} / ${p.subscription_sessions}`}
          icon={Timer}
          tone={remaining > 0 ? "success" : "destructive"}
          hint={t("dash_sessions_used")}
        />
        <StatCard
          title={t("dash_my_last_payment")}
          value={lastPayment ? formatMoney(Number(lastPayment.amount), lang) : "—"}
          icon={Receipt}
          tone="default"
          hint={
            lastPayment
              ? format(new Date(lastPayment.payment_date + "T00:00:00"), "MMM d, yyyy", { locale })
              : t("common_never")
          }
        />
        <StatCard
          title={t("dash_my_attendance_rate")}
          value={`${attendanceRate}%`}
          icon={TrendingUp}
          tone={attendanceRate >= 70 ? "success" : "warning"}
          hint={`${attendedCount} ${t("schedule_attending")}`}
        />
        <StatCard
          title={t("dash_my_status")}
          value={remaining > 0 ? t("dash_active") : t("dash_expired")}
          icon={ShieldCheck}
          tone={remaining > 0 ? "success" : "destructive"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="h-4 w-4 text-primary" />
              {t("dash_my_remaining")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {used} {t("dash_sessions_used")}
                </span>
                <span className="font-semibold">
                  {remaining} {t("profile_sessions_left")}
                </span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  {t("member_total_paid")}
                </p>
                <p className="mt-1 font-extrabold font-mono">{formatMoney(totalPaid, lang)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" />
                  {t("profile_your_share")}
                </p>
                <p className="mt-1 font-extrabold font-mono">
                  {perSessionValue > 0 ? formatMoney(perSessionValue, lang) : "—"}
                </p>
              </div>
            </div>
            {monthCost && (
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  {t("dash_session_cost_info")}
                </span>
                <Badge variant="outline" className="font-mono">
                  {formatMoney(Number(monthCost.cost_per_session), lang)}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" />
              {t("profile_upcoming_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!upcoming || upcoming.length === 0 ? (
              <EmptyState message={t("profile_no_upcoming")} icon={CalendarDays} />
            ) : (
              (upcoming ?? []).slice(0, 5).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {format(new Date(s.date + "T00:00:00"), "EEEE, MMM d", { locale })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.time.slice(0, 5)}
                      {s.location ? ` · ${s.location}` : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="font-mono">
                    {s.time.slice(0, 5)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
