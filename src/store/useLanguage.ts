"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "en" | "ar";

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const raw = localStorage.getItem("volley-lang");
    if (raw) {
      const parsed = JSON.parse(raw);
      const l = parsed?.state?.lang;
      if (l === "en" || l === "ar") return l;
    }
  } catch {}
  return "en";
}

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

const initialLang: Lang = readStoredLang();

export const useLanguage = create<LanguageState>()(
  persist(
    (set) => ({
      lang: initialLang,
      setLang: (lang) => set({ lang }),
      toggleLang: () => set((s) => ({ lang: s.lang === "en" ? "ar" : "en" })),
    }),
    { name: "volley-lang" }
  )
);
