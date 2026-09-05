import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Academy owner sign in — Volleyra",
  description: "Sign in to manage your academy on Volleyra.",
};

export default function TenantLoginPage() {
  return <LoginForm mode="tenant" />;
}