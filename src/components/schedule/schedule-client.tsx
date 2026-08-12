"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarView } from "@/components/schedule/calendar-view";
import { SessionFormDialog } from "@/components/schedule/session-form-dialog";
import { SessionCard } from "@/components/schedule/session-card";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
  useAttendanceCounts,
  useDeleteSession,
  useSessionCalculations,
  useSessions,
} from "@/lib/queries";
import type { TrainingSession } from "@/lib/types";

export function ScheduleClient({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const { data: sessions, isLoading } = useSessions();
  const { data: counts } = useAttendanceCounts();
  const { data: calculations } = useSessionCalculations();
  const deleteSession = useDeleteSession();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingSession | null>(null);
  const [deleting, setDeleting] = useState<TrainingSession | null>(null);

  const calcBySession = useMemo(
    () => new Map((calculations ?? []).map((c) => [c.session_id, c])),
    [calculations]
  );

  const sortedSessions = useMemo(
    () =>
      [...(sessions ?? [])].sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time)
      ),
    [sessions]
  );

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteSession.mutateAsync(deleting.id);
      toast.success(t("schedule_deleted"));
    } catch (err) {
      console.error("[schedule] delete failed", err);
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("schedule_title")} subtitle={t("schedule_subtitle")}>
        {isAdmin && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <CalendarPlus className="h-4 w-4" />
            {t("schedule_add")}
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <CalendarView
                sessions={sortedSessions}
                onSelectSession={(s) => {
                  if (isAdmin) {
                    setEditing(s);
                    setFormOpen(true);
                  }
                }}
              />
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 text-lg font-bold">{t("schedule_list_view")}</h2>
            {sortedSessions.length === 0 ? (
              <EmptyState message={t("schedule_no_sessions")} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sortedSessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    presentCount={counts?.[s.id]?.present}
                    calculation={calcBySession.get(s.id) ?? null}
                    onEdit={
                      isAdmin
                        ? () => { setEditing(s); setFormOpen(true); }
                        : undefined
                    }
                    onMarkAttendance={
                      isAdmin && !s.is_completed
                        ? () => window.location.assign(`/attendance?session=${s.id}`)
                        : undefined
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <SessionFormDialog open={formOpen} onOpenChange={setFormOpen} session={editing} />
          <AlertDialog
            open={!!deleting}
            onOpenChange={(open) => { if (!open) setDeleting(null); }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("schedule_delete_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("schedule_delete_confirm")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDelete}
                >
                  {t("common_delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
