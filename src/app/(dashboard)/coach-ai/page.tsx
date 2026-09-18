import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { CoachAiClient } from "@/components/coach-ai/coach-ai-client";

export const metadata: Metadata = { title: "AI Coach Assistant" };

export default async function CoachAiPage() {
  await requireSession();
  return <CoachAiClient />;
}