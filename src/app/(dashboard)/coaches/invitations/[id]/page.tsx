import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { CoachInvitationPage } from "@/components/coaches/coach-invitation-page";

export const metadata: Metadata = { title: "Coach Invitation" };

export default async function CoachInvitationRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  return <CoachInvitationPage id={id} />;
}