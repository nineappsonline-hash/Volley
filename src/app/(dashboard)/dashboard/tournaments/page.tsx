import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { TournamentsClient } from "@/components/tournaments/tournaments-client";

export const metadata: Metadata = { title: "Tournaments" };

type SP = Promise<{ create?: string }>;

export default async function TournamentsPage({ searchParams }: { searchParams: SP }) {
  const { user } = await requireSession();
  const { create } = await searchParams;

  return (
    <TournamentsClient
      canCreate={user.role !== "member"}
      autoCreate={create === "1"}
    />
  );
}