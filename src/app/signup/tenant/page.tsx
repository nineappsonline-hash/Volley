import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create your academy — Volleyra",
  description:
    "Start your 14-day free trial and set up your sports academy on Volleyra.",
};

export default function TenantSignupPage() {
  return <SignupForm mode="tenant" />;
}