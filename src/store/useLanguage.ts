"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "en" | "ar";

function detectLang(): Lang {
  if (typeof window === "undefined") return "ar";
  try {
    const stored = localStorage.getItem("volley-lang");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.state?.lang === "en" || parsed?.state?.lang === "ar") {
        return parsed.state.lang;
      }
    }
  } catch {}
  return "ar";
}

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

export const useLanguage = create<LanguageState>()(
  persist(
    (set) => ({
      lang: detectLang(),
      setLang: (lang) => set({ lang }),
      toggleLang: () => set((s) => ({ lang: s.lang === "en" ? "ar" : "en" })),
    }),
    {
      name: "volley-lang",
      merge: (persisted, current) => (
        persisted && typeof persisted === "object" && "state" in persisted
          ? persisted
          : current
      ),
    }
  )
);
