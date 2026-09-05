"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Calendar, Crown, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { useAdminSetMemberPlan } from "@/lib/queries";
import type { Profile } from "@/lib/types";

import { Badge } from "@/components/ui/badge";

interface MemberPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Profile | null;
}

export function MemberPlanDialog({ open, onOpenChange, member }: MemberPlanDialogProps) {
  const { t, lang } = useI18n();
  const setPlan = useAdminSetMemberPlan();
  const [plan, setPlanState] = useState<"free" | "premium">("free");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);

  if (member === null) return null;

  const isPremium = member.member_plan === "premium";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            {t("members_manage_plan")}
          </DialogTitle>
          <DialogDescription>
            {member.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">{member.name}</p>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
            {isPremium && (
              <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                <Crown className="mr-1 h-3 w-3" />
                Premium
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("members_plan_type")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={plan === "free" ? "default" : "outline"}
                className="justify-start text-left"
                onClick={() => setPlanState("free")}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {t("membership_free")}
              </Button>
              <Button
                type="button"
                variant={plan === "premium" ? "default" : "outline"}
                className="justify-start text-left"
                onClick={() => setPlanState("premium")}
              >
                <Crown className="mr-2 h-4 w-4" />
                {t("membership_premium")}
              </Button>
            </div>
          </div>

          {plan === "premium" && (
            <div className="space-y-2">
              <Label>{t("members_plan_expiry")}</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">{t("members_plan_note")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common_cancel")}
          </Button>
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await setPlan.mutateAsync({
                  member_id: member.id,
                  member_plan: plan,
                  premium_expires_at: plan === "premium" ? expiresAt : null,
                });
                toast.success(t("members_plan_updated"));
                onOpenChange(false);
              } catch {
                toast.error(t("common_error"));
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? t("common_saving") : t("common_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
