import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — Volleyra",
  description:
    "Sign in to your Volleyra account as a member or an academy owner.",
};

export default function LoginPage() {
  return <LoginForm />;
}