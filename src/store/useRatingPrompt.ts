"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RatingPromptState {
  /** Dismissed "venue:<id>" / "academy:<id>" keys (persisted in localStorage). */
  dismissedKeys: string[];
  dismiss: (key: string) => void;
}

/**
 * Per-target dismissals for the post-activity rating popup, keyed by
 * `venue:<id>` or `academy:<id>`. Persisted so a "Not now" isn't repeated on
 * every app open; rating a target through the popup also dismisses it.
 */
export const useRatingPrompt = create<RatingPromptState>()(
  persist(
    (set) => ({
      dismissedKeys: [],
      dismiss: (key) =>
        set((s) =>
          s.dismissedKeys.includes(key)
            ? s
            : { dismissedKeys: [...s.dismissedKeys, key] }
        ),
    }),
    { name: "volley-rating-prompt" }
  )
);