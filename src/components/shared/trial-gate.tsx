"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { useAcademy } from "@/lib/queries";

interface TrialGateProps {
  children: React.ReactNode;
  isAdmin?: boolean;
}

export function TrialGate({ children, isAdmin = false }: TrialGateProps) {
  const pathname = usePathname();
  const { t, lang } = useI18n();
  const { data: academy } = useAcademy();

  const trialStatus = useMemo(() => {
    if (!academy) return { expired: false, daysLeft: 0, isTrial: false };

    const isTrial = academy.is_trial;
    if (!isTrial || !academy.trial_ends_at) {
      return { expired: false, daysLeft: 0, isTrial: false };
    }

    const now = new Date();
    const endsAt = new Date(academy.trial_ends_at);
    const diffMs = endsAt.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      expired: daysLeft <= 0,
      daysLeft: Math.max(0, daysLeft),
      isTrial: true,
    };
  }, [academy]);

  if (isAdmin && ["/upgrade", "/checkout"].includes(pathname)) return <>{children}</>;

  if (!academy) return <>{children}</>;

  // Trial expired — show upgrade prompt
  if (trialStatus.isTrial && trialStatus.expired) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-attention-100 dark:bg-attention-500/10">
              <AlertTriangle className="h-6 w-6 text-warning-ink" />
            </div>
            <CardTitle className="text-lg">{t("trial_expired_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              {t("trial_expired_message")}
            </p>
            {isAdmin && <Button asChild><Link href="/upgrade">{lang === "ar" ? "جدد اشتراك الأكاديمية" : "Renew academy subscription"}</Link></Button>}
            <p className="text-xs text-muted-foreground">
              {t("trial_expired_contact")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Trial active — show banner if < 3 days left
  if (trialStatus.isTrial && trialStatus.daysLeft <= 3 && trialStatus.daysLeft > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-attention-300/60 bg-attention-50 p-4 text-sm dark:bg-attention-500/10">
          <Clock className="h-5 w-5 shrink-0 text-warning-ink" />
          <div className="flex-1">
            <p className="font-medium text-warning-ink dark:text-attention-300">
              {t("trial_expiring_soon").replace("{n}", String(trialStatus.daysLeft)).replace("{s}", lang === "ar" ? (trialStatus.daysLeft === 1 ? "" : "ًا") : (trialStatus.daysLeft === 1 ? "" : "s"))}
            </p>
          </div>
        </div>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}
