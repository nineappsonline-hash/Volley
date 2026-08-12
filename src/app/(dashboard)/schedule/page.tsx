import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { ScheduleClient } from "@/components/schedule/schedule-client";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const { profile } = await requireSession();

  return (
    <ScheduleClient
      isAdmin={profile.role === "admin"}
      memberId={profile.id}
    />
  );
}
