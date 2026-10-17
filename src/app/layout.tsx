import { LANDING_TITLE, LANDING_DESCRIPTION, LANDING_KEYWORDS } from "@/lib/landing-content";
import { PLAYZA } from "@/lib/brand";
import { OG_IMAGE, SITE_URL } from "@/lib/seo";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Providers } from "@/providers/providers";
import { ScrollToTop } from "@/components/shared/scroll-to-top";
import { AppBackground } from "@/components/shared/app-background";
import { ContactWidget } from "@/components/contact/contact-widget";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
  title: {
    default: LANDING_TITLE,
    template: "%s | Playza",
  },
  description: LANDING_DESCRIPTION,
  keywords: LANDING_KEYWORDS,
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["ar_EG"],
    siteName: "Playza",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Playza — مكانك تلعب رياضة في مصر",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_TITLE,
    description: LANDING_DESCRIPTION,
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
            __html: `try{if("scrollRestoration" in history){history.scrollRestoration="manual";}var H=location.hash||"";var authish=false,recovery=false;if(H){var h=H.slice(1);var rh=h.indexOf("type=recovery")>-1;authish=rh||h.indexOf("access_token=")>-1||h.indexOf("token_hash=")>-1;recovery=rh||h.indexOf("token_hash=")>-1;}var S=location.search||"";if(!authish&&S){recovery=S.indexOf("type=recovery")>-1||S.indexOf("token_hash=")>-1;authish=recovery;}if(authish){if(recovery&&location.pathname!=="/auth/update-password"){location.replace("/auth/update-password"+S+H);}}else if(H){history.replaceState(null,"",location.pathname+location.search);}window.scrollTo(0,0);}catch(e){}`,
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
        {/* Optional machine-readable overview; search engines do not require llms.txt. */}
        <link
          rel="alternate"
          type="text/markdown"
          title="Playza overview for AI assistants"
          href="/llms.txt"
        />
        <link rel="describedby" type="text/markdown" href="/llms.txt" />
      </head>
      <body className="font-sans">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-XJPEX3WY2B"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XJPEX3WY2B');
          `}
        </Script>
        <ScrollToTop />
        <Providers>
          <AppBackground />
          {children}
          <ContactWidget />
        </Providers>
      </body>
    </html>
  );
}
