import type { Metadata } from "next";
import {
  CalendarDays,
  CreditCard,
  BarChart3,
  Users,
  QrCode,
  Trophy,
  ClipboardCheck,
  Wallet,
} from "lucide-react";
import {
  SolutionPage,
  generateSolutionMetadata,
} from "@/app/solutions/solution-page";

export const metadata: Metadata = generateSolutionMetadata(
  "Swimming",
  "Playza is the complete management platform for swimming academies and schools. Track students, lesson schedules, payments and per-session profitability.",
  [
    "swimming academy management",
    "swimming school software",
    "swimming lesson scheduling",
    "manage swimming academy",
    "swimming class management",
    "swimming attendance tracking",
    "swimming academy Egypt",
    "swimming academy Saudi Arabia",
    "swimming academy UAE",
    "سباحة",
    "أكاديمية سباحة",
    "إدارة أكاديمية سباحة",
    "إدارة دروس السباحة",
    "جدول دروس السباحة",
    "نظام حضور السباحة",
    "أكاديمية سباحة مصر",
    "أكاديمية سباحة للأطفال",
    "دروس سباحة للأطفال",
    "حجز درس سباحة",
    "software for swimming schools",
    "swimming academy app",
    "swimming subscription management",
    "swimming payment tracking",
    "swimming profit tracking",
  ]
);

export default function SwimmingPage() {
  return (
    <SolutionPage
      sport="Swimming"
      emoji="🏊"
      heroGradient="from-brand via-brand to-interactive-800"
      tagline="The complete management platform for swimming academies — students, lessons, payments and profit tracking."
      description="Managing swimming lessons is uniquely complex — pool lanes, instructor schedules, age groups and skill levels. Playza handles it all. Track student subscriptions, schedule lessons with lane assignments, manage QR check-in and see automatic profit/loss for every lesson. No more paper sign-up sheets."
      features={[
        {
          icon: Users,
          title: "Student Management",
          desc: "Track students by age group, skill level and subscription plan.",
        },
        {
          icon: CalendarDays,
          title: "Lesson Scheduling",
          desc: "Schedule lessons with pool lane assignments, instructor availability and recurring patterns.",
        },
        {
          icon: QrCode,
          title: "QR Code Check-in",
          desc: "Students scan a code at the pool. Batch check-in for entire classes in seconds.",
        },
        {
          icon: Wallet,
          title: "Automatic Finances",
          desc: "Enter instructor costs and pool rental — profit/loss per lesson calculates instantly.",
        },
        {
          icon: CreditCard,
          title: "Payment Tracking",
          desc: "Record payments by cash, card, wallet or transfer. Printable receipts included.",
        },
        {
          icon: BarChart3,
          title: "Reports & Analytics",
          desc: "Revenue vs costs, attendance trends, retention analysis and CSV/PDF exports.",
        },
        {
          icon: ClipboardCheck,
          title: "Parent Portal",
          desc: "Parents see their child's remaining lessons, attendance history and upcoming schedule.",
        },
        {
          icon: Trophy,
          title: "Multi-level Support",
          desc: "Manage beginner, intermediate and advanced groups with different schedules.",
        },
      ]}
      useCases={[
        "Swimming academies and schools",
        "Multi-sport clubs with pools",
        "Learn-to-swim programs",
        "Competitive swim teams",
        "Aquatic fitness centers",
        "Independent swim instructors",
      ]}
    />
  );
}
