import type { Metadata } from "next";
import { getPublicTournaments } from "@/lib/public-games";
import { PublicTournamentBrowser } from "@/components/dashboard/public-browse-lists";
import { getSession } from "@/lib/session";
import { MyTournamentsCard } from "@/components/dashboard/my-tournaments-card";
import { TournamentsClient } from "@/components/tournaments/tournaments-client";

export const metadata: Metadata = { title: "Tournaments" };

type SP = Promise<{ create?: string }>;

export default async function TournamentsPage({ searchParams }: { searchParams: SP }) {
  const session = await getSession();
  if (!session) return <PublicTournamentBrowser tournaments={await getPublicTournaments()} />;
  const { user, profile } = session;
  const { create } = await searchParams;

  return (
    <div className="space-y-6">
      {profile.role === "member" && <section id="my-tournaments" className="scroll-mt-24"><MyTournamentsCard memberId={profile.id} /></section>}
    {profile.role === "member" ? <PublicTournamentBrowser tournaments={await getPublicTournaments()} /> : <TournamentsClient
      canCreate={user.role === "admin" || user.role === "super_admin"}
      autoCreate={create === "1"}
    />}
    </div>
  );
}