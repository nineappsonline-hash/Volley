"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Check, Copy, Crown, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

interface CalendarExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  isPro?: boolean;
}

export function CalendarExportDialog({
  open,
  onOpenChange,
  token,
  isPro = false,
}: CalendarExportDialogProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/calendar/${token}`
      : `/api/calendar/${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(t("cal_copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("common_error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            {t("cal_export")}
          </DialogTitle>
          <DialogDescription>{t("cal_subscribe_hint")}</DialogDescription>
        </DialogHeader>
        {isPro ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input dir="ltr" readOnly value={url} onFocus={(e) => e.target.select()} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("cal_copy")}
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <a href={url} download="schedule.ics" className="block">
              <Button type="button" className="w-full">
                <Download className="h-4 w-4" />
                {t("cal_download")}
              </Button>
            </a>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30">
              <Crown className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("cal_premium_hint")}
            </p>
            <Button
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700"
              onClick={() => {
                onOpenChange(false);
                router.push("/upgrade");
              }}
            >
              <Crown className="mr-2 h-4 w-4" />
              {t("premium_upgrade_cta")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}