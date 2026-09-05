"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Crown,
  Loader2,
  Map,
  BarChart3,
  Shield,
  Swords,
  UserCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import { useActivatePremium } from "@/lib/queries";
import type { Profile } from "@/lib/types";

const PLANS = [
  {
    months: 1,
    price: "50",
    labelKey: "premium_plan_monthly",
    perMonth: true,
  },
  {
    months: 6,
    price: "250",
    labelKey: "premium_plan_semi",
    perMonth: false,
  },
  {
    months: 12,
    price: "450",
    labelKey: "premium_plan_yearly",
    perMonth: false,
  },
] as const;

const FEATURES = [
  { icon: Map, key: "premium_feat_events" },
  { icon: Swords, key: "premium_feat_friendlies" },
  { icon: BarChart3, key: "premium_feat_leaderboard" },
  { icon: UserCheck, key: "premium_feat_scouting" },
  { icon: Shield, key: "premium_feat_analytics" },
  { icon: CalendarDays, key: "premium_feat_card" },
] as const;

export function UpgradeClient({ profile }: { profile: Profile }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const activate = useActivatePremium();
  const [selected, setSelected] = useState<number>(1);

  const isPremium = profile.member_plan === "premium";
  const expiresAt = profile.premium_expires_at
    ? format(new Date(profile.premium_expires_at), "MMM d, yyyy", {
        locale: lang === "ar" ? undefined : undefined,
      })
    : null;

  const onSubscribe = async () => {
    const plan = PLANS.find((p) => p.months === selected)!;
    try {
      await activate.mutateAsync({
        months: selected,
        amount: Number(plan.price),
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

      {/* Features grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, key }) => (
          <Card key={key}>
            <CardContent className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm">{t(key)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plans */}
      {!isPremium && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-amber-500" />
              {t("premium_choose_plan")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PLANS.map((plan) => (
                <button
                  key={plan.months}
                  type="button"
                  onClick={() => setSelected(plan.months)}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all ${
                    selected === plan.months
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {plan.months === 12 && (
                    <Badge
                      variant="default"
                      className="absolute -top-2.5 text-[10px]"
                    >
                      {t("premium_best_value")}
                    </Badge>
                  )}
                  <span className="text-2xl font-extrabold">
                    {plan.price} EGP
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(plan.labelKey)}
                  </span>
                  {plan.perMonth ? (
                    <span className="text-[10px] text-muted-foreground">
                      / {t("premium_month")}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {t("premium_total")}
                    </span>
                  )}
                  {selected === plan.months && (
                    <CheckCircle2 className="absolute top-2 end-2 h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>

            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700"
              size="lg"
              disabled={activate.isPending}
              onClick={onSubscribe}
            >
              {activate.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Crown className="mr-2 h-4 w-4" />
              )}
              {t("premium_subscribe")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t("premium_payment_note")}
            </p>
            <p className="text-center text-[10px] text-muted-foreground/60">
              {t("premium_gateway_soon")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
