"use client";

import { useRouter } from "next/navigation";
import { Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n";
import type { Profile } from "@/lib/types";

interface PremiumGateProps {
  profile: Profile;
  children: React.ReactNode;
  /** Short description shown on the upgrade prompt */
  description?: string;
}

export function PremiumGate({ profile, children, description }: PremiumGateProps) {
  const { t } = useI18n();
  const router = useRouter();

  const isPremium = profile.member_plan === "premium";

  if (isPremium) return <>{children}</>;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.06]">
        <div className="h-full w-full bg-[radial-gradient(circle_at_30%_40%,hsl(var(--primary)),transparent_60%)]" />
      </div>
      <CardHeader className="relative z-10 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30">
          <Crown className="h-6 w-6" />
        </div>
        <CardTitle className="text-lg">{t("premium_gate_title")}</CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          {description || t("premium_gate_description")}
        </p>
        <ul className="mx-auto grid max-w-sm grid-cols-1 gap-2 text-left text-sm">
          {[
            "premium_feat_events",
            "premium_feat_leaderboard",
            "premium_feat_analytics",
            "premium_feat_scouting",
            "premium_feat_card",
            "premium_feat_friendlies",
          ].map((key) => (
            <li key={key} className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>{t(key as keyof Dict)}</span>
            </li>
          ))}
        </ul>
        <Button
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700"
          onClick={() => router.push("/upgrade")}
        >
          <Crown className="mr-2 h-4 w-4" />
          {t("premium_upgrade_cta")}
        </Button>
      </CardContent>
    </Card>
  );
}
