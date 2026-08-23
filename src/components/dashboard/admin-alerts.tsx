"use client";

import Link from "next/link";
import { format } from "date-fns";
import { AlarmClock, HandCoins, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n } from "@/lib/i18n";
import { EXPIRY_ALERT_THRESHOLD, formatMoney } from "@/lib/constants";
import { triggerEmail } from "@/lib/email-triggers";
import {
  memberPerSessionValue,
  usedSessionsSincePayment,
} from "@/lib/calculations";
import {
  useAllPayments,
  useAttendance,
  useProfiles,
  useSessions,
  useUpdateMember,
} from "@/lib/queries";
import type { Profile } from "@/lib/types";

interface MemberAlert {
  profile: Profile;
  remaining: number;
}

export function AdminAlerts() {
  const { t, lang, locale } = useI18n();
  const { data: profiles } = useProfiles();
  const { data: payments } = useAllPayments();
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const remind = useUpdateMember();

  const members = (profiles ?? []).filter((p) => p.role === "member");

  // ── Subscription usage per member ──
  const expiring: MemberAlert[] = [];
  const debtors: { profile: Profile; debt: number }[] = [];
  for (const m of members) {
    if (m.is_active === false) continue;
    const myPayments = (payments ?? []).filter((p) => p.member_id === m.id);
    if (myPayments.length === 0) continue;
    const used = usedSessionsSincePayment(attendance ?? [], sessions ?? [], myPayments);
    const remaining = m.subscription_sessions - used;
    if (remaining < 0) {
      const perSession = memberPerSessionValue(m.id, payments ?? []);
      debtors.push({ profile: m, debt: Math.abs(remaining) * perSession });
    } else if (remaining <= EXPIRY_ALERT_THRESHOLD) {
      expiring.push({ profile: m, remaining });
    }
  }
  expiring.sort((a, b) => a.remaining - b.remaining);
  debtors.sort((a, b) => b.debt - a.debt);

  // ── At-risk: active members with low attendance over the last 30 days ──
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  const recentSessions = (sessions ?? []).filter(
    (s) => s.date >= cutoffStr && s.date <= todayStr && s.status !== "canceled"
  );
  const presentByMember = new Map<string, number>();
  for (const a of attendance ?? []) {
    if (!a.is_present) continue;
    const session = recentSessions.find((s) => s.id === a.session_id);
    if (session) {
      presentByMember.set(a.member_id, (presentByMember.get(a.member_id) ?? 0) + 1);
    }
  }
  const atRisk = members
    .filter((m) => m.is_active !== false && recentSessions.length >= 2)
    .map((m) => ({ profile: m, rate: (presentByMember.get(m.id) ?? 0) / recentSessions.length }))
    .filter((x) => x.rate < 0.5)
    .sort((a, b) => a.rate - b.rate);

  const onRemind = (m: Profile) => {
    remind.mutate(
      { id: m.id, last_reminded_at: new Date().toISOString() },
      {
        onSuccess: () => {
          toast.success(t("members_reminded_toast"));
          // Fire-and-forget renewal email
          const myPayments = (payments ?? []).filter((p) => p.member_id === m.id);
          const used = usedSessionsSincePayment(attendance ?? [], sessions ?? [], myPayments);
          const remaining = Math.max(m.subscription_sessions - used, 0);
          triggerEmail("renewal", m.id, { remaining });
        },
        onError: () => toast.error(t("common_error")),
      }
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Expiring subscriptions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlarmClock className="h-4 w-4 text-amber-500" />
            {t("dash_expiring_members")}
          </CardTitle>
          {expiring.length > 0 && (
            <Badge variant="outline" className="text-amber-600">
              {expiring.length}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {expiring.length === 0 ? (
            <EmptyState message={t("dash_no_expiring")} icon={AlarmClock} />
          ) : (
            expiring.slice(0, 6).map(({ profile, remaining }) => (
              <Link
                key={profile.id}
                href={`/members/${profile.id}`}
                className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{profile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile.last_reminded_at
                      ? `${t("members_reminded_ago")} ${format(
                          new Date(profile.last_reminded_at),
                          "MMM d",
                          { locale }
                        )}`
                      : t("members_never_reminded")}
                  </p>
                </div>
                <Badge variant={remaining <= 0 ? "destructive" : "secondary"}>
                  {remaining} {t("profile_sessions_left")}
                </Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Outstanding balances */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <HandCoins className="h-4 w-4 text-red-500" />
            {t("dash_debtors")}
          </CardTitle>
          {debtors.length > 0 && (
            <Badge variant="destructive">{debtors.length}</Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {debtors.length === 0 ? (
            <EmptyState message={t("dash_no_debtors")} icon={HandCoins} />
          ) : (
            debtors.slice(0, 6).map(({ profile, debt }) => (
              <div
                key={profile.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <Link href={`/members/${profile.id}`} className="min-w-0 hover:underline">
                  <p className="truncate font-medium">{profile.name}</p>
                  <p className="font-mono text-xs text-destructive">
                    {t("members_balance")}: {formatMoney(debt, lang)}
                  </p>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={remind.isPending}
                  onClick={() => onRemind(profile)}
                >
                  {t("members_remind")}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* At-risk attendance */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-4 w-4 text-orange-500" />
            {t("dash_at_risk")}
          </CardTitle>
          {atRisk.length > 0 && (
            <Badge variant="outline" className="text-orange-600">
              {atRisk.length}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {atRisk.length === 0 ? (
            <EmptyState message={t("dash_no_at_risk")} icon={TrendingDown} />
          ) : (
            atRisk.slice(0, 6).map(({ profile, rate }) => (
              <Link
                key={profile.id}
                href={`/members/${profile.id}`}
                className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50"
              >
                <p className="truncate font-medium">{profile.name}</p>
                <Badge variant="outline" className="font-mono text-orange-600">
                  {Math.round(rate * 100)}%
                </Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
