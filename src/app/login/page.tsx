import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — Playza",
  description:
    "Sign in to your Playza account as a member or an academy owner.",
};

export default function LoginPage() {
  return <LoginForm />;
}