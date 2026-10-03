"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useTrainingPrograms } from "@/lib/academy-training";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared/query-state";
import { TrainingSummary } from "@/components/academies/training-summary";
function distance(lat:number,lng:number,a:number,b:number) {
 const rad=Math.PI/180;const h=Math.sin((a-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(a*rad)*Math.sin((b-lng)*rad/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function NearbyTraining(){
 const {lang}=useI18n();const ar=lang==="ar";const query=useTrainingPrograms();const track=useRef<HTMLUListElement>(null);
 const [position,setPosition]=useState<{lat:number;lng:number}|null>(null);const [area,setArea]=useState("");const [locating,setLocating]=useState(false);const [error,setError]=useState("");
 const programs=(query.data??[]).filter(p=>p.active);const areas=[...new Set(programs.map(p=>[p.venue_governorate,p.venue_area].filter(Boolean).join(" · ")).filter(Boolean))].sort();
 const items=programs.filter(p=>!area||[p.venue_governorate,p.venue_area].filter(Boolean).join(" · ")===area).map(p=>({p,km:position&&p.venue_lat!=null&&p.venue_lng!=null?distance(position.lat,position.lng,p.venue_lat,p.venue_lng):null})).sort((a,b)=>(a.km??Infinity)-(b.km??Infinity)||a.p.name.localeCompare(b.p.name));
 const scroll=(d:number)=>track.current?.scrollBy({left:d*(ar?-1:1)*track.current.clientWidth*.9,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});
 return <section className="training-mobile min-w-0 space-y-3"><h2 className="text-xl font-bold">{ar?"اكتشف مجموعات التدريب":"Discover training groups"}</h2><div className="flex flex-wrap gap-2">
 <Button variant="outline" disabled={locating} onClick={()=>{if(!navigator.geolocation){setError(ar?"اختر المنطقة لعرض التدريب":"Choose an area to find training");return;}setLocating(true);setError("");navigator.geolocation.getCurrentPosition(p=>{setPosition({lat:p.coords.latitude,lng:p.coords.longitude});setArea("");setLocating(false);},()=>{setLocating(false);setError(ar?"تعذر تحديد موقعك. اختر المنطقة أدناه.":"Could not access your location. Choose an area below.");},{timeout:10000,maximumAge:300000});}}>{locating?(ar?"جارٍ تحديد الموقع…":"Locating…"):(ar?"الأقرب لموقعي":"Nearest to me")}</Button>
 <select aria-label={ar?"المنطقة":"Area"} className="min-w-0 max-w-full rounded border bg-background p-2 text-sm" value={area} onChange={e=>setArea(e.target.value)}><option value="">{ar?"كل المناطق":"All areas"}</option>{areas.map(a=><option key={a}>{a}</option>)}</select>
 <Button variant="outline" disabled={items.length<2} onClick={()=>scroll(-1)}>{ar?"السابق":"Previous"}</Button><Button variant="outline" disabled={items.length<2} onClick={()=>scroll(1)}>{ar?"التالي":"Next"}</Button></div>
 {error&&<p role="status" className="text-sm">{error}</p>}{position&&<p className="text-xs text-muted-foreground">{ar?"مرتبة حسب المسافة التقريبية من موقعك؛ المجموعات بدون إحداثيات تظهر أخيرًا.":"Sorted by approximate distance; groups without coordinates appear last."}</p>}
 <QueryState queries={[query]}>{!items.length?<p>{ar?"لا توجد مجموعات تدريب متاحة في هذه المنطقة.":"No training groups available in this area."}</p>:<ul ref={track} tabIndex={0} aria-label={ar?"مجموعات التدريب":"Training groups"} className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3">{items.map(({p,km})=><li key={p.id} className="w-[92%] min-w-0 max-w-lg shrink-0 snap-start rounded-2xl border bg-card p-4 sm:w-[70%]"><article className="space-y-3"><h3 className="text-lg font-semibold">{p.academy_name} · {p.name}</h3><p className="text-sm">{p.sport} · {p.venue_name}{km!=null&&` · ${km.toFixed(1)} ${ar?"كم":"km"}`}</p><TrainingSummary program={p}/><p className="font-semibold">{formatMoney(Number(p.monthly_price),lang)} / {ar?"٣٠ يومًا":"30 days"} · {p.monthly_sessions} {ar?"حصص":"sessions"}</p><p>{ar?"الحصة التجريبية":"Trial session"}: {formatMoney(Number(p.trial_price),lang)}</p><Button asChild className="min-h-11 h-auto whitespace-normal"><Link href={`/a/${p.academy_slug}#training-${p.id}`}>{ar?"التفاصيل والحجز":"Details & booking"}</Link></Button></article></li>)}</ul>}</QueryState>
 </section>;
}
