import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle,
  CalendarDays,
  CreditCard,
  BarChart3,
  Users,
  QrCode,
  Trophy,
  ArrowRight,
  Globe,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SolutionPageProps {
  sport: string;
  sportAr: string;
  emoji: string;
  heroGradient: string;
  tagline: string;
  taglineAr: string;
  description: string;
  descriptionAr: string;
  features: { title: string; desc: string; icon: React.ElementType }[];
  useCases: string[];
  useCasesAr: string[];
}

export function generateSolutionMetadata(
  sport: string,
  sportAr: string,
  description: string,
  keywords: string[]
): Metadata {
  return {
    title: `${sport} Academy Management Software | إدارة أكاديمية ${sportAr}`,
    description: `${description} Manage ${sport.toLowerCase()} academy members, attendance, payments and training schedules. منصة إدارة أكاديمية ${sportAr}.`,
    keywords,
    openGraph: {
      title: `Volleyra — ${sport} Academy Management`,
      description: `The complete management platform for ${sport.toLowerCase()} academies. Members, attendance, payments and automatic profit tracking.`,
      url: `https://volley-academy.vercel.app/solutions/${sport.toLowerCase()}`,
      siteName: "Volleyra",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Volleyra — ${sport} Academy Management`,
      description: `The complete management platform for ${sport.toLowerCase()} academies.`,
      images: ["/og-image.png"],
    },
    alternates: {
      canonical: `https://volley-academy.vercel.app/solutions/${sport.toLowerCase()}`,
    },
  };
}

export function SolutionPage({
  sport,
  sportAr,
  emoji,
  heroGradient,
  tagline,
  taglineAr,
  description,
  descriptionAr,
  features,
  useCases,
  useCasesAr,
}: SolutionPageProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",      name: `Volleyra — ${sport}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: `${description} ${descriptionAr}`,
    url: `https://volley-academy.vercel.app/solutions/${sport.toLowerCase()}`,
    offers: {
      "@type": "Offer",
      priceCurrency: "EGP",
      price: "500",
      priceValidUntil: "2026-12-31",
      availability: "https://schema.org/InStock",
    },
    featureList: features.map((f) => f.title),
  };

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section
        className={`relative overflow-hidden border-b bg-gradient-to-br ${heroGradient} py-20 text-white`}
      >
        <div className="pointer-events-none absolute -top-24 start-1/2 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-white/15 blur-3xl rtl:translate-x-1/2" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
          <span className="text-5xl">{emoji}</span>
          <h1 className="text-3xl font-extrabold sm:text-5xl">
            {sport} Academy Management
          </h1>
          <p className="max-w-2xl text-base text-white/85 sm:text-lg">
            {tagline}
          </p>
          <p className="max-w-2xl text-sm text-white/70" dir="rtl">
            {taglineAr}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-info-ink hover:bg-white/90">
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ms-2 h-5 w-5 rtl:rotate-180" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/30 text-white hover:bg-white/10"
            >
              <Link href="/academies">Browse Academies</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Why {sport} Academies Love Us</h2>
            <p className="mt-4 text-muted-foreground">{description}</p>
          </div>
          <div>
            <h2 className="text-2xl font-bold" dir="rtl">
              لماذا تحب أكاديميات {sportAr} منصتنا
            </h2>
            <p className="mt-4 text-muted-foreground" dir="rtl">
              {descriptionAr}
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold">
            Everything You Need for {sport}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold">
            Perfect For
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold">English</h3>
              <ul className="mt-3 space-y-2">
                {useCases.map((uc) => (
                  <li key={uc} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" />
                    {uc}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border bg-card p-6" dir="rtl">
              <h3 className="font-semibold">العربية</h3>
              <ul className="mt-3 space-y-2">
                {useCasesAr.map((uc) => (
                  <li key={uc} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" />
                    {uc}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold">
            Why Volleyra?
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Globe, label: "Bilingual", desc: "English + Arabic (RTL)" },
              { icon: Smartphone, label: "Mobile Ready", desc: "Works on any device" },
              { icon: QrCode, label: "QR Check-in", desc: "Fast attendance tracking" },
              { icon: BarChart3, label: "Auto Finance", desc: "Profit/loss per session" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <item.icon className="mx-auto h-8 w-8 text-primary" />
                <h3 className="mt-2 font-semibold">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold">
            Ready to Manage Your {sport} Academy?
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

      {/* Footer nav */}
      <section className="border-t bg-muted/30 py-8">
        <div className="mx-auto max-w-4xl px-6">
          <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
            Other Solutions
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            {[
              { label: "🏐 Volleyball", href: "/solutions/volleyball" },
              { label: "⚽ Football", href: "/solutions/football" },
              { label: "🏀 Basketball", href: "/solutions/basketball" },
              { label: "🏓 Padel", href: "/solutions/padel" },
              { label: "🏊 Swimming", href: "/solutions/swimming" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border bg-background px-4 py-1.5 text-sm font-medium hover:bg-accent"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
