"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";

export function PasswordChangeCard() {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  const handleSubmit = async () => {
    if (next.length < 6) {
      toast.error(t("field_min_password"));
      return;
    }
    if (next !== confirm) {
      toast.error(t("field_password_mismatch"));
      return;
    }
    const supabase = createClient();
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error();

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (verifyError) {
        toast.error(t("updatepwd_wrong_current"));
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success(t("updatepwd_success"));
      reset();
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="settings-password" className="scroll-mt-24">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-primary" />
          {t("security_title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("security_subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("updatepwd_current")}</Label>
            <Input
              type="password"
              dir="ltr"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("updatepwd_new")}</Label>
            <Input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("updatepwd_confirm")}</Label>
            <Input
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={busy || !next}
          className="gap-2"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? t("updatepwd_loading") : t("updatepwd_button")}
        </Button>
      </CardContent>
    </Card>
  );
}