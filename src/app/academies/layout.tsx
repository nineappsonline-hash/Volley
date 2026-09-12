import type { Metadata } from "next";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  // The root layout template appends the brand: "… | بلايزا Playza".
  title: "دليل أكاديميات الرياضة في مصر — ابحث حسب المنطقة والرياضة",
  description:
    "دليل أكاديميات الرياضة في مصر والخليج: كرة قدم، طائرة، سلة، بادل وسباحة. ابحث حسب المحافظة والمنطقة والرياضة والتقييمات، وشوف مواعيد التدريب واحجز حصة تجريبية مجاناً.",
  keywords: [
    "أكاديميات رياضية في مصر",
    "أكاديمية كرة قدم في القاهرة",
    "أكاديمية كرة قدم للأطفال",
    "أكاديمية كرة طائرة مصر",
    "أكاديمية سباحة مصر",
    "أكاديمية بادل",
    "دليل الأكاديميات الرياضية",
    "أقرب أكاديمية رياضية",
    "حجز حصة تجريبية",
    "sports academies Egypt",
    "sports academy directory",
    "find sports academy near me",
  ],
  alternates: {
    canonical: "/academies",
  },
  openGraph: {
    title: "دليل أكاديميات الرياضة في مصر | بلايزا",
    description:
      "ابحث عن أكاديمية رياضية قريبة منك حسب المنطقة والرياضة والتقييمات، واحجز حصة تجريبية مجاناً مع بلايزا.",
    url: `${SITE_URL}/academies`,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "ar_EG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "دليل أكاديميات الرياضة في مصر | بلايزا",
    description:
      "ابحث عن أكاديمية رياضية قريبة منك حسب المنطقة والرياضة والتقييمات.",
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
