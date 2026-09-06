"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { useFileReport } from "@/lib/queries";
import { errorMessage } from "@/lib/utils";

const PRESETS = ["report_reason_spam", "report_reason_abuse", "report_reason_fake", "report_reason_other"] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "member" | "game";
  targetId: string;
  targetLabel: string;
};

export function ReportDialog({ open, onOpenChange, targetType, targetId, targetLabel }: Props) {
  const { t } = useI18n();
  const report = useFileReport();
  const [preset, setPreset] = useState<string>("");
  const [custom, setCustom] = useState("");

  const handleSubmit = async () => {
    const reason = custom.trim() || preset;
    if (!reason) return;
    try {
      await report.mutateAsync({ targetType, targetId, reason });
      toast.success(t("report_submitted"));
      onOpenChange(false);
      setPreset("");
      setCustom("");
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-destructive" />
            {t("report_title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("report_desc").replace("{name}", targetLabel)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("report_reason_label")}</Label>
            {PRESETS.map((key) => (
              <label
                key={key}
                className={`block cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors ${
                  preset === key
                    ? "border-primary bg-primary/5"
                    : "hover:border-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name="report-preset"
                  className="sr-only"
                  checked={preset === key}
                  onChange={() => {
                    setPreset(key);
                    setCustom("");
                  }}
                />
                {t(key)}
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label>{t("report_custom_label")}</Label>
            <Textarea
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                if (e.target.value) setPreset("");
              }}
              placeholder={t("report_custom_placeholder")}
              rows={3}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
          <Button onClick={handleSubmit} disabled={report.isPending || (!custom.trim() && !preset)} variant="destructive">
            {report.isPending ? t("common_saving") : t("report_submit")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}