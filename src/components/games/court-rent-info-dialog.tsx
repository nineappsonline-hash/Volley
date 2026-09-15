"use client";

import { ShieldCheck } from "lucide-react";
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
 * the full rent was paid upfront.
 */
export function CourtRentInfoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const points = ar
    ? [
        "يدفع الحد الأدنى من اللاعبين نصيبهم كاملًا (أو أكثر).",
        "يدفع أحدهم المبلغ المتبقي لاستكمال إيجار الملعب.",
        "تم دفع إيجار الملعب بالكامل من البداية.",
      ]
    : [
        "The minimum number of players have paid their full share (or more).",
        "Someone pays the remaining amount to complete the court rent.",
        "The full court rent was paid upfront.",
      ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {ar ? "تأكيد إيجار الملعب" : "Court rent confirmation"}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? "يتأكد إيجار الملعب فقط عندما تغطي المدفوعات إجمالي الإيجار. يحدث ذلك بواحدة من هذه الحالات:"
              : "Your court is confirmed only when the payments cover the full rent. This happens when one of these is true:"}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-foreground">
          {points.map((point, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            {ar ? "تمام" : "Got it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}