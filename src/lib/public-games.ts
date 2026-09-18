import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-only public reads for the SEO landing pages (/games, /tournaments).
 *
 * RLS restricts `friendly_games` reads to authenticated users and `tournaments`
 * reads to academy members, so these server pages use the admin client — the
 * same pattern as the public academy page (/a/[slug]) — with strict scoping to
 * what is genuinely public:
 * - games: is_public, upcoming, not cancelled/completed
 * - tournaments: hosted by a public academy
 *
 * Every function here is best-effort: on any failure (missing service key on
 * preview deploys, DB unreachable, bad env) it returns empty results so the
 * public pages render their "no data" state instead of a 500.
 *
 * Never import this module from a Client Component.
 */

export type PublicGame = {
  host_pays?: boolean;
  host_total?: number | null;
  id: string;
  title: string;
  description: string | null;
  sport: string;
  area: string | null;
  location: string | null;
  game_date: string;
  start_time: string;
  max_players: number;
  min_players: number;
  status: string;
  skill_level: string | null;
  gender: string;
  share_price: number | null;
  creator_name: string;
  playground: { name: string | null; area: string | null; governorate: string | null } | null;
  joined: number;
};

export type PublicTournament = {
  id: string;
  name: string;
  description: string | null;
  prize: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  participant_fee: number | null;
  max_participants: number | null;
  participant_count: number;
  venue: { name: string | null; area: string | null; governorate: string | null } | null;
  status: string;
  sport: string | null;
  academy: { name: string; slug: string | null; area: string | null; governorate: string | null } | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function getAdmin() {
  try {
    return createAdminClient();
  } catch {
    // Service key not configured (e.g. preview deploys). Pages render their
    // empty state; nothing else in the app depends on it at request time.
    return null;
  }
}

/** Upcoming public friendly games, optionally filtered by sport. */
export async function getPublicGames(sport?: string): Promise<PublicGame[]> {
  const admin = getAdmin();
  if (!admin) return [];
  let query = admin
    .from("friendly_games")
    .select(
      `id, title, description, sport, area, location, game_date, start_time,
       max_players, min_players, status, skill_level, gender, share_price, host_pays, host_total,
       creator_name, playground:venues(name, area, governorate),
       participants:friendly_game_participants(count)`
    )
    .eq("is_public", true)
    .neq("status", "cancelled")
    .neq("status", "completed")
    .gte("game_date", todayISO())
    .order("game_date")
    .order("start_time")
    .limit(100);

  if (sport) query = query.eq("sport", sport);

  try {
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []).map((g: Record<string, unknown>) => {
      const parts = g.participants as { count?: number }[] | null;
      const row = g as unknown as PublicGame & { playground: PublicGame["playground"] };
      return {
        ...row,
        playground: Array.isArray(g.playground) ? (g.playground[0] ?? null) : row.playground,
        joined: Number(parts?.[0]?.count ?? 0),
      };
    });
  } catch {
    return [];
  }
}

/**
 * Server-only lookup of a single game by its shareable invite code.
 * Powers the rich link preview (metadata + OG image) for shared game links.
 */
export type SharedGameMeta = {
  status: string;
  id: string;
  title: string;
  description: string | null;
  sport: string;
  area: string | null;
  location: string | null;
  governorate: string | null;
  game_date: string;
  start_time: string;
  max_players: number;
  joined: number;
  share_price: number | null;
  host_pays: boolean;
  host_total: number | null;
  is_public: boolean;
  creator_name: string;
  map_label: string;
  participants: { id: string; player_name: string; is_waitlisted: boolean }[];
};

