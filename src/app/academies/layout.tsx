import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  // The root layout template appends the brand.
  title: "Sports Academy Directory in Egypt — Search by Area & Sport",
  description:
    "The sports academy directory for Egypt & the Gulf: football, volleyball, basketball, padel and swimming. Search by governorate, area, sport and ratings, view training schedules and book a free tryout session.",
  keywords: [
    "sports academies Egypt",
    "sports academy directory",
    "find sports academy near me",
    "football academy in Cairo",
    "kids football academy",
    "volleyball academy Egypt",
    "swimming academy Egypt",
    "padel academy",
    "book a tryout session",
    "أكاديميات رياضية في مصر",
    "أكاديمية كرة قدم في القاهرة",
    "أكاديمية كرة قدم للأطفال",
    "أكاديمية كرة طائرة مصر",
    "أكاديمية سباحة مصر",
    "أكاديمية بادل",
    "دليل الأكاديميات الرياضية",
    "أقرب أكاديمية رياضية",
    "حجز حصة تجريبية",
  ],
  alternates: {
    canonical: "/academies",
  },
  openGraph: {
    title: "Sports Academy Directory in Egypt | Playza",
    description:
      "Find a sports academy near you by area, sport and ratings, and book a free tryout session with Playza.",
    url: `${SITE_URL}/academies`,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sports Academy Directory in Egypt | Playza",
    description:
      "Find a sports academy near you by area, sport and ratings.",
    images: [OG_IMAGE],
  },
};

export default function AcademiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
