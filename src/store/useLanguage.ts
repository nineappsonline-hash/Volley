"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "en" | "ar";

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

export const useLanguage = create<LanguageState>()(
  persist(
    (set) => ({
      lang: "ar",
      setLang: (lang) => set({ lang }),
      toggleLang: () => set((s) => ({ lang: s.lang === "en" ? "ar" : "en" })),
    }),
    { name: "volley-lang" }
  )
);
