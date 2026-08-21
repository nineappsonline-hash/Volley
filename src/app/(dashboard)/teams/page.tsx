import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { TeamsClient } from "@/components/teams/teams-client";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  const { profile } = await requireSession();
  if (profile.role !== "admin") redirect("/dashboard");

  return <TeamsClient />;
}
