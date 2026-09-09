import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title:
    "Sports Academy Management Solutions | حلول إدارة أكاديميات الرياضة",
  description:
    "Discover how Playza helps you manage volleyball, football, basketball, padel and swimming academies. Members, attendance, payments and profit tracking. اكتشف كيف تساعدك بلايزا في إدارة أكاديميات الرياضة.",
  keywords: [
    "sports academy management",
    "academy management software",
    "volleyball academy",
    "football academy",
    "basketball academy",
    "padel academy",
    "swimming academy",
    "نظام إدارة أكاديمية",
    "إدارة أكاديمية رياضية",
    "كرة طائرة",
    "كرة قدم",
    "كرة سلة",
    "بادل",
    "سباحة",
    "أكاديمية رياضية مصر",
    "أكاديمية رياضية الخليج",
  ],
  openGraph: {
    title: "Playza — Sports Academy Management Solutions",
    description:
      "The complete management platform for volleyball, football, basketball, padel and swimming academies.",
    url: "https://volley-academy.vercel.app/solutions",
    siteName: "Playza",
    images: [{ url: "/logo.webp", width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  alternates: {
    canonical: "https://volley-academy.vercel.app/solutions",
  },
};

const solutions = [
  {
    sport: "Volleyball",
    sportAr: "كرة الطائرة",
    emoji: "🏐",
    href: "/solutions/volleyball",
    gradient: "from-brand to-interactive-700",
    description:
      "The #1 management platform for volleyball academies — players, sessions, payments and profit tracking.",
  },
  {
    sport: "Football",
    sportAr: "كرة القدم",
    emoji: "⚽",
    href: "/solutions/football",
    gradient: "from-brand to-interactive-700",
    description:
      "The complete management platform for football academies — training, attendance and finances.",
  },
  {
    sport: "Basketball",
    sportAr: "كرة السلة",
    emoji: "🏀",
    href: "/solutions/basketball",
    gradient: "from-brand to-interactive-700",
    description:
      "Run your basketball academy with confidence — scheduling, check-in and automatic profit/loss.",
  },
  {
    sport: "Padel",
    sportAr: "البادل",
    emoji: "🏓",
    href: "/solutions/padel",
    gradient: "from-brand to-interactive-700",
    description:
      "The complete management platform for padel clubs — members, courts, bookings and tournaments.",
  },
  {
    sport: "Swimming",
    sportAr: "السباحة",
    emoji: "🏊",
    href: "/solutions/swimming",
    gradient: "from-brand to-interactive-700",
    description:
      "The complete management platform for swimming academies — students, lessons, payments and profit tracking.",
  },
];

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-brand via-brand to-interactive-800 py-20 text-white">
        <div className="pointer-events-none absolute -top-24 start-1/2 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-white/15 blur-3xl rtl:translate-x-1/2" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
          <h1 className="text-3xl font-extrabold sm:text-5xl">
            Sports Academy Management Solutions
          </h1>
          <p className="max-w-2xl text-base text-white/85 sm:text-lg">
            One platform. Every sport. Manage volleyball, football, basketball,
            padel and swimming academies — members, attendance, payments and
            automatic profit tracking.
          </p>
          <p className="max-w-2xl text-sm text-white/70" dir="rtl">
            منصة واحدة. كل رياضة. إدارة أكاديميات الكرة الطائرة وكرة القدم
            وكرة السلة والبادل والسباحة — الأعضاء والحضور والمدفوعات وتتبع
            الأرباح التلقائي.
          </p>
        </div>
      </section>

      {/* Solutions Grid */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((s) => (
            <Link
              key={s.sport}
              href={s.href}
              className="group rounded-xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <span className="text-4xl">{s.emoji}</span>
              <h2 className="mt-3 text-xl font-bold group-hover:text-primary">
                {s.sport}
              </h2>
              <p className="text-sm text-muted-foreground" dir="rtl">
                {s.sportAr}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {s.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Learn more
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold">
            Ready to Get Started?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Start your 14-day free trial — no credit card required.
          </p>
          <Button asChild size="lg" className="mt-6 gap-2">
            <Link href="/signup">
              Get Started Free
              <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
