import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/marketing/landing";
import type { HomepageCommunityStats, HomepageLeader } from "@/components/marketing/leaderboard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dictionary } from "@/lib/i18n/dictionary";
import {
  OG_IMAGE,
  SITE_URL,
  breadcrumbsJsonLd,
  faqPageJsonLd,
  jsonLdStringify,
  landingFaqItems,
  organizationJsonLd,
  softwareAppJsonLd,
  websiteJsonLd,
} from "@/lib/seo";

async function getHomepageLeaderboard(): Promise<{
  leaders: HomepageLeader[];
  stats: HomepageCommunityStats;
}> {
  const empty = { leaders: [], stats: { games: 0, players: 0, sessions: 0, members: 0 } };
  try {
    const admin = createAdminClient();
    const [{ data: rows }, games, players, sessions, members] = await Promise.all([
      admin
        .from("community_leaderboard")
        .select("member_id, name, username, games_played, sessions_attended, points")
        .order("points", { ascending: false })
        .limit(24),
      admin
        .from("friendly_games")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      admin
        .from("friendly_game_participants")
        .select("id", { count: "exact", head: true }),
      admin
        .from("attendance")
        .select("id", { count: "exact", head: true }),
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("community_visible", true),
    ]);

    if (!rows?.length) return empty;

    const ids = rows.map((r) => r.member_id);
    const avatarMap = new Map<string, string | null>();
    if (ids.length) {
      const { data: avatars } = await admin
        .from("profiles")
        .select("id, avatar_url")
        .in("id", ids);
      for (const row of avatars ?? []) avatarMap.set(row.id, row.avatar_url);
    }

    const leaders: HomepageLeader[] = rows.map((row) => ({
      member_id: row.member_id,
      name: row.name,
      username: row.username,
      avatar_url: avatarMap.get(row.member_id) ?? null,
      games_played: row.games_played,
      sessions_attended: row.sessions_attended,
      points: row.points,
    }));

    return {
      leaders,
      stats: {
        games: games.count ?? 0,
        players: players.count ?? 0,
        sessions: sessions.count ?? 0,
        members: members.count ?? 0,
      },
    };
  } catch (error) {
    console.error("Failed to load homepage leaderboard", error);
    return empty;
  }
}

export const metadata: Metadata = {
  title: "Playza — Sports Academies, Games & Matches in Egypt | Your Place on the Field",
  description:
    "Discover a football, volleyball, basketball, padel or swimming academy near you in Egypt, track your kids' training and progress, and manage your academy from one place: subscriptions, attendance, payments and profits. Playza brings players, parents and academy owners together.",
  keywords: [
    // English
    "sports academy management",
    "academy management software",
    "football academy Egypt",
    "volleyball academy",
    "padel academy",
    "friendly football matches",
    "find sports academy",
    // Egypt local intent (Arabic)
    "أكاديميات رياضية في مصر",
    "أكاديمية كرة قدم في القاهرة",
    "أكاديمية كرة قدم للأطفال",
    "مدرب كرة قدم للأطفال",
    "أكاديمية كرة طائرة مصر",
    "أكاديمية بادل مصر",
    "حجز ماتش كرة قدم",
    "لعب كرة القدم",
    "ماتشات ودية",
    "تدريب رياضي للأطفال",
    "جيم ودية",
    "إيجار ملعب",
    // Management-intent (owners)
    "برنامج إدارة أكاديمية",
    "نظام إدارة أكاديمية رياضية",
    "إدارة اشتراكات الأكاديمية",
    "نظام حضور وغياب",
    "تتبع أرباح الأكاديمية",
    "إدارة المدفوعات",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Playza — Your Place on the Field",
    description:
      "Play, track your progress, follow your kids' training, or manage your academy. Discover schedules, attendance, feedback and friendly games with Playza.",
    url: SITE_URL,
    siteName: "Playza",
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: "en_US",
    alternateLocale: ["ar_EG"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Playza — Your Place on the Field",
    description:
      "Playza brings your sports journey together: academies, friendly matches, attendance, subscriptions and player progress tracking.",
    images: [OG_IMAGE],
  },
};

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  // The FAQ lives in the client i18n dictionary; schema.org needs it at build
  // time, so read both languages from the dictionary directly.
  const faqEn: [string, string][] = [
    [dictionary.en.landing_faq1_q, dictionary.en.landing_faq1_a],
    [dictionary.en.landing_faq2_q, dictionary.en.landing_faq2_a],
    [dictionary.en.landing_faq3_q, dictionary.en.landing_faq3_a],
    [dictionary.en.landing_faq4_q, dictionary.en.landing_faq4_a],
  ];

  const { leaders, stats } = await getHomepageLeaderboard();

  const jsonLd = [
    organizationJsonLd(),
    websiteJsonLd(),
    softwareAppJsonLd(),
    // Only the visible (default English) FAQ qualifies for the rich result;
    // Arabic is emitted in-session when the user toggles language.
    faqPageJsonLd(landingFaqItems(faqEn)),
    breadcrumbsJsonLd([{ name: "Home", url: SITE_URL }]),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdStringify({ "@graph": jsonLd }) }}
      />
      <LandingPage leaders={leaders} stats={stats} />
    </>
  );
}
