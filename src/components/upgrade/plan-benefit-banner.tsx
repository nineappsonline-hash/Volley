"use client";

import Link from "next/link";
import { Check, Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, type Dict } from "@/lib/i18n";

type AcademyPlan = "starter" | "plus" | "elite";

interface AdminPlanBannerProps {
  plan: AcademyPlan;
  isTrial?: boolean;
}

export function AdminPlanBanner({ plan, isTrial }: AdminPlanBannerProps) {
  const { t } = useI18n();

  if (plan === "elite") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-positive-300/60 bg-positive-50 p-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in-up">
        <div className="flex items-start gap-3">
          <Crown className="mt-0.5 h-5 w-5 shrink-0 text-success-ink" />
          <div>
            <p className="text-sm font-semibold text-success-ink ">
              {t(isTrial ? "plan_banner_elite_trial" : "plan_banner_elite_title")}
            </p>
            <p className="text-xs text-success-ink ">
              {t("plan_banner_elite_desc")}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/upgrade">{t("plan_banner_cta")}</Link>
        </Button>
      </div>
    );
  }

  const titleKey: keyof Dict =
    plan === "starter" ? "plan_banner_starter_title" : "plan_banner_plus_title";
  const descKey: keyof Dict =
    plan === "starter" ? "plan_banner_starter_desc" : "plan_banner_plus_desc";
  const highlights: (keyof Dict)[] =
    plan === "starter"
      ? ["plan_feat_attendance", "plan_feat_invite_signup", "plan_feat_recurring"]
      : ["plan_feat_evaluations", "plan_feat_forecast", "plan_feat_marketplace", "plan_feat_teams"];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-interactive-300/60 bg-gradient-to-br from-interactive-50 to-attention-50 p-4 animate-fade-in-up sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-info-ink" />
        <div>
          <p className="text-sm font-semibold text-info-ink ">
            {t(titleKey)}
          </p>
          <p className="text-xs text-info-ink/80 ">{t(descKey)}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {highlights.map((h) => (
              <span
                key={h}
                className="flex items-center gap-1.5 text-xs font-medium text-info-ink "
              >
                <Check className="h-3.5 w-3.5 text-info-ink" />
                {t(h)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Button asChild size="sm">
        <Link href="/upgrade">{t("plan_banner_cta")}</Link>
      </Button>
    </div>
  );
}

interface MemberPlanBannerProps {
  memberPlan: "free" | "premium";
}

export function MemberPlanBanner({ memberPlan }: MemberPlanBannerProps) {
  const { t } = useI18n();

  if (memberPlan !== "free") return null;

  const highlights: (keyof Dict)[] = [
    "mplan_leaderboard",
    "mplan_scouting",
  ];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card text-card-foreground p-4 animate-fade-in-up sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Crown className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {t("member_banner_free_title")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("member_banner_free_desc")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {highlights.map((h) => (
              <span
                key={h}
                className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground"
              >
                <Check className="h-3.5 w-3.5 text-primary" />
                {t(h)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Button asChild size="sm">
        <Link href="/upgrade">{t("member_banner_cta")}</Link>
      </Button>
    </div>
  );
}