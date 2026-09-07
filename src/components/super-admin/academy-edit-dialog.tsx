"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import {
  useAcademyManagement,
  useSuperAdminDeleteAcademy,
  useSuperAdminUpdateAcademy,
} from "@/lib/queries";
import type { Academy } from "@/lib/types";

type Plan = "starter" | "plus" | "elite";
const PLANS: Plan[] = ["starter", "plus", "elite"];

interface AcademyEditDialogProps {
  academy: Academy | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function AcademyEditDialog({
  academy,
  onClose,
  onDeleted,
}: AcademyEditDialogProps) {
  const { t } = useI18n();
  const { data: detail, isLoading } = useAcademyManagement(academy?.id ?? null);
  const update = useSuperAdminUpdateAcademy();
  const remove = useSuperAdminDeleteAcademy();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [area, setArea] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [plan, setPlan] = useState<Plan>("starter");
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const [sports, setSports] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!academy) return;
    setName(academy.name ?? "");
    setDescription(academy.description ?? "");
    setCountry(academy.country ?? "");
    setGovernorate(academy.governorate ?? "");
    setArea(academy.area ?? "");
    setIsPublic(Boolean(academy.is_public));
    setPlan((academy.plan as Plan) ?? "starter");
    setIsTrial(Boolean(academy.is_trial));
    setTrialEndsAt(
      academy.trial_ends_at ? academy.trial_ends_at.slice(0, 10) : ""
    );
  }, [academy]);

  useEffect(() => {
    if (!detail) return;
    setSports((detail.sports ?? []).join(", "));
    setAdminName(detail.admin?.name ?? "");
    setAdminEmail(detail.admin?.email ?? "");
    setAdminPhone(detail.admin?.phone ?? "");
  }, [detail]);

  if (!academy) return null;

  const payload = {
    name,
    description,
    country,
    governorate,
    area,
    is_public: isPublic,
    plan,
    is_trial: isTrial,
    trial_ends_at: trialEndsAt ? `${trialEndsAt}T23:59:59Z` : null,
    sports: sports
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    admin_name: adminName,
    admin_email: adminEmail,
    admin_phone: adminPhone,
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("sa_form_name_required"));
      return;
    }
    try {
      await update.mutateAsync({ academyId: academy.id, payload });
      toast.success(t("super_admin_academy_updated"));
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleDelete = async () => {
    try {
      await remove.mutateAsync(academy.id);
      toast.success(t("super_admin_academy_deleted"));
      setConfirmDeleteOpen(false);
      onClose();
      onDeleted();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <Dialog open={!!academy} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            {t("super_admin_edit_academy")}
          </DialogTitle>
          <DialogDescription>{academy.name}</DialogDescription>
        </DialogHeader>

        {isLoading && !detail ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Identity */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {t("sa_form_identity")}
              </p>
              <div className="space-y-2">
                <Label>{t("sa_form_name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("sa_form_description")}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("sa_form_country")}</Label>
                  <Input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("sa_form_governorate")}</Label>
                  <Input
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("sa_form_area")}</Label>
                  <Input value={area} onChange={(e) => setArea(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("sa_form_sports")}</Label>
                <Input
                  value={sports}
                  onChange={(e) => setSports(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("sa_form_sports_hint")}
                </p>
              </div>
            </div>

            {/* Subscription */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {t("sa_form_subscription")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("sa_form_plan")}</Label>
                  <Select
                    value={plan}
                    onValueChange={(v) => setPlan(v as Plan)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLANS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {t(`plans_tier_${p}` as any)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("sa_form_trial_until")}</Label>
                  <Input
                    type="date"
                    value={trialEndsAt}
                    onChange={(e) => setTrialEndsAt(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex items-center justify-between rounded-lg border p-3 sm:flex-1">
                  <div>
                    <p className="text-sm font-medium">{t("sa_form_trial")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("sa_form_trial_hint")}
                    </p>
                  </div>
                  <Switch
                    checked={isTrial}
                    onCheckedChange={setIsTrial}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 sm:flex-1">
                  <div>
                    <p className="text-sm font-medium">{t("sa_form_public")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("sa_form_public_hint")}
                    </p>
                  </div>
                  <Switch
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {t("sa_form_contact")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("sa_form_contact_name")}</Label>
                  <Input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("sa_form_contact_phone")}</Label>
                  <Input
                    dir="ltr"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("sa_form_contact_email")}</Label>
                  <Input
                    dir="ltr"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {detail && detail.branches.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("sa_form_branches").replace(
                  "{count}",
                  String(detail.branches.length)
                )}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            className="gap-1"
            disabled={isLoading || remove.isPending}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t("sa_delete")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("common_cancel")}
            </Button>
            <Button
              size="sm"
              className="gap-1"
              disabled={isLoading || update.isPending}
              onClick={handleSave}
            >
              {update.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {t("common_save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t("super_admin_delete_confirm_title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("super_admin_delete_confirm_body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              {t("common_cancel")}
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={handleDelete}
              >
                {remove.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t("sa_delete")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}