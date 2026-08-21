import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { CoachesClient } from "@/components/coaches/coaches-client";

export const metadata: Metadata = { title: "Coaches" };

export default async function CoachesPage() {
  const { profile } = await requireSession();
  if (profile.role !== "admin") redirect("/dashboard");

  return <CoachesClient />;
}
