"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MemberHomeHeader } from "./member-home-header";
import { MemberDiscoveryCards } from "./member-discovery-cards";
import { slugToSport } from "@/lib/sport-slugs";
import { authLink } from "@/lib/auth-redirect";
import { useI18n } from "@/lib/i18n";
import type { FriendlyGameWithDetails } from "@/lib/types";

export function GuestDashboard({ games, discovery = false }: { games: FriendlyGameWithDetails[]; discovery?: boolean }) {
  const params = useSearchParams();
  const [sport, setSport] = useState(() => slugToSport(params.get("sport") ?? "") ?? "all");
  const router = useRouter();
  const { lang } = useI18n();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);
  return <MemberHomeHeader guest selectedSport={sport} onSportChange={setSport}>
    {discovery && <Link className="w-fit rounded-full bg-[#C7F23D] px-4 py-2 text-sm font-bold text-[#14213D]" href={authLink("/login", "/dashboard/games?create=1")}>{lang === "ar" ? "إنشاء مباراة" : "Create a game"}</Link>}
    <MemberDiscoveryCards memberId="" hasAcademy={false} mode="games" interactive sportFilter={sport} focusGameId={params.get("focus") ?? undefined} guestQuery={{ data: games, isPending: false, isError: false, refetch: () => router.refresh() }} />
  </MemberHomeHeader>;
}
