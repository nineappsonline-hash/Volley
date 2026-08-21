"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { useDeleteVenue, useSaveVenue, useVenues } from "@/lib/queries";
import type { Venue } from "@/lib/types";

interface VenuesManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VenuesManagerDialog({
  open,
  onOpenChange,
}: VenuesManagerDialogProps) {
  const { t } = useI18n();
  const { data: venues, isLoading } = useVenues();
  const saveVenue = useSaveVenue();
  const deleteVenue = useDeleteVenue();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("");
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
    setAddress("");
    setCapacity("");
  };

  const startEdit = (v: Venue) => {
    setEditingId(v.id);
    setName(v.name);
    setAddress(v.address ?? "");
    setCapacity(v.capacity != null ? String(v.capacity) : "");
    setConfirmDeleteId(null);
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await saveVenue.mutateAsync({
        name: name.trim(),
        address: address.trim() || null,
        capacity: capacity ? Number(capacity) : null,
      });
      toast.success(t("venues_saved"));
      resetForm();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !name.trim()) return;
    setBusy(true);
    try {
      await saveVenue.mutateAsync({
        id: editingId,
        name: name.trim(),
        address: address.trim() || null,
        capacity: capacity ? Number(capacity) : null,
      });
      toast.success(t("venues_saved"));
      setEditingId(null);
      resetForm();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    try {
      await deleteVenue.mutateAsync(id);
      toast.success(t("venues_deleted"));
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
            <MapPin className="h-5 w-5 text-primary" />
            {t("venues_title")}
          </DialogTitle>
          <DialogDescription>{t("venues_empty")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border p-3">
            <div className="space-y-1.5">
              <Label>{t("venues_name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label>{t("venues_address")}</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("venues_capacity")}</Label>
                <Input
                  type="number"
                  min="0"
                  dir="ltr"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
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
                onClick={editingId ? handleUpdate : handleAdd}
              >
                <Plus className="h-4 w-4" />
                {editingId ? t("common_save") : t("venues_add")}
              </Button>
            </div>
          </div>

          <div className="space-y-1 rounded-lg border p-1">
            {isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("common_loading")}
              </p>
            ) : (venues ?? []).length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("venues_empty")}
              </p>
            ) : (
              (venues ?? []).map((venue) =>
                confirmDeleteId === venue.id ? (
                  <div
                    key={venue.id}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm"
                  >
                    <span className="text-destructive">{venue.name}</span>
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={busy}
                        onClick={() => handleDelete(venue.id)}
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
                    key={venue.id}
                    className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-start"
                      onClick={() => startEdit(venue)}
                      title={t("common_edit")}
                    >
                      <p className="truncate text-sm font-medium">{venue.name}</p>
                      {(venue.address || venue.capacity != null) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {[venue.address, venue.capacity != null ? `${venue.capacity}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </button>
                    <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("common_edit")}
                        onClick={() => startEdit(venue)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        onClick={() => setConfirmDeleteId(venue.id)}
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
