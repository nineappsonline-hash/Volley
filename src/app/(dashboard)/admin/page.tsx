import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { SuperAdminDashboard } from "@/components/super-admin/super-admin-dashboard";

export const metadata: Metadata = { title: "Super Admin" };

export default async function SuperAdminPage() {
  const { profile } = await requireSession();
  if (profile.role !== "super_admin") redirect("/dashboard");

  return <SuperAdminDashboard />;
}
