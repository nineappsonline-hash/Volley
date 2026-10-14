import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Sports Academy Management Solutions — Football, Volleyball, Basketball, Padel, Swimming",
  description:
    "Discover how Playza helps you manage football, volleyball, basketball, padel and swimming academies: members, subscriptions, attendance, payments and automatic profit tracking in Egypt & the Gulf.",
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
    "برنامج إدارة أكاديمية",
    "حلول إدارة الأندية",
  ],
  openGraph: {
    title: "Playza — Sports Academy Management Solutions",
    description:
      "The platform for managing football, volleyball, basketball, padel and swimming academies: members, attendance, payments and automatic profits.",
    url: `${SITE_URL}/solutions`,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "en_US",
    alternateLocale: ["ar_EG"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playza — Sports Academy Management Solutions",
    description: "The platform for managing football, volleyball, basketball, padel and swimming academies.",
    images: [OG_IMAGE],
  },
  alternates: {
    canonical: "/solutions",
  },
};

const solutions = [
  {
    sport: "Volleyball",
    emoji: "🏐",
    href: "/solutions/volleyball",
    gradient: "from-brand to-interactive-700",
    description:
      "Management software for volleyball academies — players, sessions, payments and profit tracking.",
  },
  {
    sport: "Football",
    emoji: "⚽",
    href: "/solutions/football",
    gradient: "from-brand to-interactive-700",
    description:
      "The complete management platform for football academies — training, attendance and finances.",
  },
  {
    sport: "Basketball",
    emoji: "🏀",
    href: "/solutions/basketball",
    gradient: "from-brand to-interactive-700",
    description:
      "Run your basketball academy with confidence — scheduling, check-in and automatic profit/loss.",
  },
  {
    sport: "Padel",
    emoji: "🏓",
    href: "/solutions/padel",
    gradient: "from-brand to-interactive-700",
    description:
      "The complete management platform for padel clubs — members, courts, bookings and tournaments.",
  },
  {
    sport: "Swimming",
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
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pt-10"><Link href="/academy-management" className="font-semibold text-brand underline underline-offset-4">Sports academy management software in Egypt</Link><span className="mx-3">·</span><Link href="/ar/academy-management" hrefLang="ar" className="font-semibold text-brand underline underline-offset-4">برنامج إدارة الأكاديميات الرياضية في مصر</Link></section>
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
            <Link href="/signup?mode=tenant">
              Get Started Free
              <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
