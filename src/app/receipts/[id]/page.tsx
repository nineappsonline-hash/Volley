"use client";

import { AppLogo } from "@/components/shared/app-logo";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Printer, Volleyball } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { useAllPayments, usePlans, useProfiles } from "@/lib/queries";

export default function ReceiptPage() {
  const { t, lang, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { data: payments, isLoading } = useAllPayments();
  const { data: profiles } = useProfiles();
  const { data: plans } = usePlans();

  const payment = (payments ?? []).find((p) => p.id === id);

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-lg p-6">
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (!payment) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">{t("page_404")}</p>
      </main>
    );
  }

  const memberName =
    (profiles ?? []).find((p) => p.id === payment.member_id)?.name ?? "—";
  const plan = (plans ?? []).find((p) => p.id === payment.plan_id);

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg bg-background p-6 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("goto_dashboard")}
        </Link>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t("receipt_print")}
        </Button>
      </div>

      <div className="rounded-2xl border bg-card p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-col items-center gap-2 border-b pb-6 text-center">
          <AppLogo />
          <h1 className="text-lg font-extrabold">{t("appName")}</h1>
          <p className="text-sm font-medium text-muted-foreground">
            {t("receipt_title")}
          </p>
        </div>

        <dl className="space-y-3 py-6 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{t("receipt_number")}</dt>
            <dd className="font-mono text-xs">{payment.id.slice(0, 8).toUpperCase()}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{t("receipt_member")}</dt>
            <dd className="font-semibold">{memberName}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{t("receipt_date")}</dt>
            <dd>
              {format(new Date(payment.payment_date + "T00:00:00"), "MMM d, yyyy", {
                locale,
              })}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{t("receipt_plan")}</dt>
            <dd>
              {plan
                ? plan.name
                : payment.membership_type === "half"
                  ? t("membership_half")
                  : t("membership_full")}
              {" · "}
              {payment.subscription_sessions} {lang === "ar" ? "حصص" : "sessions"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">{t("receipt_method")}</dt>
            <dd>{t(`method_${payment.method ?? "cash"}`)}</dd>
          </div>
          {payment.notes && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">{t("receipt_notes")}</dt>
              <dd>{payment.notes}</dd>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-4">
            <dt className="font-bold">{t("receipt_amount")}</dt>
            <dd className="font-mono text-xl font-extrabold text-primary">
              {formatMoney(Number(payment.amount), lang)}
            </dd>
          </div>
        </dl>

        <p className="border-t pt-4 text-center text-xs text-muted-foreground">
          {t("receipt_thanks")}
        </p>
      </div>
    </main>
  );
}
