import { estimateHostTotal, estimateSharePrice } from "@/lib/game-costs";
import { getBillablePlayers } from "@/lib/constants";
import { isActiveSport } from "@/lib/active-sports";
import { createAdminClient } from "@/lib/supabase/admin";
import type { VenueBlockedDate, VenueUnavailableSlot } from "@/lib/types";

/**
 * Server-only public reads for the shareable playground page (/p/<id>).
 *
 * RLS restricts `venues` reads and `friendly_games` reads to authenticated
 * users, so this page uses the admin client — the same pattern as the public
 * academy page (/a/<slug>) and the /games AND /tournaments listings — with
 * strict scoping to what is genuinely public:
 * - the venue itself (only approved playgrounds go live)
 * - upcoming public games hosted there (used to show bookable times)
 *
 * Every function here is best-effort: on any failure (missing service key on
 * preview deploys, DB unreachable, bad env) it returns empty results so the
 * public page renders its "no data" state instead of a 500.
 *
 * Never import this module from a Client Component.
 */

export type PublicPlayground = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  capacity: number | null;
  sport_id: string | null;
  school_name: string | null;
  rental_cost: null;
  booking_price?: {per_player:number;full_court:number;minimum_players:number;hours:number}|null;
  rental_hours: number | null;
  location_link: string | null;
  photos: string[];
  cover_url: string | null;
  country: string | null;
  governorate: string | null;
  area: string | null;
  unavailable_slots: VenueUnavailableSlot[] | null;
  working_hours: VenueUnavailableSlot[] | null;
  blocked_dates: VenueBlockedDate[] | null;
  court_count: number | null;
  court_availability?: (VenueUnavailableSlot & {court_number:number})[];
  /** Matches the `Venue` shape so it can be passed straight into the shared
   * booking dialog / availability helpers. */
  created_at: string;
  sport: { id: string; name: string } | null;
};

/** A review with the reviewer's display name already resolved. */
export type PublicPlaygroundReview = {
  id: string;
  member_name: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};

