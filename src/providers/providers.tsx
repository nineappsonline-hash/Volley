"use client";

import { applyAutomaticTheme } from "@/lib/automatic-theme";
import { useState, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    applyAutomaticTheme();
    const timer = window.setInterval(applyAutomaticTheme, 30_000);
    const refresh = () => { if (document.visibilityState === "visible") applyAutomaticTheme(); };
    window.addEventListener("focus", applyAutomaticTheme);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", applyAutomaticTheme);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>{children}</I18nProvider>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
