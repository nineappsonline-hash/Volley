import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { CheckoutClient } from "@/components/checkout/checkout-client";

export const metadata: Metadata = { title: "Subscribe" };

export default async function CheckoutPage() {
  const { profile } = await requireSession();
  return <CheckoutClient profile={profile} />;
}