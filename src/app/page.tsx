import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title:
    "Playza — Sports Academy Management Platform | إدارة أكاديميات الرياضة",
  description:
    "The all-in-one platform for sports academies in Egypt and the Gulf. Manage members, attendance, payments, scheduling and automatic profit/loss tracking for volleyball, football, basketball, padel and swimming. منصة شاملة لإدارة أكاديميات الرياضة.",
  keywords: [
    "sports academy management",
    "academy management software",
    "volleyball academy",
    "football academy",
    "basketball academy",
    "padel academy",
    "swimming academy",
    "نظام إدارة أكاديمية",
    "إدارة أعضاء أكاديمية",
    "نظام حضور وغياب",
    "إدارة المدفوعات",
    "تتبع أرباح",
    "Egypt sports software",
    "Gulf academy management",
    "multi-sport academy",
  ],
  openGraph: {
    title:
      "Playza — Sports Academy Management",
    description:
      "All-in-one management platform for sports academies in Egypt and the Gulf. Members, attendance, payments, scheduling and automatic profit tracking.",
    url: "https://volley-academy.vercel.app",
    siteName: "Playza",
    images: [{ url: "/logo.webp", width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Playza — Sports Academy Management",
    description:
      "All-in-one management platform for sports academies. Members, attendance, payments and automatic profit tracking.",
    images: ["/logo.webp"],
  },
};

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Playza',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'The all-in-one management platform for sports academies in Egypt and the Gulf. Manage members, attendance, payments, scheduling and automatic profit tracking.',
    url: 'https://volley-academy.vercel.app',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EGP',
      price: '500',
      priceValidUntil: '2026-12-31',
      availability: 'https://schema.org/InStock',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '150',
    },
    featureList: [
      'Sports academy management',
      'Member and subscription management',
      'Attendance tracking with QR code check-in',
      'Automatic profit and loss calculation',
      'Training schedule and calendar management',
      'Payment and receipt management',
      'Multi-sport support: volleyball, football, basketball, padel, swimming',
      'Bilingual English and Arabic (RTL)',
      'Financial reports and analytics',
      'Bilingual English and Arabic support',
    ],
    keywords:
      'sports academy, volleyball academy, football academy, basketball, padel, swimming, membership management, attendance tracking, أكاديمية رياضية إدارة',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
