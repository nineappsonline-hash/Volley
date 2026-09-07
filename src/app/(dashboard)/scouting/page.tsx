import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { ScoutingClient } from "@/components/scouting/scouting-client";

export const metadata: Metadata = { title: "Scouting" };

export default async function ScoutingPage() {
  const { profile } = await requireSession();
  return <ScoutingClient profile={profile} />;
}