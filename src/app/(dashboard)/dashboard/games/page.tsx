import type { Metadata } from "next";
import { getPublicGames } from "@/lib/public-games";
import { guestGameCard } from "@/lib/guest-games";
import { GuestDashboard } from "@/components/dashboard/guest-dashboard";
import { getSession } from "@/lib/session";
import { GamesClient } from "@/components/games/games-client";

export const metadata: Metadata = { title: "Friendly Games" };

export default async function GamesPage() {
  const session = await getSession();
  if (!session) return <GuestDashboard discovery games={(await getPublicGames()).map(guestGameCard)} />;
  const { profile } = session;
  return <GamesClient profile={profile} />;
}