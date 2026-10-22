"use client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { VenueUnavailableSlot } from "@/lib/types";
type Window = VenueUnavailableSlot & {court_number:number};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/** Splits an "HH:MM" 24-hour value into 12-hour parts. */
function toParts(value: string) {
  const [hRaw, mRaw] = (value || "00:00").split(":");
  const h24 = Number(hRaw);
  const hour = h24 % 12 === 0 ? 12 : h24 % 12;
  const minute = String(Number(mRaw) || 0).padStart(2, "0");
  return { hour, minute: MINUTES.includes(minute) ? minute : "00", period: h24 >= 12 ? "PM" : "AM" };
}

/** Rebuilds an "HH:MM" 24-hour value from 12-hour parts. */
function fromParts(hour: number, minute: string, period: string) {
  let h = hour % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function Time12({ value, onChange, labels }: { value: string; onChange: (v: string) => void; labels: { h: string; m: string; p: string } }) {
  const { hour, minute, period } = toParts(value);
  const set = (patch: Partial<ReturnType<typeof toParts>>) => {
    const next = { hour, minute, period, ...patch };
    onChange(fromParts(next.hour, next.minute, next.period));
  };
  const select = "h-9 w-full rounded border bg-card px-1 text-sm";
  return (
    <div className="flex items-end gap-1">
      <select aria-label={labels.h} className={select} value={hour} onChange={(e) => set({ hour: Number(e.target.value) })}>
        {HOURS.map((h) => (<option key={h} value={h}>{h}</option>))}
      </select>
      <select aria-label={labels.m} className={select} value={minute} onChange={(e) => set({ minute: e.target.value })}>
        {MINUTES.map((m) => (<option key={m} value={m}>{m}</option>))}
      </select>
      <select aria-label={labels.p} className={select} value={period} onChange={(e) => set({ period: e.target.value })}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export function CourtAvailabilityEditor({value,onChange,courtCount}:{value:Window[];onChange:(v:Window[])=>void;courtCount:number}){
 const {lang}=useI18n();const ar=lang==="ar";
 const days=ar?["الأحد","الإثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
 const update=(i:number,patch:Partial<Window>)=>onChange(value.map((v,n)=>n===i?{...v,...patch}:v));
 return <fieldset className="space-y-3 rounded-xl border p-3"><legend className="px-1 font-bold">{ar?"أيام ومواعيد كل ملعب":"Days and times for each court"}</legend><p className="text-xs text-muted-foreground">{ar?"أضف كل الفترات المتاحة لكل ملعب. عند إضافة مواعيد، تكون باقي الأيام والفترات مغلقة. بدون مواعيد تُطبق إعدادات الإتاحة الحالية.":"Add every available window for each court. Once configured, unlisted days and times are closed. Leave empty to use existing availability settings."}</p>
 {value.map((v,i)=><div key={i} className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2 sm:grid-cols-5"><Label className="space-y-1 text-xs"><span>{ar?"الملعب":"Court"}</span><select className="h-9 w-full rounded border bg-card px-2" value={v.court_number} onChange={e=>update(i,{court_number:Number(e.target.value)})}>{Array.from({length:courtCount},(_,n)=><option key={n+1} value={n+1}>{n+1}</option>)}</select></Label><Label className="space-y-1 text-xs"><span>{ar?"اليوم":"Day"}</span><select className="h-9 w-full rounded border bg-card px-2" value={v.weekday} onChange={e=>update(i,{weekday:Number(e.target.value)})}>{days.map((d,n)=><option key={d} value={n}>{d}</option>)}</select></Label><Label className="space-y-1 text-xs"><span>{ar?"من":"From"}</span><Time12 value={v.start} onChange={val=>update(i,{start:val})} labels={{h:ar?"ساعة":"Hour",m:ar?"دقيقة":"Minute",p:ar?"صباحًا/مساءً":"AM/PM"}}/></Label><Label className="space-y-1 text-xs"><span>{ar?"إلى":"To"}</span><Time12 value={v.end} onChange={val=>update(i,{end:val})} labels={{h:ar?"ساعة":"Hour",m:ar?"دقيقة":"Minute",p:ar?"صباحًا/مساءً":"AM/PM"}}/></Label><Button type="button" variant="outline" className="self-end" onClick={()=>onChange(value.filter((_,n)=>n!==i))}>{ar?"حذف":"Remove"}</Button></div>)}
 <Button type="button" variant="outline" onClick={()=>onChange([...value,{court_number:1,weekday:0,start:"09:00",end:"22:00"}])}>{ar?"إضافة فترة متاحة":"Add available window"}</Button></fieldset>;
}
