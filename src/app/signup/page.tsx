import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Join an academy — Volleyra",
  description: "Create your member account and join your academy on Volleyra.",
};

export default function SignupPage() {
  return <SignupForm mode="member" />;
}