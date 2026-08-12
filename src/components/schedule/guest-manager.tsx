"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import {
  useDeleteGuest,
  useSaveGuest,
  useSessionGuests,
} from "@/lib/queries";
import type { SessionGuest } from "@/lib/types";

interface GuestManagerProps {
  sessionId: string;
  isAdmin: boolean;
}

export function GuestManager({ sessionId, isAdmin }: GuestManagerProps) {
  const { t, lang } = useI18n();
  const { data: guests, isLoading } = useSessionGuests(sessionId);
  const saveGuest = useSaveGuest();
  const deleteGuest = useDeleteGuest();

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SessionGuest | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const list = guests ?? [];
  const totalGuestRevenue = list.reduce((s, g) => s + Number(g.amount_paid), 0);

  const startAdd = () => {
    setEditing(null);
    setName("");
    setAmount("");
    setAdding(true);
  };

  const startEdit = (g: SessionGuest) => {
    setEditing(g);
    setName(g.name);
    setAmount(String(g.amount_paid));
    setAdding(true);
  };

  const closeForm = () => {
    setAdding(false);
    setEditing(null);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    const amt = Number.parseFloat(amount);
    if (!trimmed || Number.isNaN(amt) || amt < 0) {
      toast.error(t("guest_invalid"));
      return;
    }
    setSaving(true);
    try {
      await saveGuest.mutateAsync(
        editing
          ? { id: editing.id, session_id: sessionId, name: trimmed, amount_paid: amt }
          : { session_id: sessionId, name: trimmed, amount_paid: amt }
      );
      toast.success(editing ? t("guest_updated") : t("guest_added"));
      closeForm();
    } catch (err) {
      console.error("[guests] save failed", err);
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (g: SessionGuest) => {
    try {
      await deleteGuest.mutateAsync(g.id);
      toast.success(t("guest_deleted"));
    } catch (err) {
      console.error("[guests] delete failed", err);
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-bold">
        <UserRound className="h-4 w-4 text-primary" />
        {t("guests_title")}
        {list.length > 0 && (
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {list.length}
          </span>
        )}
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="ms-auto h-7 gap-1 px-2 text-xs"
            onClick={startAdd}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("guest_add")}
          </Button>
        )}
      </h4>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {t("guests_empty")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {list.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm last:border-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                  {g.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="truncate font-medium">{g.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="font-mono font-semibold">
                  {formatMoney(Number(g.amount_paid), lang)}
                </span>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => startEdit(g)}
                      title={t("common_edit")}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(g)}
                      title={t("common_delete")}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-sm font-bold">
            <span>{t("guests_total")}</span>
            <span className="font-mono">{formatMoney(totalGuestRevenue, lang)}</span>
          </div>
        </div>
      )}

      {isAdmin && adding && (
        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              autoFocus
              placeholder={t("guests_name_placeholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              dir="auto"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder={t("guests_amount_placeholder")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              dir="ltr"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closeForm}>
              <X className="h-4 w-4" />
              {t("common_cancel")}
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
              <Check className="h-4 w-4" />
              {saving ? t("common_saving") : t("common_save")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
