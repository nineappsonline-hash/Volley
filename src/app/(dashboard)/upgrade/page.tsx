import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { UpgradeClient } from "@/components/upgrade/upgrade-client";

export const metadata: Metadata = { title: "Upgrade to Premium" };

export default async function UpgradePage() {
  const { user, profile } = await requireSession();
  return <UpgradeClient profile={profile} role={user.role} />;
}
