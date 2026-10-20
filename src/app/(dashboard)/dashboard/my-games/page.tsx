import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { MyGamesClient } from "@/components/games/my-games-client";

export const metadata: Metadata = { title: "My games" };

export default async function MyGamesPage() {
  const { profile } = await requireSession();
  return <MyGamesClient profile={profile} />;
}
