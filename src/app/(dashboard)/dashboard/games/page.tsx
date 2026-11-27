import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPublicGames } from "@/lib/public-games";
import { guestGameCard } from "@/lib/guest-games";
import { GuestDashboard } from "@/components/dashboard/guest-dashboard";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Friendly Games" };

// The signed-in and signed-out game views deliberately share the same Discover
// page. Member-specific booking, upcoming matches and account actions remain
// available through the optional authenticated profile.
export default async function GamesPage({
  searchParams,
}: {
  searchParams?: { join?: string };
}) {
  if (searchParams?.join) {
    redirect(`/games?join=${encodeURIComponent(searchParams.join)}`);
  }
  const [session, publicGames] = await Promise.all([getSession(), getPublicGames()]);
  return <GuestDashboard discovery games={publicGames.map(guestGameCard)} profile={session?.profile.role === "member" ? session.profile : undefined} />;
}
