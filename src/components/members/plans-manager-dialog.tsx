"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, X, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import { useDeletePlan, usePlans, useSavePlan } from "@/lib/queries";
import type { MembershipPlan } from "@/lib/types";

interface PlansManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlansManagerDialog({ open, onOpenChange }: PlansManagerDialogProps) {
  const { t, lang } = useI18n();
  const { data: plans, isLoading } = usePlans();
  const savePlan = useSavePlan();
  const deletePlan = useDeletePlan();

  const [name, setName] = useState("");
  const [sessionsCount, setSessionsCount] = useState("8");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      resetForm();
      setEditingId(null);
      setConfirmDeleteId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetForm = () => {
    setName("");
    setSessionsCount("8");
    setPrice("");
  };

  const startEdit = (p: MembershipPlan) => {
    setEditingId(p.id);
    setName(p.name);
    setSessionsCount(String(p.sessions_count));
    setPrice(p.price != null ? String(p.price) : "");
    setConfirmDeleteId(null);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await savePlan.mutateAsync({
        id: editingId ?? undefined,
        name: name.trim(),
        sessions_count: Math.max(1, Number(sessionsCount) || 1),
        price: price ? Number(price) : null,
      });
      toast.success(t("plans_saved"));
      if (!editingId) resetForm();
      else setEditingId(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deletePlan.mutateAsync(id);
      toast.success(t("plans_deleted"));
      setConfirmDeleteId(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {t("plans_title")}
          </DialogTitle>
          <DialogDescription>{t("plans_empty")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border p-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1.5 sm:col-span-2">
                <Label>{t("plans_name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("plans_sessions")}</Label>
                <Input
                  type="number"
                  min="1"
                  dir="ltr"
                  value={sessionsCount}
                  onChange={(e) => setSessionsCount(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="w-40 space-y-1.5">
                <Label>{t("plans_price")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {editingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingId(null);
                      resetForm();
                    }}
                  >
                    <X className="h-4 w-4" />
                    {t("common_cancel")}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || !name.trim()}
                  onClick={handleSave}
                >
                  <Plus className="h-4 w-4" />
                  {editingId ? t("common_save") : t("plans_add")}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1 rounded-lg border p-1">
            {isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("common_loading")}
              </p>
            ) : (plans ?? []).length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("plans_empty")}
              </p>
            ) : (
              (plans ?? []).map((plan) =>
                confirmDeleteId === plan.id ? (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm"
                  >
                    <span className="text-destructive">{plan.name}</span>
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={busy}
                        onClick={() => handleDelete(plan.id)}
                      >
                        {t("common_confirm")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("common_cancel")}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                ) : (
                  <div
                    key={plan.id}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-start"
                      onClick={() => startEdit(plan)}
                      title={t("common_edit")}
                    >
                      <p className="truncate text-sm font-medium">{plan.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {plan.sessions_count} ·{" "}
                        {plan.price != null ? formatMoney(Number(plan.price), lang) : "—"}
                      </p>
                    </button>
                    <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("common_edit")}
                        onClick={() => startEdit(plan)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        onClick={() => setConfirmDeleteId(plan.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                )
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
