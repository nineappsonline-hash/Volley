"use client";

import { CourtCorrectionRequest } from "./court-corrections";
import { PlaygroundFormDialog } from "./playground-form-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { LandPlot, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import { useDeleteVenue, useVenues, useAcademy } from "@/lib/queries";
import type { Venue } from "@/lib/types";

export function PlaygroundsClient() {
  const { t, lang } = useI18n();
  const { data: venues, isLoading } = useVenues(true);
  const { data: academy } = useAcademy();
  const remove = useDeleteVenue();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null);

  const ownedVenues = (venues ?? []).filter(
    (v) => v.academy_id === academy?.id
  );

  const sportName = (v: Venue) =>
    v.sport?.name ?? t("venues_no_sport");

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (venue: Venue) => { setEditing(venue); setDialogOpen(true); };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(t("venues_deleted"));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("playgrounds_title")} subtitle={t("playgrounds_subtitle")}>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          {t("playgrounds_add")}
        </Button>
      </PageHeader>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !ownedVenues || ownedVenues.length === 0 ? (
        <EmptyState message={t("playgrounds_empty")} icon={LandPlot} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <p className="p-4 text-sm text-muted-foreground">{t("venue_review_hint")}</p>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("venues_name")}</TableHead>
                <TableHead>{t("venues_sport")}</TableHead>
                <TableHead>{t("venues_school")}</TableHead>
                <TableHead className="text-end">{t("venues_rental_cost")}</TableHead>
                <TableHead className="text-end">{t("members_col_actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ownedVenues.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                  <p className="font-medium">
                    {v.name}
                    <Badge variant="outline" className="ms-2">{t(`venue_approval_${v.approval_status ?? "approved"}`)}</Badge>
                    {Number(v.court_count) > 1 && (
                      <span className="ms-1 text-xs font-normal text-muted-foreground">
                        ({v.court_count} {t("rentals_courts_short")})
                      </span>
                    )}
                  </p>
                    <CourtCorrectionRequest venue={v} />
                    {v.address && (
                      <p className="text-xs text-muted-foreground">{v.address}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{sportName(v)}</Badge>
                  </TableCell>
                  <TableCell>{v.school_name ?? "—"}</TableCell>
                  <TableCell className="text-end">
                    {v.rental_cost != null ? (
                      <>
                        <p className="font-mono">
                          {formatMoney(
                            Number(v.rental_cost) * (v.rental_hours ?? 1),
                            lang
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(Number(v.rental_cost), lang)}/h ×{" "}
                          {v.rental_hours ?? 1}
                          {t("rentals_hours_short")}
                        </p>
                      </>
                    ) : (
                      <span>—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common_edit")}
                        onClick={() => openEdit(v)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        onClick={() => setDeleteTarget(v)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PlaygroundFormDialog key={`${editing?.id ?? "new"}-${dialogOpen}`} venue={editing} open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("playgrounds_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("playgrounds_delete_confirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {t("common_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}