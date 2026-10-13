"use client";
import { useI18n } from "@/lib/i18n";
import { estimateHostTotal, estimateSharePrice } from "@/lib/game-costs";
import { formatMoney } from "@/lib/constants";

export function GameCostEstimate({
  rate,
  hours,
  min,
  hostPays = false,
  sport = "",
  pricePerPlayer,
}: {
  rate: number | null | undefined;
  hours: number;
  min: number;
  hostPays?: boolean;
  sport?: string;
  /** Saved price takes precedence on existing games; creation forms still estimate. */
  pricePerPlayer?: number | null;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const savedPrice = pricePerPlayer != null && Number.isFinite(pricePerPlayer) && pricePerPlayer >= 0 ? pricePerPlayer : null;
  const estimate = !hostPays && savedPrice != null
    ? { total: savedPrice }
    : hostPays
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