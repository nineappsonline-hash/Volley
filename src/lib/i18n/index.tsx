"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { dictionary, type Dict, type Lang } from "@/lib/i18n/dictionary";

export type { Dict, Lang };
import { useLanguage } from "@/store/useLanguage";
import { htmlLocaleForPath, isUrlLocalizedPublicPath } from "@/lib/html-lang";
import { enUS, ar } from "date-fns/locale";
import { Locale } from "date-fns";

interface I18nValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: (key: keyof Dict) => string;
  locale: Locale;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { lang, setLang, toggleLang } = useLanguage();

  useEffect(() => {
    void useLanguage.persist.rehydrate();
  }, []);

  useEffect(() => {
    // On URL-localised public pages the server already set the correct
    // lang/dir from the path; the stored app preference must not override it.
    if (isUrlLocalizedPublicPath(window.location.pathname)) return;
    const { lang: htmlLang, dir } = htmlLocaleForPath(lang === "ar" ? "/ar" : "/");
    document.documentElement.lang = htmlLang;
    document.documentElement.dir = dir;
  }, [lang]);

  const t = useCallback(
    (key: keyof Dict) => dictionary[lang][key],
    [lang]
  );

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t,
      locale: lang === "ar" ? (ar as Locale) : enUS,
      setLang,
      toggleLang,
    }),
    [lang, t, setLang, toggleLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
