import type { Metadata } from "next";
import Link from "next/link";
import { dictionary } from "@/lib/i18n/dictionary";
import { ACADEMY_GUIDES, guidePath } from "@/lib/guides";
import { getPublicAcademyIndex } from "@/lib/public-sport-academies";
import { AcademiesDirectory } from "@/components/academies/academies-directory";
import { SITE_URL, OG_IMAGE } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Find Sports Academies & Training in Egypt | Playza",
  description: "Discover sports academies in Egypt for kids and adults. Find volleyball, basketball, tennis, padel and training near you. Compare and connect through Playza.",
  keywords: [
    "sports academies egypt", "sports academies cairo", "sports academies new cairo",
    "volleyball academy cairo", "basketball academy for kids", "tennis academy cairo",
    "padel academy cairo", "sports training for adults",
    "أكاديميات رياضية مصر", "أكاديمية كرة طائرة", "أكاديمية كرة سلة للأطفال", "تدريب رياضي للكبار"
  ],
  alternates: { canonical: "/academies" },
  openGraph: {
    title: "Find Sports Academies & Training in Egypt | Playza",
    description: "Discover sports academies in Egypt for kids and adults. Find training near you.",
    url: `${SITE_URL}/academies`,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Find Sports Academies & Training in Egypt | Playza", description: "Discover sports academies in Egypt for kids and adults.", images: [OG_IMAGE] },
};

export default async function AcademiesPage() {
  const academies = await getPublicAcademyIndex();
  const t = dictionary.ar;

  return (
    <>
      <AcademiesDirectory />
      {academies.length > 0 && (
        <section
          aria-label={t.directory_title}
          className="mx-auto max-w-5xl px-6 pb-14"
        >
          <h2 className="text-xl font-extrabold">{t.directory_title}</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {academies.map((academy) => (
              <li key={academy.slug}>
                <Link
                  href={`/a/${academy.slug}`}
                  className="block rounded-lg border px-4 py-3 text-sm transition-colors hover:border-primary hover:bg-muted"
                >
                  <span className="font-semibold">{academy.name}</span>
                  {(academy.area || academy.governorate) && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {[academy.area, academy.governorate].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
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
