import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { MyTournamentsCard } from "@/components/dashboard/my-tournaments-card";
import { TournamentsClient } from "@/components/tournaments/tournaments-client";

export const metadata: Metadata = { title: "Tournaments" };

type SP = Promise<{ create?: string }>;

export default async function TournamentsPage({ searchParams }: { searchParams: SP }) {
  const { user, profile } = await requireSession();
  const { create } = await searchParams;

  return (
    <div className="space-y-6">
      {profile.role === "member" && <section id="my-tournaments" className="scroll-mt-24"><MyTournamentsCard memberId={profile.id} /></section>}
    <TournamentsClient
      canCreate={user.role === "admin" || user.role === "super_admin"}
      autoCreate={create === "1"}
    />
    </div>
  );
}