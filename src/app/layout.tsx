import type { Metadata, Viewport } from "next";
import { Providers } from "@/providers/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Volley Academy",
    template: "%s · Volley Academy",
  },
  description:
    "Volleyball academy management — members, attendance, payments and profit/loss tracking.",
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=localStorage.getItem('volley-lang');if(s&&JSON.parse(s).state&&JSON.parse(s).state.lang==='ar'){document.documentElement.setAttribute('dir','rtl');document.documentElement.setAttribute('lang','ar');}}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap"
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
