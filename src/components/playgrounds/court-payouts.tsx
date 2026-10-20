"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QueryState } from "@/components/shared/query-state";

type Payout = {id:string;game_title:string;venue_name:string;sport:string;start_time:string;court_number:number;hours:number;owner_name:string;owner_phone:string;due_date:string;rental_amount:number;paid_at:string|null;payment_reference:string|null;payable:boolean};
export function CourtPayouts({ admin = false }: { admin?: boolean }) {
  const { lang } = useI18n(); const ar = lang === "ar"; const cache = useQueryClient();
  const [references, setReferences] = useState<Record<string,string>>({});
  const query = useQuery({queryKey:["court-payouts"],refetchInterval:30_000,queryFn:async()=>{const {data,error}=await createClient().rpc("court_payout_ledger");if(error)throw error;return (data??[]) as Payout[];}});
  const record=useMutation({mutationFn:async(p:Payout)=>{const {error}=await createClient().rpc("record_court_payout",{p_id:p.id,p_reference:references[p.id]?.trim()});if(error)throw error;},onSuccess:()=>{cache.invalidateQueries({queryKey:["court-payouts"]});toast.success(ar?"تم تسجيل الصرف":"Payout recorded");},onError:e=>toast.error(errorMessage(e,ar?"تعذر تسجيل الصرف":"Could not record payout"))});
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  return <section className="space-y-4"><div><h2 className="text-xl font-bold">{ar?"مستحقات أصحاب الملاعب":"Court owner payouts"}</h2><p className="text-sm text-muted-foreground">{ar?"قيمة الإيجار كاملة دون خصم. تاريخ الاستحقاق هو يوم الحجز. لا تُسجّل عملية الصرف إلا بعد تحويل المبلغ فعليًا.":"Full rental amount, with no deductions. Payouts are due on the booking date. Record a payout only after the transfer has been made."}</p></div>
    <QueryState queries={[query]}>{null}</QueryState>
    {query.data?.length===0&&<p className="rounded-xl border border-dashed p-5 text-sm">{ar?"لا توجد مستحقات من حجوزات مدفوعة بالكامل بعد.":"No fully prepaid court bookings awaiting payout yet."}</p>}
    <div className="space-y-3">{query.data?.map(p=><article key={p.id} className="space-y-3 rounded-xl border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{p.venue_name} · {p.game_title}</h3><p className="text-sm text-muted-foreground">{p.sport} · {p.due_date} · <bdi>{p.start_time?.slice(0,5)}</bdi> · {ar?"ملعب":"Court"} {p.court_number} · {p.hours} {ar?"ساعة":"hours"}</p>{admin&&<p className="text-sm">{p.owner_name} · <bdi>{p.owner_phone}</bdi></p>}</div><div className="text-end"><p className="font-bold text-secondary">{formatMoney(p.rental_amount,lang)}</p><Badge variant={p.paid_at?"success":!p.payable?"destructive":"secondary"}>{p.paid_at?(ar?"تم الصرف":"Paid"):!p.payable?(ar?"غير مستحق للصرف":"On hold"):p.due_date<=today?(ar?"مستحق الآن":"Due now"):(ar?"مجدول":"Scheduled")}</Badge></div></div>
      {p.paid_at&&<p className="text-sm">{ar?"مرجع الدفع":"Payment reference"}: <bdi>{p.payment_reference}</bdi> · {new Date(p.paid_at).toLocaleDateString(ar?"ar-EG":"en-GB")}</p>}
      {admin&&!p.paid_at&&p.payable&&p.due_date<=today&&<div className="flex flex-wrap gap-2"><Input className="min-w-0 flex-1" aria-label={ar?"مرجع التحويل":"Transfer reference"} placeholder={ar?"مرجع التحويل اليدوي":"Manual transfer reference"} maxLength={200} value={references[p.id]??""} onChange={e=>setReferences({...references,[p.id]:e.target.value})}/><Button variant="secondary" disabled={record.isPending||!references[p.id]?.trim()} onClick={()=>record.mutate(p)}>{ar?"تسجيل سداد الإيجار بالكامل":"Record full rental payout"}</Button></div>}
    </article>)}</div></section>;
}
