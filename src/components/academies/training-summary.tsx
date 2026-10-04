"use client";
import { AcademyLogo } from "./academy-logo";
import { type TrainingProgram } from "@/lib/academy-training";
import { useAcademyPhotos } from "@/lib/queries";
import { useI18n } from "@/lib/i18n";
import { formatTime12h } from "@/lib/constants";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { TrainingMediaGallery } from "./training-media";
export function TrainingSummary({program:p,compact=false,showAcademy=true}:{program:TrainingProgram;compact?:boolean;showAcademy?:boolean}) {
 const {lang}=useI18n();const ar=lang==="ar";
 const {data:photos=[]}=useAcademyPhotos(p.academy_id);
 const media=[...photos.map(photo=>({kind:"image" as const,url:photo.photo_url})),...(p.media??[])].filter((item,index,items)=>items.findIndex(other=>other.url===item.url)===index);
 const days=ar?["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
return <div className="min-w-0 space-y-3 text-sm">
{showAcademy&&<div className="flex items-center gap-3"><AcademyLogo academyId={p.academy_id} name={p.academy_name}/><span className="min-w-0 break-words font-semibold">{p.academy_name}</span></div>}
 <TrainingMediaGallery media={media}/>
 <div className="grid gap-2 sm:grid-cols-2"><p className="rounded-xl border bg-muted/30 p-3">{ar?"السن":"Age"}: {p.min_age!=null&&p.max_age!=null?`${p.min_age}–${p.max_age}`:p.min_age!=null?`${p.min_age}+`:p.max_age!=null?`${ar?"حتى":"Up to"} ${p.max_age}`:ar?"كل الأعمار":"All ages"} · {p.gender==="male"?(ar?"ذكور":"Male"):p.gender==="female"?(ar?"إناث":"Female"):(ar?"مختلط":"Mixed")}</p>
 <p className="rounded-xl border bg-muted/30 p-3">{p.rating_count>0?`★ ${p.rating} / 5 (${p.rating_count})`:ar?"لا توجد تقييمات بعد":"No ratings yet"}</p></div>
 {!compact && <><div className="space-y-2 rounded-xl border p-3"><p className="font-semibold">{ar?"مكان التدريب":"Training location"}</p><p className="break-words text-muted-foreground">{[p.venue_address,p.venue_area,p.venue_governorate].filter(Boolean).join(" · ")}</p>
 <DirectionsLinks lat={p.venue_lat} lng={p.venue_lng} query={[p.venue_name,p.venue_address,p.venue_area,p.venue_governorate].filter(Boolean).join(", ")}/></div>
 <details className="rounded-xl border p-3" open><summary className="min-h-6 cursor-pointer font-semibold">{ar?"مواعيد المجموعة":"Group schedule"}</summary><ul className="mt-2 space-y-1">{p.schedule.map((s,i)=><li className="rounded-lg bg-muted/40 p-2" key={i}>{days[s.weekday]} · {formatTime12h(s.start,lang)} – {formatTime12h(s.end,lang)}</li>)}</ul></details></>}
 </div>;
}
