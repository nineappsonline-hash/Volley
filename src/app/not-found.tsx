"use client";

import Link from "next/link";
import { Volleyball } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-interactive-700 text-white shadow-lg shadow-interactive-500/30">
        <Volleyball className="h-9 w-9" />
      </div>
      <div>
        <h1 className="text-4xl font-extrabold">404</h1>
        <p className="mt-2 text-muted-foreground">{t("notfound_subtitle")}</p>
      </div>
      <Button asChild>
        <Link href="/dashboard">{t("notfound_action")}</Link>
      </Button>
    </main>
  );
}