"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
type Totals = { totalGames: number; playerWins: number; cpuWins: number; draws: number };
export function BeachGameStats({ className }: { className?: string }) {
 const { lang } = useI18n(); const ar = lang === "ar";
 const [totals, setTotals] = useState<Totals | null>(null), [failed, setFailed] = useState(false);
 useEffect(() => {
  const abort = new AbortController(); let pending = false;
  async function refresh() {
   if (pending || document.hidden) return; pending = true;
   try { const r = await fetch("/api/game/beach-stats", { cache: "no-store", signal: abort.signal }); if (!r.ok) throw Error(); const data = await r.json(); if (![data.totalGames,data.playerWins,data.cpuWins,data.draws].every(n=>Number.isSafeInteger(n)&&n>=0)) throw Error(); setTotals(data);setFailed(false); }
   catch { if (!abort.signal.aborted) setFailed(true); } finally { pending = false; }
  }
  const message = (e: MessageEvent) => { if(e.origin===location.origin&&e.data?.channel==='playza-beach'&&e.data.type==='stats-updated')void refresh(); };
  void refresh();const timer=window.setInterval(refresh,45000);window.addEventListener('focus',refresh);window.addEventListener('message',message);document.addEventListener('visibilitychange',refresh);
  return ()=>{abort.abort();clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('message',message);document.removeEventListener('visibilitychange',refresh);};
 }, []);
 const format=(n:number)=>new Intl.NumberFormat(ar?'ar-EG':'en').format(n);
 return <section className={cn("rounded-xl border border-white/15 bg-white/5 p-3 text-white",className)} aria-label={ar?"إحصائيات اللعبة لكل اللاعبين":"Community game totals"}>
  <p className="mb-2 text-xs font-bold text-white/75">{ar?"نتائج لعبة بلايزا للكرة الطائرة ثلاثية الأبعاد":"Playza 3D Volleyball game results"}</p>
  <dl className="grid grid-cols-3 gap-2 text-center" aria-live="polite">
   {[[ar?'مباريات لُعبت':'Games played',totals?.totalGames],[ar?'فوز اللاعبين':'Player wins',totals?.playerWins],[ar?'فوز الكمبيوتر':'CPU wins',totals?.cpuWins]].map(([label,value])=><div key={label}><dd className="text-xl font-black tabular-nums text-highlight">{typeof value==='number'?format(value):'—'}</dd><dt className="mt-0.5 text-[11px] font-medium text-white/80">{label}</dt></div>)}
  </dl>
  <p className="mt-2 text-[10px] text-white/60">{failed?(ar?'الإحصائيات غير متاحة حاليًا':'Stats temporarily unavailable'):(ar?'المباريات المكتملة فقط':'Completed matches only')}{!failed&&totals&&totals.draws>0?` · ${ar?'تعادل':'Draws'}: ${format(totals.draws)}`:''}</p>
 </section>;
}
