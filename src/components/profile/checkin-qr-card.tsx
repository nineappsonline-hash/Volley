"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";

interface CheckinQrCardProps {
  code: string;
  memberName: string;
}

export function CheckinQrCard({ code, memberName }: CheckinQrCardProps) {
  const { t } = useI18n();
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4 text-primary" />
          {t("qr_title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("qr_hint")}</p>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR ${code}`}
            className="h-52 w-52 rounded-xl border bg-white p-2"
          />
        ) : (
          <Skeleton className="h-52 w-52 rounded-xl" />
        )}
        <p className="font-mono text-lg font-extrabold tracking-[0.3em]">{code}</p>
        <p className="text-xs text-muted-foreground">{memberName}</p>
      </CardContent>
    </Card>
  );
}
