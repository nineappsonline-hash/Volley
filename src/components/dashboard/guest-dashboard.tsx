"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MemberHomeHeader } from "./member-home-header";
import { MemberDiscoveryCards } from "./member-discovery-cards";
import { slugToSport } from "@/lib/sport-slugs";
import type { FriendlyGameWithDetails } from "@/lib/types";

export function GuestDashboard({ games }: { games: FriendlyGameWithDetails[]; discovery?: boolean }) {
  const [search, setSearch] = useState("");
  const params = useSearchParams();
  const [sport, setSport] = useState(() => slugToSport(params.get("sport") ?? "") ?? "all");
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);
  return <MemberHomeHeader onSearchChange={setSearch} guest selectedSport={sport} onSportChange={setSport}>
    <MemberDiscoveryCards search={search} memberId="" hasAcademy={false} mode="games" interactive sportFilter={sport} focusGameId={params.get("focus") ?? undefined} guestQuery={{ data: games, isPending: false, isError: false, refetch: () => router.refresh() }} />
  </MemberHomeHeader>;
}
