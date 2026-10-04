"use client";
import Link from "next/link";
import { MapPin, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { useTrainingPrograms } from "@/lib/academy-training";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared/query-state";
import { EmptyState } from "@/components/shared/empty-state";
import {
  CarouselArrows,
  CarouselDots,
  CarouselFade,
  useCarousel,
} from "@/components/shared/carousel";

function distance(lat:number,lng:number,a:number,b:number) {
 const rad=Math.PI/180;const h=Math.sin((a-lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(a*rad)*Math.sin((b-lng)*rad/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));
}

export function NearbyTraining(){
 const {t,lang}=useI18n();const ar=lang==="ar";
 const query=useTrainingPrograms();
 const {track,scroll,index,pages,atStart,atEnd}=useCarousel(lang);
 const [position,setPosition]=useState<{lat:number;lng:number}|null>(null);
 const [area,setArea]=useState("");
 const [locating,setLocating]=useState(false);
 const [error,setError]=useState("");
 const programs=(query.data??[]).filter(p=>p.active);
 const areas=[...new Set(programs.map(p=>[p.venue_governorate,p.venue_area].filter(Boolean).join(" · ")).filter(Boolean))].sort();
 const items=programs
  .filter(p=>!area||[p.venue_governorate,p.venue_area].filter(Boolean).join(" · ")===area)
  .map(p=>({p,km:position&&p.venue_lat!=null&&p.venue_lng!=null?distance(position.lat,position.lng,p.venue_lat,p.venue_lng):null}))
  .sort((a,b)=>(a.km??Infinity)-(b.km??Infinity)||a.p.name.localeCompare(b.p.name));

 return <section className="training-mobile min-w-0 space-y-3">
  <header className="flex flex-wrap items-center justify-between gap-2">
   <h2 className="text-xl font-bold">{ar?"اكتشف مجموعات التدريب":"Discover training groups"}</h2>
   <CarouselArrows
    onPrev={()=>scroll(-1)}
    onNext={()=>scroll(1)}
    canPrev={!atStart}
    canEnd={!atEnd}
    disabled={items.length<2}
    prevLabel={ar?"السابق":"Previous"}
    nextLabel={ar?"التالي":"Next"}
   />
  </header>
  <div className="flex flex-wrap gap-2">
   <Button variant="outline" disabled={locating} onClick={()=>{
    if(!navigator.geolocation){setError(ar?"اختر المنطقة لعرض التدريب":"Choose an area to find training");return;}
    setLocating(true);setError("");
    navigator.geolocation.getCurrentPosition(
     p=>{setPosition({lat:p.coords.latitude,lng:p.coords.longitude});setArea("");setLocating(false);},
     ()=>{setLocating(false);setError(ar?"تعذر تحديد موقعك. اختر المنطقة أدناه.":"Could not access your location. Choose an area below.");},
     {timeout:10000,maximumAge:300000});
   }}>{locating?(ar?"جارٍ تحديد الموقع…":"Locating…"):(ar?"الأقرب لموقعي":"Nearest to me")}</Button>
   <select aria-label={ar?"المنطقة":"Area"} className="min-w-0 max-w-full rounded border bg-background p-2 text-sm" value={area} onChange={e=>setArea(e.target.value)}>
    <option value="">{ar?"كل المناطق":"All areas"}</option>
    {areas.map(a=><option key={a}>{a}</option>)}
   </select>
  </div>
  {error&&<p role="status" className="text-sm text-warning-ink">{error}</p>}
  {position&&<p className="text-xs text-muted-foreground">{ar?"مرتبة حسب المسافة التقريبية من موقعك؛ المجموعات بدون إحداثيات تظهر أخيرًا.":"Sorted by approximate distance; groups without coordinates appear last."}</p>}
  <QueryState queries={[query]}>
   {!items.length
    ? <EmptyState
       message={ar?"لا توجد مجموعات تدريب متاحة في هذه المنطقة.":"No training groups available in this area."}
       hint={ar?"جرّب منطقة أخرى أو فعّل تحديد الموقع.":"Try another area, or turn on location access."}
       icon={Users}
       action={<Button asChild className="gap-2"><Link href="/academies">{t("dash_training_find")}</Link></Button>}
      />
    : <div className="relative">
       <CarouselFade side="start" visible={!atStart}/>
       <CarouselFade side="end" visible={!atEnd}/>
       <ul ref={track} tabIndex={0} aria-label={ar?"مجموعات التدريب":"Training groups"} className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {items.map(({p,km})=><li key={p.id} className="w-[82%] max-w-sm shrink-0 snap-start sm:w-[55%] lg:w-[32%]">
         <article className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0">
           <h3 className="line-clamp-1 font-semibold">{p.academy_name}</h3>
           <p className="line-clamp-1 text-sm text-muted-foreground">{p.name}</p>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
           <li className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/><span className="truncate">{[p.venue_name,p.venue_area,p.venue_governorate].filter(Boolean).join(" · ")||p.sport}</span></li>
           {km!=null&&<li>{km.toFixed(1)} {ar?"كم":"km"}</li>}
           <li className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/>{p.monthly_sessions} {ar?"حصص":"sessions"} / {ar?"٣٠ يومًا":"30 days"}</li>
          </ul>
          <p className="flex items-center gap-1.5 text-base font-bold"><Wallet className="h-4 w-4 shrink-0 text-primary" aria-hidden="true"/>{formatMoney(Number(p.monthly_price),lang)}</p>
          <p className="text-xs text-muted-foreground">{ar?"الحصة التجريبية":"Trial session"}: {formatMoney(Number(p.trial_price),lang)}</p>
          <Button asChild className="mt-auto min-h-11 gap-2">
           <Link href={`/a/${p.academy_slug}#training-${p.id}`}>{ar?"التفاصيل والحجز":"Details & booking"}</Link>
          </Button>
         </article>
        </li>)}
       </ul>
      </div>}
   <CarouselDots pages={pages} index={index}/>
  </QueryState>
 </section>;
}