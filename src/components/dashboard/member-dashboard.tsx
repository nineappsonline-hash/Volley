"use client";

import { useSearchParams } from "next/navigation";
import { slugToSport } from "@/lib/sport-slugs";
import { useState } from "react";
import { useProfile } from "@/lib/queries";
import type { Profile } from "@/lib/types";
import { MemberDiscoveryCards } from "./member-discovery-cards";
import { ShopTeaser } from "@/components/shop/shop-catalog";
import { DesktopNextGame } from "./desktop-next-game";
import styles from "./member-home.module.css";
import { DashboardNavigation } from "./dashboard-navigation";
import { PlayzaFooter } from "@/components/shared/playza-footer";

export function MemberDashboard({ profile }: { profile: Profile }) {
  const { data: ownProfile } = useProfile(profile.id);
  const p = ownProfile ?? profile;
  const [search, setSearch] = useState("");
  const params = useSearchParams();
  const [selectedSport, setSelectedSport] = useState(() => slugToSport(params.get("sport") ?? "") ?? "all");

  return <div className="playza-member-dashboard mx-auto min-w-0 max-w-[1600px] pb-2">
    <DashboardNavigation onSearchChange={setSearch} profile={p} selectedSport={selectedSport} onSportChange={setSelectedSport} name={p.name}>
      <div className={styles.desktopContent}><DesktopNextGame memberId={p.id} /><section id="activity" className="min-w-0 scroll-mt-24">
        <MemberDiscoveryCards search={search} memberId={p.id} hasAcademy={!!p.academy_id} preferences={p} profile={p} focusGameId={params.get("focus") ?? undefined} mode="games" interactive sportFilter={selectedSport} />
      </section></div>
    </DashboardNavigation>
    <ShopTeaser />
    <PlayzaFooter />
  </div>;
}
