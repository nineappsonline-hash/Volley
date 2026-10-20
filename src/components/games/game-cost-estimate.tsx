"use client";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
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
  venueId,
}: {
  rate?: number | null;
  venueId?: string | null;
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
  if (venueId && savedPrice == null) return <CourtQuote venueId={venueId} hours={hours} min={min} hostPays={hostPays} sport={sport} />;
  const estimate = savedPrice != null
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
function CourtQuote({venueId,hours,min,hostPays,sport}:{venueId:string;hours:number;min:number;hostPays:boolean;sport:string}) {
  const {data:quote}=useQuery({queryKey:["court-quote",venueId,hours],enabled:hours>0&&hours<=24,queryFn:async()=>{
    const {data,error}=await createClient().rpc("court_booking_quote",{p_venue:venueId,p_hours:hours});if(error)throw error;return data as {per_player:number;full_court:number}|null;
  }});
  return <GameCostEstimate hours={hours} min={min} hostPays={hostPays} sport={sport} pricePerPlayer={quote?(hostPays?quote.full_court:quote.per_player):null}/>;
}
