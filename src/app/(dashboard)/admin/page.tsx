import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { SuperAdminDashboard } from "@/components/super-admin/super-admin-dashboard";

export const metadata: Metadata = { title: "Super Admin" };

export default async function SuperAdminPage() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!isPlatformAdmin(user)) redirect("/dashboard");

  return <SuperAdminDashboard />;
}
