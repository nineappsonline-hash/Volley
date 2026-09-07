import type { Metadata, Viewport } from "next";
import { Providers } from "@/providers/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default:
      "Volleyra — إدارة أكاديميات الرياضة",
    template: "%s · Volleyra",
  },
  description:
    "The complete management platform for sports academies in Egypt and the Gulf. Manage members, attendance, payments, scheduling and automatic profit tracking for volleyball, football, basketball, padel, swimming and more. منصة شاملة لإدارة أكاديميات الرياضة.",
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
    // ── Egypt & Gulf Market ──
    "sports software Egypt",
    "academy software Egypt",
    "sports management Saudi Arabia",
    "academy software UAE",
    "sports platform Gulf",
    "software Egypt",
    "برمجيات إدارة رياضية مصر",
    "إدارة أكاديميات الخليج",
    // ── Bilingual / Arabic ──
    "bilingual academy software",
    "RTL management platform",
    "software bilingual English Arabic",
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
    alternateLocale: "ar_EG",
    siteName: "Volleyra",
    title:
      "Volleyra — إدارة أكاديميات الرياضة",
    description:
      "The complete management platform for sports academies in Egypt and the Gulf. Manage members, attendance, payments and profit tracking.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Volleyra — Sports Academy Management CRM",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Volleyra — إدارة أكاديميات الرياضة",
    description:
      "The complete management platform for sports academies. Manage members, attendance, payments and automatic profit tracking.",
    images: ["/og-image.png"],
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
    canonical: "https://volley-academy.vercel.app",
  },
  other: {
    "theme-color": "#2563EB",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
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
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem('volley-lang');var lang=s&&JSON.parse(s).state?JSON.parse(s).state.lang:'ar';document.documentElement.setAttribute('lang',lang);document.documentElement.setAttribute('dir',lang==='ar'?'rtl':'ltr');}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏐</text></svg>"
        />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
