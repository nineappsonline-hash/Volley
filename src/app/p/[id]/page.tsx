import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  OG_IMAGE,
  SITE_URL,
  breadcrumbsJsonLd,
  jsonLdStringify,
  sportsActivityLocationJsonLd,
} from "@/lib/seo";
import {
  getPublicPlayground,
  resolvePublicPlayground,
} from "@/lib/public-playgrounds";
import { MemberBottomNavigation } from "@/components/layout/member-bottom-navigation";
import { PublicPlaygroundPage } from "@/components/playgrounds/public-playground-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const venue = await getPublicPlayground(id);

  if (!venue) return { title: "Playground" };

  const place = [venue.area, venue.governorate, venue.country]
    .filter(Boolean)
    .join(", ");
  const title = place
    ? `${venue.name} — ${place} | Playza`
    : `${venue.name} | Playza`;
  const lead = venue.sport?.name ? `${venue.sport.name} playground` : "Playground";
  const description =
    `${lead} at ${venue.name}${place ? ` in ${place}` : ""}. Check the available times and book a court with Playza.`;

  return {
    title,
    description: description.slice(0, 300),
    alternates: { canonical: `/p/${id}` },
    openGraph: {
      type: "website",
      title,
      description: description.slice(0, 200),
      url: `${SITE_URL}/p/${id}`,
      siteName: "Playza",
      locale: "en_US",
      images: [
        {
          url: venue.cover_url || OG_IMAGE,
          width: 1200,
          height: 630,
          alt: venue.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: description.slice(0, 200),
      images: [venue.cover_url || OG_IMAGE],
    },
  };
}

export default async function PublicPlaygroundRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await resolvePublicPlayground(id);

  if (!data) notFound();

  const { venue, games, rating, reviews } = data;
  const jsonLd = [
    sportsActivityLocationJsonLd({
      name: venue.name,
      country: venue.country,
      governorate: venue.governorate,
      area: venue.area,
      lat: venue.lat,
      lng: venue.lng,
      id: venue.id,
      image: venue.cover_url || undefined,
      sports: venue.sport?.name ? [venue.sport.name] : [],
      ratingValue: rating.avg,
      ratingCount: rating.count,
    }),
    breadcrumbsJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Playgrounds", url: `${SITE_URL}/book-courts` },
      { name: venue.name, url: `${SITE_URL}/p/${venue.id}` },
    ]),
  ];

  return (
    <main className="min-h-screen bg-muted/20 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }}
      />
      <PublicPlaygroundPage venue={venue} games={games} rating={rating} reviews={reviews} />
      <MemberBottomNavigation />
    </main>
  );
}