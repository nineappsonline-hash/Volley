"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Prominent, shared external directions action; uses the caller's existing URL. */
export function GoogleMapsDirectionsButton({ href, className }: { href: string; className?: string }) {
  const { t } = useI18n();
  return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${t("directions")} — Google Maps`} className={cn("inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-xl border-2 border-brand/25 bg-white px-4 py-2 text-brand shadow-sm transition-colors hover:border-brand hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}>
    <Image src="/brand/google-maps.png" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
    <span className="text-start"><span className="block text-sm font-bold leading-tight">{t("directions")}</span><span className="mt-0.5 block text-xs font-medium leading-tight text-secondary-foreground">Google Maps</span></span>
    <ArrowUpRight className="h-4 w-4 shrink-0 rtl:-rotate-90" aria-hidden="true" />
  </a>;
}
