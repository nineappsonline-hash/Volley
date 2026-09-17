"use client";

import { useState } from "react";
import { Check, Copy, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

/**
 * Shown to the game creator right after they pay their share in a split game.
 * Explains that the court rent is only confirmed when the collected payments
 * cover it — either the minimum players have paid, someone covers the rest, or
 * the full rent was paid upfront. Also surfaces the game's share link so the
 * creator can invite the players needed to confirm the booking.
 */
export function CourtRentInfoDialog({
  open,
  onOpenChange,
  shareLink,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink?: string | null;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [copied, setCopied] = useState(false);
  const message = ar
    ? "لن يتم تأكيد المباراة حتى يُدفع المبلغ المتبقي من إيجار الملعب."
    : "The game won't be confirmed until the remaining court rent is paid.";

  const copyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard?.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {ar ? "إيجار الملعب" : "Court rent"}
          </DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        {shareLink && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2.5">
            <LinkIcon className="h-4 w-4 shrink-0 text-primary" />
            <span dir="ltr" className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {shareLink}
            </span>
            <Button variant="outline" size="sm" onClick={() => void copyLink()} className="shrink-0">
              {copied ? (
                <Check className="me-1 h-3.5 w-3.5" />
              ) : (
                <Copy className="me-1 h-3.5 w-3.5" />
              )}
              {ar ? (copied ? "تم النسخ" : "نسخ") : copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            {ar ? "تمام" : "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}