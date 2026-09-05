import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { EventsClient } from "@/components/events/events-client";

export const metadata: Metadata = { title: "Nearby Events" };

export default async function EventsPage() {
  const { profile } = await requireSession();
  return <EventsClient profile={profile} />;
}
