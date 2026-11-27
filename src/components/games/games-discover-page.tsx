"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { MemberHomeHeader } from "@/components/dashboard/member-home-header";
import { MemberDiscoveryCards } from "@/components/dashboard/member-discovery-cards";
import { PlayzaFooter } from "@/components/shared/playza-footer";
import { slugToSport } from "@/lib/sport-slugs";
import type { FriendlyGameWithDetails, Profile } from "@/lib/types";

/**
 * The /games route intentionally shares Discover's real game-card renderer:
 * GuestGameList for visitors and DashboardGameList for members.
 * Fonts, spacing, card sizes, booking buttons and breakpoints therefore stay
 * synchronized with the homepage without maintaining a second mockup.
 */
export function GamesDiscoverPage({ games, selectedSport, profile }: {
  games: FriendlyGameWithDetails[];
  selectedSport?: string;
  profile?: Profile;
}) {
  const { lang } = useI18n();
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState(() => selectedSport || "all");

  return <div className="playza-member-dashboard mx-auto flex w-full min-w-0 max-w-[1600px] flex-1 flex-col">
    <MemberHomeHeader
      showExplore={false}
      name={profile?.name}
      profile={profile}
      onSearchChange={setSearch}
      selectedSport={sport}
      onSportChange={setSport}
    >
      <section className="col-span-full min-w-0 scroll-mt-24" aria-label={lang === "ar" ? "اكتشف الماتشات" : "Discover games"}>
        <MemberDiscoveryCards
          search={search}
          memberId={profile?.id ?? ""}
          hasAcademy={!!profile?.academy_id}
          preferences={profile}
          profile={profile}
          mode="games"
          interactive
          sportFilter={sport}
          guestQuery={profile ? undefined : { data: games, isPending: false, isError: false, refetch: () => window.location.reload() }}
        />
      </section>
    </MemberHomeHeader>
    <div className="mt-auto pt-10"><PlayzaFooter fullBleed /></div>
  </div>;
}
