"use client";
import { useI18n } from "@/lib/i18n";
import { estimateGameCost } from "@/lib/game-costs";
import { formatMoney } from "@/lib/constants";

export function GameCostEstimate({ rate, hours, min, max }: { rate: number | null | undefined; hours: number; min: number; max: number }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const estimate = estimateGameCost(rate, hours, min, max);
  return <div className="rounded-lg border bg-info/5 p-3 space-y-1 text-sm">
    <p className="font-semibold">{ar ? "التكلفة المتوقعة لكل لاعب" : "Estimated cost per player"}</p>
    <p className="text-muted-foreground">{ar ? `عدد اللاعبين: من ${min} لـ ${max} · المدة: ${hours} ساعة` : `${min}–${max} players · ${hours} hours`}</p>
    {estimate ? <>
      <p className="font-semibold text-info-ink">{formatMoney(estimate.low)} – {formatMoney(estimate.high)}</p>
      <p>{ar ? `عند اكتمال ${max} لاعب: ${formatMoney(estimate.low)} للفرد. عند الحد الأدنى ${min}: ${formatMoney(estimate.high)} للفرد.` : `At ${max} players: ${formatMoney(estimate.low)} each. At ${min} players: ${formatMoney(estimate.high)} each.`}</p>
      <p className="text-xs text-muted-foreground">{ar ? `إجمالي الملعب: ${formatMoney(rate!)} × ${hours} ساعة = ${formatMoney(estimate.total)}` : `Playground total: ${formatMoney(rate!)} × ${hours} hours = ${formatMoney(estimate.total)}`}</p>
    </> : <p className="text-muted-foreground">{ar ? "التقدير مش متاح. اختار ملعب بسعر معروف وأدخل عدد لاعبين ومدة صحيحين." : "Estimate unavailable. Choose a priced playground and valid player limits and duration."}</p>}
    <p className="text-xs text-muted-foreground">{ar ? "تقسيم بالتساوي شامل المنظم. تقدير فقط حسب سعر الملعب وقت إنشاء الجيم؛ رسوم إنشاء الجيم وأي إضافات مش داخلة." : "Split equally, including the organizer. Estimate based on the playground price when created; excludes the game-creation fee and extras."}</p>
  </div>;
}
