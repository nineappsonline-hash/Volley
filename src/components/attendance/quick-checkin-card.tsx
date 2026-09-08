"use client";

import { useRef, useState } from "react";
import { Camera, ScanLine } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils";
import { QrCamera } from "./qr-camera";

export function QuickCheckinCard({ sessionId }: { sessionId: string }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const busy = useRef(false);
  const checkin = useMutation({
    mutationFn: async (value: string) => {
      const { data, error } = await createClient().rpc("check_in_member", {
        p_session_id: sessionId, p_code: value,
      });
      if (error) throw error;
      return data as { member_name: string; already_present: boolean };
    },
    onSuccess: () => {
      for (const key of ["attendance", "profiles", "calculations", "sessions", "badges", "activity"])
        qc.invalidateQueries({ queryKey: [key] });
    },
  });

  const handleCheckin = async (value: string) => {
    if (busy.current) return;
    setCamera(false);
    const normalized = value.trim().toUpperCase();
    if (!/^[A-Z0-9]{8,32}$/.test(normalized)) {
      setMessage({ text: ar ? "الكود مش صحيح. امسح كود العضو من البروفايل." : "Invalid code. Scan the member’s profile QR card.", error: true });
      return;
    }
    busy.current = true;
    setMessage(null);
    try {
      const result = await checkin.mutateAsync(normalized);
      setMessage({ error: false, text: `${result.member_name} — ${result.already_present
        ? (ar ? "الحضور متسجل بالفعل" : "Already checked in") : t("checkin_success")}` });
      setCode("");
    } catch (err) {
      setMessage({ text: errorMessage(err, t("common_error")), error: true });
    } finally { busy.current = false; }
  };

  return <Card><CardContent className="space-y-3 p-4">
    <div className="flex items-center gap-2 text-sm font-medium"><ScanLine className="h-4 w-4 text-info-ink" />{t("checkin_quick")}</div>
    <p className="text-xs text-muted-foreground">{ar ? "اختار التمرين فوق، وبعدها امسح كود العضو لتسجيل حضوره." : "Select the session above, then scan a member’s QR code to mark attendance."}</p>
    <Button type="button" variant="outline" disabled={checkin.isPending} onClick={() => { setMessage(null); setCamera(!camera); }}>
      <Camera className="h-4 w-4" />{camera ? (ar ? "إيقاف الكاميرا" : "Stop camera") : (ar ? "مسح بالكاميرا" : "Scan with camera")}
    </Button>
    {camera && <QrCamera label={ar ? "ماسح كود الحضور" : "Attendance QR scanner"}
      onScan={value => void handleCheckin(value)} onError={() => {
        setCamera(false);
        setMessage({ error: true, text: ar ? "مش قادرين نفتح الكاميرا. اسمح للموقع باستخدامها وافتحه بـ HTTPS، أو اكتب الكود تحت." : "Could not open the camera. Allow camera access and use HTTPS, or enter the code below." });
      }} />}
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void handleCheckin(code); }}>
      <Input dir="ltr" className="uppercase" autoComplete="off" maxLength={32}
        aria-label={t("checkin_placeholder")} placeholder={t("checkin_placeholder")}
        value={code} onChange={e => setCode(e.target.value)} disabled={checkin.isPending} />
      <Button type="submit" disabled={!code.trim() || checkin.isPending}>{checkin.isPending ? (ar ? "جاري التسجيل…" : "Checking in…") : t("attendance_title")}</Button>
    </form>
    {message && <p role={message.error ? "alert" : "status"} className={message.error ? "text-sm text-error-ink" : "text-sm text-success-ink"}>{message.text}</p>}
  </CardContent></Card>;
}
