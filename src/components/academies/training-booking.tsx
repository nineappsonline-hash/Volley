"use client";
import { PageHeader } from "@/components/shared/page-header";
import { TrainingSummary } from "./training-summary";
import { AcademyLogo } from "./academy-logo";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
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
import { ShareIconButton, academyShareTarget } from "./academy-share";

export function TrainingDates({ slots }: {slots:TrainingSlot[]}) {
 const {lang}=useI18n();
 return <ul className="space-y-1 text-sm sm:max-h-56 sm:overflow-auto">{slots.map(s=><li key={`${s.session_date}-${s.starts_at}`} className="rounded border p-2">{s.session_date} · {formatTime12h(s.starts_at,lang)} – {formatTime12h(s.ends_at,lang)}</li>)}</ul>;
}
export function AcademyTrainingOffers({academyId}:{academyId?:string}) {
 const {lang}=useI18n(); const ar=lang==="ar";
 const query=useTrainingPrograms(academyId);
 return <section className="space-y-4"><h2 className="text-xl font-bold">{ar?"اختر مجموعة التدريب المناسبة لك":"Find your training group"}</h2><p className="text-sm text-muted-foreground">{ar?"لكل مجموعة سعر اشتراك شهري وسعر حصة تجريبية خاص بها. الاشتراك صالح لمدة ٣٠ يومًا من التسجيل، بدون تجديد تلقائي.":"Each group has its own monthly and trial price. Monthly plans last 30 days from registration, with no automatic renewal."}</p>
 <QueryState queries={[query]}>{!query.data?.length?<p className="text-sm text-muted-foreground">{ar?"لا توجد برامج متاحة للحجز حاليًا.":"No bookable training programs yet."}</p>:<div className="grid items-start gap-6 lg:grid-cols-2">{query.data.filter(p=>p.active).map((p,index)=><ProgramCard key={p.id} program={p} index={index}/>)}</div>}</QueryState>
 <Link className="text-sm text-foreground hover:underline underline-offset-4 underline" href="/academy-bookings">{ar?"حجوزاتي ومدفوعاتي":"My bookings & payments"}</Link></section>;
}
/** Roles allowed to reserve a training seat. Mirrors reserve_academy_training. */
const BOOKING_ROLES=["member","admin","super_admin"] as const;
function ProgramCard({program:p,index}:{program:TrainingProgram;index:number}) {
 const {lang,t}=useI18n();const ar=lang==="ar";
 const {data:profile}=useCurrentProfile();const refresh=useRefreshTraining();
 // Academy admins and platform admins can book their own academy's plans.
 // Only playground_owner is excluded, matching the role whitelist enforced by
 // reserve_academy_training — keep the two in sync.
 const canBook=!!profile&&(BOOKING_ROLES as readonly string[]).includes(profile.role);
 const [busy,setBusy]=useState(false);const [choice,setChoice]=useState("");const [reserved,setReserved]=useState<TrainingBooking|null>(null);
 const [expanded,setExpanded]=useState(false);
 useEffect(()=>{const reveal=()=>{if(window.location.hash===`#training-${p.id}`)setExpanded(true);};reveal();window.addEventListener("hashchange",reveal);return()=>window.removeEventListener("hashchange",reveal);},[p.id]);
 const accents=["border-t-blue-500","border-t-emerald-500","border-t-violet-500","border-t-amber-500"];
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
return <article id={`training-${p.id}`} className={`training-mobile min-w-0 scroll-mt-24 space-y-4 rounded-2xl border border-t-4 bg-card p-4 shadow-md sm:p-6 ${accents[index%accents.length]}`}><div className="flex items-start gap-3"><AcademyLogo academyId={p.academy_id} name={p.academy_name}/><div className="min-w-0 flex-1"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{ar?"مجموعة":"Group"} {index+1}</span><div className="flex items-center gap-1"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{p.sport}</span><ShareIconButton target={academyShareTarget({name:p.academy_name,slug:p.academy_slug,area:p.venue_area,governorate:p.venue_governorate},{id:p.id,name:p.name})} label={t("academy_share_program")}/></div></div><h3 className="break-words text-xl font-bold">{p.name}</h3><p className="mt-1 break-words text-sm text-muted-foreground">{p.academy_name} · {p.sport} · {p.venue_name}</p><p className="text-xs text-muted-foreground">{p.venue_address}</p></div></div>
<TrainingSummary program={p} compact={!expanded} showAcademy={false}/>
 {!expanded && <div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{ar?"اشتراك ٣٠ يومًا":"30-day plan"}</p><p className="mt-1 font-bold">{formatMoney(Number(p.monthly_price),lang)}</p><p className="text-xs">{p.monthly_sessions} {ar?"حصص":"sessions"}</p></div><div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{ar?"حصة تجريبية":"Trial session"}</p><p className="mt-1 font-bold">{formatMoney(Number(p.trial_price),lang)}</p></div></div>}
 <Button variant="outline" className="min-h-11 w-full whitespace-normal" aria-expanded={expanded} aria-controls={`group-details-${p.id}`} onClick={()=>setExpanded(!expanded)}>{expanded?(ar?"إخفاء التفاصيل":"Hide details"):(ar?"عرض المواعيد والحجز":"View schedule & book")}<ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${expanded?"rotate-180":""}`}/></Button>
 <div id={`group-details-${p.id}`} hidden={!expanded}>
 <div className="grid gap-4 sm:grid-cols-2"><div className="min-w-0 space-y-3 rounded-xl border bg-muted/30 p-3"><h4>{ar?"اشتراك ٣٠ يومًا":"30-day membership"}</h4><p>{formatMoney(Number(p.monthly_price),lang)} · {p.monthly_sessions} {ar?"حصص":"sessions"}</p><details><summary className="cursor-pointer text-sm">{ar?"مواعيد الحصص المشمولة":"Included session dates"}</summary><TrainingDates slots={monthly}/></details>{monthly.length<p.monthly_sessions&&<p className="text-xs text-muted-foreground">{ar?"عدد الحصص المتاحة لا يكفي للاشتراك حاليًا.":"Not enough available sessions for this plan yet."}</p>}
 {canBook?<Button className="h-auto min-h-11 w-full whitespace-normal" disabled={busy||monthly.length<p.monthly_sessions} onClick={()=>reserve("monthly")}>{ar?"احجز الاشتراك الشهري":"Book monthly plan"}</Button>:<Link href="/login" className="text-foreground hover:underline underline-offset-4 underline">{ar?"سجّل الدخول للحجز":"Sign in to book"}</Link>}</div>
 <div className="min-w-0 space-y-3 rounded-xl border bg-muted/30 p-3"><h4>{ar?"حصة تجريبية واحدة":"Single trial session"}</h4><p>{formatMoney(Number(p.trial_price),lang)}</p><label className="block text-sm">{ar?"اختار الموعد":"Choose a session"}<select className="mt-1 w-full rounded border bg-background p-2 text-foreground" value={choice} onChange={e=>setChoice(e.target.value)}><option value="">{ar?"اختار موعدًا متاحًا":"Select an available time"}</option>{available.map(s=><option key={`${s.session_date}-${s.starts_at}`} value={`${s.session_date}T${s.starts_at}`}>{s.session_date} · {formatTime12h(s.starts_at,lang)} ({s.seats_left})</option>)}</select></label>{canBook?<Button className="h-auto min-h-11 w-full whitespace-normal" disabled={busy||!available.some(s=>`${s.session_date}T${s.starts_at}`===choice)} onClick={()=>reserve("trial")}>{ar?"احجز حصة تجريبية":"Book a trial"}</Button>:<Link href="/login" className="text-foreground hover:underline underline-offset-4 underline">{ar?"سجّل الدخول للحجز":"Sign in to book"}</Link>}</div></div>
 </div>
 <Dialog open={!!reserved} onOpenChange={open=>{if(!open)setReserved(null);}}><DialogContent className="training-mobile max-h-[90dvh] overflow-y-auto p-3 sm:p-6"><DialogHeader><DialogTitle>{ar?"تفاصيل الحجز والدفع":"Booking & payment"}</DialogTitle><DialogDescription>{ar?"راجع المواعيد والمبلغ قبل الدفع. الحجز المدفوع يتأكد بعد مراجعة الإيصال.":"Review your dates and amount before paying. Paid bookings are confirmed after receipt review."}</DialogDescription></DialogHeader>{reserved&&<TrainingBookingCard booking={reserved} onChange={async()=>{const {data}=await createClient().from("academy_training_bookings").select("*").eq("id",reserved.id).single();if(data)setReserved(data as TrainingBooking);}}/>}</DialogContent></Dialog>
 </article>;
}
export function MyAcademyBookings(){const {lang}=useI18n();const query=useTrainingBookings();return <section className="space-y-4"><h2 className="text-xl font-bold">{lang==="ar"?"حجوزاتي":"My academy bookings"}</h2><QueryState queries={[query]}>{!query.data?.length?<p>{lang==="ar"?"لا توجد حجوزات بعد.":"No bookings yet."}</p>:query.data.map(b=><TrainingBookingCard key={b.id} booking={b}/>)}</QueryState></section>;}
export function TrainingBookingCard({booking:b,admin=false,onChange}:{booking:TrainingBooking;admin?:boolean;onChange?:()=>Promise<void>}) {
 const {lang}=useI18n();const ar=lang==="ar";const refresh=useRefreshTraining();const [busy,setBusy]=useState(false);const [pay,setPay]=useState(false);const [note,setNote]=useState("");const [receipt,setReceipt]=useState<string|null>(null);
 const expired=b.status==="awaiting_payment"&&new Date(b.hold_until).getTime()<=Date.now();
 const status={awaiting_payment:ar?"بانتظار الدفع":"Awaiting payment",submitted:ar?"الإيصال قيد المراجعة":"Receipt under review",approved:ar?"حجز مؤكد":"Confirmed",rejected:ar?"الدفع مرفوض":"Payment rejected",cancelled:ar?"ملغي":"Cancelled"}[b.status];
 const act=async(action:string,method?:string,path?:string)=>{setBusy(true);try{const {error}=await createClient().rpc("manage_academy_training_payment",{p_booking_id:b.id,p_action:action,p_method:method??null,p_receipt:path??null,p_note:note||null});if(error)throw error;setPay(false);await refresh();await onChange?.();toast.success(ar?"تم التحديث":"Updated");}catch(error){toast.error(errorMessage(error,ar?"تعذر التحديث":"Could not update"));}finally{setBusy(false);}};
 return <article className="training-mobile space-y-3 rounded-xl border p-3 sm:p-4"><h3 className="font-semibold">{b.details.academy} · {b.details.program}</h3>{admin&&<p className="text-sm">{b.details.member}</p>}<p className="text-sm">{b.details.sport} · {b.details.playground} · {b.kind==="monthly"?(ar?"اشتراك ٣٠ يومًا":"30-day plan"):(ar?"حصة تجريبية":"Trial")}</p><p className="font-medium">{formatMoney(Number(b.amount),lang)} · {expired?(ar?"انتهت مهلة الدفع":"Payment reservation expired"):status}</p><p className="text-xs text-muted-foreground">{ar?"من":"From"} {b.registered_on} · {ar?"ينتهي قبل":"Valid until (exclusive)"} {b.expires_on}</p><details><summary className="cursor-pointer text-sm">{ar?"مواعيد التدريب":"Training dates"} ({b.details.sessions.length})</summary><TrainingDates slots={b.details.sessions}/></details>{b.review_note&&<p className="text-sm">{b.review_note}</p>}
 {!admin&&b.status==="awaiting_payment"&&!expired&&<><p className="text-xs text-muted-foreground">{ar?"مهلة رفع الإيصال حتى":"Receipt deadline"}: {new Date(b.hold_until).toLocaleString(lang)}</p><div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><Button disabled={busy} onClick={()=>setPay(!pay)}>{ar?"الدفع ورفع الإيصال":"Pay & upload receipt"}</Button><Button variant="outline" disabled={busy} onClick={()=>act("cancel")}>{ar?"إلغاء الحجز غير المدفوع":"Cancel unpaid booking"}</Button></div>{pay&&<GameSharePayment cardTarget={{kind:"academy",targetId:b.id}} amount={Number(b.amount)} label={b.details.program} submitting={busy} note={ar?"ادفع بالبطاقة للتأكيد التلقائي بعد نجاح الدفع، أو استخدم إنستاباي أو المحفظة وارفع الإيصال للمراجعة.":"Pay by card for confirmation after successful payment, or upload an InstaPay/e-wallet receipt for review."} submitLabel={ar?"إرسال الإيصال للمراجعة":"Submit receipt for review"} onPay={(method,path)=>void act("submit",method,path)}/>}</>}
 {admin&&b.receipt_path&&<Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{const {data,error}=await createClient().storage.from("game-fee-receipts").createSignedUrl(b.receipt_path!,600);if(error)throw error;setReceipt(data.signedUrl);}catch(error){toast.error(errorMessage(error,ar?"تعذر فتح الإيصال":"Could not open receipt"));}finally{setBusy(false);}}}>{ar?"عرض الإيصال":"View receipt"}</Button>}
 {receipt&&<a href={receipt} target="_blank" rel="noopener noreferrer" className="block text-foreground hover:underline underline-offset-4 underline">{ar?"فتح الإيصال":"Open receipt"}</a>}
 {admin&&b.status==="submitted"&&<div className="space-y-2"><label className="block text-sm">{ar?"ملاحظة المراجعة":"Review note"}<input className="mt-1 w-full rounded border bg-background p-2" value={note} onChange={e=>setNote(e.target.value)}/></label><div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><Button disabled={busy} onClick={()=>act("approve")}>{ar?"اعتماد الدفع":"Approve payment"}</Button><Button variant="destructive" disabled={busy} onClick={()=>act("reject")}>{ar?"رفض الدفع":"Reject payment"}</Button></div></div>}
 {!admin&&b.status==="approved"&&<TrainingRating bookingId={b.id}/>}
 </article>;
}
function TrainingRating({bookingId}:{bookingId:string}) {
 const {lang}=useI18n();const ar=lang==="ar";const refresh=useRefreshTraining();const [rating,setRating]=useState("5");const [busy,setBusy]=useState(false);
 return <div className="flex flex-wrap items-center gap-2"><label className="text-sm">{ar?"قيّم التدريب بعد حضور الحصة":"Rate training after your session"}<select className="ms-2 rounded border bg-background p-2" value={rating} onChange={e=>setRating(e.target.value)}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label><Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);try{const client=createClient();const {data,error}=await client.from("academy_training_bookings").select("program_id").eq("id",bookingId).single();if(error)throw error;const result=await client.rpc("rate_training",{p_program_id:data.program_id,p_rating:Number(rating)});if(result.error)throw result.error;await refresh();toast.success(ar?"تم حفظ تقييمك":"Rating saved");}catch(error){toast.error(errorMessage(error,ar?"تعذر حفظ التقييم":"Could not rate training"));}finally{setBusy(false);}}}>{ar?"حفظ التقييم":"Save rating"}</Button></div>;
}
export function AcademyTrainingPaymentApprovals(){const {lang}=useI18n();const query=useTrainingBookings(true);return <section className="training-mobile space-y-4 rounded-xl border bg-card p-3 sm:p-5"><h2 className="text-xl font-bold">{lang==="ar"?"مدفوعات تدريب الأكاديميات":"Academy training payments"}</h2><QueryState queries={[query]}>{!query.data?.length?<p className="text-sm text-muted-foreground">{lang==="ar"?"لا توجد حجوزات بعد.":"No bookings yet."}</p>:query.data.map(b=><TrainingBookingCard key={b.id} booking={b} admin/>)}</QueryState></section>;}

export function AcademyBookingsHeader() {
  const { lang } = useI18n();
  return <PageHeader title={lang === "ar" ? "حجوزات الأكاديميات" : "Academy bookings"} subtitle={lang === "ar" ? "اكتشف التدريب المناسب وتابع حجوزاتك القادمة." : "Explore training that fits you and keep track of your upcoming bookings."} />;
}