/** An upcoming public game at the venue, for availability + "here soon". */
export type PublicPlaygroundGame = {
  id: string;
  title: string;
  game_date: string;
  start_time: string;
  duration_hours: number;
  court_number: number | null;
  invite_code: string | null;
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

/** Resolution metadata used by the SEO page and the booking island. */
export type PublicPlaygroundResolved = {
  venue: PublicPlayground;
  games: PublicPlaygroundGame[];
  rating: { avg: number; count: number };
  reviews: PublicPlaygroundReview[];
};

/** Approved playground by id, or null. Sharing a rejected/pending venue 404s. */
export async function getPublicPlayground(
  id: string
): Promise<PublicPlayground | null> {
  const admin = getAdmin();
  if (!admin || !id) return null;
  try {
    const { data, error } = await admin
      .from("venues")
      .select(
        `id, name, address, lat, lng, capacity, sport_id, school_name,
         rental_cost, rental_hours, location_link, photos, cover_url,
         country, governorate, area, unavailable_slots, working_hours,
         blocked_dates, court_count, court_availability, created_at, sport:sports(id, name)`
      )
      .eq("id", id)
      .eq("approval_status", "approved")
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as PublicPlayground & {
      sport?: { id: string; name: string } | { id: string; name: string }[] | null;
    };
    const resolvedSport = Array.isArray(row.sport) ? row.sport[0] ?? null : row.sport;
    const share = estimateSharePrice(data.rental_cost, 1, 2, resolvedSport?.name ?? "");
    const full = estimateHostTotal(data.rental_cost, 1, resolvedSport?.name ?? "");
    return {
      ...data, rental_cost: null,
      booking_price: share && full ? {per_player:share.total,full_court:full.total,minimum_players:getBillablePlayers(resolvedSport?.name??"",2),hours:1} : null,
      sport: Array.isArray(row.sport) ? (row.sport[0] ?? null) : (row.sport ?? null),
    } as PublicPlayground;
  } catch {
    return null;
  }
}

/** Upcoming public friendly games hosted at one playground, newest first. */
export async function getPublicPlaygroundGames(
  venueId: string
): Promise<PublicPlaygroundGame[]> {
  const admin = getAdmin();
  if (!admin || !venueId) return [];
  try {
    const { data, error } = await admin
      .from("friendly_games")
      .select("id, title, game_date, start_time, duration_hours, court_number, invite_code")
      .eq("playground_id", venueId)
      .eq("is_public", true)
      .neq("status", "cancelled")
      .neq("status", "completed")
      .gte("game_date", todayISO())
      .order("game_date")
      .order("start_time")
      .limit(50);
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/** Reviews (with resolved member names) and the rating summary for a venue. */
export async function getPublicPlaygroundReviews(
  venueId: string
): Promise<{ rating: { avg: number; count: number }; reviews: PublicPlaygroundReview[] }> {
  const admin = getAdmin();
  if (!admin || !venueId) return { rating: { avg: 0, count: 0 }, reviews: [] };
  try {
    const { data, error } = await admin
      .from("playground_ratings")
      .select("id, rating, comment, created_at, member:profiles(name)")
      .eq("venue_id", venueId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { rating: { avg: 0, count: 0 }, reviews: [] };
    const reviews = (data ?? []).map((r) => {
      const row = r as {
        id: string;
        rating: number;
        comment: string | null;
        created_at: string;
        member?: { name?: string } | { name?: string }[] | null;
      };
      const member = Array.isArray(row.member) ? (row.member[0] ?? null) : (row.member ?? null);
      return {
        id: row.id,
        member_name: member?.name ?? null,
        rating: row.rating,
        comment: row.comment,
        created_at: row.created_at,
      };
    });
    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    return {
      rating: {
        avg: reviews.length ? total / reviews.length : 0,
        count: reviews.length,
      },
      reviews,
    };
  } catch {
    return { rating: { avg: 0, count: 0 }, reviews: [] };
  }
}

/** One-shot loader for the public playground page: venue + games + reviews. */
export async function resolvePublicPlayground(
  id: string
): Promise<PublicPlaygroundResolved | null> {
  const [venue, games, reviews] = await Promise.all([
    getPublicPlayground(id),
    getPublicPlaygroundGames(id),
    getPublicPlaygroundReviews(id),
  ]);
  if (!venue) return null;
  return { venue, games, rating: reviews.rating, reviews: reviews.reviews };
}
/** Small allowlisted projection for crawlable court discovery; never owner/member data. */
export type PublicCourt = Pick<PublicPlayground, "id" | "name" | "address" | "country" | "governorate" | "area" | "booking_price" | "rental_hours" | "capacity" | "court_count" | "cover_url" | "photos"> & { sport: { name: string } | null };

export async function getPublicCourtDirectory(sport?: string): Promise<PublicCourt[]> {
  const admin = getAdmin();
  if (!admin) return [];
  const courts: PublicCourt[] = [];
  try {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.from("venues")
        .select("id, name, address, country, governorate, area, rental_cost, rental_hours, capacity, court_count, cover_url, photos, sport:sports(name)")
        .eq("approval_status", "approved")
        .in("country", ["Egypt", "مصر"])
        .order("name").order("id")
        .range(offset, offset + 999);
      if (error) break;
      for (const row of data ?? []) {
        const joined = row.sport as { name: string } | { name: string }[] | null;
        const resolved = Array.isArray(joined) ? joined[0] ?? null : joined;
        if (!isActiveSport(resolved?.name)) continue;
        if (sport && resolved?.name.toLowerCase() !== sport.toLowerCase()) continue;
        courts.push({ id: row.id, name: row.name, address: row.address, country: row.country,
          governorate: row.governorate, area: row.area,
          booking_price: row.rental_cost == null || !Number.isFinite(row.rental_cost) || row.rental_cost < 0 ? null : {per_player:estimateSharePrice(row.rental_cost,1,2,resolved?.name??"")!.total,
            full_court:estimateHostTotal(row.rental_cost,1,resolved?.name??"")!.total,minimum_players:getBillablePlayers(resolved?.name??"",2),hours:1},
          rental_hours: row.rental_hours, capacity: row.capacity, court_count: row.court_count,
          cover_url: row.cover_url, photos: row.photos ?? [], sport: resolved });
      }
      if (!data || data.length < 1000) break;
    }
  } catch { /* Return completed batches if a later request fails. */ }
  return courts;
}
