import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPublicGames } from "@/lib/public-games";
import { guestGameCard } from "@/lib/guest-games";
import { GuestDashboard } from "@/components/dashboard/guest-dashboard";
import { getSession } from "@/lib/session";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";

// Private app surface: the public equivalents are /games and /sports. Keep it
// out of the index so it cannot compete with those pages as duplicate content.
export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: true } };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return <GuestDashboard games={(await getPublicGames()).map(guestGameCard)} />;
  const { profile } = session;
  if (profile.role === "super_admin") redirect("/admin");
  if (profile.role === "playground_owner") redirect("/playgrounds");

  return (
    <div className="space-y-6">
      {profile.role !== "member" && <DashboardHeader isAdmin />}
      {profile.role !== "member" ? (
        <AdminDashboard />
      ) : (
        <MemberDashboard profile={profile} />
      )}
    </div>
  );
}
