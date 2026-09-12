import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "تسجيل الدخول",
  description:
    "سجّل الدخول إلى حسابك في بلايزا: تابع تدريبك أو ولادك، أو نظّم أكاديميتك الرياضية.",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginPage() {
  return <LoginForm />;
}