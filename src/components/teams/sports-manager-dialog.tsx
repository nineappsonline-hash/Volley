"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
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
import { errorMessage } from "@/lib/utils";
import {
  useDeleteSport,
  useSaveSport,
  useSports,
} from "@/lib/queries";
import type { Sport } from "@/lib/types";

interface SportsManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SportsManagerDialog({
  open,
  onOpenChange,
}: SportsManagerDialogProps) {
  const { t } = useI18n();
  const { data: sports, isLoading } = useSports();
  const saveSport = useSaveSport();
  const deleteSport = useDeleteSport();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setNewName("");
      setEditingId(null);
      setConfirmDeleteId(null);
    }
  }, [open]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await saveSport.mutateAsync({ name: newName.trim() });
      toast.success(t("sports_saved"));
      setNewName("");
    } catch (err) {
      console.error("[sports-manager] add failed", err);
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (sport: Sport) => {
    if (!editName.trim() || editName.trim() === sport.name) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      await saveSport.mutateAsync({ id: sport.id, name: editName.trim() });
      toast.success(t("sports_saved"));
      setEditingId(null);
    } catch (err) {
      console.error("[sports-manager] rename failed", err);
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (sport: Sport) => {
    setBusy(true);
    try {
      await deleteSport.mutateAsync(sport.id);
      toast.success(t("sports_deleted"));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("[sports-manager] delete failed", err);
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-primary" />
            {t("sports_title")}
          </DialogTitle>
          <DialogDescription>{t("sports_subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("sports_add")}</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("sports_placeholder")}
              />
              <Button
                type="button"
                size="icon"
                aria-label={t("sports_add")}
                disabled={busy || !newName.trim()}
                onClick={handleAdd}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1 rounded-lg border p-1">
            {isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("common_loading")}
              </p>
            ) : (sports ?? []).length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("sports_empty")}
              </p>
            ) : (
              (sports ?? []).map((sport) =>
                editingId === sport.id ? (
                  <div key={sport.id} className="flex items-center gap-1.5 p-1">
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename(sport)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label={t("common_save")}
                      disabled={busy}
                      onClick={() => handleRename(sport)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label={t("common_cancel")}
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : confirmDeleteId === sport.id ? (
                  <div
                    key={sport.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm"
                  >
                    <span className="text-destructive">{sport.name}</span>
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={busy}
                        onClick={() => handleDelete(sport)}
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
                    key={sport.id}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-start text-sm font-medium"
                      onClick={() => {
                        setEditingId(sport.id);
                        setEditName(sport.name);
                        setConfirmDeleteId(null);
                      }}
                      title={t("common_edit")}
                    >
                      {sport.name}
                    </button>
                    <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("common_edit")}
                        onClick={() => {
                          setEditingId(sport.id);
                          setEditName(sport.name);
                          setConfirmDeleteId(null);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        onClick={() => {
                          setConfirmDeleteId(sport.id);
                          setEditingId(null);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </div>
                )
              )
            )}
          </div>

          <p className="text-xs text-muted-foreground">{t("sports_delete_hint")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
