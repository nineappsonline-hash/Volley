import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Sign up — Playza",
  description:
    "Create your Playza account as a member or set up your sports academy.",
};

export default function SignupPage() {
  return <SignupForm />;
}