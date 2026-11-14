"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AcademyLogo } from "@/components/academies/academy-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { GameSharePayment } from "@/components/games/game-share-payment";
import { Topbar } from "@/components/layout/topbar";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Calendar, MapPin, Users, Building2, ArrowUpRight, Trophy } from "lucide-react";

export function TrainingDetail({
  program,
  team,
  isProgram,
  session,
}: {
  program: any;
  team: any;
  isProgram: boolean;
  session: any;
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const [busy, setBusy] = useState(false);
  const [reserved, setReserved] = useState<any>(null);
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);
  const paymentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (reserved) paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [reserved]);

  const source = program ?? team;
  const academy = source?.academy ?? {
    id: source?.academy_id || source?.academy?.id,
    name: source?.academy_name || source?.academy?.name,
    slug: source?.academy_slug || source?.academy?.slug,
    logo_url: source?.academy_logo_url || source?.academy?.logo_url,
  };
  const venue = source?.venue ?? {
    id: source?.venue_id,
    name: source?.venue_name || source?.venue?.name,
    address: source?.venue_address || source?.venue?.address,
    governorate: source?.venue_governorate || source?.venue?.governorate,
    area: source?.venue_area || source?.venue?.area,
    location_link: source?.venue_location_link || source?.location_link || source?.venue?.location_link,
  };
  const locationUrl = venue.location_link ||
    (venue.lat != null && venue.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.lat},${venue.lng}`)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([venue.name, venue.address, venue.area, venue.governorate].filter(Boolean).join(", ") || academy.name)}`);
  const gender =
    source?.gender === "male"
      ? ar
        ? "ذكور"
        : "Male"
      : source?.gender === "female"
        ? ar
          ? "إناث"
          : "Female"
        : ar
          ? "مختلط"
          : "Mixed";
  const age =
    source?.min_age != null && source?.max_age != null
      ? `${source.min_age}–${source.max_age}`
      : source?.min_age != null
        ? `${source.min_age}+`
        : source?.max_age != null
          ? `≤ ${source.max_age}`
          : ar
            ? "كل الأعمار"
            : "All ages";
  const sport = source?.sport?.name || source?.sport || "";
  const monthlyPrice = source?.monthly_price ?? 0;
  const trialPrice = source?.trial_price ?? 0;
  const monthlySessions = source?.monthly_sessions ?? 0;
  const programId = program?.id;

  const reserve = async (kind: "monthly" | "trial", slot: any = null) => {
    if (!programId) {
      toast.error(ar ? "هذا النوع غير متاح للحجز." : "This type cannot be booked.");
      return;
    }
    if (busy || reserved) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: id, error } = await supabase.rpc("reserve_academy_training", {
        p_program_id: programId,
        p_kind: kind,
        p_trial_date: kind === "trial" ? slot?.session_date : null,
        p_trial_time: kind === "trial" ? slot?.starts_at : null,
      });
      if (error) throw error;
      const { data, error: readError } = await supabase
        .from("academy_training_bookings")
        .select("*")
        .eq("id", id)
        .single();
      if (readError) throw readError;
      setPaymentSubmitted(false);
      setReserved(data);
    } catch (error: any) {
      toast.error(error.message || (ar ? "تعذر الحجز" : "Booking failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen mx-auto max-w-5xl px-6 pb-14">
      {session ? (
        <Topbar
          role={session.profile.role}
          name={session.profile.name}
          username={session.profile.username}
          avatarUrl={session.profile.avatar_url}
          avatarId={session.profile.avatar_id}
          memberPlan={session.profile.member_plan}
          isCoach={false}
          hasAcademyWorkspace={false}
        />
      ) : (
        <Topbar role="member" name="" username="" guest />
      )}
      <div className="mb-5 mt-6 text-sm font-semibold text-[#6739d4]"><Link href="/academies" className="hover:underline">{ar ? "الأكاديميات" : "Academies"}</Link><span className="mx-2 text-[#716c7d]">/</span><Link href={`/a/${academy.slug}`} className="hover:underline">{academy.name}</Link></div>
      <section className="relative mb-6 overflow-hidden rounded-[28px] bg-[#201438] px-6 py-9 text-white sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -bottom-24 -end-14 h-72 w-72 rounded-full bg-[#6739d4]/60" aria-hidden="true" />
        <div className="relative z-10 max-w-3xl">
          <div className="mb-6 flex items-center gap-3"><div className="rounded-xl bg-white p-1.5"><AcademyLogo academyId={academy.id} name={academy.name} logoUrl={academy.logo_url} /></div><Link href={`/a/${academy.slug}`} className="text-sm font-semibold text-[#d5ff4b] hover:underline">{academy.name}</Link></div>
          <span className="inline-flex rounded-full bg-[#d5ff4b] px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-[#201438]">{sport || (ar ? "تدريب رياضي" : "Sports training")}</span>
          <h1 className="mt-6 max-w-2xl break-words text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{source.name}</h1>
          <p className="mt-4 text-sm text-[#d6cfe8] sm:text-base">{ar ? "ابدأ تدريبك، طور مستواك، والعب مع ناس شبهك." : "Train harder. Play smarter. Find your people."}</p>
          <div className="mt-7 flex flex-wrap gap-2">{[gender,age,[venue.area,venue.governorate].filter(Boolean).join(" · ")].filter(Boolean).map(value=><span key={value} className="rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white">{value}</span>)}</div>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <section className="rounded-[24px] border border-[#e9e5f1] bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#6739d4]">{ar ? "تفاصيل التدريب" : "TRAINING DETAILS"}</p>
            <h2 className="mt-3 text-2xl font-extrabold text-[#211a30]">{ar ? "كل اللي محتاج تعرفه" : "Everything you need to know"}</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                {label:ar?"الرياضة":"Sport",value:sport||"—",icon:Trophy},
                {label:ar?"المجموعة":"Group",value:gender,icon:Users},
                {label:ar?"السن":"Age group",value:age,icon:Calendar},
                {label:ar?"المنطقة":"Area",value:[venue.governorate,venue.area].filter(Boolean).join(" · ")||"—",icon:Building2},
              ].map(item=><div key={item.label} className="rounded-2xl bg-[#f7f6fb] p-4"><div className="flex items-center gap-2 text-xs font-bold text-[#6739d4]"><item.icon size={15}/>{item.label}</div><p className="mt-2 break-words text-sm font-bold text-[#211a30]">{item.value}</p></div>)}
            </div>
          </section>
          <section className="rounded-[24px] border border-[#e9e5f1] bg-white p-6 shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#6739d4]">{ar?"مكان التدريب":"TRAINING LOCATION"}</p>
            <h2 className="mt-3 break-words text-xl font-extrabold text-[#211a30]">{venue.name || (ar?"الملعب":"Training venue")}</h2>
            <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-[#716c7d]"><MapPin className="mt-1 h-4 w-4 shrink-0"/>{[venue.address,venue.area,venue.governorate].filter(Boolean).join(" · ")||"—"}</p>
            <a href={locationUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#6739d4]/25 bg-[#eee8ff] px-5 py-3 text-sm font-extrabold text-[#6739d4] hover:bg-[#e3d9ff]"><MapPin size={17}/>{t("directions")}<ArrowUpRight size={16}/></a>
          </section>
        </div>
        <section className="rounded-[24px] border border-[#e9e5f1] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#6739d4]">{ar?"اختار خطتك":"CHOOSE YOUR PLAN"}</p>
          <h2 className="mt-3 text-2xl font-extrabold text-[#211a30]">{ar?"ابدأ تدريبك معانا":"Start playing with us"}</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-[18px] bg-[#eee8ff] p-5">
              <span className="inline-flex rounded-full bg-[#d5ff4b] px-3 py-1 text-xs font-extrabold text-[#211a30]">{ar?"أفضل قيمة":"BEST VALUE"}</span>
              <h3 className="mt-4 font-extrabold text-[#211a30]">{ar?"اشتراك شهري":"Monthly membership"}</h3>
              <p className="mt-2 text-2xl font-extrabold text-[#6739d4]">{formatMoney(monthlyPrice,lang)}</p>
              <p className="mt-1 text-sm text-[#716c7d]">{monthlySessions} {ar?"حصة شهريًا":"sessions per month"}</p>
              {program?<Button disabled={busy || !!reserved} onClick={()=>reserve("monthly")} className="mt-4 min-h-12 w-full rounded-xl bg-[#6739d4] font-bold text-white hover:bg-[#5029ad]">{ar?"احجز الاشتراك الشهري":"Book monthly plan"}<ArrowUpRight size={16}/></Button>:<p className="mt-4 text-xs text-[#716c7d]">{ar?"غير متاح للحجز المباشر":"Not bookable directly"}</p>}
            </div>
            <div className="rounded-[18px] border border-[#e9e5f1] bg-[#f7f6fb] p-5">
              <h3 className="font-extrabold text-[#211a30]">{ar?"حصة تجريبية واحدة":"Single trial session"}</h3>
              <p className="mt-2 text-2xl font-extrabold text-[#6739d4]">{formatMoney(trialPrice,lang)}</p>
              <p className="mt-1 text-sm text-[#716c7d]">{ar?"جرب حصة واحدة قبل الاشتراك":"Try one session before joining"}</p>
              {program?<Link href={`/a/${academy.slug}#training-${programId}`} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d5ff4b] px-4 py-3 text-center text-sm font-bold text-[#211a30] hover:bg-[#c7ef40]">{ar?"اختار موعد الحصة التجريبية":"Choose a trial session time"}<ArrowUpRight size={16}/></Link>:<p className="mt-4 text-xs text-[#716c7d]">{ar?"غير متاح للحجز المباشر":"Not bookable directly"}</p>}
            </div>
          </div>
        </section>
      </div>

      {reserved && (
        <div ref={paymentRef} className="mt-7 scroll-mt-24 rounded-[24px] border border-[#e9e5f1] bg-white p-5 shadow-sm sm:p-8" role="region" aria-label={ar ? "تفاصيل الحجز والدفع" : "Booking and payment"}>
          <div className="mb-5 rounded-xl bg-[#eee8ff] p-4 text-sm font-semibold text-[#211a30]">{ar ? "تم إنشاء طلب الحجز. راجع المبلغ وأكمل الدفع لتأكيد الطلب." : "Your reservation request is created. Review the amount and complete payment to confirm."}</div>
          <h3 className="mb-4 text-xl font-extrabold text-[#211a30]">
            {ar ? "تفاصيل الحجز والدفع" : "Booking & payment"}
          </h3>
          {paymentSubmitted ? (
            <div role="status" className="rounded-2xl border border-[#d9e9bd] bg-[#f4ffe5] p-6">
              <h4 className="text-lg font-extrabold text-[#211a30]">{ar ? "تم إرسال بيانات الدفع" : "Payment details submitted"}</h4>
              <p className="mt-2 text-sm leading-7 text-[#4f5c3e]">{ar ? "تم استلام بيانات الدفع للمراجعة. الحجز مش مؤكد لحد ما يتم اعتماد الدفع." : "Your payment details are awaiting review. The booking is not confirmed until payment is approved."}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/dashboard/academies" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6739d4] px-5 py-3 text-sm font-bold text-white hover:bg-[#5029ad]">{ar ? "متابعة اشتراكاتي" : "View my academy subscriptions"}<ArrowUpRight size={16}/></Link>
                <Link href={`/a/${academy.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#6739d4]/25 bg-white px-5 py-3 text-sm font-bold text-[#6739d4] hover:bg-[#eee8ff]">{ar ? "الرجوع للأكاديمية" : "Back to academy"}</Link>
              </div>
            </div>
          ) : <GameSharePayment
            amount={reserved.amount}
            label={reserved.details?.program || source.name}
            submitting={busy}
            onPay={async (method, path) => {
              setBusy(true);
              try {
                const supabase = createClient();
                const { error } = await supabase.rpc(
                  "manage_academy_training_payment",
                  {
                    p_booking_id: reserved.id,
                    p_action: "submit",
                    p_method: method ?? null,
                    p_receipt: path ?? null,
                    p_note: null,
                  }
                );
                if (error) throw error;
                setPaymentSubmitted(true);
                toast.success(
                  ar ? "تم إرسال الدفع للمراجعة" : "Payment submitted for review"
                );
              } catch (error: any) {
                toast.error(
                  error.message || (ar ? "تعذر إرسال الدفع" : "Could not submit payment")
                );
              } finally {
                setBusy(false);
              }
            }}
            submitLabel={
              ar ? "إرسال الإيصال للمراجعة" : "Submit receipt for review"
            }
            note={
              ar
                ? "ادفع برفع الإيصال للمراجعة من المشرف العام."
                : "Pay by uploading receipt for super admin review."
            }
          />}
        </div>
      )}
    </div>
  );
}
