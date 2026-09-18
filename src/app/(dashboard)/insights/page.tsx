import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { InsightsClient } from "@/components/insights/insights-client";

export const metadata: Metadata = { title: "Academy Insights" };

export default async function InsightsPage() {
  await requireSession();
  return <InsightsClient />;
}