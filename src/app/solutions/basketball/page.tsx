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
  "Basketball",
  "كرة السلة",
  "Volleyra is the complete management platform for basketball academies. Track players, training sessions, payments and per-session profitability.",
  [
    "basketball academy management",
    "basketball club software",
    "basketball coaching platform",
    "manage basketball academy",
    "basketball training schedule",
    "basketball attendance tracking",
    "basketball academy Egypt",
    "basketball academy Saudi Arabia",
    "basketball academy UAE",
    "كرة سلة",
    "أكاديمية كرة سلة",
    "إدارة أكاديمية كرة سلة",
    "إدارة فريق كرة سلة",
    "جدول تدريب كرة سلة",
    "نظام حضور كرة سلة",
    "أكاديمية كرة سلة مصر",
    "software for basketball academies",
    "basketball academy app",
    "basketball subscription management",
    "basketball payment tracking",
    "basketball profit tracking",
  ]
);

export default function BasketballPage() {
  return (
    <SolutionPage
      sport="Basketball"
      sportAr="كرة السلة"
      emoji="🏀"
      heroGradient="from-brand via-brand to-interactive-800"
      tagline="The complete management platform for basketball academies — players, training, payments and profit tracking."
      taglineAr="منصة الإدارة الشاملة لأكاديميات كرة سلة — اللاعبين والتدريب والمدفوعات وتتبع الأرباح."
      description="Run your basketball academy with confidence. Volleyra manages player rosters, subscription billing, court scheduling, QR check-in attendance and automatic profit/loss calculations. Whether you coach kids or compete at a high level, our platform gives you the numbers you need to make smart decisions."
      descriptionAr="درّ أكاديمية كرة سلتك بثقة. تدير فوليرا قوائم اللاعبين وفوترة الاشتراكات وجدولة الملاعب والحضور بالباركود وحسابات الأرباح والخسائر التلقائية. سواء كنت تدرب أطفالاً أو تنافس على مستوى عالي، تمنحك منصتنا الأرقام التي تحتاجها لاتخاذ قرارات ذكية."
      features={[
        {
          icon: Users,
          title: "Player Management",
          desc: "Complete roster with search, filtering, subscription plans and payment history.",
        },
        {
          icon: CalendarDays,
          title: "Court Scheduling",
          desc: "Monthly calendar, recurring sessions and coach availability — never double-book a court.",
        },
        {
          icon: QrCode,
          title: "QR Code Check-in",
          desc: "Players scan a personal code at the door. Batch attendance for entire teams in seconds.",
        },
        {
          icon: Wallet,
          title: "Automatic Finances",
          desc: "Enter coach salary and gym rental — profit/loss per session calculates instantly.",
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
          title: "Member Portal",
          desc: "Players see their remaining sessions, attendance history and upcoming schedule.",
        },
        {
          icon: Trophy,
          title: "Tournaments",
          desc: "Manage brackets, rounds, scores and match history for basketball tournaments.",
        },
      ]}
      useCases={[
        "Youth basketball academies",
        "Professional basketball training centers",
        "School basketball programs",
        "Multi-sport clubs with basketball",
        "Basketball camps and clinics",
        "Independent basketball coaches",
      ]}
      useCasesAr={[
        "أكاديميات كرة سلة للناشئين",
        "مراكز تدريب كرة سلة احترافية",
        "برامج كرة سلة في المدارس",
        "أندية رياضية متعددة تشمل كرة سلة",
        "مخيمات وعيادات كرة سلة",
        "مدربو كرة سلة مستقلون",
      ]}
    />
  );
}
