"use client";

import { useEffect } from "react";

/**
 * Forces the page to open at the top on a full reload.
 *
 * Browsers normally restore the previous scroll offset on refresh, so a long
 * page (e.g. the marketing landing) reloads mid-page. We switch scroll
 * restoration to manual and jump to the top, while still letting deep links
 * like `/#about` land on their anchor.
 */
export function ScrollToTop() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const reset = () => {
      if (!window.location.hash) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    };

    reset();
    window.addEventListener("load", reset);
    return () => window.removeEventListener("load", reset);
  }, []);

  return null;
}