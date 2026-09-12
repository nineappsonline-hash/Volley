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
  "Padel",
  "Playza is the complete management platform for padel clubs and academies. Track members, court bookings, payments and per-session profitability.",
  [
    "padel academy management",
    "padel club management software",
    "padel court booking system",
    "manage padel academy",
    "padel membership management",
    "padel attendance tracking",
    "padel academy Egypt",
    "padel academy Saudi Arabia",
    "padel academy UAE",
    "padel club Gulf",
    "بادل",
    "أكاديمية بادل",
    "إدارة نادي بادل",
    "إدارة أكاديمية بادل",
    "حجز ملعب بادل",
    "نظام إدارة بادل",
    "نادي بادل مصر",
    "أكاديمية بادل مصر",
    "أكاديمية بادل القاهرة",
    "حجز ملعب بادل مصر",
    "software for padel clubs",
    "padel club app",
    "padel subscription management",
    "padel payment tracking",
    "padel profit tracking",
  ]
);

export default function PadelPage() {
  return (
    <SolutionPage
      sport="Padel"
      emoji="🏓"
      heroGradient="from-brand via-brand to-interactive-800"
      tagline="The complete management platform for padel clubs — members, courts, bookings and profit tracking."
      description="Padel is booming across Egypt and the Gulf — and your club needs a system that keeps up. Playza handles member subscriptions, court scheduling with conflict detection, QR check-in and automatic profit/loss per session. Focus on growing your padel community, not managing it in spreadsheets."
      features={[
        {
          icon: Users,
          title: "Member Management",
          desc: "Complete roster with search, filtering, membership plans and payment history.",
        },
        {
          icon: CalendarDays,
          title: "Court Scheduling",
          desc: "Book courts with conflict detection, recurring slots and availability windows.",
        },
        {
          icon: QrCode,
          title: "QR Code Check-in",
          desc: "Members scan a personal code at the door. Fast check-in for doubles and groups.",
        },
        {
          icon: Wallet,
          title: "Automatic Finances",
          desc: "Enter coach/trainer costs and court rental — profit/loss calculates instantly.",
        },
        {
          icon: CreditCard,
          title: "Payment Tracking",
          desc: "Record payments by cash, card, wallet or transfer. Printable receipts included.",
        },
        {
          icon: BarChart3,
          title: "Reports & Analytics",
          desc: "Revenue vs costs, court utilization, member retention and CSV/PDF exports.",
        },
        {
          icon: ClipboardCheck,
          title: "Member Portal",
          desc: "Members see their remaining sessions, attendance history and upcoming bookings.",
        },
        {
          icon: Trophy,
          title: "Tournaments & Leagues",
          desc: "Manage ladders, brackets, scores and match history for padel competitions.",
        },
      ]}
      useCases={[
        "Dedicated padel clubs",
        "Multi-sport clubs with padel courts",
        "Padel academies and coaching programs",
        "Corporate padel facilities",
        "Padel tournament organizers",
        "Independent padel coaches",
      ]}
    />
  );
}
