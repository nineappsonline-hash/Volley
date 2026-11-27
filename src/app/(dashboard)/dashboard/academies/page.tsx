import type { Metadata } from "next";
import { AcademiesPremiumDirectory } from "@/components/academies/academies-premium-directory";
import { getPublicTeams } from "@/lib/public-sport-academies";

export const metadata: Metadata = { title: "Academies" };

// The dashboard layout already renders the shared Playza top navigation.
// Reuse only the directory content here to avoid nesting a second navbar.
export default async function DashboardAcademiesPage() {
  const teams = await getPublicTeams();
  return <AcademiesPremiumDirectory teams={teams} />;
}
