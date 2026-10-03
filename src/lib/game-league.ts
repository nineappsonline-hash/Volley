export interface GameLeagueTeam { id: string; name: string; players: string[] }
export interface GameLeagueMatch { id: number; round: number; a: string; b: string; score_a: number | null; score_b: number | null }
export interface GameLeague { teams: GameLeagueTeam[]; matches: GameLeagueMatch[]; roster: { id: string; name: string }[]; revision: number }

export function gameLeagueStandings(teams: GameLeagueTeam[], matches: GameLeagueMatch[]) {
  const rows = new Map(teams.map(team => [team.id, { id: team.id, name: team.name, played: 0, won: 0, drawn: 0, lost: 0, scored: 0, conceded: 0, difference: 0, points: 0 }]));
  for (const match of matches) {
    if (match.score_a === null || match.score_b === null) continue;
    const a = rows.get(match.a), b = rows.get(match.b);
    if (!a || !b) continue;
    a.played++; b.played++;
    a.scored += match.score_a; a.conceded += match.score_b;
    b.scored += match.score_b; b.conceded += match.score_a;
    if (match.score_a > match.score_b) { a.won++; a.points += 3; b.lost++; }
    else if (match.score_a < match.score_b) { b.won++; b.points += 3; a.lost++; }
    else { a.drawn++; b.drawn++; a.points++; b.points++; }
  }
  for (const row of rows.values()) row.difference = row.scored - row.conceded;
  return [...rows.values()].sort((a, b) => b.points - a.points || b.difference - a.difference || b.scored - a.scored || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function hasGameStarted(date: string, time: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}` >= `${date}T${time.length === 5 ? time + ':00' : time}`;
}
