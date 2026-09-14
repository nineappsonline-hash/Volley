"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  Edit3,
  Play,
  Plus,
  Swords,
  Trash2,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { cn, errorMessage, todayInput } from "@/lib/utils";
import {
  useDeleteTournament,
  useSaveMatch,
  useSaveTournament,
  useSports,
  useTeams,
  useTournaments,
  useVenues,
} from "@/lib/queries";
import { TournamentRunner } from "@/components/tournaments/tournament-runner";
import type {
  Tournament,
  TournamentFormat,
  TournamentMatch,
  TournamentWithMatches,
} from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  upcoming: "secondary",
  in_progress: "default",
  completed: "success",
  canceled: "destructive",
};

export function TournamentsClient({
  canCreate = true,
  autoCreate = false,
}: {
  canCreate?: boolean;
  autoCreate?: boolean;
}) {
  const { t, lang, locale } = useI18n();
  const { data: tournaments, isLoading } = useTournaments();
  const { data: sports } = useSports();
  const { data: teams } = useTeams();
  const { data: venues } = useVenues();
  const deleteTournament = useDeleteTournament();

  const [formOpen, setFormOpen] = useState(false);
  useEffect(() => {
    if (autoCreate && !formOpen) {
      setEditing(null);
      setFormOpen(true);
    }
  }, [autoCreate, formOpen]);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [deleting, setDeleting] = useState<TournamentWithMatches | null>(null);
  const [details, setDetails] = useState<TournamentWithMatches | null>(null);
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<TournamentMatch | null>(null);
  const [matchTournamentId, setMatchTournamentId] = useState<string>("");
  const [running, setRunning] = useState<TournamentWithMatches | null>(null);

  const sportName = useMemo(
    () => new Map((sports ?? []).map((s) => [s.id, s.name])),
    [sports]
  );
  const teamName = useMemo(
    () => new Map((teams ?? []).map((t) => [t.id, t.name])),
    [teams]
  );

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTournament.mutateAsync(deleting.id);
      toast.success(t("tournament_deleted"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setDeleting(null);
    }
  };

  const openNewMatch = (tournamentId: string) => {
    setMatchTournamentId(tournamentId);
    setEditingMatch(null);
    setMatchFormOpen(true);
  };

  if (running) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" className="w-fit gap-1.5" onClick={() => setRunning(null)}>
          <ArrowLeft className="h-4 w-4" />
          {t("tr_back")}
        </Button>
        <TournamentRunner tournament={running} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("tournament_title")} subtitle={t("tournament_subtitle")}>
        {canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("tournament_add")}
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <div className="h-32 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        </div>
      ) : !tournaments || tournaments.length === 0 ? (
        <EmptyState message={t("tournament_empty")} icon={Trophy} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tournaments.map((tournament) => (
            <Card
              key={tournament.id}
              className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardContent className="p-0">
                <div className="flex items-start justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{tournament.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tournament.sport && (
                        <Badge variant="outline" className="text-xs">
                          {tournament.sport.name}
                        </Badge>
                      )}
                      <Badge variant={STATUS_COLORS[tournament.status] as any}>
                        {t(`tournament_status_${tournament.status}`)}
                      </Badge>
                    </div>
                  </div>
                  {canCreate && (
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t("common_edit")}
                        onClick={() => {
                          setEditing(tournament);
                          setFormOpen(true);
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={t("common_delete")}
                        onClick={() => setDeleting(tournament)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-3 px-4 py-3">
                  {tournament.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {tournament.description}
                    </p>
                  )}
                  {tournament.prize && (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                      <Trophy className="h-4 w-4" />
                      {tournament.prize}
                    </span>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {format(new Date(tournament.start_date + "T00:00:00"), "MMM d, yyyy", { locale })}
                      {tournament.end_date
                        ? ` – ${format(new Date(tournament.end_date + "T00:00:00"), "MMM d, yyyy", { locale })}`
                        : ""}
                    </span>
                    <span className="font-mono font-semibold">
                      {tournament.tournament_matches.length} {t("match_title").toLowerCase()}
                    </span>
                  </div>
                  <div className={cn("grid gap-2", canCreate ? "grid-cols-2" : "grid-cols-1")}>
                    {canCreate && (
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setRunning(tournament)}
                      >
                        <Play className="h-4 w-4" />
                        {t("tr_run")}
                      </Button>
                    )}
                    <Button
                      variant={canCreate ? "outline" : "default"}
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setDetails(tournament)}
                    >
                      <Swords className="h-4 w-4" />
                      {t(canCreate ? "match_title" : "tournament_view")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tournament form dialog */}
      <TournamentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        tournament={editing}
        sports={sports ?? []}
      />

      {/* Tournament details / matches */}
      {details && (
        <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                {details.name}
              </DialogTitle>
              <DialogDescription>
                {format(new Date(details.start_date + "T00:00:00"), "MMM d, yyyy", { locale })}
                {details.end_date
                  ? ` – ${format(new Date(details.end_date + "T00:00:00"), "MMM d, yyyy", { locale })}`
                  : ""}
                {details.prize ? ` · ${details.prize}` : ""}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {details.tournament_matches.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                  {t("match_empty")}
                </p>
              ) : (
                details.tournament_matches
                  .sort((a, b) => (a.match_date ?? "").localeCompare(b.match_date ?? ""))
                  .map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {teamName.get(match.team_a_id ?? "") ?? "TBD"}{" "}
                          <span className="text-muted-foreground">{t("match_vs")}</span>{" "}
                          {teamName.get(match.team_b_id ?? "") ?? "TBD"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {match.round_name}
                          {match.match_date
                            ? ` · ${format(new Date(match.match_date + "T00:00:00"), "MMM d", { locale })}`
                            : ""}
                          {match.score_a != null && match.score_b != null
                            ? ` · ${match.score_a} – ${match.score_b}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {canCreate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setMatchTournamentId(details.id);
                              setEditingMatch(match);
                              setMatchFormOpen(true);
                            }}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
              )}
              {canCreate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => openNewMatch(details.id)}
                >
                  <Plus className="h-4 w-4" />
                  {t("match_add")}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Match form dialog */}
      <MatchFormDialog
        open={matchFormOpen}
        onOpenChange={setMatchFormOpen}
        match={editingMatch}
        tournamentId={matchTournamentId}
        teams={teams ?? []}
        venues={venues ?? []}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tournament_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tournament_delete_confirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t("common_delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Tournament Form Dialog ─────────────────────────────────

function TournamentFormDialog({
  open,
  onOpenChange,
  tournament,
  sports,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament | null;
  sports: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const save = useSaveTournament();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");
  const [sportId, setSportId] = useState<string>("none");
  const [startDate, setStartDate] = useState(todayInput());
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<string>("upcoming");
  const [format, setFormat] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (tournament) {
        setName(tournament.name);
        setDescription(tournament.description ?? "");
        setPrize(tournament.prize ?? "");
        setSportId(tournament.sport_id ?? "none");
        setStartDate(tournament.start_date);
        setEndDate(tournament.end_date ?? "");
        setStatus(tournament.status);
        setFormat(tournament.format ?? "none");
      } else {
        setName("");
        setDescription("");
        setPrize("");
        setSportId("none");
        setStartDate(todayInput());
        setEndDate("");
        setStatus("upcoming");
        setFormat("none");
      }
    }
  }, [open, tournament]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await save.mutateAsync({
        id: tournament?.id,
        name: name.trim(),
        description: description.trim() || null,
        prize: prize.trim() || null,
        sport_id: sportId === "none" ? null : sportId,
        start_date: startDate,
        end_date: endDate || null,
        status: status as any,
        format: format === "none" ? null : (format as TournamentFormat),
      });
      toast.success(t("tournament_saved"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tournament ? t("tournament_edit") : t("tournament_add")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("tournament_name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("tournament_desc")}</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("tournament_prize")}</Label>
            <Input
              value={prize}
              onChange={(e) => setPrize(e.target.value)}
              placeholder={t("tournament_prize_placeholder")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("tournament_sport")}</Label>
              <Select value={sportId} onValueChange={setSportId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {sports.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("tournament_status")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">{t("tournament_status_upcoming")}</SelectItem>
                  <SelectItem value="in_progress">{t("tournament_status_in_progress")}</SelectItem>
                  <SelectItem value="completed">{t("tournament_status_completed")}</SelectItem>
                  <SelectItem value="canceled">{t("tournament_status_canceled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("tr_format")}</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("tr_format_none")}</SelectItem>
                <SelectItem value="knockout">{t("tr_format_knockout")}</SelectItem>
                <SelectItem value="league">{t("tr_format_league")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("tournament_start")}</Label>
              <Input
                type="date"
                dir="ltr"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("tournament_end")}</Label>
              <Input
                type="date"
                dir="ltr"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? t("common_saving") : t("common_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Match Form Dialog ──────────────────────────────────────

function MatchFormDialog({
  open,
  onOpenChange,
  match,
  tournamentId,
  teams,
  venues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: TournamentMatch | null;
  tournamentId: string;
  teams: { id: string; name: string }[];
  venues: { id: string; name: string }[];
}) {
  const { t } = useI18n();
  const save = useSaveMatch();

  const [roundName, setRoundName] = useState("");
  const [teamA, setTeamA] = useState<string>("none");
  const [teamB, setTeamB] = useState<string>("none");
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [matchDate, setMatchDate] = useState(todayInput());
  const [matchTime, setMatchTime] = useState("");
  const [venueId, setVenueId] = useState<string>("none");
  const [status, setStatus] = useState<string>("scheduled");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (match) {
        setRoundName(match.round_name);
        setTeamA(match.team_a_id ?? "none");
        setTeamB(match.team_b_id ?? "none");
        setScoreA(match.score_a != null ? String(match.score_a) : "");
        setScoreB(match.score_b != null ? String(match.score_b) : "");
        setMatchDate(match.match_date ?? todayInput());
        setMatchTime(match.match_time?.slice(0, 5) ?? "");
        setVenueId(match.venue_id ?? "none");
        setStatus(match.status);
        setNotes(match.notes ?? "");
      } else {
        setRoundName("");
        setTeamA("none");
        setTeamB("none");
        setScoreA("");
        setScoreB("");
        setMatchDate(todayInput());
        setMatchTime("");
        setVenueId("none");
        setStatus("scheduled");
        setNotes("");
      }
    }
  }, [open, match]);

  const handleSave = async () => {
    if (!roundName.trim()) return;
    setSaving(true);
    try {
      await save.mutateAsync({
        id: match?.id,
        tournament_id: tournamentId,
        round_name: roundName.trim(),
        team_a_id: teamA === "none" ? null : teamA,
        team_b_id: teamB === "none" ? null : teamB,
        score_a: scoreA ? Number(scoreA) : null,
        score_b: scoreB ? Number(scoreB) : null,
        match_date: matchDate || null,
        match_time: matchTime ? `${matchTime}:00` : null,
        venue_id: venueId === "none" ? null : venueId,
        status: status as any,
        notes: notes.trim() || null,
      });
      toast.success(t("match_saved"));
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{match ? t("match_edit") : t("match_add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("match_round")}</Label>
            <Input
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              placeholder="e.g. Quarter-final"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("match_team_a")}</Label>
              <Select value={teamA} onValueChange={setTeamA}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">TBD</SelectItem>
                  {teams.map((tm) => (
                    <SelectItem key={tm.id} value={tm.id}>
                      {tm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("match_team_b")}</Label>
              <Select value={teamB} onValueChange={setTeamB}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">TBD</SelectItem>
                  {teams.map((tm) => (
                    <SelectItem key={tm.id} value={tm.id}>
                      {tm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("match_score")} A</Label>
              <Input
                type="number"
                min="0"
                dir="ltr"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("match_score")} B</Label>
              <Input
                type="number"
                min="0"
                dir="ltr"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("match_date")}</Label>
              <Input
                type="date"
                dir="ltr"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("match_time")}</Label>
              <Input
                type="time"
                dir="ltr"
                value={matchTime}
                onChange={(e) => setMatchTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("match_venue")}</Label>
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("match_status")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">{t("tournament_status_upcoming")}</SelectItem>
                  <SelectItem value="completed">{t("tournament_status_completed")}</SelectItem>
                  <SelectItem value="canceled">{t("tournament_status_canceled")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("match_notes")}</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common_cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || !roundName.trim()}>
            {saving ? t("common_saving") : t("common_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


