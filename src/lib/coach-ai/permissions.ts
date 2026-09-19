import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface StaffScope {
  userId: string;
  academyId: string;
  role: string;
  isAdmin: boolean;
  isCoach: boolean;
  /** Coach staff record ids (coaches.profile_id = userId). */
  coachIds: string[];
  /** Team ids this coach is linked to (empty for admins → "all teams"). */
  teamIds: string[];
  /** Player ids linked to the coach (empty for admins → "all players"). */
  playerIds: string[];
}

/**
 * Resolves the caller's staff scope for the AI Coach / Insights modules.
 * Admins get academy-wide access; coaches are restricted to their teams.
 * Throws with a message when the caller is outside the academy.
 */
export async function resolveStaffScope(
  supabase: SupabaseClient
): Promise<StaffScope> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Unauthorized");
  }
  const userId = user.id;

  const profile = await supabase
    .from("profiles")
    .select("id, role, academy_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile.data || profile.error || !profile.data.academy_id) {
    throw new Error("No academy affiliation");
  }

  const academyId = profile.data.academy_id;
  const role = profile.data.role;
  const isAdmin = role === "admin";

  if (role !== "admin" && role !== "member") {
    throw new Error("Forbidden");
  }

  const coachIds: string[] = [];
  const teamIds: string[] = [];
  const playerIds: string[] = [];

  if (!isAdmin) {
    const admin = createAdminClient();
    const coaches = await admin
      .from("coaches")
      .select("id, teams(id)")
      .eq("profile_id", userId)
      .eq("academy_id", academyId)
      .eq("is_active", true);

    const coachRows = (coaches.data ?? []) as {
      id: string;
      teams: { id: string }[] | null;
    }[];
    for (const c of coachRows) {
      coachIds.push(c.id);
      for (const t of c.teams ?? []) teamIds.push(t.id);
    }

    // Mirror the SQL helper current_coach_player_ids(): a coach manages the
    // players on their assigned teams. player_development_plans.coach_id
    // stores a profile id (not a coaches.id), so it cannot scope the roster.
    if (teamIds.length > 0) {
      const players = await admin
        .from("team_members")
        .select("member_id")
        .in("team_id", teamIds);
      playerIds.push(...(players.data ?? []).map((p) => p.member_id as string));
    }

    if (coachIds.length === 0) {
      // A member with no active staff record is not academy staff.
      throw new Error("Forbidden");
    }
  }

  return { userId, academyId, role, isAdmin, isCoach: !isAdmin, coachIds, teamIds, playerIds };
}