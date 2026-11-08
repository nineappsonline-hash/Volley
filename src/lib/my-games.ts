import type { SupabaseClient } from "@supabase/supabase-js";
import type { FriendlyGameWithDetails } from "./types";

const details = "*, participants:friendly_game_participants(id, game_id, sponsor_participant_id, member_id, role, player_name, is_waitlisted, share_amount, pay_status, joined_at, kickoff_remind_opt_in), rent_payments:friendly_game_rent_payments(amount, member_id, pay_status, created_at), playground:venues(name, country, area, governorate, address, lat, lng, location_link, photos, cover_url)";

/** RLS remains in force; neither discovery's date cutoff nor its 200-game cap applies. */
export async function fetchMyGames(client: SupabaseClient, memberId: string): Promise<FriendlyGameWithDetails[]> {
  const load = async (joined: boolean) => {
    const rows: FriendlyGameWithDetails[] = [];
    for (let offset = 0; ; offset += 100) {
      let query = client.from("friendly_games").select(joined ? `${details}, membership:friendly_game_participants!inner(member_id)` : details);
      query = joined ? query.eq("membership.member_id", memberId) : query.eq("creator_id", memberId);
      const { data, error } = await query.order("id").range(offset, offset + 99);
      if (error) throw error;
      rows.push(...(data ?? []) as unknown as FriendlyGameWithDetails[]);
      if ((data?.length ?? 0) < 100) break;
    }
    return rows;
  };
  const [created, joined] = await Promise.all([load(false), load(true)]);
  const unique = new Map([...created, ...joined].map(game => [game.id, game]));
  return [...unique.values()].map(game => {
    const participants = game.participants ?? [];
    return { ...game, participants, participants_count: participants.filter(p => !p.is_waitlisted && p.pay_status === "approved").length, waitlist_count: participants.filter(p => p.is_waitlisted).length, rent_payments: game.rent_payments ?? [] };
  }).sort((a, b) => `${b.game_date} ${b.start_time}`.localeCompare(`${a.game_date} ${a.start_time}`));
}
