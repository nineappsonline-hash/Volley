"use client";

import { useSessionWaitlist, useJoinWaitlist, useUpdateWaitlistEntry } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Clock, X } from "lucide-react";

export function WaitlistCard({ sessionId, maxCapacity }: { sessionId: string; maxCapacity?: number }) {
  const { t: tk, lang } = useI18n();
  const t = (key: string) => tk(key as any);
  const { data: waitlist = [] } = useSessionWaitlist(sessionId);
  const joinWaitlist = useJoinWaitlist();
  const updateEntry = useUpdateWaitlistEntry();

  const myEntry = waitlist.find((w) => w.status === "waiting");

  const handleJoin = async () => {
    await joinWaitlist.mutateAsync({
      session_id: sessionId,
      member_id: "", // Will be set server-side from auth.uid()
      position: waitlist.length + 1,
    });
    toast.success(t("waitlist_join"));
  };

  const handleLeave = async (id: string) => {
    await updateEntry.mutateAsync({ id, status: "cancelled" });
    toast.success(t("waitlist_leave"));
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {t("waitlist_title")}
          <Badge variant="secondary">{waitlist.length}</Badge>
        </h4>
        {!myEntry && (
          <Button size="sm" variant="outline" onClick={handleJoin} disabled={joinWaitlist.isPending}>
            {t("waitlist_join")}
          </Button>
        )}
      </div>

      {waitlist.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("waitlist_empty")}</p>
      ) : (
        <div className="space-y-2">
          {waitlist.map((entry, i) => (
            <div key={entry.id} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="w-6 justify-center">{i + 1}</Badge>
                {(entry as any).profile?.name ?? "Unknown"}
              </span>
              {myEntry?.id === entry.id && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleLeave(entry.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
