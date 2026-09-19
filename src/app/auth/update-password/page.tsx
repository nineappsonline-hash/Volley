import { Suspense } from "react";
import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  description:
    "Choose a new password for your Playza account from the reset link sent to your email.",
  alternates: {
    canonical: "/auth/update-password",
  },
};

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordForm />
    </Suspense>
  );
}