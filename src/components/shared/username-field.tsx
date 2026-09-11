"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { isValidUsername, normalizeUsername } from "@/lib/username";

type Status = "idle" | "checking" | "available" | "taken" | "invalid";

export function UsernameField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const v = value.trim();
    if (!v) {
      setStatus("idle");
      return;
    }
    if (!isValidUsername(v)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    const version = ++requestVersion.current;
    timer.current = setTimeout(async () => {
      try {
        const { data, error } = await createClient().rpc("is_username_taken", {
          p_username: v,
        });
        if (requestVersion.current !== version) return;
        if (error) {
          setStatus("idle");
          return;
        }
        setStatus(data ? "taken" : "available");
      } catch {
        if (requestVersion.current === version) setStatus("idle");
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  return (
    <div className="space-y-2">
      <Label htmlFor="username">{label ?? t("username_label")}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 pe-1 text-sm text-muted-foreground">
          @
        </span>
        <Input
          dir="ltr"
          id="username"
          autoComplete="username"
          value={value}
          onChange={(e) => onChange(normalizeUsername(e.target.value))}
          className="ps-7"
          aria-invalid={status === "taken" || status === "invalid"}
          maxLength={20}
        />
        {status === "checking" && (
          <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {status === "available" && (
          <CheckCircle2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success-ink" />
        )}
        {status === "taken" && (
          <XCircle className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-destructive" />
        )}
      </div>
      {status === "invalid" && value.trim() !== "" && (
        <p className="text-xs text-destructive">{t("field_username_invalid")}</p>
      )}
      {status === "taken" && (
        <p className="text-xs text-destructive">{t("field_username_taken")}</p>
      )}
      {status === "available" && value.trim() !== "" && (
        <p className="text-xs text-success-ink">
          {t("username_available").replace("{username}", value.trim())}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t("username_hint")}</p>
    </div>
  );
}