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

/**
 * Always rendered as a live form rather than behind an "Edit" toggle, so every
 * field in this tab can be changed without switching the tab into another mode.
 * Callers key this by member id, which resets the draft when the member changes.
 */
export function MemberDetailsEditor({ member }: { member: RecordRow }) {
  const {lang}=useI18n();const ar=lang==="ar";const cache=useQueryClient();
  const [draft,setDraft]=useState<RecordRow>(()=>({...member}));const [busy,setBusy]=useState(false);
  const fields=[['name','Full name','الاسم الكامل'],['nickname','Nickname','الاسم المستعار'],['phone','Phone','الهاتف'],['birth_date','Date of birth','تاريخ الميلاد'],['country','Country','الدولة'],['join_date','Join date','تاريخ الانضمام']] as const;
  const set=(key:string,value:unknown)=>setDraft({...draft,[key]:value});
  const save=async(e:React.FormEvent)=>{
   e.preventDefault();if(busy)return;
   const payload={action:'member_details',id:member.id,...Object.fromEntries(fields.map(([key])=>[key,draft[key]||null])),bio:draft.bio||null,gender:draft.gender||null,is_active:!!draft.is_active,member_plan:draft.member_plan??'free',premium_expires_at:draft.premium_expires_at?new Date(draft.premium_expires_at).toISOString():null};
   const parsed=memberDetailsAction.safeParse(payload);if(!parsed.success){toast.error(parsed.error.issues[0].message);return;}
   setBusy(true);try{const response=await fetch('/api/platform-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed.data)});const result=await response.json();if(!response.ok)throw new Error(result.error);await cache.invalidateQueries();toast.success(ar?'تم حفظ البيانات':'Member details saved');}catch(error){toast.error(errorMessage(error,ar?'تعذر الحفظ':'Could not save'));}finally{setBusy(false);}
  };
  return <form className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2" onSubmit={save}>
  <h3 className="font-semibold sm:col-span-2">{ar?"البيانات الشخصية والعضوية":"Personal details & membership"}</h3>
  {fields.map(([key,en,arabic])=><label key={key} className="space-y-1 text-sm">{ar?arabic:en}<Input disabled={busy} required={key==='name'} maxLength={key==='phone'?40:100} type={key.endsWith('date')?'date':key==='phone'?'tel':'text'} value={draft[key]??''} onChange={e=>set(key,e.target.value)}/>{key==='birth_date'&&<span className="text-xs text-muted-foreground">{ar?'العمر':'Age'}: {memberAge(draft.birth_date)??'—'}</span>}</label>)}
  <label className="space-y-1 text-sm">{ar?'النوع':'Gender'}<select disabled={busy} className="block min-h-11 w-full rounded border bg-background p-2" value={draft.gender??''} onChange={e=>set('gender',e.target.value)}><option value="">{ar?'غير محدد':'Not specified'}</option><option value="male">{ar?'ذكر':'Male'}</option><option value="female">{ar?'أنثى':'Female'}</option></select></label>
  <label className="space-y-1 text-sm sm:col-span-2">{ar?'نبذة':'Bio'}<textarea disabled={busy} maxLength={2000} className="block min-h-24 w-full rounded border bg-background p-2" value={draft.bio??''} onChange={e=>set('bio',e.target.value)}/></label>
  <label className="space-y-1 text-sm">{ar?'خطة المنصة':'Platform plan'}<select disabled={busy} className="block min-h-11 w-full rounded border bg-background p-2" value={draft.member_plan??'free'} onChange={e=>set('member_plan',e.target.value)}><option value="free">{ar?'مجانية':'Free'}</option><option value="premium">{ar?'مميزة':'Premium'}</option></select></label>
  <label className="space-y-1 text-sm">{ar?'انتهاء الخطة المميزة':'Premium expiry'}<Input disabled={busy} type="date" value={draft.premium_expires_at?.slice(0,10)??''} onChange={e=>set('premium_expires_at',e.target.value)}/></label>
  <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input disabled={busy} type="checkbox" checked={!!draft.is_active} onChange={e=>set('is_active',e.target.checked)}/>{ar?'عضوية أكاديمية نشطة':'Active academy membership'}</label>
  <div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={busy} type="submit">{busy?(ar?"بنحفظ…":"Saving…"):(ar?"حفظ التغييرات":"Save changes")}</Button><Button disabled={busy} type="button" variant="outline" onClick={()=>setDraft({...member})}>{ar?'إلغاء التعديلات':'Discard changes'}</Button></div>
  </form>;
}