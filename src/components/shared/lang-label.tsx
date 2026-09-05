"use client";

import { useI18n } from "@/lib/i18n";

interface LangLabelProps {
  en: string;
  ar: string;
}

/** Renders `en` or `ar` depending on the active app language. */
export function LangLabel({ en, ar }: LangLabelProps) {
  const { lang } = useI18n();
  return <>{lang === "ar" ? ar : en}</>;
}