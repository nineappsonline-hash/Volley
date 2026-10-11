"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { profileAge } from "@/lib/member-training";
import { Button } from "@/components/ui/button";
import { QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

interface CheckinQrCardProps {
  code: string;
  memberName: string;
  compact?: boolean;
  profile?: Profile;
}

export function CheckinQrCard({ code, memberName, compact = false, profile }: CheckinQrCardProps) {
  const { t, lang } = useI18n();
  const academy = useQuery({
    queryKey: ["member-qr-academy", profile?.academy_id],
    enabled: !!profile?.academy_id,
    queryFn: async () => {
      const { data, error } = await createClient().from("academies").select("name").eq("id", profile!.academy_id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const ar = lang === "ar";
  const age = profileAge(profile?.birth_date ?? null);
  const details = profile ? [
    [ar ? "الاسم" : "Name", profile.name],
    [ar ? "اسم المستخدم" : "Username", profile.username],
    [ar ? "كود العضو" : "Member code", code],
    [ar ? "الهاتف" : "Phone", profile.phone],
    [ar ? "النوع" : "Gender", profile.gender === "male" ? (ar ? "ذكر" : "Male") : profile.gender === "female" ? (ar ? "أنثى" : "Female") : null],
    [ar ? "العمر" : "Age", age == null ? null : String(age)],
    [ar ? "الأكاديمية" : "Academy", profile.academy_id ? academy.data?.name ?? (academy.isError ? (ar ? "تعذر تحميل الاسم" : "Name unavailable") : (ar ? "جار التحميل…" : "Loading…")) : (ar ? "غير مسجل في أكاديمية" : "No academy membership")],
    [ar ? "الحالة" : "Status", profile.is_active ? (ar ? "نشط" : "Active") : (ar ? "غير نشط" : "Inactive")],
  ] : [];
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(code, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <Card className={compact ? "overflow-hidden rounded-2xl border-indigo-300/30 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 sm:flex sm:items-center sm:justify-between" : undefined}>
      <CardHeader className={compact ? "pb-3 sm:max-w-sm sm:pb-6" : "pb-3"}>
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4 text-primary" />
          {t("qr_title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("qr_hint")}</p>
        {profile && <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">{details.map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value || (ar ? "غير محدد" : "Not provided")}</dd></div>)}</dl>}
      </CardHeader>
      <CardContent className={compact ? "flex flex-col items-center gap-2 pt-0 sm:pt-6" : "flex flex-col items-center gap-3"}>
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR ${code}`}
            className={compact ? "h-40 w-40 rounded-xl border bg-white p-2" : "h-52 w-52 rounded-xl border bg-white p-2"}
          />
        ) : (
          <Skeleton className={compact ? "h-40 w-40 rounded-xl" : "h-52 w-52 rounded-xl"} />
        )}
        <p className="max-w-full break-all text-center font-mono text-sm font-extrabold tracking-wider">{code}</p>
        <p className="text-xs text-muted-foreground">{memberName}</p>
        {dataUrl && <Button asChild variant="outline" size="sm"><a href={dataUrl} download="member-qr.png">{lang === "ar" ? "تحميل كود الحضور" : "Download attendance QR"}</a></Button>}
      </CardContent>
    </Card>
  );
}
