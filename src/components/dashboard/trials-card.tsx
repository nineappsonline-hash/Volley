"use client";

import { QueryState } from "@/components/shared/query-state";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarClock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n } from "@/lib/i18n";
import { TRIAL_STATUSES, sessionsForMembership } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import { useSports, useTrialRequests, useUpdateTrialRequest } from "@/lib/queries";
import type { TrialStatus } from "@/lib/types";

export function TrialsCard() {
  const { t, locale } = useI18n();
  const cache = useQueryClient();
  const trialsQuery = useTrialRequests();
  const { data: trials } = trialsQuery;
  const { data: sports } = useSports();
  const update = useUpdateTrialRequest();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const sportName = (id: string | null) =>
    id ? ((sports ?? []).find((s) => s.id === id)?.name ?? "") : "";

  const setStatus = async (id: string, status: TrialStatus) => {
    try {
      await update.mutateAsync({ id, status });
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  // Approve = create a real member account, then mark the request as converted.
  const handleApprove = async (trial: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  }) => {
    if (!trial.email) {
      toast.error(t("field_invalid_email"));
      return;
    }
    setApprovingId(trial.id);
    try {
      const tempPassword = `Volley-${Math.random().toString(36).slice(2, 10)}`;
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trial.email,
          password: tempPassword,
          name: trial.name,
          phone: trial.phone ?? "",
          membership_type: "full",
          subscription_sessions: sessionsForMembership("full"),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed");
      }
      await update.mutateAsync({ id: trial.id, status: "converted" });
      await cache.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(`${trial.name}: ${t("trials_approve_done")}`);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="mb-4 flex-row flex-wrap items-center justify-between gap-2 space-y-0 bg-gradient-to-br from-orange-900 to-rose-800 text-white">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-5 w-5 text-orange-200" />
          {t("trials_title")}
        </CardTitle>
        {(trials ?? []).length > 0 && (
          <Badge variant="secondary">{trials!.length}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-2"><QueryState queries={[trialsQuery]}>
        {!trials || trials.length === 0 ? (
          <EmptyState message={t("trials_empty")} icon={CalendarClock} />
        ) : (
          [...trials]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, 6)
            .map((trial) => (
              <div key={trial.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{trial.name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      {[trial.phone, trial.email].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sportName(trial.sport_id) || "—"}
                      {trial.preferred_date
                        ? ` · ${format(new Date(trial.preferred_date + "T00:00:00"), "MMM d", { locale })}`
                        : ""}
                      {" · "}
                      {format(new Date(trial.created_at), "MMM d", { locale })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Select
                      value={trial.status}
                      onValueChange={(v) => setStatus(trial.id, v as TrialStatus)}
                    >
                      <SelectTrigger className="h-8 w-[7.5rem] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRIAL_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`trial_status_${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {trial.status !== "converted" && trial.email && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={approvingId === trial.id}
                        onClick={() =>
                          handleApprove({
                            id: trial.id,
                            name: trial.name,
                            phone: trial.phone,
                            email: trial.email,
                          })
                        }
                      >
                        <UserPlus className="h-4 w-4" />
                        {t("trials_approve")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
        )}
      </QueryState></CardContent>
    </Card>
  );
}
