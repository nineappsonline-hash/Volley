import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing";
import { createClient } from "@/lib/supabase/server";
import { dictionary } from "@/lib/i18n/dictionary";
import {
  OG_IMAGE,
  SITE_URL,
  breadcrumbsJsonLd,
  faqPageJsonLd,
  jsonLdStringify,
  landingFaqItems,
  organizationJsonLd,
  softwareAppJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Playza — Sports Academies, Games & Matches in Egypt | Your Place on the Field",
  description:
    "Discover a football, volleyball, basketball, padel or swimming academy near you in Egypt, track your kids' training and progress, and manage your academy from one place: subscriptions, attendance, payments and profits. Playza brings players, parents and academy owners together.",
  keywords: [
    // English
    "sports academy management",
    "academy management software",
    "football academy Egypt",
    "volleyball academy",
    "padel academy",
    "friendly football matches",
    "find sports academy",
    // Egypt local intent (Arabic)
    "أكاديميات رياضية في مصر",
    "أكاديمية كرة قدم في القاهرة",
    "أكاديمية كرة قدم للأطفال",
    "مدرب كرة قدم للأطفال",
    "أكاديمية كرة طائرة مصر",
    "أكاديمية بادل مصر",
    "حجز ماتش كرة قدم",
    "لعب كرة القدم",
    "ماتشات ودية",
    "تدريب رياضي للأطفال",
    "جيم ودية",
    "إيجار ملعب",
    // Management-intent (owners)
    "برنامج إدارة أكاديمية",
    "نظام إدارة أكاديمية رياضية",
    "إدارة اشتراكات الأكاديمية",
    "نظام حضور وغياب",
    "تتبع أرباح الأكاديمية",
    "إدارة المدفوعات",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Playza — Your Place on the Field",
    description:
      "Play, track your progress, follow your kids' training, or manage your academy. Discover schedules, attendance, feedback and friendly games with Playza.",
    url: SITE_URL,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "en_US",
    alternateLocale: ["ar_EG"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playza — Your Place on the Field",
    description:
      "Playza brings your sports journey together: academies, friendly matches, attendance, subscriptions and player progress tracking.",
    images: [OG_IMAGE],
  },
};

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  // The FAQ lives in the client i18n dictionary; schema.org needs it at build
  // time, so read both languages from the dictionary directly.
  const faqEn: [string, string][] = [
    [dictionary.en.landing_faq1_q, dictionary.en.landing_faq1_a],
    [dictionary.en.landing_faq2_q, dictionary.en.landing_faq2_a],
    [dictionary.en.landing_faq3_q, dictionary.en.landing_faq3_a],
    [dictionary.en.landing_faq4_q, dictionary.en.landing_faq4_a],
  ];

  const jsonLd = [
    organizationJsonLd(),
    websiteJsonLd(),
    softwareAppJsonLd(),
    // Only the visible (default English) FAQ qualifies for the rich result;
    // Arabic is emitted in-session when the user toggles language.
    faqPageJsonLd(landingFaqItems(faqEn)),
    breadcrumbsJsonLd([{ name: "Home", url: SITE_URL }]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }}
      />
      <LandingPage />
    </>
  );
}
