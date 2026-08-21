"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Tags, Trash2, Trophy, UserPlus, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { TeamFormDialog } from "@/components/teams/team-form-dialog";
import { SportsManagerDialog } from "@/components/teams/sports-manager-dialog";
import { useI18n } from "@/lib/i18n";
import { cn, errorMessage, initials } from "@/lib/utils";
import {
  useDeleteTeam,
  useSports,
  useTeams,
} from "@/lib/queries";
import type { TeamWithDetails } from "@/lib/types";

export function TeamsClient() {
  const { t } = useI18n();
  const { data: teams, isLoading } = useTeams();
  const { data: sports } = useSports();
  const deleteTeam = useDeleteTeam();

  const [formOpen, setFormOpen] = useState(false);
  const [sportsOpen, setSportsOpen] = useState(false);
  const [editing, setEditing] = useState<TeamWithDetails | null>(null);
  const [deleting, setDeleting] = useState<TeamWithDetails | null>(null);
  const [sportFilter, setSportFilter] = useState<string>("all");

  const filteredTeams = useMemo(
    () =>
      sportFilter === "all"
        ? teams ?? []
        : (teams ?? []).filter((team) => team.sport_id === sportFilter),
    [teams, sportFilter]
  );

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTeam.mutateAsync(deleting.id);
      toast.success(t("teams_delete_success"));
    } catch (err) {
      console.error("[teams] delete failed", err);
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("teams_title")} subtitle={t("teams_subtitle")}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSportsOpen(true)}>
            <Tags className="h-4 w-4" />
            {t("teams_manage_sports")}
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <UserPlus className="h-4 w-4" />
            {t("teams_add")}
          </Button>
        </div>
      </PageHeader>

      {/* Sport filter */}
      {(sports ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSportFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              sportFilter === "all"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            {t("schedule_filter_all")}
          </button>
          {(sports ?? []).map((sport) => (
            <button
              key={sport.id}
              type="button"
              onClick={() => setSportFilter(sport.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                sportFilter === sport.id
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {sport.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : filteredTeams.length === 0 ? (
        <EmptyState message={t("teams_no_teams")} icon={Trophy} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTeams.map((team) => (
            <Card
              key={team.id}
              className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardContent className="p-0">
                <div className="flex items-start justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{team.name}</p>
                    {team.sport && (
                      <Badge variant="outline" className="mt-1 gap-1 text-xs">
                        <Trophy className="h-3 w-3" />
                        {team.sport.name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={t("common_edit")}
                      onClick={() => { setEditing(team); setFormOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={t("common_delete")}
                      onClick={() => setDeleting(team)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-3">
                  {team.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {team.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="font-semibold text-foreground">
                        {team.team_members.length}
                      </span>
                      {t("teams_members_count")}
                    </span>
                    <div className="flex -space-x-2 rtl:space-x-reverse">
                      {team.team_members.slice(0, 5).map((m) => (
                        <Avatar key={m.member_id} className="h-7 w-7 border-2 border-background">
                          <AvatarFallback className="text-[10px]">
                            {initials(m.profile?.name ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {team.team_members.length > 5 && (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold">
                          +{team.team_members.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TeamFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        team={editing}
      />

      <SportsManagerDialog
        open={sportsOpen}
        onOpenChange={setSportsOpen}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("teams_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("teams_delete_confirm")}
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
