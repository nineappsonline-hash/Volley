import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const { profile } = await requireSession();
  if (profile.role === "member") redirect("/");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <OnboardingWizard />
    </div>
  );
}