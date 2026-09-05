"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LandPlot, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useDeleteVenue, useSaveVenue, useSports, useVenues } from "@/lib/queries";
import type { Venue } from "@/lib/types";

export function PlaygroundsClient() {
  const { t, lang } = useI18n();
  const { data: venues, isLoading } = useVenues();
  const { data: sports } = useSports();
  const save = useSaveVenue();
  const remove = useDeleteVenue();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("");
  const [sportId, setSportId] = useState("none");
  const [schoolName, setSchoolName] = useState("");
  const [rentalCost, setRentalCost] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null);

  const sportName = (id: string | null) =>
    (id && (sports ?? []).find((s) => s.id === id)?.name) || t("venues_no_sport");

  const openNew = () => {
    setEditing(null);
    setName("");
    setAddress("");
    setCapacity("");
    setSportId("none");
    setSchoolName("");
    setRentalCost("");
    setDialogOpen(true);
  };

  const openEdit = (v: Venue) => {
    setEditing(v);
    setName(v.name);
    setAddress(v.address ?? "");
    setCapacity(v.capacity != null ? String(v.capacity) : "");
    setSportId(v.sport_id ?? "none");
    setSchoolName(v.school_name ?? "");
    setRentalCost(v.rental_cost != null ? String(v.rental_cost) : "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await save.mutateAsync({
        id: editing?.id,
        name: name.trim(),
        address: address.trim() || null,
        capacity: capacity ? Number(capacity) : null,
        sport_id: sportId === "none" ? null : sportId,
        school_name: schoolName.trim() || null,
        rental_cost: rentalCost ? Number(rentalCost) : null,
      });
      toast.success(t("venues_saved"));
      setDialogOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

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
      ) : !venues || venues.length === 0 ? (
        <EmptyState message={t("playgrounds_empty")} icon={LandPlot} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
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
              {(venues ?? []).map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <p className="font-medium">{v.name}</p>
                    {v.address && (
                      <p className="text-xs text-muted-foreground">{v.address}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{sportName(v.sport_id)}</Badge>
                  </TableCell>
                  <TableCell>{v.school_name ?? "—"}</TableCell>
                  <TableCell className="text-end font-mono">
                    {v.rental_cost != null
                      ? formatMoney(Number(v.rental_cost), lang)
                      : "—"}
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

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("playgrounds_edit") : t("playgrounds_add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("venues_name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("venues_sport")}</Label>
                <Select value={sportId} onValueChange={setSportId}>
                  <SelectTrigger aria-label={t("venues_sport")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("venues_no_sport")}</SelectItem>
                    {(sports ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("venues_rental_cost")}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={rentalCost}
                  onChange={(e) => setRentalCost(e.target.value)}
                  placeholder="0"
                />
                <p className="text-[11px] text-muted-foreground">
                  {t("venues_rental_cost_hint")}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("venues_school")}</Label>
              <Input
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder={t("venues_school")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("venues_address")}</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="space-y-2">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common_cancel")}
            </Button>
            <Button disabled={!name.trim() || save.isPending} onClick={handleSave}>
              {save.isPending ? t("common_saving") : t("common_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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