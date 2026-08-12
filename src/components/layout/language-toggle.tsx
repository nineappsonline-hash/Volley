"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { t, toggleLang, lang } = useI18n();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLang}
      className="gap-1.5 font-semibold"
      aria-label="Toggle language"
    >
      <Languages className="h-4 w-4" />
      {lang === "en" ? "عربي" : "EN"}
    </Button>
  );
}
