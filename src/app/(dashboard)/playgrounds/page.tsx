import type { Metadata } from "next";
import { getPublicCourtDirectory } from "@/lib/public-playgrounds";
import { PublicCourtBrowser } from "@/components/dashboard/public-browse-lists";
import { getSession } from "@/lib/session";
import { PlaygroundsClient } from "@/components/playgrounds/playgrounds-client";
import { MemberPlaygrounds } from "@/components/playgrounds/member-playgrounds";
import { OwnerDashboard } from "@/components/playgrounds/owner-dashboard";

// Private app surface: the public court directory lives at /courts. Keep this
// authenticated route out of the index so it cannot duplicate /courts.
export const metadata: Metadata = { title: "Playgrounds", robots: { index: false, follow: true } };

export default async function PlaygroundsPage() {
  const session = await getSession();
  if (!session) return <PublicCourtBrowser courts={await getPublicCourtDirectory()} />;
  const { profile } = session;

  if (profile.role === "playground_owner") {
    return <OwnerDashboard />;
  }

  if (profile.role === "member") return <MemberPlaygrounds memberPlan={profile.member_plan} />;

  return <PlaygroundsClient />;
}