"use client";

import { useEffect } from "react";

/**
 * Forces the page to open at the top on a full reload.
 *
 * The root layout also runs a synchronous head script that disables native
 * scroll restoration and strips any persisted anchor (e.g. `/#features`), so
 * this component is a safety net that re-scrolls to the top once the page is
 * hydrated and after every resource finishes loading / bfcache restore.
 */
export function ScrollToTop() {
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const reset = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };

    reset();
    const onLoad = () => window.requestAnimationFrame(reset);
    window.addEventListener("load", onLoad);
    window.addEventListener("pageshow", onLoad);
    return () => {
      window.removeEventListener("load", onLoad);
      window.removeEventListener("pageshow", onLoad);
    };
  }, []);

  return null;
}