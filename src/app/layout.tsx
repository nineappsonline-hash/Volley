import { PLAYZA } from "@/lib/brand";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";
import type { Metadata, Viewport } from "next";
import { Providers } from "@/providers/providers";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Playza — Sports Academy Management Platform for Egypt & the Gulf",
    template: "%s | Playza",
  },
  description:
    "The complete sports academy management platform for Egypt & the Gulf: members, subscriptions, QR attendance, training schedules, payments, and automated profit tracking for football, volleyball, basketball, padel, and swimming. منصة بلايزا لإدارة أكاديميات الرياضة في مصر والخليج.",
  keywords: [
    // ── Sports Academy Management ──
    "sports academy management",
    "academy management software",
    "academy management system",
    "academy management app",
    "sports club management",
    "club management software",
    "نظام إدارة الأكاديميات",
    "إدارة أكاديمية رياضية",
    "تطبيق إدارة أكاديمية",
    "إدارة الأندية الرياضية",
    // ── Volleyball ──
    "volleyball academy",
    "volleyball academy management",
    "volleyball club management",
    "volleyball coaching software",
    "volleyball team management",
    "كرة طائرة",
    "أكاديمية كرة طائرة",
    "إدارة فريق كرة طائرة",
    // ── Football / Soccer ──
    "football academy",
    "football academy management",
    "soccer academy",
    "soccer academy software",
    "football coaching platform",
    "كرة قدم",
    "أكاديمية كرة قدم",
    "إدارة أكاديمية كرة قدم",
    // ── Basketball ──
    "basketball academy",
    "basketball academy management",
    "basketball club software",
    "كرة سلة",
    "أكاديمية كرة سلة",
    "إدارة فريق كرة سلة",
    // ── Padel ──
    "padel academy",
    "padel club management",
    "padel court management",
    "بادل",
    "أكاديمية بادل",
    "إدارة نادي بادل",
    // ── Swimming ──
    "swimming academy",
    "swimming class management",
    "swimming lesson scheduling",
    "سباحة",
    "أكاديمية سباحة",
    "إدارة دروس السباحة",
    // ── Member & Payment Management ──
    "membership management software",
    "subscription management",
    "payment tracking system",
    "attendance management",
    "member portal",
    "إدارة الأعضاء",
    "إدارة الاشتراكات",
    "تتبع المدفوعات",
    "نظام الحضور",
    "بوابة الأعضاء",
    // ── Scheduling & Calendar ──
    "training schedule software",
    "class scheduling app",
    "booking management",
    "جدول التدريب",
    "إدارة الجدول التدريبي",
    "نظام الحجز",
    // ── Financial / Profit Tracking ──
    "academy accounting software",
    "profit tracking software",
    "revenue management",
    "expense tracking",
    "financial reports software",
    "محاسبة الأكاديميات",
    "تتبع الأرباح",
    "إدارة الإيرادات",
    "تتبع المصاريف",
    "التقارير المالية",
    // ── Analytics & Reports ──
    "performance analytics",
    "data analytics platform",
    "training analytics",
    "تحليلات أداء",
    "تقارير تحليلية",
    "تحليل بيانات",
    // ── Egypt & Gulf Market (highest intent) ──
    "sports software Egypt",
    "academy software Egypt",
    "sports management Saudi Arabia",
    "academy software UAE",
    "sports platform Gulf",
    "software Egypt",
    "برمجيات إدارة رياضية مصر",
    "إدارة أكاديميات الخليج",
    // ── Arabic search intent (Egypt-first phrasing) ──
    "برنامج إدارة أكاديمية",
    "نظام إدارة أندية",
    "برنامج إدارة نادٍ رياضي",
    "تطبيق أكاديمية رياضية",
    "إدارة أكاديمية في مصر",
    "نظام اشتراكات أكاديمية",
    "برنامج حسابات أكاديمية رياضية",
    "تسجيل حضور اللاعبين",
    "متابعة المدفوعات الأكاديمية",
    "أكاديميات رياضية في مصر",
    "أكاديميات رياضية القاهرة",
    "برمجيات عربية",
    "نظام إدارة ثنائية اللغة",
    // ── SaaS / Cloud ──
    "SaaS academy platform",
    "cloud management software",
    "online academy management",
    "منصة سحابية",
    "برمجيات SaaS",
    // ── Multi-sport ──
    "multi-sport academy",
    "multi-sport management",
    "all-in-one sports platform",
    "academy all-in-one",
    "أكاديمية متعددة الرياضات",
    // ── QR / Check-in / Attendance ──
    "QR code check-in",
    "digital attendance system",
    "automated check-in",
    "نظام الحضور الرقمي",
    "تسجيل الحضور بالباركود",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_EG"],
    siteName: "Playza",
    title: "Playza — Sports Academy Management Platform for Egypt & the Gulf",
    description:
      "The complete sports academy management platform for Egypt & the Gulf: members, subscriptions, attendance, payments, and profit tracking — all in one place.",
    url: SITE_URL,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "بلايزا Playza — منصة إدارة أكاديميات الرياضة",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Playza — Sports Academy Management Platform for Egypt & the Gulf",
    description:
      "The complete sports academy management platform for Egypt & the Gulf: members, subscriptions, attendance, payments, and profit tracking — all in one place.",
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    // Page-level canonicals live in each route's metadata; setting one here
    // would leak onto every child page.
  },
  other: {
    "theme-color": PLAYZA.navy,
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Playza",
    // Geo signals for Egypt-first local search.
    "geo.region": "EG",
    "geo.placename": "Cairo",
    "ICBM": "30.0444, 31.2357",
  },
};

/** Optional: wire Google Search Console / Bing via env vars without code changes. */
const verification = {
  google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
    ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  themeColor: PLAYZA.navy,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem('volley-lang');var lang=s&&JSON.parse(s).state?JSON.parse(s).state.lang:'en';document.documentElement.setAttribute('lang',lang);document.documentElement.setAttribute('dir',lang==='ar'?'rtl':'ltr');}catch(e){}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if("scrollRestoration" in history){history.scrollRestoration="manual";}if(location.hash){history.replaceState(null,"",location.pathname+location.search);}window.scrollTo(0,0);}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router: loading Google Fonts in the root layout is the supported pattern */}
        <link
          href="https://fonts.googleapis.com/css2?family=Alexandria:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link
          rel="icon"
          href="/favicon.png"
        />
        {/* AI / LLM machine-readable overview (llms.txt spec) — helps ChatGPT, Gemini, Claude & Perplexity describe the site accurately. */}
        <link
          rel="alternate"
          type="text/markdown"
          title="Playza overview for AI assistants"
          href="/llms.txt"
        />
        <link rel="describedby" type="text/markdown" href="/llms.txt" />
      </head>
      <body className="font-sans">
        <ScrollToTop />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
