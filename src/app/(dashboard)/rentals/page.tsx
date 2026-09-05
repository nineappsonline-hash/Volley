import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { RentalsClient } from "@/components/rentals/rentals-client";

export const metadata: Metadata = { title: "Rentals" };

export default async function RentalsPage() {
  const { profile } = await requireSession();

  return <RentalsClient />;
}