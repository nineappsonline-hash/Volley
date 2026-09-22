import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { profile } = await requireSession();
  if (profile.role === "super_admin") redirect("/admin");
  if (profile.role === "playground_owner") redirect("/playgrounds");

  return (
    <div className="space-y-6">
      <DashboardHeader isAdmin={profile.role !== "member"} />
      {profile.role !== "member" ? (
        <AdminDashboard />
      ) : (
        <MemberDashboard profile={profile} />
      )}
    </div>
  );
}
