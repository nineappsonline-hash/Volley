import { AnalyticsView } from "@/components/analytics/business-analytics";
import { LocationMap } from "@/components/shared/location-map";
import { AcademyLogo } from "@/components/academies/academy-logo";
import { AcademyHeroPhoto } from "@/components/academies/academy-hero-photo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Camera, MapPin, MessageSquareText, Star, Trophy, UsersRound, Clock3, ArrowUpRight, Phone, ShieldCheck, Volleyball, Images, GraduationCap, Sparkles } from "lucide-react";
import styles from "./academy-profile.module.css";
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

  const place = [academy.area, academy.governorate, academy.country].filter(Boolean).join(", ");
  const gallery = [
    ...(academy.cover_url ? [{ id: "cover", photo_url: academy.cover_url, caption: academy.name }] : []),
    ...(photos ?? []),
  ];
  const heroImage = academy.cover_url
    || (photos ?? [])[0]?.photo_url
    || "/images/academy-design/sparkle/hero-volleyball.jpg";

  return (
    <main className={styles.profile}>
      <AnalyticsView event="academy_view" id={academy.id} context={{country:academy.country,governorate:academy.governorate,area:academy.area,sports:(sports??[]).map(s=>s.name)}} />
      <AcademyNavigation />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }} />

      <section className={styles.hero} aria-labelledby="academy-name">
        <AcademyHeroPhoto className={styles.heroPhoto} src={heroImage} alt={academy.name} />
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <div className={styles.identity}>
            <div className={styles.avatar}><AcademyLogo academyId={academy.id} name={academy.name} logoUrl={academy.logo_url} /></div>
            <div>
              <span className={styles.kicker}><LangLabel en="SPORTS ACADEMY" ar="أكاديمية رياضية" /></span>
              <h1 id="academy-name">{academy.name}</h1>
            </div>
          </div>
          {place && <p className={styles.heroPlace}><MapPin size={15} />{place}</p>}
          {ratingCount > 0 && <p className={styles.heroRating}><Star size={18} fill="#caff00" /> {avgRating.toFixed(1)} <span>({ratingCount} <LangLabel en="reviews" ar="تقييمات" />)</span></p>}
          {academy.description && <p className={styles.heroDesc}>{academy.description}</p>}
          <div className={styles.heroButtons}>
            <a className={styles.heroPrimary} href="#groups"><UsersRound size={18}/><LangLabel en="Explore training groups" ar="استكشف مجموعات التدريب" /></a>
            <JoinAcademyButton academyId={academy.id} analytics={{country:academy.country,governorate:academy.governorate,area:academy.area,sports:(sports??[]).map(s=>s.name)}} className={styles.heroSecondary} />
            <FollowAcademyButton academyId={academy.id} showCount className={styles.heroSecondary} />
            <AcademyShareButton academy={{name:academy.name,slug,area:academy.area,governorate:academy.governorate}} variant="outline" size="lg" align="start" className={styles.heroSecondary} />
          </div>
        </div>
        <div className={styles.heroHighlights}>
          <span><Volleyball size={18}/><LangLabel en="Sports training" ar="تدريب رياضي" /></span>
          <span><UsersRound size={18}/><LangLabel en="Training groups" ar="مجموعات تدريب" /></span>
          <span><CalendarDays size={18}/><LangLabel en="Flexible scheduling" ar="مواعيد تدريب" /></span>
        </div>
      </section>

      <nav className={styles.tabs} aria-label="Academy page sections">
        <div className={styles.tabsInner}>
          <a className={styles.selectedTab} href="#groups"><UsersRound size={17}/><LangLabel en="Training groups" ar="مجموعات التدريب" /></a>
          <a href="#sports"><Volleyball size={17}/><LangLabel en="Sports" ar="الرياضات" /></a>
          {!!sessions?.length && <a href="#sessions"><CalendarDays size={17}/><LangLabel en="Schedule" ar="المواعيد" /></a>}
          {!!gallery.length && <a href="#photos"><Images size={17}/><LangLabel en="Gallery" ar="الصور" /></a>}
          {!!reviews.length && <a href="#reviews"><Star size={17}/><LangLabel en="Reviews" ar="التقييمات" /></a>}
          <a href="#about"><GraduationCap size={17}/><LangLabel en="About" ar="عن الأكاديمية" /></a>
        </div>
      </nav>

      <div className={styles.body}>
        <div className={styles.workspace}>
          <div className={styles.mainColumn}>
            <section id="groups" className={styles.groups}>
              <AcademyTrainingOffers academyId={academy.id}/>
            </section>

            {(sports??[]).length > 0 && <section id="sports" className={styles.panel}>
              <h2><Volleyball size={21}/><LangLabel en="Sports at this academy" ar="الرياضات المتاحة" /></h2>
              <div className={styles.sportPills}>{(sports??[]).map(s=>isActiveSport(s.name)
                ? <Link key={s.id} href={discoveryPath("en",sportToSlug(s.name))}>{s.name} <ArrowUpRight size={15}/></Link>
                : <span key={s.id}>{s.name}</span>)}</div>
            </section>}

            {(sessions??[]).length > 0 && <section id="sessions" className={styles.panel}>
              <h2><CalendarDays size={21}/><LangLabel en="Upcoming sessions" ar="المواعيد القادمة" /></h2>
              <div className={styles.sessionGrid}>{(sessions??[]).map(s=><div className={styles.session} key={`${s.date}-${s.time}`}>
                <strong>{s.date}</strong><span><Clock3 size={15}/>{formatTime12h(s.time)} {s.location ? ` · ${s.location}` : ""}</span>
              </div>)}</div>
            </section>}

            {!!gallery.length && <section id="photos" className={styles.panel}>
              <h2><Camera size={21}/><LangLabel en="Photos & gallery" ar="الصور والمعرض" /></h2>
              <div className={styles.photoGrid}>{gallery.map(p=><figure key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.photo_url} alt={p.caption||academy.name} loading="lazy"/>
                {p.caption && <figcaption>{p.caption}</figcaption>}
              </figure>)}</div>
            </section>}

            {!!reviews.length && <section id="reviews" className={styles.panel}>
              <h2><MessageSquareText size={21}/><LangLabel en="Academy reviews" ar="تقييمات الأكاديمية" /></h2>
              <div className={styles.reviewList}>{reviews.map(r=><div key={r.id??`${r.created_at}-${r.rating}`} className={styles.review}>
                <div><strong>{(r as {member?:{name?:string}}).member?.name||"—"}</strong><span><Star size={16} fill="#f6bc30"/>{r.rating}/5</span></div>
                <time dir="ltr"><LangLabel en={fmtDate(r.created_at,"en")} ar={fmtDate(r.created_at,"ar")} /></time>
                {r.comment && <p>{r.comment}</p>}
              </div>)}</div>
            </section>}

            <section id="about" className={styles.panel}>
              <h2><GraduationCap size={21}/><LangLabel en="About the academy" ar="عن الأكاديمية" /></h2>
              {academy.description ? <p className={styles.about}>{academy.description}</p>
                : <p className={styles.about}><LangLabel en="Explore this academy's sports, training groups and available booking options." ar="اكتشف الرياضات ومجموعات التدريب وخيارات الحجز المتاحة في الأكاديمية." /></p>}
              <details className={styles.trial}>
                <summary><LangLabel en="Ask about a different trial time" ar="اسأل عن موعد تجريبي مختلف" /></summary>
                <p><LangLabel en="This is an enquiry, not a confirmed booking or payment." ar="ده استفسار فقط، مش حجز مؤكد أو عملية دفع." /></p>
                <TrialForm anchorId="trial-enquiry" academyId={academy.id} sports={sports??[]}/>
              </details>
            </section>
          </div>

          <aside className={styles.sidebar} aria-label="Academy venue and details">
            <div className={styles.sideCard}>
              <div className={styles.sideImage} style={{backgroundImage:`url("${(gallery[0]?.photo_url || heroImage).replace(/["\\]/g,"")}")`}}>
                <span>{academy.name}</span>
              </div>
              <div className={styles.sideLines}>
                {place && <p><MapPin size={19}/>{place}</p>}
                <p><CalendarDays size={19}/><LangLabel en="Training times vary by group" ar="المواعيد حسب مجموعة التدريب" /></p>
                {!!sports?.length && <p><Volleyball size={19}/>{sports.map(s=>s.name).join(" · ")}</p>}
              </div>
              <div className={styles.mapWrap}><LocationMap name={academy.name} address={place} lat={academy.lat} lng={academy.lng}/></div>
              <div className={styles.sideActions}>
                <a href="#groups"><UsersRound size={17}/><LangLabel en="Explore groups" ar="عرض المجموعات" /></a>
                <a href="#trial-enquiry"><Sparkles size={17}/><LangLabel en="Trial enquiry" ar="استفسار عن تجربة" /></a>
              </div>
            </div>
            <p className={styles.sideHint}><ShieldCheck size={18}/><LangLabel en="Choose a training group and check actual prices and dates before booking." ar="اختار مجموعة التدريب وراجع الأسعار والمواعيد الفعلية قبل الحجز." /></p>
          </aside>
        </div>

        <nav className={styles.bottomLinks} aria-label="More Playza destinations">
          <Link href="/academies"><LangLabel en="Explore sports academies" ar="اكتشف أكاديميات تانية" /> <ArrowUpRight size={17}/></Link>
          <Link href="/games"><LangLabel en="Find games to join" ar="دور على ماتشات" /> <ArrowUpRight size={17}/></Link>
        </nav>
      </div>
      <MemberBottomNavigation />
    </main>
  );
}
