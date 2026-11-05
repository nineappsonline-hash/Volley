"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

/** Explains full court-booking prepayment and shares the game invitation. */
export function CourtRentInfoDialog({ open, onOpenChange, shareLink }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink?: string | null;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setCopied(false); setCopyFailed(false); }, [open, shareLink]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
      input.current?.focus();
      input.current?.select();
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex min-w-0 flex-col gap-5 overflow-x-hidden rounded-2xl p-5 sm:max-w-md sm:p-6">
      <DialogHeader className="min-w-0 space-y-3 text-start">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><LinkIcon className="h-5 w-5" aria-hidden="true" /></span>
        <DialogTitle className="pe-5 text-xl leading-tight">{shareLink ? (ar ? "اعزم أصحابك للماتش" : "Invite friends to your game") : (ar ? "إيجار الملعب" : "Court rent")}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed">{shareLink ? (ar ? "شارك لينك الماتش علشان أصحابك يقدروا ينضموا." : "Share your invitation link so friends can join you.") : (ar ? "راجع حالة الحجز قبل موعد الماتش." : "Check your booking status before game time.")}</DialogDescription>
      </DialogHeader>
      {shareLink && <div className="min-w-0 space-y-3">
        <label htmlFor="created-game-invitation" className="block text-xs font-semibold text-muted-foreground">{ar ? "لينك الدعوة" : "Invitation link"}</label>
        <input ref={input} id="created-game-invitation" dir="ltr" readOnly value={shareLink} onFocus={event => event.currentTarget.select()} className="block h-11 w-full min-w-0 rounded-xl border bg-muted/40 px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <Button className="h-11 w-full rounded-xl" onClick={() => void copyLink()}>{copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{ar ? (copied ? "تم نسخ اللينك" : "انسخ لينك الماتش") : copied ? "Link copied" : "Copy game link"}</Button>
        <p role="status" className="sr-only">{copied ? (ar ? "تم نسخ اللينك" : "Link copied") : ""}</p>
        {copyFailed && <p role="status" className="text-xs text-muted-foreground">{ar ? "اختار اللينك وانسخه يدويًا." : "Select the link and copy it manually."}</p>}
      </div>}
      <div className="flex min-w-0 items-start gap-2.5 rounded-xl border bg-muted/30 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
        <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">{ar ? "يتأكد الحجز بعد سداد السعر النهائي بالكامل واعتماد الدفع. الإيصالات قيد المراجعة لا تؤكد الحجز." : "Your booking is confirmed once the full price is paid and approved. Receipts awaiting review do not confirm a booking."}</p>
      </div>
      <Button variant="ghost" className="h-9 w-full rounded-xl" onClick={() => onOpenChange(false)}>{ar ? "تمام" : "Done"}</Button>
    </DialogContent>
  </Dialog>;
}
