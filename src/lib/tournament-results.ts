import type { TournamentMatch, TournamentStanding } from "@/lib/types";

/**
 * Round-robin standings used by the league view.
 * Same rules as the tournament runner: 3 points for a win, 1 for a draw;
 * tie-broken by goal difference then goals for then name.
 */
export function computeLeagueStandings(
  matches: TournamentMatch[],
  teams: { id: string; name: string }[]
): TournamentStanding[] {
  const rows = new Map<string, TournamentStanding>();
  for (const tm of teams) {
    rows.set(tm.id, {
      team_id: tm.id,
      name: tm.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      goal_diff: 0,
      points: 0,
    });
  }
  for (const m of matches) {
    if (m.status !== "completed" || m.score_a == null || m.score_b == null) continue;
    if (!m.team_a_id || !m.team_b_id) continue;
    const a = rows.get(m.team_a_id);
    const b = rows.get(m.team_b_id);
    if (!a || !b) continue;
    const ga = m.goals_a ?? m.score_a;
    const gb = m.goals_b ?? m.score_b;
    a.played += 1;
    b.played += 1;
    a.goals_for += ga;
    a.goals_against += gb;
    b.goals_for += gb;
    b.goals_against += ga;
    if (m.score_a > m.score_b) {
      a.won += 1;
      b.lost += 1;
      a.points += 3;
    } else if (m.score_a < m.score_b) {
      b.won += 1;
      a.lost += 1;
      b.points += 3;
    } else {
      a.drawn += 1;
      b.drawn += 1;
      a.points += 1;
      b.points += 1;
    }
  }
  for (const r of rows.values()) r.goal_diff = r.goals_for - r.goals_against;
  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.goal_diff - x.goal_diff ||
      y.goals_for - x.goals_for ||
      x.name.localeCompare(y.name)
  );
}

/** Bracket depth of every match: round 1 = 1, the final has the max. */
export function matchDepths(matches: TournamentMatch[]): Map<string, number> {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const memo = new Map<string, number>();
  const depth = (id: string | null): number => {
    if (!id) return 0;
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const m = byId.get(id);
    if (!m) return 0;
    const d = 1 + Math.max(depth(m.prev_match_a_id), depth(m.prev_match_b_id));
    memo.set(id, d);
    return d;
  };
  for (const m of matches) depth(m.id);
  return memo;
}

export interface RemainingOpponent {
  team_id: string;
  name: string;
}

export interface RemainingGames {
  team_id: string;
  name: string;
  count: number;
  opponents: RemainingOpponent[];
}

/**
 * For a single round-robin league: how many fixtures each team still has to
 * play (scheduled, not completed/canceled) and which opponents remain.
 * Teams that never got paired against an opponent (e.g. fewer than 2 real
 * matchups scheduled) report zero remaining games.
 */
export function computeRemainingGames(
  matches: TournamentMatch[],
  teams: { id: string; name: string }[]
): RemainingGames[] {
  const nameById = new Map(teams.map((tm) => [tm.id, tm.name]));

  const upcoming = matches.filter(
    (m) =>
      m.status === "scheduled" &&
      m.team_a_id &&
      m.team_b_id
  );

  const byTeam = new Map<string, Set<string>>();
  for (const m of upcoming) {
    const a = m.team_a_id!;
    const b = m.team_b_id!;
    if (!byTeam.has(a)) byTeam.set(a, new Set());
    if (!byTeam.has(b)) byTeam.set(b, new Set());
    byTeam.get(a)!.add(b);
    byTeam.get(b)!.add(a);
  }

  return teams.map((tm) => {
    const oppIds = [...(byTeam.get(tm.id) ?? [])];
    return {
      team_id: tm.id,
      name: tm.name,
      count: oppIds.length,
      opponents: oppIds
        .map((id) => ({ team_id: id, name: nameById.get(id) ?? "?" }))
        .sort((x, y) => x.name.localeCompare(y.name)),
    };
  });
}