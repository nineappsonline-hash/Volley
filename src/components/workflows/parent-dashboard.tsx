"use client";
import { NativeSelect } from "@/components/ui/sorted-options";
import { useState } from 'react';
import Link from 'next/link';
import { useChildren, useAttendance, useAllPayments, useSessions, useEvaluations } from '@/lib/queries';
import { usedSessionsSincePayment } from '@/lib/calculations';
import { useI18n } from '@/lib/i18n';
import { formatTime12h } from '@/lib/constants';
import { QueryState } from '@/components/shared/query-state';
import { Card,CardHeader,CardTitle,CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
export function ParentDashboard(){
 const {lang}=useI18n();const ar=lang==='ar';const children=useChildren();const [selected,setSelected]=useState('');
 const child=children.data?.find(c=>c.id===selected)??children.data?.[0];
 return <QueryState queries={[children]}>{child&&<Card><CardHeader><CardTitle>{ar?'متابعة ولادك':'Your children at a glance'}</CardTitle></CardHeader><CardContent className="space-y-4"><label className="block text-sm">{ar?'اختار الطفل':'Choose a child'}<NativeSelect value={child.id} onChange={e=>setSelected(e.target.value)} className="ms-3 rounded border bg-background p-2">{children.data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></label><ChildSummary key={child.id} child={child}/></CardContent></Card>}</QueryState>;
}
function ChildSummary({child}:{child:import('@/lib/types').Profile}){
 const {lang}=useI18n();const ar=lang==='ar';const sessions=useSessions();const attendance=useAttendance();const payments=useAllPayments();const evaluations=useEvaluations(child.id);
 const mine=(payments.data??[]).filter(p=>p.member_id===child.id);const used=usedSessionsSincePayment((attendance.data??[]).filter(a=>a.member_id===child.id),sessions.data??[],mine);
 const next=(sessions.data??[]).filter(s=>s.academy_id===child.academy_id&&s.status==='scheduled'&&s.date>=format(new Date(),'yyyy-MM-dd')).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
 const latest=evaluations.data?.[0];
 return <QueryState queries={[sessions,attendance,payments,evaluations]}><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-info/10 p-4"><p className="text-sm">{ar?"التمرين الجاي بالأكاديمية":'Next academy session'}</p><strong>{next?`${next.date} · ${formatTime12h(next.time, lang)}`:'—'}</strong><p className="text-xs">{ar?'راجع الجدول للتأكد من المجموعة المناسبة.':'Check the schedule for the appropriate group.'}</p></div><div className="rounded-lg bg-success/10 p-4"><p>{ar?'الحصص المتبقية':'Sessions remaining'}</p><strong>{Math.max(0,child.subscription_sessions-used)}</strong></div><div className="rounded-lg bg-muted p-4"><p>{ar?'آخر تقييم':'Latest evaluation'}</p><strong>{latest?.evaluation_date??'—'}</strong><p className="line-clamp-2 text-sm">{latest?.notes}</p></div></div><Button asChild className="mt-4"><Link href={`/profile/children/${child.id}`}>{ar?'افتح الملف والتقييمات':'Open profile and feedback'}</Link></Button></QueryState>;
}
