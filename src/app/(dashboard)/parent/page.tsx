import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ParentDashboard } from "@/components/parent/parent-dashboard";

export const metadata: Metadata = { title: "Family Dashboard" };

export default async function ParentPage() {
  const { profile } = await requireSession();
  if (profile.role === "admin") redirect("/dashboard");
  return <ParentDashboard />;
}