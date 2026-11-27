"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { MemberHomeHeader } from "./member-home-header";
import { MemberDiscoveryCards } from "./member-discovery-cards";
import { AcademiesHomeBanner } from "./academies-home-banner";
import { VenueOwnerHomeBanner } from "./venue-owner-home-banner";
import { ShopTeaser } from "@/components/shop/shop-catalog";
import { PlayzaFooter } from "@/components/shared/playza-footer";
import { useI18n } from "@/lib/i18n";
import { slugToSport } from "@/lib/sport-slugs";
import type { FriendlyGameWithDetails } from "@/lib/types";
import styles from "./member-home.module.css";
import gameStyles from "./next-game-premium.module.css";

/** One Discover experience for visitors and members; only account data differs. */
export function GuestDashboard({ games }: { games: FriendlyGameWithDetails[]; discovery?: boolean }) {
  const { lang } = useI18n();
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

  return <div className="playza-member-dashboard mx-auto flex w-full min-w-0 max-w-[1600px] flex-1 flex-col pb-0">
    <MemberHomeHeader onSearchChange={setSearch} selectedSport={sport} onSportChange={setSport}>
      <div className={styles.desktopContent}>
        <aside className={gameStyles.section} aria-label={lang === "ar" ? "ماتشك الجاي" : "Your next game"}>
          <div className={gameStyles.empty}>
            <CalendarDays size={28} aria-hidden="true" />
            <div>
              <h2>{lang === "ar" ? "ماتشك الجاي" : "Your next game"}</h2>
              <p>{lang === "ar" ? "اختار ماتشك الجاي واحجز مكانك على بلايزا." : "Find your next game and book your spot on Playza."}</p>
            </div>
            <Link href="/games">{lang === "ar" ? "اكتشف الماتشات" : "Explore games"} <ArrowUpRight size={17} /></Link>
          </div>
        </aside>
        <section id="activity" className="min-w-0 scroll-mt-24">
          <MemberDiscoveryCards search={search} memberId="" hasAcademy={false} mode="games" interactive sportFilter={sport} focusGameId={params.get("focus") ?? undefined} guestQuery={{ data: games, isPending: false, isError: false, refetch: () => router.refresh() }} />
        </section>
      </div>
    </MemberHomeHeader>
    <AcademiesHomeBanner />
    <VenueOwnerHomeBanner />
    <ShopTeaser />
    <div className="mt-auto pt-10"><PlayzaFooter fullBleed /></div>
  </div>;
}
