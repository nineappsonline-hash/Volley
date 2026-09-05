import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { PlaygroundsClient } from "@/components/playgrounds/playgrounds-client";

export const metadata: Metadata = { title: "Playgrounds" };

export default async function PlaygroundsPage() {
  const { profile } = await requireSession();

  return <PlaygroundsClient />;
}