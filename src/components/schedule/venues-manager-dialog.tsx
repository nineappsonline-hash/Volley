"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlaygroundFormDialog } from "@/components/playgrounds/playground-form-dialog";
import { CourtCorrectionRequest } from "@/components/playgrounds/court-corrections";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useAcademy, useDeleteVenue, useVenues } from "@/lib/queries";
import type { Venue } from "@/lib/types";

interface VenuesManagerDialogProps { open: boolean; onOpenChange: (open: boolean) => void }
export function VenuesManagerDialog({ open, onOpenChange }: VenuesManagerDialogProps) {
  const { t } = useI18n();
  const { data: academy } = useAcademy();
  const { data: venues, isLoading } = useVenues(true);
  const remove = useDeleteVenue();
  const [editing, setEditing] = useState<Venue | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const owned = (venues ?? []).filter(venue => venue.academy_id === academy?.id);
  const edit = (venue: Venue | null) => { setEditing(venue); setEditorOpen(true); };
  const deleteVenue = async (id: string) => {
    try { await remove.mutateAsync(id); setDeleting(null); toast.success(t("venues_deleted")); }
    catch (error) { toast.error(errorMessage(error, t("common_error"))); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><DialogHeader>
      <DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />{t("venues_title")}</DialogTitle>
      <DialogDescription>{t("playgrounds_subtitle")}</DialogDescription>
    </DialogHeader>
      <Button onClick={() => edit(null)}><Plus className="h-4 w-4" />{t("playgrounds_add")}</Button>
      {isLoading ? <p>{t("common_loading")}</p> : owned.length === 0 ? <p className="p-4 text-center text-muted-foreground">{t("venues_empty")}</p> : <div className="space-y-3">{owned.map(venue => <div key={venue.id} className="space-y-2 rounded-lg border p-3">
        <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{venue.name}</p><p className="text-xs text-muted-foreground">{t(`venue_approval_${venue.approval_status ?? "approved"}`)}</p><p className="text-sm">{venue.address}</p></div>
          <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={t("common_edit")} onClick={() => edit(venue)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={t("common_delete")} onClick={() => setDeleting(venue.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
        </div>
        <CourtCorrectionRequest venue={venue} />
        {deleting === venue.id && <div className="space-y-2"><p className="text-sm">{t("playgrounds_delete_confirm")}</p><Button variant="destructive" size="sm" disabled={remove.isPending} onClick={() => void deleteVenue(venue.id)}>{t("common_confirm")}</Button> <Button variant="outline" size="sm" onClick={() => setDeleting(null)}>{t("common_cancel")}</Button></div>}
      </div>)}</div>}
    </DialogContent>
    {editorOpen && <PlaygroundFormDialog key={editing?.id ?? "new"} venue={editing} open onOpenChange={setEditorOpen} />}
  </Dialog>;
}
