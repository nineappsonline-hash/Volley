"use client";

import { useSearchParams } from "next/navigation";
import { slugToSport } from "@/lib/sport-slugs";
import { useState } from "react";
import { useProfile } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import { MemberDiscoveryCards } from "./member-discovery-cards";
import { DashboardNavigation } from "./dashboard-navigation";

export function MemberDashboard({ profile }: { profile: Profile }) {
  const { data: ownProfile } = useProfile(profile.id);
  const p = ownProfile ?? profile;
  const params = useSearchParams();
  const [selectedSport, setSelectedSport] = useState(() => slugToSport(params.get("sport") ?? "") ?? "all");

  return <div className="mx-auto min-w-0 max-w-6xl pb-2">
    <DashboardNavigation selectedSport={selectedSport} onSportChange={setSelectedSport} name={p.name}>
      <section id="activity" className="scroll-mt-24">
        <MemberDiscoveryCards memberId={p.id} hasAcademy={!!p.academy_id} preferences={p} profile={p} focusGameId={params.get("focus") ?? undefined} mode="games" interactive sportFilter={selectedSport} />
      </section>
    </DashboardNavigation>
  </div>;
}
