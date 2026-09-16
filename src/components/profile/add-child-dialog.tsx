"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, UserRoundPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useAddFamilyMember, useUpdateFamilyMember } from "@/lib/queries";
import type { Profile } from "@/lib/types";

interface AddChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child?: Profile | null;
}

export function AddChildDialog({ open, onOpenChange, child }: AddChildDialogProps) {
  const { t } = useI18n();
  const isEdit = Boolean(child);
  const addChild = useAddFamilyMember();
  const updateChild = useUpdateFamilyMember();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<Profile["gender"]>(null);
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (open) {
      setName(child?.name ?? "");
      setNickname(child?.nickname ?? "");
      setGender(child?.gender ?? null);
      setBirthDate(child?.birth_date ?? "");
      setPhone(child?.phone ?? "");
    }
  }, [open, child]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("field_required"));
      return;
    }
    if (!gender) {
      toast.error(t("field_required"));
      return;
    }
    setSaving(true);
    try {
      if (isEdit && child) {
        await updateChild.mutateAsync({
          childId: child.id,
          name: name.trim(),
          nickname: nickname.trim(),
          gender,
          birth_date: birthDate || null,
          phone: phone || null,
        });
      } else {
        await addChild.mutateAsync({
          name: name.trim(),
          nickname: nickname.trim() || null,
          gender,
          birth_date: birthDate || null,
          phone: phone || null,
        });
      }
      toast.success(t("family_saved"));
      onOpenChange(false);
    } catch (e) {
      console.error("[add-child] failed", e);
      toast.error(errorMessage(e, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlus className="h-5 w-5 text-primary" />
            {isEdit ? t("family_edit_child") : t("family_add_child_title")}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t("family_edit_hint") : t("family_add_hint")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("signup_name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("profile_nickname")}</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t("profile_nickname_hint")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("profile_gender")}</Label>
              <Select
                value={gender ?? undefined}
                onValueChange={(v) => setGender(v as "male" | "female")}
              >
                <SelectTrigger aria-label={t("profile_gender")}>
                  <SelectValue placeholder={t("profile_gender")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t("games_gender_male")}</SelectItem>
                  <SelectItem value="female">{t("games_gender_female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("profile_birth_date")}</Label>
              <Input
                type="date"
                dir="ltr"
                max={new Date().toISOString().slice(0, 10)}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("signup_phone")}</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
            />
          </div>

          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            <Save className="h-4 w-4" />
            {saving ? t("common_saving") : t("family_save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}