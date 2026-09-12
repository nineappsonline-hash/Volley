import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Create your free Playza account: join a sports academy, or start managing your own academy — members, subscriptions, attendance and profits from one place.",
  alternates: {
    canonical: "/signup",
  },
};

export default function SignupPage() {
  return <SignupForm />;
}