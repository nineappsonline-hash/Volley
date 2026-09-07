import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { LeaderboardClient } from "@/components/leaderboard/leaderboard-client";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const { profile } = await requireSession();
  return <LeaderboardClient profile={profile} />;
}