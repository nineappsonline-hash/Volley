import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { TournamentsClient } from "@/components/tournaments/tournaments-client";

export const metadata: Metadata = { title: "Tournaments" };

export default async function TournamentsPage() {
  const { profile } = await requireSession();

  return <TournamentsClient />;
}
