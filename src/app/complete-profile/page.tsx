import { authDestination } from "@/lib/auth-redirect";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";

export const metadata: Metadata = {
  title: "Complete your profile",
  description: "Tell us a little more about you to finish setting up your Playza account.",
  alternates: {
    canonical: "/complete-profile",
  },
};

export default async function CompleteProfilePage({ searchParams }: { searchParams: { next?: string } }) {
  const { profile } = await requireSession();

  const needsCompletion =
    profile.role === "member" &&
    (!profile.phone || !profile.gender || !profile.birth_date);

  if (!needsCompletion) redirect(authDestination(searchParams.next));

  return (
    <Suspense>
      <CompleteProfileForm />
    </Suspense>
  );
}