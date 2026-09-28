import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { PlaygroundsClient } from "@/components/playgrounds/playgrounds-client";
import { MemberPlaygrounds } from "@/components/playgrounds/member-playgrounds";
import { OwnerDashboard } from "@/components/playgrounds/owner-dashboard";

export const metadata: Metadata = { title: "Playgrounds" };

export default async function PlaygroundsPage() {
  const { profile } = await requireSession();

  if (profile.role === "playground_owner") {
    return <OwnerDashboard />;
  }

  if (profile.role === "member") return <MemberPlaygrounds memberPlan={profile.member_plan} />;

  return <PlaygroundsClient />;
}