"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2, MapPin, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { LocationFields } from "@/components/shared/location-fields";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
  useBranches,
  useCreateBranch,
  useDeleteBranch,
  useUpdateBranch,
} from "@/lib/queries";
import type { AcademyBranch } from "@/lib/types";

interface BranchForm {
  name: string;
  address: string;
  country: string;
  governorate: string;
  area: string;
  phone: string;
}

const emptyForm: BranchForm = {
  name: "",
  address: "",
  country: "",
  governorate: "",
  area: "",
  phone: "",
};

function toForm(b: AcademyBranch): BranchForm {
  return {
    name: b.name,
    address: b.address ?? "",
    country: b.country ?? "",
    governorate: b.governorate ?? "",
    area: b.area ?? "",
    phone: b.phone ?? "",
  };
}

export function BranchesCard() {
  const { t } = useI18n();
  const { data: branches, isLoading } = useBranches();
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const remove = useDeleteBranch();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcademyBranch | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (b: AcademyBranch) => {
    setEditing(b);
    setForm(toForm(b));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t("field_required"));
      return;
    }
    setSaving(true);
    const payload: {
      name: string;
      address: string | null;
      country: string | null;
      governorate: string | null;
      area: string | null;
      phone: string | null;
      is_main?: boolean;
    } = {
      name: form.name.trim(),
      address: form.address.trim() || null,
      country: form.country.trim() || null,
      governorate: form.governorate.trim() || null,
      area: form.area.trim() || null,
      phone: form.phone.trim() || null,
    };
    if (!editing && (!branches || branches.length === 0)) {
      payload.is_main = true;
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      toast.success(t("settings_branch_saved"));
      setDialogOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast.success(t("settings_branch_deleted"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            {t("settings_branches_title")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {t("settings_branches_hint")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openAdd}
          disabled={isLoading}
        >
          <Plus className="h-4 w-4" />
          {t("settings_branch_add")}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !branches || branches.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {t("settings_branch_empty")}
          </p>
        ) : (
          <div className="space-y-2">
            {branches.map((b) => {
              const location = [b.country, b.governorate, b.area, b.address]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={b.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{b.name}</p>
                      {b.is_main && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {t("settings_branch_main")}
                        </span>
                      )}
                    </div>
                    {location && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        {location}
                      </p>
                    )}
                    {b.phone && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground" dir="ltr">
                        <Phone className="h-3 w-3 shrink-0" />
                        {b.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("settings_branch_edit")}
                      onClick={() => openEdit(b)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("settings_branch_delete")}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("settings_branch_delete_confirm")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {b.name}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-white hover:bg-destructive/90"
                            onClick={() => handleDelete(b.id)}
                          >
                            {t("settings_branch_delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? t("settings_branch_edit") : t("settings_branch_add")}
            </DialogTitle>
            <DialogDescription>
              {t("settings_branches_hint")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("settings_branch_name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("settings_branch_name")}
              />
            </div>
            <LocationFields
              country={form.country}
              governorate={form.governorate}
              city={form.area}
              onCountryChange={(v) => setForm({ ...form, country: v })}
              onGovernorateChange={(v) => setForm({ ...form, governorate: v })}
              onCityChange={(v) => setForm({ ...form, area: v })}
            />
            <div className="space-y-2">
              <Label>{t("settings_address")}</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder={t("directory_no_address")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("settings_branch_phone")}</Label>
              <Input
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={t("settings_branch_phone")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {t("common_cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
            >
              {saving ? t("common_saving") : t("common_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}