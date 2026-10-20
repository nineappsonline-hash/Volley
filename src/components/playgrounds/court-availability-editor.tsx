"use client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VenueUnavailableSlot } from "@/lib/types";
type Window = VenueUnavailableSlot & {court_number:number};
export function CourtAvailabilityEditor({value,onChange,courtCount}:{value:Window[];onChange:(v:Window[])=>void;courtCount:number}){
 const {lang}=useI18n();const ar=lang==="ar";
 const days=ar?["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
 const update=(i:number,patch:Partial<Window>)=>onChange(value.map((v,n)=>n===i?{...v,...patch}:v));
 return <fieldset className="space-y-3 rounded-xl border p-3"><legend className="px-1 font-bold">{ar?"أيام ومواعيد كل ملعب":"Days and times for each court"}</legend><p className="text-xs text-muted-foreground">{ar?"أضف كل الفترات المتاحة لكل ملعب. عند إضافة مواعيد، تكون باقي الأيام والفترات مغلقة. بدون مواعيد تُطبق إعدادات الإتاحة الحالية.":"Add every available window for each court. Once configured, unlisted days and times are closed. Leave empty to use existing availability settings."}</p>
 {value.map((v,i)=><div key={i} className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2 sm:grid-cols-5"><Label className="space-y-1 text-xs"><span>{ar?"الملعب":"Court"}</span><select className="h-9 w-full rounded border bg-card px-2" value={v.court_number} onChange={e=>update(i,{court_number:Number(e.target.value)})}>{Array.from({length:courtCount},(_,n)=><option key={n+1} value={n+1}>{n+1}</option>)}</select></Label><Label className="space-y-1 text-xs"><span>{ar?"اليوم":"Day"}</span><select className="h-9 w-full rounded border bg-card px-2" value={v.weekday} onChange={e=>update(i,{weekday:Number(e.target.value)})}>{days.map((d,n)=><option key={d} value={n}>{d}</option>)}</select></Label><Label className="space-y-1 text-xs"><span>{ar?"من":"From"}</span><Input type="time" value={v.start} onChange={e=>update(i,{start:e.target.value})}/></Label><Label className="space-y-1 text-xs"><span>{ar?"إلى":"To"}</span><Input type="time" value={v.end} onChange={e=>update(i,{end:e.target.value})}/></Label><Button type="button" variant="outline" className="self-end" onClick={()=>onChange(value.filter((_,n)=>n!==i))}>{ar?"حذف":"Remove"}</Button></div>)}
 <Button type="button" variant="outline" onClick={()=>onChange([...value,{court_number:1,weekday:0,start:"09:00",end:"22:00"}])}>{ar?"إضافة فترة متاحة":"Add available window"}</Button></fieldset>;
}
