"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { gameLeagueStandings, hasGameStarted, type GameLeague, type GameLeagueTeam, type GameLeagueMatch } from "@/lib/game-league";
import { useI18n } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QueryState } from "@/components/shared/query-state";

export function GameTeamsButton({ gameId, date, time, status, canManage }: {
  gameId: string; date: string; time: string; status: string; canManage: boolean;
}) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    setStarted(false);
    if (!canManage || status === "cancelled") return;
    if (hasGameStarted(date, time)) { setStarted(true); return; }
    const timer = window.setInterval(() => {
      if (hasGameStarted(date, time)) { setStarted(true); window.clearInterval(timer); }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [date, time, canManage, status]);
  if (!canManage || !started || status === "cancelled") return null;
  return <>
    <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}><Users className="h-4 w-4" />{lang === "ar" ? "الفرق" : "Teams"}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>{lang === "ar" ? "الفرق ودوري الماتش" : "Teams & game league"}</DialogTitle><DialogDescription>{lang === "ar" ? "قسّم اللاعبين إلى فرق، وأنشئ جدول الدوري وسجّل النتائج." : "Assign players to named teams, generate a league and record results."}</DialogDescription></DialogHeader>
      {open && <GameLeaguePanel gameId={gameId} />}
    </DialogContent></Dialog>
  </>;
}

function GameLeaguePanel({ gameId }: { gameId: string }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const cache = useQueryClient();
  const key = ["game-league", gameId];
  const query = useQuery({ queryKey: key, queryFn: async () => {
    const { data, error } = await createClient().rpc("manage_friendly_game_league", { p_game_id: gameId });
    if (error) throw error;
    return data as GameLeague;
  }, refetchOnWindowFocus: true, refetchInterval: 15000 });
  const [busy, setBusy] = useState(false);
  const save = async (action: string, payload: object, revision: number) => {
    setBusy(true);
    try {
      const { data, error } = await createClient().rpc("manage_friendly_game_league", { p_game_id: gameId, p_action: action, p_revision: revision, p_payload: payload });
      if (error) throw error;
      cache.setQueryData(key, data as GameLeague);
      toast.success(ar ? "تم الحفظ" : "Saved");
      return true;
    } catch (error) {
      toast.error(errorMessage(error, ar ? "تعذّر الحفظ. جرّب تاني." : "Could not save. Please try again."));
      await query.refetch();
      return false;
    } finally { setBusy(false); }
  };
  const league = query.data;
  return <QueryState queries={[query]}>{league && <div className="space-y-6">
    {league.matches.length === 0 ? <TeamSetup key={league.revision} league={league} busy={busy} save={save} /> : <>
      <div className="grid gap-3 sm:grid-cols-2">{league.teams.map(team => <div key={team.id} className="rounded-xl border p-3"><h3 className="font-semibold">{team.name}</h3><p className="mt-1 text-sm text-muted-foreground">{team.players.map(id => league.roster.find(player => player.id === id)?.name ?? (ar ? "لاعب غادر الماتش" : "Player no longer in game")).join(" · ")}</p></div>)}</div>
      <Standings league={league} />
      <Fixtures league={league} busy={busy} save={save} />
    </>}
  </div>}</QueryState>;
}

