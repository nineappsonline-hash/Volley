import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { FollowingClient } from "@/components/community/following-client";

export const metadata: Metadata = { title: "Following" };

export default async function FollowingPage() {
  await requireSession();
  return <FollowingClient />;
}