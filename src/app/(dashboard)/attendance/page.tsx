"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ClipboardCheck, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { AttendanceTable } from "@/components/attendance/attendance-table";
import { useI18n } from "@/lib/i18n";
import { useSessions } from "@/lib/queries";
import type { TrainingSession } from "@/lib/types";

function AttendanceContent() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const { data: sessions, isLoading } = useSessions();

  const upcoming = useMemo(
    () =>
      [...(sessions ?? [])]
        .filter((s) => !s.is_completed)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [sessions]
  );

  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    const fromQuery = searchParams.get("session");
    if (fromQuery && upcoming.some((s) => s.id === fromQuery)) {
      setSessionId(fromQuery);
    } else if (upcoming.length > 0 && !sessionId) {
      setSessionId(upcoming[0].id);
    }
  }, [upcoming, searchParams, sessionId]);

  const selected: TrainingSession | undefined = upcoming.find(
    (s) => s.id === sessionId
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("attendance_title")} subtitle={t("attendance_subtitle")} />

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : upcoming.length === 0 ? (
        <EmptyState message={t("dash_no_sessions")} icon={ClipboardCheck} />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:max-w-md">
                <Select value={sessionId} onValueChange={setSessionId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("attendance_select_session")} />
                  </SelectTrigger>
                  <SelectContent>
                    {upcoming.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {format(new Date(s.date + "T00:00:00"), "EEE, MMM d", {
                          locale,
                        })}{" "}
                        · {s.time.slice(0, 5)}
                        {s.location ? ` · ${s.location}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selected && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  {selected.location || t("common_not_set")}
                </div>
              )}
            </CardContent>
          </Card>

          {selected && <AttendanceTable session={selected} />}
        </>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AttendanceContent />
    </Suspense>
  );
}
