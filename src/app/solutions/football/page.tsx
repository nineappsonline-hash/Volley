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
  "Football",
  "كرة القدم",
  "Playza is the complete management platform for football academies. Track players, training sessions, payments and per-session profitability.",
  [
    "football academy management",
    "soccer academy software",
    "football club management",
    "football coaching platform",
    "manage football academy",
    "football training schedule",
    "football attendance tracking",
    "football academy Egypt",
    "football academy Saudi Arabia",
    "football academy UAE",
    "football academy Gulf",
    "كرة قدم",
    "أكاديمية كرة قدم",
    "إدارة أكاديمية كرة قدم",
    "إدارة فريق كرة قدم",
    "جدول تدريب كرة قدم",
    "نظام حضور كرة قدم",
    "أكاديمية كرة قدم مصر",
    "أكاديمية كرة قدم السعودية",
    "أكاديمية كرة قدم للأطفال",
    "مدرسة كرة قدم",
    "برنامج إدارة أكاديمية كرة قدم",
    "اشتراكات أكاديمية كرة قدم",
    "تدريب كرة قدم للأطفال",
    "software for football academies",
    "football academy app",
    "football subscription management",
    "football payment tracking",
    "football academy accounting",
    "football profit tracking",
  ]
);

export default function FootballPage() {
  return (
    <SolutionPage
      sport="Football"
      sportAr="كرة القدم"
      emoji="⚽"
      heroGradient="from-brand via-brand to-interactive-800"
      tagline="The complete management platform for football academies — players, training, payments and profit tracking."
      taglineAr="منصة الإدارة الشاملة لأكاديميات كرة قدم — اللاعبين والتدريب والمدفوعات وتتبع الأرباح."
      description="Whether you run a grassroots football school or a professional academy, Playza handles everything from player registration and subscription management to training schedules, QR check-in and automatic per-session profit calculations. Stop juggling spreadsheets and WhatsApp — get one system that does it all."
      descriptionAr="سواء كنت تدير مدرسة كرة قدم محلية أو أكاديمية احترافية، تتعامل بلايزا مع كل شيء من تسجيل اللاعبين وإدارة الاشتراكات إلى جداول التدريب والدخول بالباركود وحسابات الأرباح التلقائية لكل حصة. توقف عن استخدام جداول البيانات وواتساب — احصل على نظام واحد يفعل كل شيء."
      features={[
        {
          icon: Users,
          title: "Player Management",
          desc: "Complete roster with search, filtering, subscription plans and payment history.",
        },
        {
          icon: CalendarDays,
          title: "Training Schedule",
          desc: "Monthly calendar, recurring sessions and coach availability — never double-book.",
        },
        {
          icon: QrCode,
          title: "QR Code Check-in",
          desc: "Players scan a personal code at the door. Batch attendance for large squads in seconds.",
        },
        {
          icon: Wallet,
          title: "Automatic Finances",
          desc: "Enter coach salary and pitch rental — profit/loss per session calculates instantly.",
        },
        {
          icon: CreditCard,
          title: "Payment Tracking",
          desc: "Record payments by cash, card, wallet or transfer. Printable receipts included.",
        },
        {
          icon: BarChart3,
          title: "Reports & Analytics",
          desc: "Revenue vs costs, retention analysis, coach performance and CSV/PDF exports.",
        },
        {
          icon: ClipboardCheck,
          title: "Member Portal",
          desc: "Players see their remaining sessions, attendance history and upcoming schedule.",
        },
        {
          icon: Trophy,
          title: "Tournaments & Matches",
          desc: "Manage brackets, rounds, scores and match history for football tournaments.",
        },
      ]}
      useCases={[
        "Grassroots football schools",
        "Professional football academies",
        "Youth football programs (U8–U18)",
        "Futsal academies",
        "Multi-sport clubs with football",
        "Independent football coaches",
      ]}
      useCasesAr={[
        "مدارس كرة قدم محلية",
        "أكاديميات كرة قدم احترافية",
        "برامج كرة قدم للناشئين (تحت 8–18)",
        "أكاديميات فوتسال",
        "أندية رياضية متعددة تشمل كرة قدم",
        "مدربو كرة قدم مستقلون",
      ]}
    />
  );
}
