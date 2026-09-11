import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { SettingsClient } from "@/components/settings/settings-client";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, profile } = await requireSession();

  return (
    <SettingsClient
      isAdmin={profile.role === "admin"}
      canDelete={user.role !== "super_admin"}
    />
  );
}
