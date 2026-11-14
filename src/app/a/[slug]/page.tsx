import { AnalyticsView } from "@/components/analytics/business-analytics";
import { LocationMap } from "@/components/shared/location-map";
import { AcademyLogo } from "@/components/academies/academy-logo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Camera, MapPin, MessageSquareText, Star, Trophy } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { dictionary } from "@/lib/i18n/dictionary";
import {
  OG_IMAGE,
  SITE_URL,
  breadcrumbsJsonLd,
  jsonLdStringify,
  sportsClubJsonLd,
} from "@/lib/seo";
import { AcademyTrainingOffers } from "@/components/academies/training-booking";
import { MemberBottomNavigation } from "@/components/layout/member-bottom-navigation";
import { AcademyNavigation } from "@/components/academies/academy-navigation";
import { formatTime12h, AR_NUMERIC_LOCALE } from "@/lib/constants";
import { sportToSlug } from "@/lib/sport-slugs";
import { isActiveSport } from "@/lib/active-sports";
import { discoveryPath } from "@/lib/sport-discovery";
import { TrialForm } from "@/components/public/trial-form";
import { JoinAcademyButton } from "@/components/academies/join-academy-button";
import { LangLabel } from "@/components/shared/lang-label";
import { FollowAcademyButton } from "@/components/academies/follow-badge-button";
import { AcademyShareButton } from "@/components/academies/academy-share";

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
  const title = [academy.name, place].filter(Boolean).join(" — ");
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
    .select("id, name, description, country, governorate, area, lat, lng, cover_url, logo_url, is_public")
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
    new Intl.DateTimeFormat(locale === "ar" ? AR_NUMERIC_LOCALE : "en-US", {
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
    <main className="min-h-screen bg-[#f7f5fc] pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <AnalyticsView event="academy_view" id={academy.id} context={{country:academy.country,governorate:academy.governorate,area:academy.area,sports:(sports??[]).map(s=>s.name)}} />
      <AcademyNavigation />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }}
      />
      {/* Premium academy profile inspired by Figma academy details screens. */}
      <section className="bg-[#f7f5fc] px-4 pb-4 pt-8 sm:px-6 sm:pt-12">
        <div className="mx-auto max-w-6xl">
          <Link href="/academies" className="mb-5 inline-flex text-sm font-semibold text-[#706b80] hover:text-[#5d35c5]"><LangLabel en="← All academies" ar="← كل الأكاديميات" /></Link>
          <div className="relative overflow-hidden rounded-[26px] bg-[#e9e1ff] px-6 py-9 sm:px-10 sm:py-12">
            <div className="pointer-events-none absolute -bottom-28 -end-20 h-80 w-80 rounded-full bg-[#c8b8f9]/70" aria-hidden="true" />
            <div className="relative z-10 flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="mb-5 flex items-center gap-4">
                  <div className="rounded-2xl bg-white p-2 shadow-sm"><AcademyLogo academyId={academy.id} name={academy.name} logoUrl={academy.logo_url} /></div>
                  <p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#5d35c5]"><LangLabel en="SPORTS ACADEMY" ar="أكاديمية رياضية" /></p>
                </div>
                <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-[#1d1631] sm:text-5xl">{academy.name}</h1>
                {academy.description && <p className="mt-5 max-w-xl whitespace-pre-line text-sm leading-relaxed text-[#625b74] sm:text-base">{academy.description}</p>}
                {(academy.area || academy.governorate || academy.country) && <p className="mt-5 flex items-center gap-2 text-sm font-medium text-[#5d35c5]"><MapPin className="h-4 w-4 shrink-0" />{[academy.area, academy.governorate, academy.country].filter(Boolean).join(", ")}</p>}
                {ratingCount > 0 && <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#5d35c5]"><Star className="h-4 w-4 fill-current" />{avgRating.toFixed(1)} · {ratingCount} <LangLabel en="ratings" ar="تقييم" /></p>}
              </div>
              {academy.cover_url ? <div className="w-full shrink-0 overflow-hidden rounded-[22px] border-4 border-white/60 shadow-xl md:w-[38%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={academy.cover_url} alt={academy.name} className="aspect-[4/3] w-full object-cover" />
              </div> : <div className="hidden aspect-[4/3] w-[32%] shrink-0 items-center justify-center rounded-[22px] bg-[#c8b8f9]/60 text-[#5d35c5] md:flex"><Trophy size={92} strokeWidth={1.3} /></div>}
            </div>
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_350px]">
            <div className="rounded-[22px] border border-[#e8e2f1] bg-white p-6 sm:p-8">
              <h2 className="text-2xl font-extrabold text-[#1d1631]"><LangLabel en="About the academy" ar="عن الأكاديمية" /></h2>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#706b80] sm:text-base">{academy.description || <LangLabel en="Explore the academy's available sports, training groups and schedules below." ar="اكتشف الرياضات والمجموعات ومواعيد التدريب المتاحة تحت." />}</p>
              {(sports ?? []).length > 0 && <><p className="mb-3 mt-7 text-xs font-extrabold uppercase tracking-widest text-[#5d35c5]"><LangLabel en="PROGRAMS" ar="البرامج الرياضية" /></p><div className="grid gap-3 sm:grid-cols-2">{(sports ?? []).map(sport => <div key={sport.id} className="rounded-xl bg-[#f7f5fc] px-5 py-5 text-base font-bold text-[#1d1631]">{sport.name}</div>)}</div></>}
            </div>
            <aside className="flex flex-col gap-4 rounded-[22px] border border-[#e8e2f1] bg-white p-6 sm:p-7">
              <h2 className="text-xl font-extrabold text-[#1d1631]"><LangLabel en="Ready to get started?" ar="جاهز تبدأ؟" /></h2>
              <p className="text-sm leading-6 text-[#706b80]"><LangLabel en="Explore available training groups, schedules and prices." ar="شوف مجموعات التدريب والمواعيد والأسعار المتاحة." /></p>
              <a href="#groups" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#5d35c5] px-5 py-3 text-sm font-bold text-white hover:bg-[#4925a5]"><Trophy size={17} /><LangLabel en="Explore training groups" ar="شوف مجموعات التدريب" /></a>
              <JoinAcademyButton academyId={academy.id} analytics={{country:academy.country,governorate:academy.governorate,area:academy.area,sports:(sports??[]).map(s=>s.name)}} className="min-h-12 rounded-xl bg-[#d8fc55] px-5 py-3 text-sm font-bold text-[#1d1631]" />
              <div className="flex flex-wrap gap-2"><FollowAcademyButton academyId={academy.id} showCount /><AcademyShareButton academy={{name:academy.name,slug,area:academy.area,governorate:academy.governorate}} variant="outline" size="lg" align="start" /></div>
            </aside>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <nav aria-label="Academy sections" className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2 shadow-sm">
          <a href="#groups" className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"><LangLabel en="Training groups" ar="مجموعات التدريب" /></a>
          <a href="#sports" className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"><LangLabel en="Sports" ar="الرياضات" /></a>
          {!!sessions?.length && <a href="#sessions" className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"><LangLabel en="Schedule" ar="المواعيد" /></a>}
          {!!photos?.length && <a href="#photos" className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"><LangLabel en="Photos" ar="الصور" /></a>}
          {!!reviews.length && <a href="#reviews" className="rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"><LangLabel en="Reviews" ar="التقييمات" /></a>}
        </nav>
        <LocationMap name={academy.name} address={[academy.area, academy.governorate, academy.country].filter(Boolean).join(", ")} lat={academy.lat} lng={academy.lng} />

        <section id="groups" className="scroll-mt-24">
          <AcademyTrainingOffers academyId={academy.id} />
        </section>
        {/* Sports */}
        {(sports ?? []).length > 0 && (
          <section id="sports" className="scroll-mt-24 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Trophy className="h-5 w-5 text-primary" />
              <LangLabel en={dictionary.en.public_sports} ar={dictionary.ar.public_sports} />
            </h2>
            <div className="flex flex-wrap gap-2">
              {(sports ?? []).map((s) =>
                // Link only sports Playza actually serves discovery pages for.
                isActiveSport(s.name) ? (
                  <Link
                    key={s.name}
                    href={discoveryPath("en", sportToSlug(s.name))}
                    className="rounded-full border bg-muted/40 px-4 py-1.5 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {s.name}
                  </Link>
                ) : (
                  <span
                    key={s.name}
                    className="rounded-full border bg-muted/40 px-4 py-1.5 text-sm font-medium"
                  >
                    {s.name}
                  </span>
                ),
              )}
            </div>
          </section>
        )}

        {/* Upcoming sessions */}
        {(sessions ?? []).length > 0 && (
          <section id="sessions" className="scroll-mt-24 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
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
          <section id="photos" className="scroll-mt-24 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
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
          <section id="reviews" className="scroll-mt-24 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
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

        {/* Discovery links back to public routes for these sports */}
        <nav
          aria-label="Playza discovery"
          className="flex flex-wrap items-center gap-3 text-sm"
        >
          <Link
            href="/academies"
            className="rounded-xl border bg-card px-4 py-2 font-semibold underline-offset-4 hover:underline"
          >
            <LangLabel en="Explore sports academies" ar="اكتشف الأكاديميات الرياضية" />
          </Link>
          <Link
            href="/games"
            className="rounded-xl border bg-card px-4 py-2 font-semibold underline-offset-4 hover:underline"
          >
            <LangLabel en="Find games to join" ar="لاقي ماتشات تنضم لها" />
          </Link>
        </nav>

        {/* Trial booking */}
        <details className="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
          <summary className="cursor-pointer font-medium"><LangLabel en="Ask the academy about another trial time" ar="اسأل الأكاديمية عن موعد تجريبي آخر" /></summary>
          <p className="my-3 text-sm text-muted-foreground"><LangLabel en="This sends an enquiry; it does not reserve a session or confirm payment." ar="ده استفسار للأكاديمية بس، مش حجز لحصة أو تأكيد للدفع." /></p>
          <TrialForm anchorId="trial-enquiry" academyId={academy.id} sports={sports ?? []} />
        </details>
      </div>
      <MemberBottomNavigation />
    </main>
  );
}
