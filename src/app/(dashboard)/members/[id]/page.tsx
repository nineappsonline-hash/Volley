"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgePlus,
  CheckCircle2,
  CreditCard,
  MapPin,
  Pencil,
  Timer,
  Trash2,
  XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PaymentFormDialog } from "@/components/members/payment-form-dialog";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import {
  memberPerSessionValue,
  usedSessionsSincePayment,
} from "@/lib/calculations";
import {
  useAttendance,
  useDeletePayment,
  usePayments,
  useProfile,
  useSessions,
} from "@/lib/queries";

export default function MemberDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, locale } = useI18n();
  const { data: member, isLoading } = useProfile(id);
  const { data: payments, isLoading: loadingPayments } = usePayments(id);
  const { data: attendance } = useAttendance();
  const { data: sessions } = useSessions();
  const deletePayment = useDeletePayment();

  const [paymentOpen, setPaymentOpen] = useState(false);

  const myAttendance = useMemo(
    () => (attendance ?? []).filter((a) => a.member_id === id),
    [attendance, id]
  );

  const sessionById = useMemo(
    () => new Map((sessions ?? []).map((s) => [s.id, s])),
    [sessions]
  );

  const used = usedSessionsSincePayment(myAttendance, sessions ?? [], payments ?? []);
  const remaining = member ? Math.max(member.subscription_sessions - used, 0) : 0;
  const totalPaid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const hasPaid = (payments?.length ?? 0) > 0;
  const perSessionValue = hasPaid ? memberPerSessionValue(id, payments ?? []) : 0;

  const attendedSessions = myAttendance
    .filter((a) => a.is_present)
    .map((a) => sessionById.get(a.session_id))
    .filter(Boolean)
    .sort((a, b) => (b!.date + b!.time).localeCompare(a!.date + a!.time));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!member) {
    return <EmptyState message={t("members_no_results")} />;
  }

  const handleDeletePayment = async (paymentId: string) => {
    try {
      await deletePayment.mutateAsync(paymentId);
      toast.success(t("member_payment_deleted"));
    } catch {
      toast.error(t("common_error"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.name}
        subtitle={`${member.email}${member.phone ? ` · ${member.phone}` : ""}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/members">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {t("nav_members")}
          </Link>
        </Button>
        <Button size="sm" onClick={() => setPaymentOpen(true)}>
          <BadgePlus className="h-4 w-4" />
          {t("member_add_payment")}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Summary */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("member_details_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-base">
                  {member.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{member.name}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <Badge variant="secondary">
                    {member.role === "admin" ? t("role_admin") : t("role_member")}
                  </Badge>
                  <Badge variant={member.membership_type === "half" ? "outline" : "default"}>
                    {member.membership_type === "half" ? t("membership_half") : t("membership_full")}
                  </Badge>
                  {!loadingPayments && (
                    <Badge variant={hasPaid ? "success" : "destructive"} className="gap-1">
                      {hasPaid ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          {t("members_status_paid")}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          {t("members_status_unpaid")}
                        </>
                      )}
                    </Badge>
                  )}
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
                <span className="text-muted-foreground">{t("member_per_session")}</span>
                <span className="font-mono font-semibold">
                  {perSessionValue > 0 ? formatMoney(perSessionValue, lang) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("member_last_payment")}</span>
                <span className="font-medium">
                  {payments && payments.length > 0
                    ? format(new Date(payments[0].payment_date + "T00:00:00"), "MMM d, yyyy", { locale })
                    : t("common_never")}
                </span>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  {t("member_remaining")}
                </span>
                <span className="font-semibold">
                  {remaining} / {member.subscription_sessions}
                </span>
              </div>
              <Progress
                value={
                  member.subscription_sessions > 0
                    ? Math.min(100, (used / member.subscription_sessions) * 100)
                    : 0
                }
                className="h-2.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("member_used")}: {used}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payment history */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" />
              {t("member_payment_history")}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)}>
              <BadgePlus className="h-4 w-4" />
              {t("member_add_payment")}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingPayments ? (
              <Skeleton className="h-40 w-full" />
            ) : !payments || payments.length === 0 ? (
              <EmptyState message={t("member_no_payments")} icon={CreditCard} />
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-mono font-bold">
                        {formatMoney(Number(p.amount), lang)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.payment_date + "T00:00:00"), "MMM d, yyyy", { locale })}
                        {" · "}
                        {p.membership_type === "half" ? t("membership_half") : t("membership_full")}
                        {" · "}
                        {p.subscription_sessions} {t("member_payment_sessions")}
                        {p.notes ? ` · ${p.notes}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeletePayment(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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

      <PaymentFormDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        memberId={member.id}
        memberName={member.name}
        defaultSessions={member.subscription_sessions}
      />
    </div>
  );
}
