"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Save, Users } from "lucide-react";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ProfitLossIndicator } from "@/components/shared/profit-loss-indicator";
import { BatchToolbar } from "@/components/shared/batch-toolbar";
import {
  useAttendance,
  useMonthlyCosts,
  useAllPayments,
  useProfiles,
  useSessionCalculations,
  useSessionGuests,
  useUpsertAttendance,
} from "@/lib/queries";
import { useRealtime } from "@/lib/useRealtime";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import {
  buildSessionCalculation,
  memberPerSessionValue,
} from "@/lib/calculations";
import type { TrainingSession } from "@/lib/types";

interface AttendanceTableProps {
  session: TrainingSession;
}

export function AttendanceTable({ session }: AttendanceTableProps) {
  const { t, lang } = useI18n();
  const { data: profiles, isLoading: loadingMembers } = useProfiles();
  const { data: payments } = useAllPayments();
  const { data: attendance } = useAttendance(session.id);
  const { data: monthlyCosts } = useMonthlyCosts();
  const { data: calculations } = useSessionCalculations();
  const { data: guests } = useSessionGuests(session.id);
  const upsert = useUpsertAttendance();

  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean | undefined>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Realtime: keep everything in sync when attendance/guests change
  useRealtime(["attendance", "session_calculations", "session_guests"]);

  const members = useMemo(
    () => (profiles ?? []).filter((p) => p.role === "member"),
    [profiles]
  );

  const presentMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const a of attendance ?? []) {
      if (a.session_id === session.id) map.set(a.member_id, a.is_present);
    }
    return map;
  }, [attendance, session.id]);

  // Server attendance overlaid with pending toggles so the P/L updates
  // the instant a checkbox is flipped (spec: immediate feedback).
  const effectiveAttendance = useMemo(() => {
    const att = (attendance ?? []).filter((a) => a.session_id === session.id);
    const merged = new Map(att.map((a) => [a.member_id, a]));
    for (const [memberId, p] of Object.entries(pending)) {
      if (p === undefined) continue;
      merged.set(memberId, {
        ...(merged.get(memberId) ?? {
          id: `pending-${memberId}`,
          session_id: session.id,
          member_id: memberId,
          marked_at: new Date().toISOString(),
        }),
        is_present: p,
      });
    }
    return [...merged.values()];
  }, [attendance, pending, session.id]);

  const monthCost = useMemo(() => {
    const d = new Date(session.date + "T00:00:00");
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return (monthlyCosts ?? []).find(
      (c) => c.month === month && c.year === year
    );
  }, [monthlyCosts, session]);

  const calc = useMemo(() => {
    if (!attendance || !payments) return null;
    const clientCalc = buildSessionCalculation(
      session,
      effectiveAttendance,
      payments,
      monthlyCosts ?? [],
      guests ?? []
    );
    const hasPending = Object.values(pending).some((p) => p !== undefined);
    if (hasPending) return clientCalc;
    // No pending changes: prefer the authoritative server calculation.
    return (
      (calculations ?? []).find((c) => c.session_id === session.id) ?? clientCalc
    );
  }, [attendance, payments, calculations, monthlyCosts, session, effectiveAttendance, pending, guests]);

  const presentCount = useMemo(
    () => effectiveAttendance.filter((a) => a.is_present).length,
    [effectiveAttendance]
  );

  // Reset pending toggles when switching sessions so stale entries
  // are never written to a different session's attendance.
  useEffect(() => {
    setPending({});
  }, [session.id]);

  const hasChanges = useMemo(() => {
    return Object.values(pending).some((p) => p !== undefined);
  }, [pending]);

  const handleSave = useCallback(async () => {
    const changes: { member_id: string; is_present: boolean }[] = [];
    for (const m of members) {
      const p = pending[m.id];
      if (p !== undefined && p !== (presentMap.get(m.id) ?? false)) {
        changes.push({ member_id: m.id, is_present: p });
      }
    }
    if (changes.length === 0) return;
    setSaving(true);
    try {
      await upsert.mutateAsync(
        changes.map((c) => ({
          session_id: session.id,
          member_id: c.member_id,
          is_present: c.is_present,
        }))
      );
      toast.success(t("attendance_saved"));
      setPending({});
    } catch {
      toast.error(t("common_error"));
    } finally {
      setSaving(false);
    }
  }, [members, pending, presentMap, session.id, upsert, t]);

  const toggle = (memberId: string, value: boolean) => {
    setPending((p) => ({ ...p, [memberId]: value }));
  };

  const markAll = (value: boolean) => {
    const next: Record<string, boolean | undefined> = {};
    for (const m of members) next[m.id] = value;
    setPending(next);
  };

  const toggleSelect = (memberId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === members.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(members.map((m) => m.id)));
    }
  };

  const batchMarkPresent = () => {
    const next: Record<string, boolean | undefined> = {};
    for (const id of selected) next[id] = true;
    setPending((p) => ({ ...p, ...next }));
  };

  const batchMarkAbsent = () => {
    const next: Record<string, boolean | undefined> = {};
    for (const id of selected) next[id] = false;
    setPending((p) => ({ ...p, ...next }));
  };

  const batchExport = () => {
    const rows = members.filter((m) => selected.has(m.id)).map((m) => {
      const present = pending[m.id] ?? presentMap.get(m.id) ?? false;
      return { name: m.name, email: m.email, phone: m.phone, present: present ? 'Yes' : 'No' };
    });
    const csv = [Object.keys(rows[0] || {}).join(','), ...rows.map(r => Object.values(r).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance-${session.date}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingMembers) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (members.length === 0) {
    return <EmptyState message={t("attendance_no_members")} icon={Users} />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t("attendance_count")}</p>
            <p className="mt-1 text-xl font-extrabold">
              {presentCount}
              <span className="text-sm font-medium text-muted-foreground">
                {" / "}
                {members.length}
              </span>
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t("attendance_revenue")}</p>
            <p className="mt-1 text-xl font-extrabold font-mono text-success-ink dark:text-positive-400">
              {calc ? formatMoney(calc.total_revenue, lang) : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t("attendance_cost")}</p>
            <p className="mt-1 text-xl font-extrabold font-mono text-muted-foreground">
              {calc && monthCost ? formatMoney(calc.cost_per_session, lang) : "—"}
            </p>
            {!monthCost && (
              <p className="mt-1 text-[11px] leading-tight text-warning-ink dark:text-attention-400">
                {t("attendance_no_costs_hint")}
              </p>
            )}
          </div>
          <div className="flex flex-col justify-between rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t("attendance_profit_loss")}</p>
            <div className="mt-1">
              {calc && monthCost ? (
                <ProfitLossIndicator value={calc.profit_loss} className="text-sm" />
              ) : (
                "—"
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <BatchToolbar
        selectedCount={selected.size}
        onMarkPresent={batchMarkPresent}
        onMarkAbsent={batchMarkAbsent}
        onExport={batchExport}
        onClear={() => setSelected(new Set())}
      />

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAll(true)}
          disabled={saving}
        >
          <CheckCircle2 className="h-4 w-4 text-success-ink" />
          {t("attendance_mark_all")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAll(false)}
          disabled={saving}
        >
          <Circle className="h-4 w-4 text-muted-foreground" />
          {t("attendance_clear_all")}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="ms-auto gap-1.5"
        >
          <Save className="h-4 w-4" />
          {saving ? t("attendance_saving") : t("attendance_confirm_complete")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                <button onClick={toggleSelectAll} className="flex items-center gap-2">
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${selected.size === members.length && members.length > 0 ? 'bg-primary border-primary' : 'border-muted-foreground/50'}`}> 
                    {selected.size === members.length && members.length > 0 && <span className="text-[10px] text-primary-foreground">✓</span>}
                  </span>
                  {t("batch_select")}
                </button>
              </th>
              <th className="hidden px-4 py-3 text-end font-medium text-muted-foreground sm:table-cell">
                {t("attendance_per_member")}
              </th>
              <th className="px-4 py-3 text-end font-medium text-muted-foreground">
                {t("attendance_present")}
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const present = pending[m.id] ?? presentMap.get(m.id) ?? false;
              const pendingChange = pending[m.id] !== undefined;
              const value = memberPerSessionValue(m.id, payments ?? []);
              return (
                <tr
                  key={m.id}
                  className={`border-b last:border-0 transition-colors ${
                    present ? "bg-positive-50/60 dark:bg-positive-500/5" : "hover:bg-accent/40"
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggleSelect(m.id)}>
                      <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${selected.has(m.id) ? 'bg-primary border-primary' : 'border-muted-foreground/50'}`}> 
                        {selected.has(m.id) && <span className="text-[10px] text-primary-foreground">✓</span>}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <ProfileAvatar name={m.name} url={m.avatar_url} avatarId={m.avatar_id} className="h-8 w-8" />
                      <div>
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.phone || m.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 text-end font-mono text-xs text-muted-foreground sm:table-cell">
                    {value > 0 ? `+${formatMoney(value, lang)}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <button
                      role="switch"
                      aria-checked={present}
                      onClick={() => toggle(m.id, !present)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        present
                          ? "border-positive-500 bg-positive-500"
                          : "border-input bg-muted"
                      } ${pendingChange ? "opacity-70" : ""}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          present
                            ? "translate-x-5 rtl:-translate-x-5"
                            : "translate-x-0.5 rtl:-translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
