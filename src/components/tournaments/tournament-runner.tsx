"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ListPlus,
  Pencil,
  Play,
  Plus,
  Shuffle,
  Trash2,
  Trophy,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { cn, errorMessage } from "@/lib/utils";
import {
  useAddTournamentParticipants,
  useAddTournamentTeamMembers,
  useCreateTournamentTeam,
  useDeleteTournamentTeam,
  useGenerateTournamentFixtures,
  useProfiles,
  useRemoveTournamentParticipant,
  useRemoveTournamentTeamMember,
  useRenameTournamentTeam,
  useSubmitTournamentScore,
  useTournamentParticipants,
  useTournamentTeams,
} from "@/lib/queries";
import type {
  TournamentMatch,
  TournamentStanding,
  TournamentTeamWithMembers,
  TournamentWithMatches,
} from "@/lib/types";

const displayName = (
  p: { name: string; nickname: string | null; username: string | null } | null | undefined
) => (p ? p.nickname?.trim() || p.name : "?");

/** Full runner for one tournament: pool → teams → fixtures → results. */
export function TournamentRunner({ tournament }: { tournament: TournamentWithMatches }) {
  const { t, lang } = useI18n();
  const { data: participants } = useTournamentParticipants(tournament.id);
  const { data: teams } = useTournamentTeams(tournament.id);
  const { data: profiles } = useProfiles();

  const addParticipants = useAddTournamentParticipants();
  const removeParticipant = useRemoveTournamentParticipant();
  const createTeam = useCreateTournamentTeam();
  const renameTeam = useRenameTournamentTeam();
  const deleteTeam = useDeleteTournamentTeam();
  const addTeamMembers = useAddTournamentTeamMembers();
  const removeTeamMember = useRemoveTournamentTeamMember();
  const submitScore = useSubmitTournamentScore();
  const generateFixtures = useGenerateTournamentFixtures();

  const [poolOpen, setPoolOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [assignTeam, setAssignTeam] = useState<TournamentTeamWithMembers | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeamName, setEditingTeamName] = useState<string | null>(null);
  const [teamNameDraft, setTeamNameDraft] = useState("");
  const [scoreMatch, setScoreMatch] = useState<TournamentMatch | null>(null);
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");

  const teamName = useMemo(
    () => new Map((teams ?? []).map((tm) => [tm.id, tm.name])),
    [teams]
  );

  const standings: TournamentStanding[] = useMemo(() => {
    if (tournament.format !== "league") return [];
    const rows = new Map<string, TournamentStanding>();
    for (const tm of teams ?? []) {
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
    for (const m of tournament.tournament_matches) {
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
  }, [tournament.format, tournament.tournament_matches, teams]);

  // Knockout: the next matches that still need a score, then scheduled ones.
  const upNext = useMemo(
    () =>
      tournament.tournament_matches
        .filter((m) => m.status === "scheduled")
        .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)),
    [tournament.tournament_matches]
  );

  const participantIds = useMemo(
    () => new Set((participants ?? []).map((p) => p.member_id)),
    [participants]
  );
  const assignedIds = useMemo(
    () => new Set((teams ?? []).flatMap((tm) => tm.members.map((m) => m.member_id))),
    [teams]
  );

  const memberLabel = (id: string) => {
    const p = (profiles ?? []).find((x) => x.id === id);
    return p ? p.nickname?.trim() || p.name : id.slice(0, 8);
  };

  const handleGenerate = async () => {
    try {
      const created = await generateFixtures.mutateAsync(tournament.id);
      toast.success(
        t("tr_generated").replace("{count}", String(created))
      );
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      await createTeam.mutateAsync({
        tournamentId: tournament.id,
        name: newTeamName.trim(),
      });
      setNewTeamName("");
      setTeamOpen(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const handleScore = async () => {
    if (!scoreMatch) return;
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return;
    try {
      await submitScore.mutateAsync({
        matchId: scoreMatch.id,
        scoreA: a,
        scoreB: b,
      });
      toast.success(t("match_saved"));
      setScoreMatch(null);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  const matchRow = (m: TournamentMatch) => {
    const aName = m.team_a_id ? teamName.get(m.team_a_id) ?? "—" : "TBD";
    const bName = m.team_b_id ? teamName.get(m.team_b_id) ?? "—" : "TBD";
    const isBye = m.status === "canceled" && m.notes === "bye";
    return (
      <div
        key={m.id}
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border p-3 text-sm",
          isBye && "opacity-50"
        )}
      >
        <div className="min-w-0">
          <p className="font-medium">
            {aName} <span className="text-muted-foreground">{t("match_vs")}</span> {bName}
          </p>
          <p className="text-xs text-muted-foreground">
            {m.round_name}
            {m.match_date ? ` · ${m.match_date}` : ""}
            {isBye ? ` · ${t("tr_bye")}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {m.status === "completed" ? (
            <span className="font-mono font-bold">
              {m.score_a} – {m.score_b}
            </span>
          ) : m.status === "scheduled" && m.team_a_id && m.team_b_id ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => {
                setScoreMatch(m);
                setScoreA("");
                setScoreB("");
              }}
            >
              <Play className="h-3.5 w-3.5" />
              {t("tr_enter_score")}
            </Button>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Format + generate fixtures */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" />
            {tournament.name}
            {tournament.format && (
              <Badge variant="secondary">
                {t(`tr_format_${tournament.format}`)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPoolOpen(true)}>
              <Users className="h-4 w-4" />
              {t("tr_pool")} ({participants?.length ?? 0})
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setTeamOpen(true)}>
              <Plus className="h-4 w-4" />
              {t("tr_add_team")}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={
                generateFixtures.isPending ||
                !tournament.format ||
                (teams?.length ?? 0) < 2
              }
              onClick={handleGenerate}
            >
              <Shuffle className="h-4 w-4" />
              {t("tr_generate")}
            </Button>
          </div>
          {!tournament.format && (
            <p className="text-sm text-muted-foreground">{t("tr_pick_format_hint")}</p>
          )}
        </CardContent>
      </Card>

      {/* Teams */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(teams ?? []).map((tm) => (
          <Card key={tm.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                {editingTeamName === tm.id ? (
                  <span className="flex flex-1 items-center gap-1">
                    <Input
                      value={teamNameDraft}
                      onChange={(e) => setTeamNameDraft(e.target.value)}
                      className="h-8"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={t("common_save")}
                      onClick={async () => {
                        if (!teamNameDraft.trim()) return;
                        try {
                          await renameTeam.mutateAsync({
                            teamId: tm.id,
                            name: teamNameDraft.trim(),
                          });
                          setEditingTeamName(null);
                        } catch (err) {
                          toast.error(errorMessage(err, t("common_error")));
                        }
                      }}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={t("common_cancel")}
                      onClick={() => setEditingTeamName(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </span>
                ) : (
                  <>
                    <span className="truncate">{tm.name}</span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={t("common_edit")}
                        onClick={() => {
                          setEditingTeamName(tm.id);
                          setTeamNameDraft(tm.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        onClick={async () => {
                          try {
                            await deleteTeam.mutateAsync(tm.id);
                          } catch (err) {
                            toast.error(errorMessage(err, t("common_error")));
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {tm.members.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("tr_team_empty")}</p>
              ) : (
                <ul className="space-y-1">
                  {tm.members.map((mem) => (
                    <li key={mem.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{mem.display_name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        aria-label={t("tr_remove_member")}
                        onClick={async () => {
                          try {
                            await removeTeamMember.mutateAsync(mem.id);
                          } catch (err) {
                            toast.error(errorMessage(err, t("common_error")));
                          }
                        }}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5"
                onClick={() => setAssignTeam(tm)}
              >
                <ListPlus className="h-4 w-4" />
                {t("tr_add_members")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* League standings */}
      {tournament.format === "league" && standings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("tr_standings")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/50 text-start text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start">#</th>
                    <th className="px-3 py-2 text-start">{t("tr_team")}</th>
                    <th className="px-2 py-2">{t("tr_played")}</th>
                    <th className="px-2 py-2">{t("tr_won")}</th>
                    <th className="px-2 py-2">{t("tr_drawn")}</th>
                    <th className="px-2 py-2">{t("tr_lost")}</th>
                    <th className="px-2 py-2">{t("tr_gf")}</th>
                    <th className="px-2 py-2">{t("tr_ga")}</th>
                    <th className="px-2 py-2">{t("tr_gd")}</th>
                    <th className="px-3 py-2">{t("tr_points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <tr key={row.team_id} className={cn("border-t", i === 0 && "bg-success/5")}>
                      <td className="px-3 py-2 font-mono">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-2 py-2 text-center font-mono">{row.played}</td>
                      <td className="px-2 py-2 text-center font-mono">{row.won}</td>
                      <td className="px-2 py-2 text-center font-mono">{row.drawn}</td>
                      <td className="px-2 py-2 text-center font-mono">{row.lost}</td>
                      <td className="px-2 py-2 text-center font-mono">{row.goals_for}</td>
                      <td className="px-2 py-2 text-center font-mono">{row.goals_against}</td>
                      <td
                        className={cn(
                          "px-2 py-2 text-center font-mono",
                          row.goal_diff > 0 && "text-success-ink",
                          row.goal_diff < 0 && "text-error-ink"
                        )}
                      >
                        {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fixtures */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("tr_fixtures")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {upNext.length > 0 && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-primary">
                {t("tr_up_next")}
              </p>
              <div className="space-y-2">
                {upNext.slice(0, 3).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {m.team_a_id ? teamName.get(m.team_a_id) : t("tr_tbd")}
                      {" "}
                      <span className="text-muted-foreground">{t("match_vs")}</span>
                      {" "}
                      {m.team_b_id ? teamName.get(m.team_b_id) : t("tr_tbd")}
                      {" · "}
                      <span className="text-muted-foreground">{m.round_name}</span>
                    </span>
                    {m.team_a_id && m.team_b_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => {
                          setScoreMatch(m);
                          setScoreA("");
                          setScoreB("");
                        }}
                      >
                        <Play className="h-3.5 w-3.5" />
                        {t("tr_enter_score")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {tournament.tournament_matches.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
              {t("match_empty")}
            </p>
          ) : (
            tournament.tournament_matches
              .slice()
              .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
              .map(matchRow)
          )}
        </CardContent>
      </Card>

      {/* Pool dialog */}
      <Dialog open={poolOpen} onOpenChange={setPoolOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("tr_pool")}</DialogTitle>
            <DialogDescription>{t("tr_pool_hint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(participants ?? []).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="truncate">{displayName(p.member)}</span>
                <span className="flex items-center gap-1">
                  {assignedIds.has(p.member_id) && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t("tr_in_team")}
                    </Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label={t("tr_remove_member")}
                    disabled={assignedIds.has(p.member_id)}
                    onClick={async () => {
                      try {
                        await removeParticipant.mutateAsync(p.id);
                      } catch (err) {
                        toast.error(errorMessage(err, t("common_error")));
                      }
                    }}
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </div>
            ))}
            <p className="pt-2 text-xs font-semibold uppercase text-muted-foreground">
              {t("tr_roster_add")}
            </p>
            {(profiles ?? [])
              .filter((p) => !participantIds.has(p.id))
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-sm transition-colors hover:bg-accent"
                  onClick={async () => {
                    try {
                      await addParticipants.mutateAsync({
                        tournamentId: tournament.id,
                        memberIds: [p.id],
                      });
                    } catch (err) {
                      toast.error(errorMessage(err, t("common_error")));
                    }
                  }}
                >
                  <span className="truncate">
                    {p.nickname?.trim() || p.name}
                    {p.username ? (
                      <span className="text-muted-foreground"> @{p.username}</span>
                    ) : null}
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* New team dialog */}
      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("tr_add_team")}</DialogTitle>
            <DialogDescription>{t("tr_team_name_hint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="tr-team-name">{t("tr_team")}</Label>
            <Input
              id="tr-team-name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamOpen(false)}>
              {t("common_cancel")}
            </Button>
            <Button onClick={handleCreateTeam} disabled={!newTeamName.trim() || createTeam.isPending}>
              {createTeam.isPending ? t("common_saving") : t("common_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign members to a team */}
      <Dialog open={!!assignTeam} onOpenChange={(o) => !o && setAssignTeam(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("tr_assign_to")} {assignTeam?.name}
            </DialogTitle>
            <DialogDescription>{t("tr_assign_hint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(participants ?? []).filter((p) => !assignedIds.has(p.member_id)).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tr_all_assigned")}</p>
            ) : (
              (participants ?? [])
                .filter((p) => !assignedIds.has(p.member_id))
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-sm transition-colors hover:bg-accent"
                    onClick={async () => {
                      if (!assignTeam) return;
                      try {
                        await addTeamMembers.mutateAsync({
                          teamId: assignTeam.id,
                          participantIds: [p.id],
                        });
                      } catch (err) {
                        toast.error(errorMessage(err, t("common_error")));
                      }
                    }}
                  >
                    <span className="truncate">{displayName(p.member)}</span>
                    <Plus className="h-4 w-4 shrink-0 text-primary" />
                  </button>
                ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Score entry */}
      <Dialog open={!!scoreMatch} onOpenChange={(o) => !o && setScoreMatch(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("tr_enter_score")}</DialogTitle>
            <DialogDescription>
              {scoreMatch
                ? `${scoreMatch.team_a_id ? teamName.get(scoreMatch.team_a_id) : "TBD"} ${t("match_vs")} ${scoreMatch.team_b_id ? teamName.get(scoreMatch.team_b_id) : "TBD"}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-4">
            <div className="space-y-2 text-center">
              <Label>{t("tr_score")}</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                className="w-20 text-center font-mono text-lg"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <span className="mt-6 text-muted-foreground">—</span>
            <div className="space-y-2 text-center">
              <Label>{t("tr_score")}</Label>
              <Input
                dir="ltr"
                inputMode="numeric"
                className="w-20 text-center font-mono text-lg"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoreMatch(null)}>
              {t("common_cancel")}
            </Button>
            <Button
              onClick={handleScore}
              disabled={
                scoreA === "" ||
                scoreB === "" ||
                submitScore.isPending ||
                (tournament.format === "knockout" && scoreA === scoreB)
              }
            >
              {submitScore.isPending ? t("common_saving") : t("common_save")}
            </Button>
          </DialogFooter>
          {tournament.format === "knockout" && scoreA === scoreB && scoreA !== "" && (
            <p className="text-center text-xs text-error-ink">{t("tr_no_draws")}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
