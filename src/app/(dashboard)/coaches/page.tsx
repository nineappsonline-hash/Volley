import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { CoachesClient } from "@/components/coaches/coaches-client";

export const metadata: Metadata = { title: "Coaches" };

export default async function CoachesPage() {
  const { profile } = await requireSession();

  return <CoachesClient />;
}