type Save = (action: string, payload: object, revision: number) => Promise<boolean>;
function TeamSetup({ league, busy, save }: { league: GameLeague; busy: boolean; save: Save }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [teams, setTeams] = useState<GameLeagueTeam[]>(league.teams);
  const dirty = JSON.stringify(teams) !== JSON.stringify(league.teams);
  const assigned = new Set(teams.flatMap(team => team.players));
  const valid = teams.length >= 2 && teams.every(team => team.name.trim() && team.players.length > 0 && team.players.every(id => league.roster.some(player => player.id === id))) && league.roster.every(player => assigned.has(player.id));
  const updateName = (id: string, name: string) => setTeams(current => current.map(team => team.id === id ? { ...team, name } : team));
  const assign = (playerId: string, teamId: string) => setTeams(current => current.map(team => ({ ...team, players: [...team.players.filter(id => id !== playerId), ...(team.id === teamId ? [playerId] : [])] })));
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{ar ? "أضف فريقين على الأقل بأسماء مختلفة، ووزّع كل اللاعبين. لاعبو قائمة الانتظار غير مشمولين." : "Add at least two teams with different names and assign every active player. Waitlisted players are excluded."}</p>
    <fieldset disabled={busy} className="space-y-3">
      {teams.map((team, index) => <div key={team.id} className="flex items-center gap-2"><Input aria-label={`${ar ? "اسم الفريق" : "Team name"} ${index + 1}`} maxLength={60} value={team.name} onChange={event => updateName(team.id, event.target.value)} /><Button variant="ghost" size="icon" aria-label={`${ar ? "حذف الفريق" : "Remove team"} ${team.name}`} onClick={() => setTeams(teams.filter(item => item.id !== team.id))}><Trash2 className="h-4 w-4" /></Button></div>)}
      <Button variant="outline" disabled={teams.length >= 32} onClick={() => setTeams([...teams, { id: crypto.randomUUID(), name: `${ar ? "فريق" : "Team"} ${teams.length + 1}`, players: [] }])}><Plus className="me-2 h-4 w-4" />{ar ? "إضافة فريق" : "Add team"}</Button>
      {!league.roster.length && <p className="text-sm text-muted-foreground">{ar ? "مفيش لاعبين مشاركين في الماتش." : "No active players in this game."}</p>}
      {league.roster.map(player => <label key={player.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><span>{player.name}</span><select className="max-w-full rounded-md border bg-background p-2 text-foreground" value={teams.find(team => team.players.includes(player.id))?.id ?? ""} onChange={event => assign(player.id, event.target.value)}><option value="">{ar ? "بدون فريق" : "Unassigned"}</option>{teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>)}
    </fieldset>
    <p className="text-xs text-muted-foreground">{ar ? "احفظ توزيع الفرق أولاً. بعد إنشاء الجدول لن تتمكن من تغيير الفرق أو اللاعبين." : "Save your teams first. Teams and player assignments lock after generating fixtures."}</p>
    <div className="flex flex-wrap gap-2"><Button disabled={busy || !dirty} onClick={() => save("setup", { teams }, league.revision)}>{ar ? "حفظ الفرق" : "Save teams"}</Button><Button variant="outline" disabled={busy || dirty || !valid} onClick={() => save("generate", {}, league.revision)}>{ar ? "إنشاء جدول الدوري" : "Generate league"}</Button></div>
  </div>;
}

function Standings({ league }: { league: GameLeague }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  return <section className="space-y-2"><h3 className="font-semibold">{ar ? "جدول الترتيب" : "Standings"}</h3><p className="text-xs text-muted-foreground">{ar ? "الفوز 3 نقاط، التعادل نقطة. الترتيب بالنقاط ثم فارق النتيجة ثم مجموع المسجّل ثم الاسم." : "Win: 3 points · Draw: 1. Ranked by points, score difference, score for, then name."}</p><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr>{(ar ? ["الفريق", "لعب", "فاز", "تعادل", "خسر", "له", "عليه", "الفارق", "النقاط"] : ["Team", "Played", "W", "D", "L", "For", "Against", "+/−", "Points"]).map(label => <th key={label} scope="col" className="whitespace-nowrap border-b p-2 text-start">{label}</th>)}</tr></thead><tbody>{gameLeagueStandings(league.teams, league.matches).map(row => <tr key={row.id}><th scope="row" className="border-b p-2 text-start">{row.name}</th>{[row.played, row.won, row.drawn, row.lost, row.scored, row.conceded, row.difference, row.points].map((value, index) => <td key={index} className="border-b p-2 tabular-nums">{value}</td>)}</tr>)}</tbody></table></div></section>;
}

function Fixtures({ league, busy, save }: { league: GameLeague; busy: boolean; save: Save }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const remaining = league.matches.filter(match => match.score_a === null);
  const completed = league.matches.filter(match => match.score_a !== null);
  const name = (id: string) => league.teams.find(team => team.id === id)?.name ?? "—";
  return <section className="space-y-4">
    <div className="rounded-xl bg-primary/10 p-4"><h3 className="font-semibold">{remaining.length ? (ar ? "الماتش الجاي" : "Up next") : (ar ? "اكتمل الدوري" : "League complete")}</h3>{remaining[0] && <p>{name(remaining[0].a)} — {name(remaining[0].b)}</p>}<p className="text-sm text-muted-foreground">{completed.length} / {league.matches.length} {ar ? "ماتشات خلصت" : "matches completed"}</p></div>
    {remaining.length > 0 && <><h3 className="font-semibold">{ar ? "الماتشات المتبقية" : "Remaining matches"} ({remaining.length})</h3>{remaining.map(match => <MatchScore key={`${match.id}-${league.revision}`} match={match} name={name} busy={busy} onSave={(a, b) => save("score", { match_id: match.id, score_a: a, score_b: b }, league.revision)} />)}</>}
    {completed.length > 0 && <details><summary className="cursor-pointer font-semibold">{ar ? "النتائج المسجلة وتعديلها" : "Recorded results & corrections"} ({completed.length})</summary><div className="mt-3 space-y-3">{completed.map(match => <MatchScore key={`${match.id}-${league.revision}`} match={match} name={name} busy={busy} onSave={(a, b) => save("score", { match_id: match.id, score_a: a, score_b: b }, league.revision)} />)}</div></details>}
  </section>;
}

function MatchScore({ match, name, busy, onSave }: { match: GameLeagueMatch; name: (id: string) => string; busy: boolean; onSave: (a: number, b: number) => Promise<boolean> }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [a, setA] = useState(match.score_a?.toString() ?? "");
  const [b, setB] = useState(match.score_b?.toString() ?? "");
  const valid = [a, b].every(value => /^\d{1,4}$/.test(value));
  return <form className="space-y-3 rounded-xl border p-3" onSubmit={event => { event.preventDefault(); if (valid && !busy) void onSave(Number(a), Number(b)); }}>
    <p className="text-xs text-muted-foreground">{ar ? "الجولة" : "Round"} {match.round} · {ar ? "الماتش" : "Match"} {match.id}</p>
    <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm"><span>{name(match.a)}</span><Input aria-label={`${ar ? "نتيجة" : "Score for"} ${name(match.a)}`} type="number" inputMode="numeric" min={0} max={9999} step={1} required value={a} disabled={busy} onChange={event => setA(event.target.value)} /></label><label className="space-y-1 text-sm"><span>{name(match.b)}</span><Input aria-label={`${ar ? "نتيجة" : "Score for"} ${name(match.b)}`} type="number" inputMode="numeric" min={0} max={9999} step={1} required value={b} disabled={busy} onChange={event => setB(event.target.value)} /></label></div>
    <Button size="sm" type="submit" disabled={!valid || busy}>{ar ? "حفظ النتيجة" : "Save score"}</Button>
  </form>;
}
