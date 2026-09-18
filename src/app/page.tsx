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

// Fallback demo data so the public landing shows a lively leaderboard with
// Egyptian players before the community has real activity to rank. It stays on
// screen until real leaderboard records outnumber the demo rows.
const FAKE_LEADERS: HomepageLeader[] = [
  { member_id: "demo-ahmed", name: "Ahmed Nabil", username: "ahmednabil", avatar_id: "char-07", avatar_url: null, games_played: 87, sessions_attended: 64, points: 320 },
  { member_id: "demo-omar", name: "Omar Farouk", username: "omar.farouk", avatar_id: "char-03", avatar_url: null, games_played: 91, sessions_attended: 41, points: 305 },
  { member_id: "demo-karim", name: "Karim El-Sayed", username: "karim.elsayed", avatar_id: "char-11", avatar_url: null, games_played: 76, sessions_attended: 38, points: 272 },
  { member_id: "demo-youssef", name: "Youssef Hany", username: "youssef.hany", avatar_id: "char-15", avatar_url: null, games_played: 68, sessions_attended: 55, points: 251 },
  { member_id: "demo-mostafa", name: "Mostafa Magdy", username: "mostafamagdy", avatar_id: "char-02", avatar_url: null, games_played: 63, sessions_attended: 30, points: 228 },
  { member_id: "demo-mahmoud", name: "Mahmoud Tarek", username: "mahmoud.tarek", avatar_id: "char-09", avatar_url: null, games_played: 52, sessions_attended: 47, points: 214 },
  { member_id: "demo-ali", name: "Ali Hassan", username: "ali.hassan", avatar_id: "char-19", avatar_url: null, games_played: 49, sessions_attended: 26, points: 189 },
  { member_id: "demo-mohamed", name: "Mohamed Adel", username: "mohamedadel", avatar_id: "char-04", avatar_url: null, games_played: 44, sessions_attended: 33, points: 172 },
];

const FAKE_STATS: HomepageCommunityStats = {
  games: 1240,
  players: 3080,
  sessions: 865,
  members: 4870,
};

async function getHomepageLeaderboard(): Promise<{
  leaders: HomepageLeader[];
  stats: HomepageCommunityStats;
}> {
  try {
    const admin = createAdminClient();
    const [{ data: rows }, games, players, sessions, members] = await Promise.all([
      admin
        .from("community_leaderboard")
        .select("member_id, name, username, avatar_id, games_played, sessions_attended, points")
        .order("points", { ascending: false })
        .limit(10),
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

    // The view includes every community-visible profile (even with zero games
    // or sessions). Only members with real activity count as "real" leaderboard
    // records — demo data wins until those outnumber the fake rows.
    const activeRows = (rows ?? []).filter(
      (r) => r.points > 0 || r.games_played > 0 || r.sessions_attended > 0
    );

    if (!activeRows.length || activeRows.length <= FAKE_LEADERS.length)
      return { leaders: FAKE_LEADERS, stats: FAKE_STATS };

    const ids = activeRows.map((r) => r.member_id);
    const avatarMap = new Map<string, string | null>();
    if (ids.length) {
      const { data: avatars } = await admin
        .from("profiles")
        .select("id, avatar_url")
        .in("id", ids);
      for (const row of avatars ?? []) avatarMap.set(row.id, row.avatar_url);
    }

    const leaders: HomepageLeader[] = activeRows.map((row) => ({
      member_id: row.member_id,
      name: row.name,
      username: row.username,
      avatar_id: row.avatar_id,
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
    return { leaders: FAKE_LEADERS, stats: FAKE_STATS };
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
