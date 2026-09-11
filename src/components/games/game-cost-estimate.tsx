"use client";
import { useI18n } from "@/lib/i18n";
import { estimateSharePrice } from "@/lib/game-costs";
import { formatMoney } from "@/lib/constants";

export function GameCostEstimate({
  rate,
  hours,
  min,
  compact = false,
}: {
  rate: number | null | undefined;
  hours: number;
  min: number;
  compact?: boolean;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const estimate = estimateSharePrice(rate, hours, min);
  return (
    <div className="space-y-1 rounded-lg border bg-info/5 p-3 text-sm">
      <p className="font-semibold">
        {ar ? "السعر لكل لاعب" : "Per-player price"}
      </p>
      <p className="text-muted-foreground">
        {ar
          ? `الحد الأدنى ${min} لاعبين · المدة ${hours} ساعة`
          : min && hours
            ? `${min} min players · ${hours} hours`
            : ""}
      </p>
      {estimate ? (
        <>
          <p className="font-extrabold text-info-ink">
            {formatMoney(estimate.total, lang)}
          </p>
          <details open={compact ? undefined : true}>
            <summary className="cursor-pointer text-xs font-medium">
              {ar ? "تفاصيل حساب التكلفة" : "Cost breakdown"}
            </summary>
            <p className="mt-1">
              {ar
                ? `إجمالي الملعب: ${formatMoney(rate!, lang)} × ${hours} ساعة = ${formatMoney(Math.round(rate! * hours * 100) / 100, lang)}، مقسم بالتساوي على ${min} لاعب (الحد الأدنى).`
                : `Playground total: ${formatMoney(rate!, lang)} × ${hours} hours = ${formatMoney(Math.round(rate! * hours * 100) / 100, lang)}, split evenly across ${min} players (the minimum).`}
            </p>
          </details>
          <p className="text-[11px] text-muted-foreground">
            {ar
              ? "إذا زاد عدد اللاعبين عن الحد الأدنى، سيتم إرجاع المبلغ الزائد الذي دفعته."
              : "If more players join than the minimum, you'll be refunded any extra amount you paid."}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">
          {ar
            ? "التقدير مش متاح. اختار ملعب بسعر معروف وأدخل عدد لاعبين ومدة صحيحين."
            : "Estimate unavailable. Choose a priced playground and valid player limits and duration."}
        </p>
      )}
    </div>
  );
}