import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnerSignupForm } from "@/components/auth/owner-signup-form";

export const metadata: Metadata = {
  title: "Become a playground owner",
  description:
    "List your playground on Playza, get verified, and earn from every booking — Playza handles the booking and keeps the participant fee while you earn your playground rate.",
  alternates: {
    canonical: "/signup/owner",
  },
};

export default function OwnerSignupPage() {
  return (
    <Suspense>
      <OwnerSignupForm />
    </Suspense>
  );
}