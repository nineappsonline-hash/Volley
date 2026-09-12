import type { Metadata } from "next";
import { FaqPage } from "@/components/marketing/faq-page";
import { dictionary } from "@/lib/i18n/dictionary";
import {
  OG_IMAGE,
  SITE_URL,
  breadcrumbsJsonLd,
  faqPageJsonLd,
  jsonLdStringify,
  landingFaqItems,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "الأسئلة الشائعة — بلايزا",
  description:
    "إجابات الأسئلة الشائعة عن بلايزا: الحسابات، اشتراكات الأعضاء والأكاديميات، الماتشات الودية والبطولات، الحضور والمدفوعات، وأمان بياناتك. FAQ Playza.",
  keywords: [
    "بلايزا أسئلة شائعة",
    "بلايزا FAQ",
    "إزاي انضم لأكاديمية",
    "باقات بلايزا",
    "اشتراك بلايزا",
    "ماتشات ودية بلايزا",
    "بطولات بلايزا",
    "حضور QR",
    "playza faq",
    "playza help",
  ],
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "الأسئلة الشائعة — بلايزا",
    description:
      "إجابات كل أسئلتك عن بلايزا: الحسابات، الاشتراكات، الماتشات، البطولات، الحضور، المدفوعات والأمان.",
    url: `${SITE_URL}/faq`,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "ar_EG",
    alternateLocale: ["en_US"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "الأسئلة الشائعة — بلايزا",
    description: "إجابات كل أسئلتك عن بلايزا في صفحة الأسئلة الشائعة.",
    images: [OG_IMAGE],
  },
};

/** Every on-page Q&A, serialized as schema.org FAQPage (Arabic-primary, matching the visible UI). */
const FAQ_KEYS: [keyof typeof dictionary["ar"], keyof typeof dictionary["ar"]][] = [
  ["faq_item_general_what_q", "faq_item_general_what_a"],
  ["faq_item_general_free_q", "faq_item_general_free_a"],
  ["faq_item_general_roles_q", "faq_item_general_roles_a"],
  ["faq_item_general_member_needed_q", "faq_item_general_member_needed_a"],
  ["faq_item_members_children_q", "faq_item_members_children_a"],
  ["faq_item_members_plans_q", "faq_item_members_plans_a"],
  ["faq_item_members_payment_q", "faq_item_members_payment_a"],
  ["faq_item_members_qr_q", "faq_item_members_qr_a"],
  ["faq_item_members_remaining_q", "faq_item_members_remaining_a"],
  ["faq_item_games_find_q", "faq_item_games_find_a"],
  ["faq_item_games_price_q", "faq_item_games_price_a"],
  ["faq_item_games_chat_q", "faq_item_games_chat_a"],
  ["faq_item_games_tournament_join_q", "faq_item_games_tournament_join_a"],
  [
    "faq_item_games_tournament_type_q",
    "faq_item_games_tournament_type_a",
  ],
  [
    "faq_item_games_tournament_organize_q",
    "faq_item_games_tournament_organize_a",
  ],
  ["faq_item_owners_create_q", "faq_item_owners_create_a"],
  ["faq_item_owners_trial_q", "faq_item_owners_trial_a"],
  ["faq_item_owners_plans_q", "faq_item_owners_plans_a"],
  ["faq_item_owners_collect_q", "faq_item_owners_collect_a"],
  ["faq_item_owners_attendance_q", "faq_item_owners_attendance_a"],
  ["faq_item_owners_profit_q", "faq_item_owners_profit_a"],
  ["faq_item_owners_public_page_q", "faq_item_owners_public_page_a"],
  ["faq_item_tech_devices_q", "faq_item_tech_devices_a"],
  ["faq_item_tech_install_q", "faq_item_tech_install_a"],
  ["faq_item_tech_security_q", "faq_item_tech_security_a"],
  ["faq_item_tech_calendar_q", "faq_item_tech_calendar_a"],
];

export default function FaqRoute() {
  const faqAr: [string, string][] = FAQ_KEYS.map(([q, a]) => [
    dictionary.ar[q] as string,
    dictionary.ar[a] as string,
  ]);

  const jsonLd = [
    breadcrumbsJsonLd([
      { name: "الرئيسية", url: SITE_URL },
      { name: "الأسئلة الشائعة", url: `${SITE_URL}/faq` },
    ]),
    faqPageJsonLd(landingFaqItems(faqAr)),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }}
      />
      <FaqPage />
    </>
  );
}