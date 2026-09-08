import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { GamesClient } from "@/components/games/games-client";

export const metadata: Metadata = { title: "Friendly Games" };

export default async function GamesPage() {
  const { profile } = await requireSession();
  return <GamesClient profile={profile} />;
}