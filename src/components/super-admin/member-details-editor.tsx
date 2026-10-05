"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { memberDetailsAction, memberAge } from "@/lib/admin/member-details";
import { errorMessage } from "@/lib/utils";

type RecordRow = Record<string, any>;
export function MemberDetailsEditor({member,academies}:{member:RecordRow;academies:RecordRow[]}) {
 const {lang}=useI18n();const ar=lang==="ar";const cache=useQueryClient();
 const [draft,setDraft]=useState<RecordRow|null>(null);const [busy,setBusy]=useState(false);
 const fields=[['name','Full name','الاسم الكامل'],['nickname','Nickname','الاسم المستعار'],['phone','Phone','الهاتف'],['birth_date','Date of birth','تاريخ الميلاد'],['country','Country','الدولة'],['join_date','Join date','تاريخ الانضمام']] as const;
 if(!draft)return <Button type="button" onClick={()=>setDraft({...member})}>{ar?"تعديل بيانات العضو":"Edit member details"}</Button>;
 const set=(key:string,value:unknown)=>setDraft({...draft,[key]:value});
 return <form className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2" onSubmit={async e=>{
  e.preventDefault();if(busy)return;
  const payload={action:'member_details',id:member.id,...Object.fromEntries(fields.map(([key])=>[key,draft[key]||null])),bio:draft.bio||null,gender:draft.gender||null,academy_id:draft.academy_id||null,subscription_sessions:Number(draft.subscription_sessions??0),is_active:!!draft.is_active,member_plan:draft.member_plan??'free',premium_expires_at:draft.premium_expires_at?new Date(draft.premium_expires_at).toISOString():null};
  const parsed=memberDetailsAction.safeParse(payload);if(!parsed.success){toast.error(parsed.error.issues[0].message);return;}
  setBusy(true);try{const response=await fetch('/api/platform-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data)});const result=await response.json();if(!response.ok)throw new Error(result.error);await cache.invalidateQueries();setDraft(null);toast.success(ar?'تم حفظ البيانات':'Member details saved');}catch(error){toast.error(errorMessage(error,ar?'تعذر الحفظ':'Could not save'));}finally{setBusy(false);}
 }}>
 <h3 className="font-semibold sm:col-span-2">{ar?"البيانات الشخصية والعضوية":"Personal details & membership"}</h3>
 {fields.map(([key,en,arabic])=><label key={key} className="space-y-1 text-sm">{ar?arabic:en}<Input disabled={busy} required={key==='name'} maxLength={key==='phone'?40:100} type={key.endsWith('date')?'date':key==='phone'?'tel':'text'} value={draft[key]??''} onChange={e=>set(key,e.target.value)}/>{key==='birth_date'&&<span className="text-xs text-muted-foreground">{ar?'العمر':'Age'}: {memberAge(draft.birth_date)??'—'}</span>}</label>)}
 <label className="space-y-1 text-sm">{ar?'النوع':'Gender'}<select disabled={busy} className="block min-h-11 w-full rounded border bg-background p-2" value={draft.gender??''} onChange={e=>set('gender',e.target.value)}><option value="">{ar?'غير محدد':'Not specified'}</option><option value="male">{ar?'ذكر':'Male'}</option><option value="female">{ar?'أنثى':'Female'}</option></select></label>
 <label className="space-y-1 text-sm">{ar?'الأكاديمية الأساسية':'Primary academy'}<select disabled={busy} className="block min-h-11 w-full rounded border bg-background p-2" value={draft.academy_id??''} onChange={e=>set('academy_id',e.target.value)}><option value="">{ar?'بدون أكاديمية':'No academy'}</option>{academies.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
 <p className="text-xs text-muted-foreground sm:col-span-2">{ar?'تغيير الأكاديمية الأساسية لا ينقل حجوزات التدريب أو المدفوعات السابقة.':'Changing the primary academy does not move existing training bookings or payment history.'}</p>
 <label className="space-y-1 text-sm sm:col-span-2">{ar?'نبذة':'Bio'}<textarea disabled={busy} maxLength={2000} className="block min-h-24 w-full rounded border bg-background p-2" value={draft.bio??''} onChange={e=>set('bio',e.target.value)}/></label>
 <label className="space-y-1 text-sm">{ar?'حصص الاشتراك':'Subscription sessions'}<Input disabled={busy} type="number" min={0} max={10000} required value={draft.subscription_sessions??0} onChange={e=>set('subscription_sessions',e.target.value)}/></label>
 <label className="space-y-1 text-sm">{ar?'خطة المنصة':'Platform plan'}<select disabled={busy} className="block min-h-11 w-full rounded border bg-background p-2" value={draft.member_plan??'free'} onChange={e=>set('member_plan',e.target.value)}><option value="free">{ar?'مجانية':'Free'}</option><option value="premium">{ar?'مميزة':'Premium'}</option></select></label>
 <label className="space-y-1 text-sm">{ar?'انتهاء الخطة المميزة':'Premium expiry'}<Input disabled={busy} type="date" value={draft.premium_expires_at?.slice(0,10)??''} onChange={e=>set('premium_expires_at',e.target.value)}/></label>
 <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input disabled={busy} type="checkbox" checked={!!draft.is_active} onChange={e=>set('is_active',e.target.checked)}/>{ar?'عضوية أكاديمية نشطة':'Active academy membership'}</label>
 <div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={busy} type="submit">{ar?'حفظ التغييرات':'Save changes'}</Button><Button disabled={busy} type="button" variant="outline" onClick={()=>setDraft(null)}>{ar?'إلغاء':'Cancel'}</Button></div>
 </form>;
}
