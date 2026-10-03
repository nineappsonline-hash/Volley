"use client";
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { useCurrentProfile } from "@/lib/queries";
import { useTrainingPrograms, useTrainingBookings, useRefreshTraining, type TrainingBooking, type TrainingProgram, type TrainingSlot } from "@/lib/academy-training";
import { formatMoney, formatTime12h } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QueryState } from "@/components/shared/query-state";
import { GameSharePayment } from "@/components/games/game-share-payment";

export function TrainingDates({ slots }: {slots:TrainingSlot[]}) {
 const {lang}=useI18n();
 return <ul className="max-h-56 space-y-1 overflow-auto text-sm">{slots.map(s=><li key={`${s.session_date}-${s.starts_at}`} className="rounded border p-2">{s.session_date} · {formatTime12h(s.starts_at,lang)} – {formatTime12h(s.ends_at,lang)}</li>)}</ul>;
}
export function AcademyTrainingOffers({academyId}:{academyId?:string}) {
 const {lang}=useI18n(); const ar=lang==="ar";
 const query=useTrainingPrograms(academyId);
 return <section className="space-y-4"><h2 className="text-xl font-bold">{ar?"احجز تدريبك":"Book academy training"}</h2><p className="text-sm text-muted-foreground">{ar?"الاشتراك الشهري صالح لمدة ٣٠ يومًا من تاريخ التسجيل، وليس شهرًا تقويميًا. لا يوجد تجديد تلقائي.":"Monthly plans last 30 days from registration, not a calendar month. No automatic renewal."}</p>
 <QueryState queries={[query]}>{!query.data?.length?<p className="text-sm text-muted-foreground">{ar?"لا توجد برامج متاحة للحجز حاليًا.":"No bookable training programs yet."}</p>:query.data.filter(p=>p.active).map(p=><ProgramCard key={p.id} program={p}/>)}</QueryState>
 <Link className="text-sm text-info-ink underline" href="/academy-bookings">{ar?"حجوزاتي ومدفوعاتي":"My bookings & payments"}</Link></section>;
}
function ProgramCard({program:p}:{program:TrainingProgram}) {
 const {lang}=useI18n();const ar=lang==="ar";
 const {data:profile}=useCurrentProfile();const refresh=useRefreshTraining();
 const [busy,setBusy]=useState(false);const [choice,setChoice]=useState("");const [reserved,setReserved]=useState<TrainingBooking|null>(null);
 const available=p.slots.filter(s=>s.seats_left>0);const monthly=available.slice(0,p.monthly_sessions);
 const reserve=async(kind:"monthly"|"trial")=>{
  setBusy(true);
  try {
   const slot=available.find(s=>`${s.session_date}T${s.starts_at}`===choice);
   const {data:id,error}=await createClient().rpc("reserve_academy_training",{p_program_id:p.id,p_kind:kind,p_trial_date:kind==="trial"?slot?.session_date:null,p_trial_time:kind==="trial"?slot?.starts_at:null});if(error)throw error;
   const {data,error:readError}=await createClient().from("academy_training_bookings").select("*").eq("id",id).single();if(readError)throw readError;
   setReserved(data as TrainingBooking);await refresh();
  }catch(error){toast.error(errorMessage(error,ar?"تعذر الحجز":"Booking failed"));await refresh();}finally{setBusy(false);}
 };
 return <article className="space-y-4 rounded-xl border bg-card p-5"><div><h3 className="text-lg font-semibold">{p.name}</h3><p className="text-sm">{p.academy_name} · {p.sport} · {p.venue_name}</p><p className="text-xs text-muted-foreground">{p.venue_address}</p></div>
 <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-3 rounded-lg border p-3"><h4>{ar?"اشتراك ٣٠ يومًا":"30-day membership"}</h4><p>{formatMoney(Number(p.monthly_price),lang)} · {p.monthly_sessions} {ar?"حصص":"sessions"}</p><details><summary className="cursor-pointer text-sm">{ar?"مواعيد الحصص المشمولة":"Included session dates"}</summary><TrainingDates slots={monthly}/></details>{monthly.length<p.monthly_sessions&&<p className="text-xs text-muted-foreground">{ar?"عدد الحصص المتاحة لا يكفي للاشتراك حاليًا.":"Not enough available sessions for this plan yet."}</p>}
 {profile?.role==="member"?<Button disabled={busy||monthly.length<p.monthly_sessions} onClick={()=>reserve("monthly")}>{ar?"احجز الاشتراك الشهري":"Book monthly plan"}</Button>:<Link href="/login" className="text-info-ink underline">{ar?"سجّل دخولك كعضو للحجز":"Sign in as a member to book"}</Link>}</div>
 <div className="space-y-3 rounded-lg border p-3"><h4>{ar?"حصة تجريبية واحدة":"Single trial session"}</h4><p>{formatMoney(Number(p.trial_price),lang)}</p><label className="block text-sm">{ar?"اختار الموعد":"Choose a session"}<select className="mt-1 w-full rounded border bg-background p-2 text-foreground" value={choice} onChange={e=>setChoice(e.target.value)}><option value="">{ar?"اختار موعدًا متاحًا":"Select an available time"}</option>{available.map(s=><option key={`${s.session_date}-${s.starts_at}`} value={`${s.session_date}T${s.starts_at}`}>{s.session_date} · {formatTime12h(s.starts_at,lang)} ({s.seats_left})</option>)}</select></label>{profile?.role==="member"?<Button disabled={busy||!available.some(s=>`${s.session_date}T${s.starts_at}`===choice)} onClick={()=>reserve("trial")}>{ar?"احجز حصة تجريبية":"Book a trial"}</Button>:<Link href="/login" className="text-info-ink underline">{ar?"سجّل دخولك كعضو للحجز":"Sign in as a member to book"}</Link>}</div></div>
 <Dialog open={!!reserved} onOpenChange={open=>{if(!open)setReserved(null);}}><DialogContent className="max-h-[90dvh] overflow-auto"><DialogHeader><DialogTitle>{ar?"تفاصيل الحجز والدفع":"Booking & payment"}</DialogTitle><DialogDescription>{ar?"راجع المواعيد والمبلغ قبل الدفع. الحجز المدفوع يتأكد بعد مراجعة الإيصال.":"Review your dates and amount before paying. Paid bookings are confirmed after receipt review."}</DialogDescription></DialogHeader>{reserved&&<TrainingBookingCard booking={reserved} onChange={async()=>{const {data}=await createClient().from("academy_training_bookings").select("*").eq("id",reserved.id).single();if(data)setReserved(data as TrainingBooking);}}/>}</DialogContent></Dialog>
 </article>;
}
export function MyAcademyBookings(){const {lang}=useI18n();const query=useTrainingBookings();return <section className="space-y-4"><h2 className="text-xl font-bold">{lang==="ar"?"حجوزاتي":"My academy bookings"}</h2><QueryState queries={[query]}>{!query.data?.length?<p>{lang==="ar"?"لا توجد حجوزات بعد.":"No bookings yet."}</p>:query.data.map(b=><TrainingBookingCard key={b.id} booking={b}/>)}</QueryState></section>;}
export function TrainingBookingCard({booking:b,admin=false,onChange}:{booking:TrainingBooking;admin?:boolean;onChange?:()=>Promise<void>}) {
 const {lang}=useI18n();const ar=lang==="ar";const refresh=useRefreshTraining();const [busy,setBusy]=useState(false);const [pay,setPay]=useState(false);const [note,setNote]=useState("");const [receipt,setReceipt]=useState<string|null>(null);
 const expired=b.status==="awaiting_payment"&&new Date(b.hold_until).getTime()<=Date.now();
 const status={awaiting_payment:ar?"بانتظار الدفع":"Awaiting payment",submitted:ar?"الإيصال قيد المراجعة":"Receipt under review",approved:ar?"حجز مؤكد":"Confirmed",rejected:ar?"الدفع مرفوض":"Payment rejected",cancelled:ar?"ملغي":"Cancelled"}[b.status];
 const act=async(action:string,method?:string,path?:string)=>{setBusy(true);try{const {error}=await createClient().rpc("manage_academy_training_payment",{p_booking_id:b.id,p_action:action,p_method:method??null,p_receipt:path??null,p_note:note||null});if(error)throw error;setPay(false);await refresh();await onChange?.();toast.success(ar?"تم التحديث":"Updated");}catch(error){toast.error(errorMessage(error,ar?"تعذر التحديث":"Could not update"));}finally{setBusy(false);}};
 return <article className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{b.details.academy} · {b.details.program}</h3>{admin&&<p className="text-sm">{b.details.member}</p>}<p className="text-sm">{b.details.sport} · {b.details.playground} · {b.kind==="monthly"?(ar?"اشتراك ٣٠ يومًا":"30-day plan"):(ar?"حصة تجريبية":"Trial")}</p><p className="font-medium">{formatMoney(Number(b.amount),lang)} · {expired?(ar?"انتهت مهلة الدفع":"Payment reservation expired"):status}</p><p className="text-xs text-muted-foreground">{ar?"من":"From"} {b.registered_on} · {ar?"ينتهي قبل":"Valid until (exclusive)"} {b.expires_on}</p><details><summary className="cursor-pointer text-sm">{ar?"مواعيد التدريب":"Training dates"} ({b.details.sessions.length})</summary><TrainingDates slots={b.details.sessions}/></details>{b.review_note&&<p className="text-sm">{b.review_note}</p>}
 {!admin&&b.status==="awaiting_payment"&&!expired&&<><p className="text-xs text-muted-foreground">{ar?"مهلة رفع الإيصال حتى":"Receipt deadline"}: {new Date(b.hold_until).toLocaleString(lang)}</p><div className="flex gap-2"><Button disabled={busy} onClick={()=>setPay(!pay)}>{ar?"الدفع ورفع الإيصال":"Pay & upload receipt"}</Button><Button variant="outline" disabled={busy} onClick={()=>act("cancel")}>{ar?"إلغاء الحجز غير المدفوع":"Cancel unpaid booking"}</Button></div>{pay&&<GameSharePayment amount={Number(b.amount)} label={b.details.program} submitting={busy} note={ar?"استخدم إنستاباي أو المحفظة الإلكترونية وارفع الإيصال. الدفع يحتاج موافقة الإدارة لتأكيد الحجز.":"Pay with the existing InstaPay or e-wallet method and upload your receipt. Admin approval confirms your booking."} submitLabel={ar?"إرسال الإيصال للمراجعة":"Submit receipt for review"} onPay={(method,path)=>void act("submit",method,path)}/>}</>}
 {admin&&b.receipt_path&&<Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{const {data,error}=await createClient().storage.from("game-fee-receipts").createSignedUrl(b.receipt_path!,600);if(error)throw error;setReceipt(data.signedUrl);}catch(error){toast.error(errorMessage(error,ar?"تعذر فتح الإيصال":"Could not open receipt"));}finally{setBusy(false);}}}>{ar?"عرض الإيصال":"View receipt"}</Button>}
 {receipt&&<a href={receipt} target="_blank" rel="noopener noreferrer" className="block text-info-ink underline">{ar?"فتح الإيصال":"Open receipt"}</a>}
 {admin&&b.status==="submitted"&&<div className="space-y-2"><label className="block text-sm">{ar?"ملاحظة المراجعة":"Review note"}<input className="mt-1 w-full rounded border bg-background p-2" value={note} onChange={e=>setNote(e.target.value)}/></label><div className="flex gap-2"><Button disabled={busy} onClick={()=>act("approve")}>{ar?"اعتماد الدفع":"Approve payment"}</Button><Button variant="destructive" disabled={busy} onClick={()=>act("reject")}>{ar?"رفض الدفع":"Reject payment"}</Button></div></div>}
 </article>;
}
export function AcademyTrainingPaymentApprovals(){const {lang}=useI18n();const query=useTrainingBookings(true);return <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-bold">{lang==="ar"?"مدفوعات تدريب الأكاديميات":"Academy training payments"}</h2><QueryState queries={[query]}>{!query.data?.length?<p className="text-sm text-muted-foreground">{lang==="ar"?"لا توجد حجوزات بعد.":"No bookings yet."}</p>:query.data.map(b=><TrainingBookingCard key={b.id} booking={b} admin/>)}</QueryState></section>;}
