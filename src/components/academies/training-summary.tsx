"use client";
import { type TrainingProgram } from "@/lib/academy-training";
import { useI18n } from "@/lib/i18n";
import { formatTime12h } from "@/lib/constants";
import { DirectionsLinks } from "@/components/shared/directions-links";
import { TrainingMediaGallery } from "./training-media";
export function TrainingSummary({program:p}:{program:TrainingProgram}) {
 const {lang}=useI18n();const ar=lang==="ar";
 const days=ar?["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
 return <div className="min-w-0 space-y-3 text-sm">
 <TrainingMediaGallery media={p.media}/>
 <p>{ar?"السن":"Age"}: {p.min_age!=null&&p.max_age!=null?`${p.min_age}–${p.max_age}`:p.min_age!=null?`${p.min_age}+`:p.max_age!=null?`${ar?"حتى":"Up to"} ${p.max_age}`:ar?"كل الأعمار":"All ages"} · {p.gender==="male"?(ar?"ذكور":"Male"):p.gender==="female"?(ar?"إناث":"Female"):(ar?"مختلط":"Mixed")}</p>
 <p>{p.rating_count>0?`★ ${p.rating} / 5 (${p.rating_count})`:ar?"لا توجد تقييمات بعد":"No ratings yet"}</p>
 <p className="break-words">{[p.venue_address,p.venue_area,p.venue_governorate].filter(Boolean).join(" · ")}</p>
 <DirectionsLinks lat={p.venue_lat} lng={p.venue_lng} query={[p.venue_name,p.venue_address,p.venue_area,p.venue_governorate].filter(Boolean).join(", ")}/>
 <details><summary className="cursor-pointer">{ar?"مواعيد المجموعة":"Group schedule"}</summary><ul className="mt-2 space-y-1">{p.schedule.map((s,i)=><li key={i}>{days[s.weekday]} · {formatTime12h(s.start,lang)} – {formatTime12h(s.end,lang)}</li>)}</ul></details>
 </div>;
}
