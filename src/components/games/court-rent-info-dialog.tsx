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
  const message = ar
    ? "لن يتم تأكيد المباراة حتى يُدفع المبلغ المتبقي من إيجار الملعب."
    : "The game won't be confirmed until the remaining court rent is paid.";

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
        <DialogFooter>
          <Button className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            {ar ? "تمام" : "OK"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}