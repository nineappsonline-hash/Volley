"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  Phone,
  Save,
  Timer,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { usedSessionsSincePayment } from "@/lib/calculations";
import {
  useAllPayments,
  useAttendance,
  useMonthlyCosts,
  useProfile,
  useSessions,
  useUpdateOwnProfile,
  useUpcomingSessions,
} from "@/lib/queries";
import type { Profile } from "@/lib/types";

export function ProfileClient({ serverProfile }: { serverProfile: Profile }) {
  const { t, lang, locale } = useI18n();
  const { data: profile } = useProfile(serverProfile.id);
  const p = profile ?? serverProfile;

  const [name, setName] = useState(p.name);
  const [phone, setPhone] = useState(p.phone ?? "");
  const [saving, setSaving] = useState(false);
  const updateProfile = useUpdateOwnProfile();

  const { data: payments, isLoading: loadingPayments } = useAllPayments();
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const { data: upcoming } = useUpcomingSessions();
  const { data: costs } = useMonthlyCosts();

  const myPayments = useMemo(
    () => (payments ?? []).filter((x) => x.member_id === p.id),
    [payments, p.id]
  );

  const myAttendance = useMemo(
    () => (attendance ?? []).filter((a) => a.member_id === p.id),
    [attendance, p.id]
  );

  const sessionById = useMemo(
    () => new Map((sessions ?? []).map((s) => [s.id, s])),
    [sessions]
  );

  const used = usedSessionsSincePayment(myAttendance, sessions ?? [], myPayments);
  const remaining = Math.max(p.subscription_sessions - used, 0);
  const progress =
    p.subscription_sessions > 0
      ? Math.min(100, Math.round((used / p.subscription_sessions) * 100))
      : 0;

  const attendedSessions = myAttendance
    .filter((a) => a.is_present)
    .map((a) => sessionById.get(a.session_id))
    .filter(Boolean)
    .sort((a, b) => (b!.date + b!.time).localeCompare(a!.date + a!.time));

  const lastPayment = myPayments[0];
  const totalPaid = myPayments.reduce((s, x) => s + Number(x.amount), 0);

  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  const monthCost = (costs ?? []).find((c) => c.month === m && c.year === y);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("field_required"));
      return;
    }
    setSaving(true);
    try {
      await updateProfile.mutateAsync({
        id: p.id,
        name: name.trim(),
        phone: phone || null,
      });
      toast.success(t("profile_saved"));
    } catch {
      toast.error(t("common_error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("profile_title")} subtitle={t("profile_subtitle")} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-primary" />
              {t("nav_profile")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {p.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-bold">{p.name}</p>
                <Badge variant="secondary">{t("role_member")}</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("signup_name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("signup_phone")}</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
              />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4" />
              {saving ? t("common_saving") : t("profile_save")}
            </Button>

            <div className="space-y-2 border-t pt-4 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span dir="ltr" className="truncate">{p.email}</span>
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                {p.phone || t("common_not_set")}
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {t("profile_join_date")}:{" "}
                {p.join_date
                  ? format(new Date(p.join_date + "T00:00:00"), "MMM d, yyyy", { locale })
                  : t("common_not_set")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Middle column: subscription + payments */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Timer className="h-4 w-4 text-primary" />
                {t("profile_remaining_sessions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {used} {t("dash_sessions_used")} {t("member_sessions_remaining_of")}{" "}
                    {p.subscription_sessions}
                  </span>
                  <span className="font-semibold">
                    {remaining} {t("profile_sessions_left")}
                  </span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t("dash_my_status")}</p>
                  <Badge variant={remaining > 0 ? "success" : "warning"} className="mt-1">
                    {remaining > 0 ? t("dash_active") : t("dash_expired")}
                  </Badge>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t("member_total_paid")}</p>
                  <p className="mt-1 font-extrabold font-mono">
                    {formatMoney(totalPaid, lang)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <span className="text-muted-foreground">{t("member_last_payment")}</span>
                <span className="font-medium">
                  {lastPayment
                    ? `${formatMoney(Number(lastPayment.amount), lang)} · ${format(
                        new Date(lastPayment.payment_date + "T00:00:00"),
                        "MMM d, yyyy",
                        { locale }
                      )}`
                    : t("common_never")}
                </span>
              </div>
              {monthCost && (
                <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <span className="text-muted-foreground">{t("dash_session_cost_info")}</span>
                  <span className="font-mono font-semibold">
                    {formatMoney(Number(monthCost.cost_per_session), lang)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-primary" />
                {t("profile_payment_status")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPayments ? (
                <Skeleton className="h-24 w-full" />
              ) : myPayments.length === 0 ? (
                <EmptyState message={t("member_no_payments")} icon={CreditCard} />
              ) : (
                <div className="space-y-2">
                  {myPayments.map((x) => (
                    <div
                      key={x.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <p className="font-mono font-bold">
                          {formatMoney(Number(x.amount), lang)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(x.payment_date + "T00:00:00"), "MMM d, yyyy", {
                            locale,
                          })}
                          {" · "}
                          {x.subscription_sessions} {t("member_payment_sessions")}
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
      </div>

      {/* Attendance history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {t("profile_attendance_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendedSessions.length === 0 ? (
            <EmptyState message={t("member_no_attendance")} icon={CheckCircle2} />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {attendedSessions.map((s) => (
                <div
                  key={s!.id}
                  className="flex items-center gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {format(new Date(s!.date + "T00:00:00"), "EEE, MMM d", { locale })}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {s!.time.slice(0, 5)}
                      {s!.location ? ` · ${s!.location}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="h-4 w-4 text-primary" />
            {t("profile_upcoming_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!upcoming || upcoming.length === 0 ? (
            <EmptyState message={t("profile_no_upcoming")} />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((s) => (
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
