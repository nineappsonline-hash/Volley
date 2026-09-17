"use client";

import { TrainingGoals, TrainingRenewal } from "@/components/workflows/player-workflows";
import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Flame,
  MapPin,
  Timer,
  Trophy,
  UsersRound,
  Zap,
} from "lucide-react";
import { CheckinQrCard } from "@/components/profile/checkin-qr-card";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { EvaluationsCard } from "@/components/members/evaluations-card";
import { AttendanceTrendCard } from "@/components/members/attendance-trend-card";
import { MemberBadges } from "@/components/shared/member-badges";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatTime12h } from "@/lib/constants";
import { usedSessionsSincePayment } from "@/lib/calculations";
import {
  useAttendance,
  useMyCommunityRecord,
  useMyStreaks,
  usePayments,
  useProfile,
  useSessions,
} from "@/lib/queries";
import type { Profile } from "@/lib/types";

export function ChildProfileClient({ child }: { child: Profile }) {
  const { t, lang, locale } = useI18n();
  const { data: profile } = useProfile(child.id);
  const member = profile ?? child;
  const { data: payments } = usePayments(member.id);
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const { data: record } = useMyCommunityRecord(member.id);
  const { data: streaks } = useMyStreaks(member.id);

  const myAttendance = useMemo(
    () => (attendance ?? []).filter((a) => a.member_id === member.id),
    [attendance, member.id]
  );

  const sessionById = useMemo(
    () => new Map((sessions ?? []).map((s) => [s.id, s])),
    [sessions]
  );

  const used = usedSessionsSincePayment(myAttendance, sessions ?? [], payments ?? []);
  const remaining = Math.max(member.subscription_sessions - used, 0);
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const hasPlan = (payments?.length ?? 0) > 0;

  const attendedSessions = myAttendance
    .filter((a) => a.is_present)
    .map((a) => sessionById.get(a.session_id))
    .filter(Boolean)
    .sort((a, b) => (b!.date + b!.time).localeCompare(a!.date + a!.time));

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.name}
        subtitle={
          member.gender ? `${t("profile_gender")}: ${member.gender === "male" ? t("games_gender_male") : t("games_gender_female")} · ` : ""
        }
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/profile">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("nav_profile")}
          </Link>
        </Button>
      </PageHeader>
      <TrainingRenewal memberId={member.id} academyId={member.academy_id}/><TrainingGoals memberId={member.id}/>
      {member.checkin_code && <CheckinQrCard code={member.checkin_code} memberName={member.name} />}


      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Summary */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersRound className="h-4 w-4 text-primary" />
              {t("family_member_summary")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <ProfileAvatar name={member.name} url={member.avatar_url} avatarId={member.avatar_id} className="h-12 w-12" fallbackClassName="text-base" />
              <div>
                <p className="font-semibold">{member.name}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <Badge variant={member.membership_type === "half" ? "outline" : "default"}>
                    {member.membership_type === "half" ? t("membership_half") : t("membership_full")}
                  </Badge>
                  <Badge variant={hasPlan ? "success" : "outline"} className="text-muted-foreground">
                    {hasPlan ? t("dash_active") : t("membership_none")}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("members_joined_on")}</span>
                <span className="font-medium">
                  {member.join_date
                    ? format(new Date(member.join_date + "T00:00:00"), "MMM d, yyyy", { locale })
                    : t("common_not_set")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("member_total_paid")}</span>
                <span className="font-mono font-semibold">{formatMoney(totalPaid, lang)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("member_last_payment")}</span>
                <span className="font-medium">
                  {payments && payments.length > 0
                    ? format(new Date(payments[0].payment_date + "T00:00:00"), "MMM d, yyyy", { locale })
                    : t("common_never")}
                </span>
              </div>
              {member.birth_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("profile_birth_date")}</span>
                  <span className="font-medium">
                    {format(new Date(member.birth_date + "T00:00:00"), "MMM d, yyyy", { locale })}
                  </span>
                </div>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  {t("member_remaining")}
                </span>
                <span className="font-semibold">
                  {member.subscription_sessions > 0
                    ? `${remaining} / ${member.subscription_sessions}`
                    : t("membership_none")}
                </span>
              </div>
              {member.subscription_sessions > 0 && (
                <>
                  <Progress
                    value={Math.min(100, (used / member.subscription_sessions) * 100)}
                    className="h-2.5"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("member_used")}: {used}
                  </p>
                </>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-lg font-bold">{record?.played ?? "–"}</p>
                <p className="text-[10px] text-muted-foreground">{t("record_played")}</p>
              </div>
              <div className="rounded-lg bg-success/10 p-2">
                <p className="text-lg font-bold text-success">{record?.wins ?? "–"}</p>
                <p className="text-[10px] text-muted-foreground">{t("record_wins")}</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-2">
                <p className="text-lg font-bold text-destructive">{record?.losses ?? "–"}</p>
                <p className="text-[10px] text-muted-foreground">{t("record_losses")}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-lg font-bold">{record?.draws ?? "–"}</p>
                <p className="text-[10px] text-muted-foreground">{t("record_draws")}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Flame className="h-4 w-4 text-warning-ink" />
                <span>{t("streak_current")}</span>
              </div>
              <Badge variant="outline">
                {streaks?.current ?? 0} {t("streak_days")}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-warning-ink" />
                <span>{t("streak_best")}</span>
              </div>
              <Badge variant="outline">
                {streaks?.best ?? 0} {t("streak_days")}
              </Badge>
            </div>
            {member.member_plan === "premium" && (
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Trophy className="h-4 w-4" />
                  Premium
                </span>
                <Badge className="bg-info/15 text-info-ink">
                  Active
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment history (read-only for the guardian) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" />
              {t("member_payment_history")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!payments ? (
              <Skeleton className="h-40 w-full" />
            ) : payments.length === 0 ? (
              <EmptyState message={t("member_no_payments")} icon={CreditCard} />
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-mono font-bold">{formatMoney(Number(p.amount), lang)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.payment_date + "T00:00:00"), "MMM d, yyyy", { locale })}
                        {" · "}
                        {p.membership_type === "half" ? t("membership_half") : t("membership_full")}
                        {" · "}
                        {p.subscription_sessions} {t("member_payment_sessions")}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    <Badge variant="success">{t("dash_active")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance trend + player development */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AttendanceTrendCard
          memberId={member.id}
          attendance={attendance ?? []}
          sessions={sessions ?? []}
        />
        <EvaluationsCard memberId={member.id} isAdmin={false} />
      </div>

      {/* Badges + Activity Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MemberBadges memberId={member.id} />
        <ActivityFeed memberId={member.id} limit={15} />
      </div>

      {/* Attendance history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {t("member_attendance_history")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendedSessions.length === 0 ? (
            <EmptyState message={t("member_no_attendance")} icon={CheckCircle2} />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {attendedSessions.slice(0, 18).map((s) => (
                <div key={s!.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success-ink" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {format(new Date(s!.date + "T00:00:00"), "EEE, MMM d", { locale })}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {formatTime12h(s!.time, lang)}
                      {s!.location ? ` · ${s!.location}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}