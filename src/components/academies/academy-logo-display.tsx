"use client";

import { useState } from "react";
import { Volleyball } from "lucide-react";

/**
 * Read-only logo in public academy/team cards.
 * Directory entries already include logo_url, so no auth client,
 * React Query subscription, upload logic, or dialog is required.
 */
export function AcademyLogoDisplay({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-1.5 shadow-sm">
      {logoUrl && failedUrl !== logoUrl ? (
        // Logos may be stored on user-provided hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setFailedUrl(logoUrl)}
        />
      ) : (
        <Volleyball aria-hidden="true" className="h-7 w-7 text-slate-500" />
      )}
    </div>
  );
}
