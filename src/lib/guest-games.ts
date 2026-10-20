import type { PublicGame } from "./public-games";
import type { FriendlyGameWithDetails } from "./types";

/** Display-only card shape. Identity, invitations, payments and rosters are never included. */
export function guestGameCard(game: PublicGame): FriendlyGameWithDetails {
  return {
    id: game.id, creator_id: "", creator_name: game.creator_name, creator_username: null, creator_nickname: null,
    sport: game.sport, title: game.title, description: game.description, area: game.area, location: game.location,
    lat: null, lng: null, playground_id: null,
    playground: game.playground ? { name: game.playground.name, area: game.playground.area, governorate: game.playground.governorate, country: game.playground.country, address: null, lat: null, lng: null, location_link: game.playground.location_link ?? null, photos: game.playground.photos ?? [], cover_url: game.playground.cover_url ?? null } : null,
    game_date: game.game_date, start_time: game.start_time, max_players: game.max_players, min_players: game.min_players,
    duration_hours: game.duration_hours ?? 1, booking_total: game.booking_total, playground_hourly_rate: null,
    skill_level: ["beginner", "intermediate", "advanced"].includes(game.skill_level ?? "") ? game.skill_level as FriendlyGameWithDetails["skill_level"] : null,
    is_public: true, status: game.status === "full" ? "full" : "open", recurrence: null, source_game_id: null,
    result_a: null, result_b: null, completed_by: null, completed_at: null,
    share_price: game.share_price, host_pays: !!game.host_pays, host_total: null, invite_code: null,
    gender: game.gender === "male" || game.gender === "female" ? game.gender : "mixed",
    min_age: game.min_age ?? null, max_age: game.max_age ?? null, created_at: "",
    participants_count: game.joined, waitlist_count: 0, participants: [], rent_payments: [],
  };
}
