"use client";
import { useI18n } from "@/lib/i18n";
import { estimateHostTotal, estimateSharePrice } from "@/lib/game-costs";
import { formatMoney } from "@/lib/constants";

export function GameCostEstimate({
  rate,
  hours,
  min,
  compact = false,
  hostPays = false,
  sport = "",
}: {
  rate: number | null | undefined;
  hours: number;
  min: number;
  compact?: boolean;
  hostPays?: boolean;
  sport?: string;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const estimate = hostPays
    ? estimateHostTotal(rate, hours, sport)
    : estimateSharePrice(rate, hours, min, sport);

  return (
    <div className="space-y-1 rounded-lg border bg-info/5 p-3 text-sm">
      <p className="font-semibold">
        {ar
          ? hostPays
            ? "تكلفة الحجز كاملة"
            : "السعر لكل لاعب"
          : hostPays
            ? "Full reservation"
            : "Per-player price"}
      </p>
      <p className="text-muted-foreground">
        {ar
          ? hostPays
            ? `المدة ${hours} ساعة`
            : `الحد الأدنى ${min} لاعبين · المدة ${hours} ساعة`
          : hostPays
            ? `${hours} hours`
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
                ? hostPays
                  ? `إجمالي الملعب: ${formatMoney(rate!, lang)} × ${hours} ساعة = ${formatMoney(Math.round(rate! * hours * 100) / 100, lang)}`
                  : `إجمالي الملعب: ${formatMoney(rate!, lang)} × ${hours} ساعة = ${formatMoney(Math.round(rate! * hours * 100) / 100, lang)}، مقسم بالتساوي على ${min} لاعب (الحد الأدنى).`
                : hostPays
                  ? `Playground total: ${formatMoney(rate!, lang)} × ${hours} hours = ${formatMoney(Math.round(rate! * hours * 100) / 100, lang)}`
                  : `Playground total: ${formatMoney(rate!, lang)} × ${hours} hours = ${formatMoney(Math.round(rate! * hours * 100) / 100, lang)}, split evenly across ${min} players (the minimum).`}
            </p>
          </details>
          <p className="text-[11px] text-muted-foreground">
            {ar
              ? hostPays
                ? "تكفل بالحجز كله — انضم باقي اللاعبين مجانًا."
                : "إذا زاد عدد اللاعبين عن الحد الأدنى، سيتم إرجاع المبلغ الزائد الذي دفعته."
              : hostPays
                ? "You cover the whole reservation — other players join free."
                : "If more players join than the minimum, you'll be refunded any extra amount you paid."}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground">
          {ar
            ? "التقدير مش متاح. اختار ملعب بسعر معروف وأدخل مدة صحيحة."
            : "Estimate unavailable. Choose a priced playground and a valid duration."}
        </p>
      )}
    </div>
  );
}