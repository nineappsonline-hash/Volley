"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { profileAge } from "@/lib/member-training";
import { Button } from "@/components/ui/button";
import { QrCode, Maximize2, Download, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  const [expanded, setExpanded] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(code, {
      width: 768,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => { cancelled = true; };
  }, [code]);

  return <>
    <Card className="overflow-hidden rounded-2xl border-amber-300/30 bg-gradient-to-br from-slate-950 via-[#10284d] to-slate-950 text-slate-100 shadow-xl shadow-blue-950/15">
      <CardHeader className="border-b border-white/10 bg-white/[0.03] pb-5">
        <div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-3 text-base"><span className="rounded-xl border border-amber-200/20 bg-amber-200/10 p-2.5"><QrCode className="h-5 w-5 text-amber-200" /></span>{t("qr_title")}</CardTitle><span className="flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/25 bg-amber-200/10 px-3 py-1 text-xs font-medium text-amber-100"><Sparkles className="h-3 w-3" />{ar ? "بطاقة العضو" : "Member pass"}</span></div>
        <p className="text-xs leading-relaxed text-slate-300">{t("qr_hint")}</p>
      </CardHeader>
      <CardContent className={`grid gap-6 p-5 ${compact ? "sm:grid-cols-[1fr_240px]" : "md:grid-cols-[1fr_240px]"}`}>
        <div className="min-w-0"><p className="text-2xl font-semibold tracking-tight text-white">{memberName}</p><p className="mt-1 text-sm text-slate-300">{profile?.username ? `@${profile.username}` : (ar ? "بطاقة حضورك الشخصية" : "Your personal attendance pass")}</p>
          {profile && <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 text-sm">{details.filter(([label]) => ![ar ? "الاسم" : "Name", ar ? "اسم المستخدم" : "Username", ar ? "كود العضو" : "Member code"].includes(label!)).map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-white/5 bg-white/[0.04] px-3 py-3"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words font-medium">{value || (ar ? "غير محدد" : "Not provided")}</dd></div>)}</dl>}
        </div>
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-amber-200/30 bg-white p-5 text-slate-950 shadow-lg">
          <button type="button" disabled={!dataUrl} onClick={() => setExpanded(true)} aria-label={ar ? "تكبير كود الحضور" : "Enlarge attendance QR"} className="rounded-xl bg-white p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={dataUrl} alt={`QR ${code}`} className="h-40 w-40" />
            ) : <Skeleton className="h-40 w-40" />}
          </button>
          <div className="text-center"><p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">{ar ? "كود العضو" : "Member code"}</p><p className="mt-1 max-w-full break-all font-mono text-sm font-semibold tracking-wider">{code}</p></div>
          <Button variant="outline" size="sm" disabled={!dataUrl} onClick={() => setExpanded(true)} className="w-full gap-2 border-slate-200 bg-slate-950 text-white hover:bg-slate-800 hover:text-white"><Maximize2 className="h-4 w-4" />{ar ? "تكبير الكود" : "Enlarge QR"}</Button>
          {dataUrl && <Button asChild variant="ghost" size="sm" className="w-full gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950"><a href={dataUrl} download="member-qr.png"><Download className="h-4 w-4" />{ar ? "تحميل" : "Download"}</a></Button>}
        </div>
      </CardContent>
    </Card>
    <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{ar ? "كود الحضور" : "Attendance QR"}</DialogTitle><DialogDescription>{memberName}</DialogDescription></DialogHeader>{dataUrl && (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={dataUrl} alt={`QR ${code}`} className="mx-auto aspect-square w-full max-w-96 rounded-xl bg-white p-4" />
    )}<p className="break-all text-center font-mono text-sm font-semibold">{code}</p></DialogContent></Dialog>
  </>;
}
