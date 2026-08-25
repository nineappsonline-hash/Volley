"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Check, Copy, Link2, Save, Settings as SettingsIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { useAcademy, useUpdateAcademy } from "@/lib/queries";

export function SettingsClient() {
  const { t } = useI18n();
  const { data: academy, isLoading } = useAcademy();
  const update = useUpdateAcademy();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (academy) {
      setName(academy.name);
      setDescription(academy.description ?? "");
      setAddress(academy.address ?? "");
      setIsPublic(academy.is_public ?? false);
      setSlug(academy.slug ?? "");
    }
  }, [academy]);

  if (isLoading || !academy) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("settings_title")} subtitle={t("settings_subtitle")} />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const publicUrl =
    typeof window !== "undefined" && slug
      ? `${window.location.origin}/a/${slug}`
      : "";
  const calendarUrl =
    typeof window !== "undefined" && academy.calendar_token
      ? `${window.location.origin}/api/calendar/${academy.calendar_token}`
      : "";

  const handleSave = async () => {
    if (!name.trim()) return;
    try {
      await update.mutateAsync({
        id: academy.id,
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
        is_public: isPublic,
        slug: slug.trim() || null,
      });
      toast.success(t("settings_saved"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      toast.success(t("cal_copied"));
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error(t("common_error"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings_title")} subtitle={t("settings_subtitle")}>
        <Button onClick={handleSave} disabled={update.isPending || !name.trim()}>
          <Save className="h-4 w-4" />
          {update.isPending ? t("common_saving") : t("common_save")}
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <SettingsIcon className="h-4 w-4 text-primary" />
            {t("settings_academy_info")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("signup_new_academy_name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("teams_description")}</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("settings_public_hint")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("settings_address")}</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("directory_no_address")}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              id="public-toggle"
            />
            <Label htmlFor="public-toggle" className="cursor-pointer text-sm">
              {t("settings_public_toggle")}
            </Label>
          </div>
          {isPublic && (
            <p className="rounded-md bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              {t("settings_public_hint")}
            </p>
          )}
          <div className="space-y-2">
            <Label>{t("settings_slug")}</Label>
            <div className="flex items-center gap-2">
              <Input
                dir="ltr"
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
                placeholder="my-academy"
              />
              {publicUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("cal_copy")}
                  onClick={() => copy(publicUrl, "public")}
                >
                  {copied === "public" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {publicUrl && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                dir="ltr"
              >
                <Link2 className="h-3 w-3" />
                {publicUrl}
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Invite code */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("settings_invite_code")}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("settings_invite_hint")}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input dir="ltr" readOnly value={academy.invite_code} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("cal_copy")}
                onClick={() => copy(academy.invite_code, "invite")}
              >
                {copied === "invite" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Calendar feed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4 text-primary" />
              {t("settings_calendar_feed")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("settings_calendar_hint")}
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Input dir="ltr" readOnly value={calendarUrl} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("cal_copy")}
                onClick={() => copy(calendarUrl, "cal")}
              >
                {copied === "cal" ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
