import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { MarketplaceClient } from "@/components/marketplace/marketplace-client";

export const metadata: Metadata = { title: "Session Marketplace" };

export default async function MarketplacePage() {
  const { profile } = await requireSession();
  return <MarketplaceClient profile={profile} />;
}
