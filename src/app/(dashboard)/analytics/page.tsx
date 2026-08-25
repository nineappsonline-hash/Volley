import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { AnalyticsClient } from "./analytics-client";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { profile } = await requireSession();

  return <AnalyticsClient isAdmin={profile.role === "admin"} />;
}
