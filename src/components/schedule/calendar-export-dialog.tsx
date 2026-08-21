"use client";

import { useState } from "react";
import { CalendarCheck, Check, Copy, Download } from "lucide-react";
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
}

export function CalendarExportDialog({
  open,
  onOpenChange,
  token,
}: CalendarExportDialogProps) {
  const { t } = useI18n();
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
      </DialogContent>
    </Dialog>
  );
}
