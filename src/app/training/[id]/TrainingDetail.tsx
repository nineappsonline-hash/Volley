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
import { useState } from "react";
import { toast } from "sonner";
import { Calendar, MapPin, Users, Building2 } from "lucide-react";

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
    location_link: source?.venue?.location_link,
  };
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
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start gap-4">
            <AcademyLogo
              academyId={academy.id}
              name={academy.name}
              logoUrl={academy.logo_url}
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/a/${academy.slug}`}
                className="text-sm font-semibold text-primary hover:underline truncate block"
              >
                {academy.name}
              </Link>
              <h1 className="text-2xl font-bold mt-0.5">{source.name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {sport} · {gender} · {age}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <Users className="h-4 w-4" />
              <span>{gender}</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <Calendar className="h-4 w-4" />
              <span>{age}</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <Building2 className="h-4 w-4" />
              <span>
                {[venue.governorate, venue.area].filter(Boolean).join(" · ")}
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <MapPin className="h-4 w-4" />
              <span>{venue.address || venue.name}</span>
            </div>
          </div>
          {venue.location_link && (
            <a
              href={venue.location_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
            >
              <MapPin className="h-4 w-4" />
              {t("directions")}
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {ar ? "خطط الاشتراك والمشاركة" : "Participation plans"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <h3 className="font-semibold">{ar ? "اشتراك شهري" : "Monthly plan"}</h3>
            <p className="text-lg font-bold">{formatMoney(monthlyPrice, lang)}</p>
            <p className="text-sm text-muted-foreground">
              {monthlySessions} {ar ? "حصة شهرياً" : "sessions per month"}
            </p>
            {program ? (
              <Button
                disabled={busy}
                className="w-full"
                onClick={() => reserve("monthly")}
              >
                {ar ? "احجز الاشتراك الشهري" : "Book monthly plan"}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                {ar ? "غير متاح للحجز المباشر" : "Not bookable directly"}
              </span>
            )}
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="font-semibold">
              {ar ? "حصة تجريبية واحدة" : "Single trial session"}
            </h3>
            <p className="text-lg font-bold">{formatMoney(trialPrice, lang)}</p>
            <p className="text-sm text-muted-foreground">
              {ar ? "جلسة واحدة للتجربة" : "One session to try"}
            </p>
            {program ? (
              <Button
                disabled={busy}
                className="w-full"
                onClick={() => {
                  toast.info(
                    ar
                      ? "اختر موعداً من صفحة الأكاديمية للحجز التجريبي"
                      : "Select a session time from the academy page for trial booking"
                  );
                }}
              >
                {ar ? "احجز حصة تجريبية" : "Book trial session"}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                {ar ? "غير متاح للحجز المباشر" : "Not bookable directly"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {reserved && (
        <div className="mt-6">
          <h3 className="font-semibold mb-3">
            {ar ? "تفاصيل الحجز والدفع" : "Booking & payment"}
          </h3>
          <GameSharePayment
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
          />
        </div>
      )}
    </div>
  );
}
