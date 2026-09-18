import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Playza account to follow your training or your children's, or manage your sports academy.",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}