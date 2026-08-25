"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { Check, X, Download, Bell } from "lucide-react";

interface BatchToolbarProps {
  selectedCount: number;
  onMarkPresent: () => void;
  onMarkAbsent: () => void;
  onExport: () => void;
  onClear: () => void;
}

export function BatchToolbar({
  selectedCount,
  onMarkPresent,
  onMarkAbsent,
  onExport,
  onClear,
}: BatchToolbarProps) {
  const { t: tk } = useI18n();
  const t = (key: string) => tk(key as any);

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
      <Badge variant="secondary">
        {t("batch_selected").replace("{n}", String(selectedCount))}
      </Badge>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onMarkPresent}>
          <Check className="h-3 w-3 mr-1" />
          {t("batch_mark_present")}
        </Button>
        <Button size="sm" variant="outline" onClick={onMarkAbsent}>
          <X className="h-3 w-3 mr-1" />
          {t("batch_mark_absent")}
        </Button>
        <Button size="sm" variant="outline" onClick={onExport}>
          <Download className="h-3 w-3 mr-1" />
          {t("batch_export_selected")}
        </Button>
      </div>
      <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto">
        {t("batch_clear")}
      </Button>
    </div>
  );
}
