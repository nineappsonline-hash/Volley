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
  title: "بلايزا Playza — أكاديميات وجيمز وماتشات في مصر | مكانك في الملعب",
  description:
    "اكتشف أكاديمية كرة قدم أو طائرة أو سلة أو بادل أو سباحة قريبة منك في مصر، تابع تدريب ولادك وتطورهم، ونظم أكاديميتك من مكان واحد: اشتراكات، حضور، مدفوعات وأرباح. بلايزا بيجمع اللاعبين وأولياء الأمور وأصحاب الأكاديميات.",
  keywords: [
    // Egypt local intent (Arabic-first)
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
    // English
    "sports academy management",
    "academy management software",
    "football academy Egypt",
    "volleyball academy",
    "padel academy",
    "friendly football matches",
    "find sports academy",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "بلايزا Playza — مكانك في الملعب",
    description:
      "العب واتابع تطورك، تابع تمرين ولادك، أو نظم أكاديميتك. اكتشف المواعيد والحضور والتقييمات والجيمز الودية مع بلايزا.",
    url: SITE_URL,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "ar_EG",
    alternateLocale: ["en_US"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "بلايزا Playza — مكانك في الملعب",
    description:
      "بلايزا بيجمع رحلتك الرياضية: أكاديميات، ماتشات ودية، حضور، اشتراكات ومتابعة تطور اللاعبين.",
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
  const faqAr: [string, string][] = [
    [dictionary.ar.landing_faq1_q, dictionary.ar.landing_faq1_a],
    [dictionary.ar.landing_faq2_q, dictionary.ar.landing_faq2_a],
    [dictionary.ar.landing_faq3_q, dictionary.ar.landing_faq3_a],
    [dictionary.ar.landing_faq4_q, dictionary.ar.landing_faq4_a],
  ];

  const jsonLd = [
    organizationJsonLd(),
    websiteJsonLd(),
    softwareAppJsonLd(),
    // Only the visible (default Arabic) FAQ qualifies for the rich result;
    // English is emitted in-session when the user toggles language.
    faqPageJsonLd(landingFaqItems(faqAr)),
    breadcrumbsJsonLd([{ name: "الرئيسية", url: SITE_URL }]),
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
