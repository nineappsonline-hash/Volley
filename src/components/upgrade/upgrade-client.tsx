"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import { useActivatePremium } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import { PlanComparison } from "./plan-comparison";

type Tier = "starter" | "plus" | "elite";

const MONTHLY: Record<Tier, number> = {
  starter: 0,
  plus: 200,
  elite: 350,
};

export function UpgradeClient({ profile }: { profile: Profile }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const activate = useActivatePremium();

  const isPremium = profile.member_plan === "premium";
  const current: Tier = isPremium ? "plus" : "starter";
  const expiresAt = profile.premium_expires_at
    ? format(new Date(profile.premium_expires_at), "MMM d, yyyy", {
        locale: lang === "ar" ? undefined : undefined,
      })
    : null;

  const onSubscribe = async (tier: Tier) => {
    if (tier === "starter") return;
    try {
      await activate.mutateAsync({
        months: 1,
        amount: MONTHLY[tier],
        method: "card",
      });
      toast.success(t("premium_activated"));
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error(t("common_error"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("premium_page_title")}
        subtitle={t("premium_page_subtitle")}
      />

      {isPremium && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300/60 bg-amber-50 p-4 text-sm dark:bg-amber-500/10">
          <Crown className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">
              {t("premium_active_message")}
            </p>
            {expiresAt && (
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70">
                {t("premium_expires")}: {expiresAt}
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {t("plans_compare_subtitle")}
      </p>

      <PlanComparison
        current={current}
        busy={activate.isPending}
        onSubscribe={onSubscribe}
      />

      <p className="text-center text-xs text-muted-foreground">
        {t("premium_payment_note")}
      </p>
      <p className="text-center text-[10px] text-muted-foreground/60">
        {t("premium_gateway_soon")}
      </p>
    </div>
  );
}