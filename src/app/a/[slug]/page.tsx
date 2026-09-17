import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Camera, MapPin, MessageSquareText, Star, Trophy, Volleyball } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { dictionary } from "@/lib/i18n/dictionary";
import {
  OG_IMAGE,
  SITE_URL,
  breadcrumbsJsonLd,
  jsonLdStringify,
  sportsClubJsonLd,
} from "@/lib/seo";
import { AcademyTrainingSummary } from "@/components/settings/academy-training-prices";
import { formatTime12h } from "@/lib/constants";
import { TrialForm } from "@/components/public/trial-form";
import { LangLabel } from "@/components/shared/lang-label";
import { FollowAcademyButton } from "@/components/academies/follow-badge-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data: academy } = await admin
    .from("academies")
    .select("name, description, country, governorate, area, cover_url, is_public")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!academy) return { title: "Academy" };

  const place = [academy.area, academy.governorate, academy.country]
    .filter(Boolean)
    .join(", ");
  const title = place
    ? `${academy.name} — ${place} | Playza`
    : `${academy.name} | Playza`;
  const description =
    academy.description ||
    `${academy.name} academy${place ? ` in ${place}` : ""}. Learn about training schedules, sports and subscriptions, and book a tryout session with Playza.`;

  return {
    title,
    description: description.slice(0, 300),
    alternates: { canonical: `/a/${slug}` },
    openGraph: {
      type: "website",
      title,
      description: description.slice(0, 200),
      url: `${SITE_URL}/a/${slug}`,
      siteName: "Playza",
      locale: "en_US",
      images: [
        {
          url: academy.cover_url || OG_IMAGE,
          width: 1200,
          height: 630,
          alt: academy.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: description.slice(0, 200),
      images: [academy.cover_url || OG_IMAGE],
    },
  };
}

export default async function PublicAcademyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: academy } = await admin
    .from("academies")
    .select("id, name, description, country, governorate, area, lat, lng, cover_url, is_public, monthly_sessions, monthly_price, tryout_price")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (!academy) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const [{ data: sports }, { data: sessions }, { data: ratings }, { data: photos }] =
    await Promise.all([
      admin
        .from("sports")
        .select("id, name")
        .eq("academy_id", academy.id)
        .order("name"),
      admin
        .from("training_sessions")
        .select("date, time, location")
        .eq("academy_id", academy.id)
        .eq("status", "scheduled")
        .gte("date", today)
        .order("date")
        .order("time")
        .limit(6),
      admin
        .from("academy_ratings")
        .select("id, rating, comment, created_at, member:profiles(name)")
        .eq("academy_id", academy.id)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("academy_photos")
        .select("id, photo_url, caption")
        .eq("academy_id", academy.id)
        .order("created_at"),
    ]);

  const ratingCount = (ratings ?? []).length;
  const avgRating =
    ratingCount > 0
      ? (ratings ?? []).reduce((sum, r) => sum + r.rating, 0) / ratingCount
      : 0;
  const reviews = (ratings ?? []).filter((r) => r.comment?.trim());
  const fmtDate = (iso: string, locale: "en" | "ar") =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
      dateStyle: "medium",
    }).format(new Date(iso));

  const jsonLd = [
    sportsClubJsonLd({
      name: academy.name,
      description: academy.description,
      country: academy.country,
      governorate: academy.governorate,
      area: academy.area,
      lat: academy.lat ?? null,
      lng: academy.lng ?? null,
      slug,
      sports: (sports ?? []).map((s) => s.name),
      ratingValue: avgRating,
      ratingCount,
    }),
    breadcrumbsJsonLd([
      { name: "Home", url: SITE_URL },
      { name: "Academies", url: `${SITE_URL}/academies` },
      { name: academy.name, url: `${SITE_URL}/a/${slug}` },
    ]),
  ];

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-brand via-brand to-interactive-800 py-14 text-white">
        <div className="pointer-events-none absolute -top-24 start-1/2 h-72 w-[32rem] -translate-x-1/2 rounded-full bg-white/15 blur-3xl rtl:translate-x-1/2" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 text-center">
          {academy.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={academy.cover_url}
              alt={academy.name}
              className="h-40 w-full max-w-xl rounded-2xl border border-white/20 object-cover shadow-lg sm:h-56"
            />
          )}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Volleyball className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{academy.name}</h1>
          {academy.description && (
            <p className="max-w-xl text-sm text-white/85 sm:text-base">
              {academy.description}
            </p>
          )}
          {(academy.country || academy.governorate) && (
            <p className="flex items-center justify-center gap-1.5 text-sm text-white/85">
              <MapPin className="h-4 w-4" />
              {[academy.area, academy.governorate, academy.country]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
          {ratingCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-white/90">
              <span className="flex items-center gap-0.5" dir="ltr">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i <= Math.round(avgRating)
                        ? "fill-attention-300 text-attention-300"
                        : "text-white/40"
                    }`}
                  />
                ))}
              </span>
              <span>
                {avgRating.toFixed(1)} ·{" "}
                <LangLabel
                  en={(dictionary.en.directory_reviews as string).replace(
                    "{n}",
                    String(ratingCount)
                  )}
                  ar={(dictionary.ar.directory_reviews as string).replace(
                    "{n}",
                    String(ratingCount)
                  )}
                />
              </span>
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#trial"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-brand shadow-lg transition-transform hover:scale-105"
            >
              <Trophy className="h-4 w-4" />
              <LangLabel
                en={dictionary.en.public_book_trial}
                ar={dictionary.ar.public_book_trial}
              />
            </a>
            <FollowAcademyButton
              academyId={academy.id}
              showCount
              className="border border-white/40 bg-white/10 px-6 py-2.5 text-white hover:bg-white/20 hover:text-white"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-8 px-6 py-10">
        {/* Sports */}
        {(sports ?? []).length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Trophy className="h-5 w-5 text-primary" />
              <LangLabel en={dictionary.en.public_sports} ar={dictionary.ar.public_sports} />
            </h2>
            <div className="flex flex-wrap gap-2">
              {(sports ?? []).map((s) => (
                <span
                  key={s.name}
                  className="rounded-full border bg-muted/40 px-4 py-1.5 text-sm font-medium"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming sessions */}
        {(sessions ?? []).length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <CalendarDays className="h-5 w-5 text-primary" />
              <LangLabel en={dictionary.en.public_upcoming} ar={dictionary.ar.public_upcoming} />
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(sessions ?? []).map((s) => (
                <div key={`${s.date}-${s.time}`} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{s.date}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {formatTime12h(s.time)}
                    {s.location ? ` · ${s.location}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Photos */}
        {(photos ?? []).length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Camera className="h-5 w-5 text-primary" />
              <LangLabel en={dictionary.en.public_photos} ar={dictionary.ar.public_photos} />
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(photos ?? []).map((p) => (
                <figure key={p.id} className="overflow-hidden rounded-xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.photo_url}
                    alt={p.caption ?? academy.name}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                  {p.caption && (
                    <figcaption className="px-3 py-2 text-xs text-muted-foreground">
                      {p.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <MessageSquareText className="h-5 w-5 text-primary" />
              <LangLabel en={dictionary.en.public_reviews} ar={dictionary.ar.public_reviews} />
            </h2>
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id ?? `${r.created_at}-${r.rating}`} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {(r as { member?: { name?: string } }).member?.name ?? "—"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5" dir="ltr">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i <= r.rating
                                ? "fill-attention-300 text-attention-300"
                                : "text-muted-foreground/40"
                            }`}
                          />
                        ))}
                      </span>
                      <time className="text-xs text-muted-foreground" dir="ltr">
                        <LangLabel
                          en={fmtDate(r.created_at, "en")}
                          ar={fmtDate(r.created_at, "ar")}
                        />
                      </time>
                    </div>
                  </div>
                  {r.comment && (
                    <p className="mt-1.5 text-sm text-muted-foreground">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trial booking */}
        <AcademyTrainingSummary academy={academy} />
        <div id="trial" className="scroll-mt-6">
          <TrialForm academyId={academy.id} sports={sports ?? []} />
        </div>
      </div>
    </main>
  );
}
