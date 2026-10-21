"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useAcademyWorkspace, useAcademyAction } from '@/lib/academy-workspace';
import { useI18n } from '@/lib/i18n';
import { QueryState } from '@/components/shared/query-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { todayInput } from '@/lib/utils';
export function BookedTrainingAgenda({attendance=false}:{attendance?:boolean}){
 const {lang}=useI18n();const ar=lang==='ar';const [day,setDay]=useState(todayInput());const query=useAcademyWorkspace('',day);const action=useAcademyAction();const agenda=query.data?.agenda.filter(s=>!attendance||s.date===day)??[];
 return <section className="space-y-3 rounded-2xl border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">{ar?'التدريب المحجوز والمؤكد':'Confirmed purchased training'}</h2><Link className="underline" href="/academy#attendance">{ar?'إدارة المجموعات والحجوزات':'Manage groups & bookings'}</Link></div><label className="block text-sm">{ar?'تاريخ العرض':'Display date'}<Input className="mt-1 max-w-xs" type="date" value={day} onChange={e=>e.target.value&&setDay(e.target.value)}/></label><QueryState queries={[query]}>{!agenda.length&&<p className="text-sm text-muted-foreground">{ar?"مفيش حصص محجوزة ومؤكدة في الاختيار ده.":'No confirmed purchased sessions match this selection.'}</p>}<div className="max-h-96 space-y-3 overflow-y-auto">{agenda.map(s=><article key={`${s.booking_id}${s.date}${s.time}`} className="rounded-lg border p-3"><strong>{s.program} · {s.member}</strong><p className="text-sm">{s.date} · {s.time.slice(0,5)} — {s.end.slice(0,5)} · {s.venue} · {ar?'ملعب':'Court'} {s.court}</p>{attendance&&<div className="mt-2 flex flex-wrap gap-2">{[true,false].map(present=><Button key={String(present)} variant={s.present===present?'default':'outline'} disabled={action.isPending||s.date>todayInput()||!query.data?.capabilities.attendance} onClick={()=>action.mutate({name:'academy_mark_booking_attendance',args:{p_booking:s.booking_id,p_date:s.date,p_time:s.time,p_present:present}})}>{present?(ar?'حاضر':'Present'):(ar?'غائب':'Absent')}</Button>)}</div>}</article>)}</div></QueryState></section>;
}
