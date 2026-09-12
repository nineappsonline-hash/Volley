"use client";

import { useRouter } from "next/navigation";
import { Crown, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n, type Dict } from "@/lib/i18n";
import { useAcademy } from "@/lib/queries";

interface EnterpriseGateProps {
  children: React.ReactNode;
}

/**
 * Renders children only when the academy is on the Enterprise (elite) plan.
 * Otherwise shows an upgrade prompt. Used to gate tournament organizing.
 */
export function EnterpriseGate({ children }: EnterpriseGateProps) {
  const { t } = useI18n();
  const router = useRouter();
  const { data: academy, isLoading } = useAcademy();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-32 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (academy?.plan === "elite") return <>{children}</>;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.06]">
        <div className="h-full w-full bg-[radial-gradient(circle_at_30%_40%,hsl(var(--primary)),transparent_60%)]" />
      </div>
      <CardHeader className="relative z-10 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-interactive-700 text-white shadow-lg shadow-interactive-500/30">
          <Crown className="h-6 w-6" />
        </div>
        <CardTitle className="text-lg">{t("enterprise_gate_title")}</CardTitle>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          {t("enterprise_gate_description")}
        </p>
        <ul className="mx-auto grid max-w-sm grid-cols-1 gap-2 text-left text-sm">
          {[
            "enterprise_gate_feat_tournaments",
            "enterprise_gate_feat_teams",
            "enterprise_gate_feat_scoreboard",
          ].map((key) => (
            <li key={key} className="flex items-center gap-2">
              <Swords className="h-3.5 w-3.5 shrink-0 text-info-ink" />
              <span>{t(key as keyof Dict)}</span>
            </li>
          ))}
        </ul>
        <Button
          className="w-full bg-gradient-to-r from-interactive-600 to-interactive-700 text-white hover:from-interactive-700 hover:to-interactive-800"
          onClick={() => router.push("/upgrade")}
        >
          <Crown className="mr-2 h-4 w-4" />
          {t("enterprise_gate_cta")}
        </Button>
      </CardContent>
    </Card>
  );
}