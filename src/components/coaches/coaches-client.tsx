"use client";

import { useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { CoachAvailabilityDialog } from "@/components/coaches/coach-availability-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { errorMessage } from "@/lib/utils";
import { useCoaches, useDeleteCoach, useSaveCoach } from "@/lib/queries";
import type { Coach } from "@/lib/types";

export function CoachesClient() {
  const { t, lang } = useI18n();
  const { data: coaches, isLoading } = useCoaches();
  const save = useSaveCoach();
  const remove = useDeleteCoach();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [salary, setSalary] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Coach | null>(null);
  const [availCoach, setAvailCoach] = useState<Coach | null>(null);

  const openNew = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setSpecialty("");
    setSalary("");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (c: Coach) => {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone ?? "");
    setSpecialty(c.specialty ?? "");
    setSalary(c.monthly_salary != null ? String(c.monthly_salary) : "");
    setIsActive(c.is_active !== false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await save.mutateAsync({
        id: editing?.id,
        name: name.trim(),
        phone: phone.trim() || null,
        specialty: specialty.trim() || null,
        monthly_salary: salary ? Number(salary) : null,
        is_active: isActive,
      });
      toast.success(t("coaches_save_success"));
      setDialogOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(t("coaches_delete_success"));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("coaches_title")} subtitle={t("coaches_subtitle")}>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          {t("coaches_add")}
        </Button>
      </PageHeader>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !coaches || coaches.length === 0 ? (
        <EmptyState message={t("coaches_empty")} icon={UserRound} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("coaches_name")}</TableHead>
                <TableHead>{t("coaches_phone")}</TableHead>
                <TableHead>{t("coaches_specialty")}</TableHead>
                <TableHead className="text-end">{t("coaches_salary")}</TableHead>
                <TableHead className="text-end">{t("members_col_actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(coaches ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      {c.name}
                      {c.is_active === false && (
                        <Badge variant="outline" className="text-muted-foreground">
                          {t("coaches_inactive")}
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell dir="ltr" className="text-start font-mono text-sm">
                    {c.phone ?? "—"}
                  </TableCell>
                  <TableCell>{c.specialty ?? "—"}</TableCell>
                  <TableCell className="text-end font-mono">
                    {c.monthly_salary != null
                      ? formatMoney(Number(c.monthly_salary), lang)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("common_edit")}
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("coach_avail_title")}
                        onClick={() => setAvailCoach(c)}
                      >
                        <CalendarDays className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        onClick={() => setDeleteTarget(c)}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("coaches_edit") : t("coaches_add")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coach-name">{t("coaches_name")}</Label>
              <Input id="coach-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coach-phone">{t("coaches_phone")}</Label>
                <Input
                  id="coach-phone"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coach-specialty">{t("coaches_specialty")}</Label>
                <Input
                  id="coach-specialty"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="coach-salary">{t("coaches_salary")}</Label>
                <Input
                  id="coach-salary"
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                />
              </div>
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                {t("coaches_active")}
              </label>
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

      <CoachAvailabilityDialog
        open={!!availCoach}
        onOpenChange={(o) => !o && setAvailCoach(null)}
        coach={availCoach}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("coaches_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("coaches_delete_confirm")}
            </AlertDialogDescription>
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
