import type { Metadata } from "next";
import Link from "next/link";
import { dictionary } from "@/lib/i18n/dictionary";
import { ACADEMY_GUIDES, guidePath } from "@/lib/guides";
import { getPublicTeams } from "@/lib/public-sport-academies";
import { AcademyTeamsSection } from "@/components/academies/academy-teams-section";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { AppLogo } from "@/components/shared/app-logo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Find Sports Teams & Academies in Egypt | Playza",
  description: "Discover sports teams and academies in Egypt for kids and adults. Find volleyball, basketball, tennis, padel and training near you by sport, gender, age, and location.",
  keywords: [
    "sports teams egypt", "sports academies egypt", "volleyball teams cairo", "basketball teams cairo", "tennis academy cairo",
    "padel academy cairo", "sports training for kids and adults",
    "فرق رياضية مصر", "أكاديميات رياضية مصر", "فرق كرة طائرة", "فرق كرة سلة للأطفال"
  ],
  alternates: { canonical: "/academies" },
  openGraph: {
    title: "Find Sports Teams & Academies in Egypt | Playza",
    description: "Discover sports teams and academies in Egypt for kids and adults. Find training near you by sport, gender, age, and location.",
    url: `${SITE_URL}/academies`,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Find Sports Teams & Academies in Egypt | Playza", description: "Discover sports teams and academies in Egypt for kids and adults.", images: [OG_IMAGE] },
};

export default async function AcademiesPage() {
  const teams = await getPublicTeams();
  const t = dictionary.ar;

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <AppLogo className="h-6 w-auto" />
          <span className="font-semibold text-sm hidden sm:inline">Playza</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-2">
          <Link href="/games" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">Games</Link>
          <Link href="/sports" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">Sports</Link>
          <Link href="/academies" className="text-xs font-medium text-primary">Academies</Link>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link href="/login" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">Sign in</Link>
        </div>
      </header>
      <AcademyTeamsSection teams={teams} />
      <section
        aria-label="Academy guides"
        className="mx-auto max-w-5xl px-6 pb-14"
      >
        <h2 className="text-xl font-extrabold">Academy guides</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ACADEMY_GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link
                href={guidePath("en", guide.slug)}
                className="block rounded-lg border px-4 py-3 text-sm transition-colors hover:border-primary hover:bg-muted"
              >
                <span className="font-semibold">{guide.en.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{guide.en.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
