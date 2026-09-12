import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { EnterpriseGate } from "@/components/shared/enterprise-gate";
import { TournamentsClient } from "@/components/tournaments/tournaments-client";

export const metadata: Metadata = { title: "Tournaments" };

export default async function TournamentsPage() {
  await requireSession();

  return (
    <EnterpriseGate>
      <TournamentsClient />
    </EnterpriseGate>
  );
}