export async function getGameByInviteCode(code: string): Promise<SharedGameMeta | null> {
  noStore();
  const admin = getAdmin();
  if (!admin || !code) return null;
  try {
    const { data, error } = await admin
      .from("friendly_games")
      .select(
        `id, title, description, sport, area, location, game_date, start_time,
         max_players, status, share_price, host_pays, host_total, is_public, creator_name,
         playground:venues(name, area, governorate),
         participants:friendly_game_participants(id, player_name, is_waitlisted)`
      )
      .eq("invite_code", code.trim().toUpperCase())
      .neq("status", "cancelled")
      .limit(1)
      .single();
    if (error || !data) return null;
    const row = data as unknown as {
      participants?: SharedGameMeta["participants"] | null;
      playground?: PublicGame["playground"] | NonNullable<PublicGame["playground"]>[];
    };
    const playground = Array.isArray(row.playground) ? row.playground[0] ?? null : row.playground;
    const meta: SharedGameMeta = {
      status: data.status,
      id: data.id,
      title: data.title,
      description: data.description,
      sport: data.sport,
      area: data.area,
      location: data.location,
      governorate: playground?.governorate ?? null,
      game_date: data.game_date,
      start_time: data.start_time,
      max_players: data.max_players,
      joined: (row.participants ?? []).filter(p => !p.is_waitlisted).length,
      participants: row.participants ?? [],
      share_price: data.share_price,
      host_pays: data.host_pays,
      host_total: data.host_total,
      is_public: data.is_public,
      creator_name: data.creator_name,
      map_label:
        [playground?.name, playground?.area ?? data.area, playground?.governorate]
          .filter(Boolean)
          .join(", ") ||
        data.location ||
        data.area ||
        data.title,
    };
    return meta;
  } catch {
    return null;
  }
}

/** Distinct sports that currently have upcoming public games. */
export async function getPublicGameSports(): Promise<string[]> {
  const admin = getAdmin();
  if (!admin) return [];
  try {
    const { data, error } = await admin
      .from("friendly_games")
      .select("sport")
      .eq("is_public", true)
      .neq("status", "cancelled")
      .neq("status", "completed")
      .gte("game_date", todayISO())
      .limit(1000);
    if (error) return [];
    return [...new Set((data ?? []).map((r: { sport: string }) => r.sport))].sort();
  } catch {
    return [];
  }
}

/** Tournaments hosted by public academies, optionally filtered by sport name. */
export async function getPublicTournaments(sport?: string): Promise<PublicTournament[]> {
  const admin = getAdmin();
  if (!admin) return [];
  let query = admin
    .from("tournaments")
    .select(
      `id, name, description, prize, start_date, end_date, start_time, end_time,
       participant_fee, max_participants,
       sport:sports(name),
       venue:venues(name, area, governorate),
       participants:tournament_participants(count),
       academy:academies!inner(id, name, slug, area, governorate, is_public)`
    )
    .eq("academies.is_public", true)
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(100);

  if (sport) query = query.eq("sports.name", sport);

  try {
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []).map((t: Record<string, unknown>) => {
      const row = t as unknown as PublicTournament & {
        sport: { name: string } | null;
        venue: PublicTournament["venue"];
        participants: { count?: number }[] | null;
        academy: PublicTournament["academy"];
      };
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        prize: row.prize,
        start_date: row.start_date,
        end_date: row.end_date,
        start_time: row.start_time,
        end_time: row.end_time,
        participant_fee: row.participant_fee,
        max_participants: row.max_participants,
        participant_count: Number(row.participants?.[0]?.count ?? 0),
        venue: Array.isArray(row.venue) ? (row.venue[0] ?? null) : (row.venue ?? null),
        status: row.status,
        sport: row.sport?.name ?? null,
        academy: row.academy,
      };
    });
  } catch {
    return [];
  }
}

/** Distinct sports that currently have public tournaments. */
export async function getPublicTournamentSports(): Promise<string[]> {
  const admin = getAdmin();
  if (!admin) return [];
  try {
    const { data, error } = await admin
      .from("tournaments")
      .select("sport:sports(name), academies!inner(is_public)")
      .eq("academies.is_public", true)
      .limit(1000);
    if (error) return [];
    const set = new Set<string>();
    for (const row of data ?? []) {
      const r = row as unknown as { sport: { name: string } | null };
      if (r.sport?.name) set.add(r.sport.name);
    }
    return [...set].sort();
  } catch {
    return [];
  }
}
