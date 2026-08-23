import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { TournamentsClient } from "@/components/tournaments/tournaments-client";

export const metadata: Metadata = { title: "Tournaments" };

export default async function TournamentsPage() {
  const { profile } = await requireSession();
  if (profile.role !== "admin") redirect("/dashboard");

  return <TournamentsClient />;
}
