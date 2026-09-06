import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { CommunityClient } from "@/components/community/community-client";

export const metadata: Metadata = { title: "Community" };

export default async function CommunityPage() {
  const { profile } = await requireSession();
  return <CommunityClient profile={profile} />;
}