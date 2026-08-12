import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ProfileClient } from "@/components/profile/profile-client";

export const metadata: Metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const { profile } = await requireSession();
  if (profile.role === "admin") redirect("/members");
  return <ProfileClient serverProfile={profile} />;
}
