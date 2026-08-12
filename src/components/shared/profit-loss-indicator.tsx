"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/constants";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ProfitLossIndicatorProps {
  value: number;
  showLabel?: boolean;
  className?: string;
}

export function ProfitLossIndicator({
  value,
  showLabel = true,
  className,
}: ProfitLossIndicatorProps) {
  const { t, lang } = useI18n();
  const isProfit = value >= 0;

  return (
    <Badge
      variant={isProfit ? "success" : "destructive"}
      className={cn(
        "gap-1 font-mono text-xs",
        isProfit ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "",
        className
      )}
    >
      {isProfit ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {showLabel && (isProfit ? t("dash_profit") : t("dash_loss"))}
      {formatMoney(value, lang)}
    </Badge>
  );
}
