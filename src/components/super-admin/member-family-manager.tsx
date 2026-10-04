"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/shared/query-state";

type Child = {id?:string;name:string;gender:string;birth_date:string;phone:string;academy_id:string};
const blank:Child={name:"",gender:"male",birth_date:"",phone:"",academy_id:""};
export function MemberFamilyManager({memberId,academies}:{memberId:string;academies:{id:string;name:string}[]}) {
 const {lang}=useI18n();const ar=lang==="ar";const cache=useQueryClient();
 const [draft,setDraft]=useState<Child|null>(null);const [busy,setBusy]=useState(false);
 const query=useQuery({queryKey:["admin-family",memberId],queryFn:async()=>{
  const db=createClient();const [parent,children]=await Promise.all([
   db.from("profiles").select("is_parent,guardian_id,role,email").eq("id",memberId).single(),
   db.from("profiles").select("id,name,gender,birth_date,phone,academy_id").eq("guardian_id",memberId).order("name")]);
  if(parent.error)throw parent.error;if(children.error)throw children.error;
  return {parent:parent.data,children:children.data};
 }});
 const refresh=async()=>{await Promise.all([cache.invalidateQueries({queryKey:["admin-family",memberId]}),cache.invalidateQueries({queryKey:["platform-records"]}),cache.invalidateQueries({queryKey:["children"]})]);};
 const act=async(work:()=>PromiseLike<{error:unknown}>)=>{setBusy(true);try{const {error}=await work();if(error)throw error;await refresh();toast.success(ar?"تم الحفظ":"Saved");return true;}catch(error){toast.error(errorMessage(error,ar?"تعذر الحفظ":"Could not save"));return false;}finally{setBusy(false);}};
 const parent=query.data?.parent;const children=query.data?.children??[];
 const isParent=parent?.is_parent||children.length>0;
 return <section className="space-y-4 rounded-xl border p-4"><h3 className="font-semibold">{ar?"حساب ولي الأمر والأبناء":"Parent account & children"}</h3>
 <QueryState queries={[query]}>{parent?.guardian_id?<p className="text-sm">{ar?"هذا الحساب تابع لولي أمر. افتح حساب ولي الأمر لإدارة بيانات الأبناء.":"This is a child profile. Open the parent’s member details to manage the family."}</p>:parent?.role!=="member"||!parent?.email?<p className="text-sm">{ar?"إدارة الأسرة متاحة لحساب عضو لديه تسجيل دخول.":"Family management requires a member with a login account."}</p>:<>
 <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium">{isParent?(ar?"نوع الحساب: ولي أمر":"Account type: Parent"):(ar?"نوع الحساب: عضو":"Account type: Member")}</p>
 <Button type="button" variant="outline" disabled={busy||(!!isParent&&children.length>0)} onClick={()=>act(()=>createClient().rpc("admin_set_parent_account",{p_parent_id:memberId,p_enabled:!isParent}))}>{isParent?(ar?"تحويل إلى عضو":"Change to member"):(ar?"تحويل إلى ولي أمر":"Change to parent")}</Button></div>
 <p className="text-xs text-muted-foreground">{ar?"يحتفظ ولي الأمر بتسجيل دخوله. ملفات الأبناء تُدار من لوحة الأسرة بدون تسجيل دخول مستقل.":"The parent keeps their login. Children are managed through the family dashboard without separate logins."}</p>
 {children.map(child=><div key={child.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3"><div className="min-w-0"><p className="break-words font-medium">{child.name}</p><p className="text-xs text-muted-foreground">{child.birth_date} · {academies.find(a=>a.id===child.academy_id)?.name??(ar?"بدون أكاديمية":"No academy")}</p></div><Button type="button" variant="outline" disabled={busy} onClick={()=>setDraft({id:child.id,name:child.name,gender:child.gender??"male",birth_date:child.birth_date??"",phone:child.phone??"",academy_id:child.academy_id??""})}>{ar?"تعديل البيانات":"Edit details"}</Button></div>)}
 {!draft&&<Button type="button" disabled={busy} onClick={()=>setDraft({...blank})}>{ar?"إضافة ابن أو ابنة":"Add child"}</Button>}
 {draft&&<form className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();if(busy)return;const saved=await act(()=>createClient().rpc("admin_save_family_child",{p_parent_id:memberId,p_child_id:draft.id??null,p_details:draft}));if(saved)setDraft(null);}}>
 <h4 className="font-medium sm:col-span-2">{draft.id?(ar?"تعديل بيانات الابن":"Edit child"):(ar?"بيانات الابن الجديد":"New child details")}</h4>
 <label className="space-y-1 text-sm">{ar?"الاسم الكامل":"Full name"}<Input required maxLength={100} value={draft.name} disabled={busy} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <label className="space-y-1 text-sm">{ar?"تاريخ الميلاد":"Date of birth"}<Input required type="date" max={new Date().toISOString().slice(0,10)} value={draft.birth_date} disabled={busy} onChange={e=>setDraft({...draft,birth_date:e.target.value})}/></label>
 <label className="space-y-1 text-sm">{ar?"النوع":"Gender"}<select className="block min-h-10 w-full rounded border bg-background p-2" value={draft.gender} disabled={busy} onChange={e=>setDraft({...draft,gender:e.target.value})}><option value="male">{ar?"ذكر":"Male"}</option><option value="female">{ar?"أنثى":"Female"}</option></select></label>
 <label className="space-y-1 text-sm">{ar?"الهاتف (اختياري)":"Phone (optional)"}<Input type="tel" maxLength={40} value={draft.phone} disabled={busy} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label>
 <label className="space-y-1 text-sm sm:col-span-2">{ar?"الأكاديمية":"Academy"}<select className="block min-h-10 w-full rounded border bg-background p-2" value={draft.academy_id} disabled={busy} onChange={e=>setDraft({...draft,academy_id:e.target.value})}><option value="">{ar?"بدون أكاديمية":"No academy"}</option>{academies.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
 <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>{busy?(ar?"جارٍ الحفظ…":"Saving…"):(ar?"حفظ بيانات الابن":"Save child")}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setDraft(null)}>{ar?"إلغاء":"Cancel"}</Button></div>
 </form>}
 </>}</QueryState></section>;
}
