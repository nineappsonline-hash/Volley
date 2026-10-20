"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import type { Profile, Role } from "@/lib/types";
import { PlanComparison } from "./plan-comparison";
import { MemberPlanComparison } from "./member-plan-comparison";

type Tier = "starter" | "plus" | "elite";

export function UpgradeClient({
  profile,
  role,
}: {
  profile: Profile;
  role: Role;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();

  const isPremium = profile.member_plan === "premium";
  const current: Tier = isPremium ? "plus" : "starter";
  const expiresAt = profile.premium_expires_at
    ? format(new Date(profile.premium_expires_at), "MMM d, yyyy", {
        locale: lang === "ar" ? undefined : undefined,
      })
    : null;

  const onSubscribe = (tier: Tier) => {
    router.push(`/checkout?kind=academy&plan=${tier}`);
  };

  const onMemberSubscribe = () => {
    router.push("/checkout?kind=member&plan=pro");
  };

  const isOwner = role === "admin" || role === "super_admin";
  const isMember = role === "member" || role === "super_admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(isOwner && !isMember ? "plans_page_title" : "premium_page_title")}
        subtitle={t(
          isOwner && !isMember ? "plans_page_subtitle" : "premium_page_subtitle"
        )}
      />

      {isPremium && role !== "super_admin" && (
        <div className="flex items-center gap-3 rounded-lg border border-interactive-300/60 bg-interactive-50 p-4 text-sm ">
          <Crown className="h-5 w-5 shrink-0 text-info-ink" />
          <div>
            <p className="font-medium text-info-ink ">
              {t("premium_active_message")}
            </p>
            {expiresAt && (
              <p className="text-xs text-info-ink/80 ">
                {t("premium_expires")}: {expiresAt}
              </p>
            )}
          </div>
        </div>
      )}

      {isOwner && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("plans_compare_subtitle")}
          </p>

          <PlanComparison
            current={current}
            busy={false}
            onSubscribe={onSubscribe}
          />
        </>
      )}

      {isMember && (
        <>
          <p className="pt-4 text-sm font-semibold text-foreground">
            {t("mplan_page_title")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("mplan_page_subtitle")}
          </p>

          <MemberPlanComparison
            currentPlan={profile.member_plan}
            onSubscribe={onMemberSubscribe}
          />
        </>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {t("premium_payment_note")}
      </p>
      <p className="text-center text-[10px] text-muted-foreground/60">
        {t("premium_gateway_soon")}
      </p>
    </div>
  );
}