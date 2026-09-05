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
  "Volleyball",
  "الكرة الطائرة",
  "Volleyra is the #1 management platform built specifically for volleyball academies. Track players, subscriptions, attendance and per-session profitability — all in one place.",
  [
    "volleyball academy management",
    "volleyball club management software",
    "volleyball coaching platform",
    "volleyball team management",
    "manage volleyball academy",
    "volleyball training schedule",
    "volleyball attendance tracking",
    "volleyball academy Egypt",
    "volleyball academy Saudi Arabia",
    "volleyball academy UAE",
    "volleyball academy Gulf",
    "كرة طائرة",
    "أكاديمية كرة طائرة",
    "إدارة أكاديمية كرة طائرة",
    "إدارة فريق كرة طائرة",
    "جدول تدريب كرة طائرة",
    "نظام حضور كرة طائرة",
    "أكاديمية كرة طائرة مصر",
    "أكاديمية كرة طائرة السعودية",
    "software for volleyball academies",
    "volleyball academy app",
    "volleyball subscription management",
    "volleyball payment tracking",
    "volleyball academy accounting",
    "volleyball profit tracking",
  ]
);

export default function VolleyballPage() {
  return (
    <SolutionPage
      sport="Volleyball"
      sportAr="الكرة الطائرة"
      emoji="🏐"
      heroGradient="from-blue-700 via-blue-600 to-sky-500"
      tagline="The #1 management platform for volleyball academies — track players, attendance and per-session profit automatically."
      taglineAr="منصة الإدارة رقم 1 لأكاديميات الكرة الطائرة — تتبع اللاعبين والحضور والأرباح تلقائياً."
      description="Volleyra was built from the ground up for volleyball academies. Whether you run a single court or a multi-branch operation, our platform handles member management, subscription tracking, training schedules, QR code check-in and automatic profit/loss calculations — so you can focus on coaching, not spreadsheets."
      descriptionAr="تم بناء فوليرا من الأساس لأكاديميات الكرة الطائرة. سواء كنت تدير ملعباً واحداً أو عمليات فرعية متعددة، تعتمد منصتنا على إدارة الأعضاء وتتبع الاشتراكات وجداول التدريب والدخول بالباركود وحسابات الأرباح والخسائر التلقائية — حتى تتمكن من التركيز على التدريب."
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
          desc: "Members scan a personal code at the door. Batch attendance for 30 players in seconds.",
        },
        {
          icon: Wallet,
          title: "Automatic Finances",
          desc: "Enter coach salary and court rental — profit/loss per session calculates instantly.",
        },
        {
          icon: CreditCard,
          title: "Payment Tracking",
          desc: "Record payments by cash, card, wallet or transfer. Printable receipts included.",
        },
        {
          icon: BarChart3,
          title: "Reports & Analytics",
          desc: "Revenue vs costs charts, retention analysis, revenue forecast and CSV/PDF exports.",
        },
        {
          icon: ClipboardCheck,
          title: "Member Portal",
          desc: "Players see their remaining sessions, attendance history and upcoming schedule.",
        },
        {
          icon: Trophy,
          title: "Tournaments",
          desc: "Manage brackets, rounds, scores and match history for volleyball tournaments.",
        },
      ]}
      useCases={[
        "Single-court volleyball academies",
        "Multi-branch volleyball clubs",
        "Youth volleyball programs (U14, U16, U18)",
        "Professional volleyball training centers",
        "Volleyball schools and camps",
        "Coaches managing multiple teams",
      ]}
      useCasesAr={[
        "أكاديميات كرة طائرة بملعب واحد",
        "أندية كرة طائرة متعددة الفروع",
        "برامج كرة طائرة للناشئين (تحت 14، 16، 18)",
        "مراكز تدريب كرة طائرة احترافية",
        "مدارس ومخيمات كرة طائرة",
        "مدربون يديرون فرقاً متعددة",
      ]}
    />
  );
}
