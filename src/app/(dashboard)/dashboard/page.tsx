import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { profile } = await requireSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile.role === "admin" ? "Academy overview" : "Your membership at a glance"}
        </p>
      </div>
      {profile.role === "admin" ? (
        <AdminDashboard />
      ) : (
        <MemberDashboard profile={profile} />
      )}
    </div>
  );
}
