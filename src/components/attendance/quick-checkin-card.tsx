"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useProfiles, useUpsertAttendance } from "@/lib/queries";

interface QuickCheckinCardProps {
  sessionId: string;
}

export function QuickCheckinCard({ sessionId }: QuickCheckinCardProps) {
  const { t } = useI18n();
  const { data: profiles } = useProfiles();
  const upsert = useUpsertAttendance();
  const [code, setCode] = useState("");

  const handleCheckin = async () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    const member = (profiles ?? []).find(
      (p) => p.role === "member" && p.checkin_code === normalized
    );
    if (!member) {
      toast.error(t("checkin_not_found"));
      setCode("");
      return;
    }
    try {
      await upsert.mutateAsync([
        { session_id: sessionId, member_id: member.id, is_present: true },
      ]);
      toast.success(`${member.name} ${t("checkin_success")}`);
      setCode("");
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ScanLine className="h-4 w-4 text-primary" />
          {t("checkin_quick")}
        </div>
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleCheckin();
          }}
        >
          <Input
            dir="ltr"
            className="uppercase"
            autoComplete="off"
            placeholder={t("checkin_placeholder")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" disabled={!code.trim() || upsert.isPending}>
            {t("attendance_title")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
