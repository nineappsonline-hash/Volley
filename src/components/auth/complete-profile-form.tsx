"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AppLogo } from "@/components/shared/app-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { LanguageToggle } from "@/components/layout/language-toggle";
import { authDestination } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/client";

export function CompleteProfileForm() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = phone.trim().length > 0 && !!gender && birthDate.length > 0;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await createClient().auth.getUser();
      if (!user) throw new Error("no session");
      const { error } = await createClient()
        .from("profiles")
        .update({
          phone: phone.trim(),
          gender,
          birth_date: birthDate,
        })
        .eq("id", user.id);
      if (error) throw error;
      const next = authDestination(searchParams.get("next"));
      router.push(next);
      router.refresh();
    } catch {
      toast.error(t("complete_profile_error"));
      setLoading(false);
    }
  };

  return (
    <main className="pwa-pad-top relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -top-32 start-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-accent blur-3xl rtl:translate-x-1/2" />
      <div className="absolute end-4 top-4">
        <LanguageToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <AppLogo className="w-44" />
          <h1 className="text-2xl font-extrabold">{t("complete_profile_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("complete_profile_subtitle")}</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("complete_profile_phone")}</Label>
                <Input
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+20 1xx xxx xxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("complete_profile_gender")}</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger aria-label={t("complete_profile_gender")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("games_gender_male")}</SelectItem>
                    <SelectItem value="female">{t("games_gender_female")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("complete_profile_birth_date")}</Label>
                <Input
                  type="date"
                  dir="ltr"
                  max={new Date().toISOString().slice(0, 10)}
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={!canSubmit || loading} onClick={onSubmit}>
                {loading && <Loader2 className="animate-spin" />}
                {loading ? t("complete_profile_loading") : t("complete_profile_button")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}