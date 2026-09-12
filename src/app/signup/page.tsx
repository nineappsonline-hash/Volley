import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "إنشاء حساب",
  description:
    "أنشئ حسابك في بلايزا مجاناً: انضم لأكاديمية رياضية، أو ابدأ في تنظيم أكاديميتك — أعضاء، اشتراكات، حضور وأرباح من مكان واحد.",
  alternates: {
    canonical: "/signup",
  },
};

export default function SignupPage() {
  return <SignupForm />;
}