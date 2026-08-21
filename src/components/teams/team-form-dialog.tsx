"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Trophy } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { SKILL_LEVELS } from "@/lib/constants";
import { cn, errorMessage, initials } from "@/lib/utils";
import {
  useCoaches,
  useProfiles,
  useSaveTeam,
  useSetTeamMembers,
  useSports,
  useTeams,
} from "@/lib/queries";
import type { TeamWithDetails } from "@/lib/types";

interface TeamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: TeamWithDetails | null;
}

export function TeamFormDialog({
  open,
  onOpenChange,
  team,
}: TeamFormDialogProps) {
  const { t } = useI18n();
  const isEdit = !!team;
  const saveTeam = useSaveTeam();
  const setTeamMembers = useSetTeamMembers();
  const { data: sports } = useSports();
  const { data: profiles } = useProfiles();
  const { data: coaches } = useCoaches();

  const [name, setName] = useState("");
  const [sportId, setSportId] = useState<string>("none");
  const [coachId, setCoachId] = useState<string>("none");
  const [ageGroup, setAgeGroup] = useState("");
  const [skillLevel, setSkillLevel] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(team?.name ?? "");
      setSportId(team?.sport_id ?? "none");
      setCoachId(team?.coach_id ?? "none");
      setAgeGroup(team?.age_group ?? "");
      setSkillLevel(team?.skill_level ?? "none");
      setDescription(team?.description ?? "");
      setMemberIds(
        (team?.team_members ?? []).map((m) => m.member_id)
      );
    }
  }, [open, team]);

  // Roster candidates: active members only.
  const members = useMemo(
    () => (profiles ?? []).filter((p) => p.role === "member"),
    [profiles]
  );

  const toggleMember = (id: string) =>
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const onSubmit = async () => {
    if (!name.trim()) {
      toast.error(t("field_required"));
      return;
    }
    setSaving(true);
    try {
      const teamId = await saveTeam.mutateAsync({
        id: team?.id,
        name: name.trim(),
        sport_id: sportId === "none" ? null : sportId,
        coach_id: coachId === "none" ? null : coachId,
        age_group: ageGroup.trim() || null,
        skill_level:
          skillLevel !== "none"
            ? (skillLevel as "beginner" | "intermediate" | "advanced")
            : null,
        description: description.trim() || null,
      });
      if (teamId) {
        await setTeamMembers.mutateAsync({
          team_id: teamId,
          member_ids: memberIds,
        });
      }
      toast.success(t("teams_save_success"));
      onOpenChange(false);
    } catch (err) {
      console.error("[team-form] save failed", err);
      toast.error(errorMessage(err, t("common_error")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            {isEdit ? t("teams_edit") : t("teams_create")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("teams_name")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("teams_name_placeholder")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("schedule_sport")}</Label>
              <Select value={sportId} onValueChange={setSportId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("schedule_sport_none")}</SelectItem>
                  {(sports ?? []).map((sport) => (
                    <SelectItem key={sport.id} value={sport.id}>
                      {sport.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("coach_label")}</Label>
              <Select value={coachId} onValueChange={setCoachId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("coach_none")}</SelectItem>
                  {(coaches ?? []).map((coach) => (
                    <SelectItem key={coach.id} value={coach.id}>
                      {coach.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("age_group")}</Label>
              <Input
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value)}
                placeholder={t("age_group_placeholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("skill_level")}</Label>
              <Select value={skillLevel} onValueChange={setSkillLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {SKILL_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {t(`skill_${level}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("teams_description")}</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>
              {t("teams_members")}
              {memberIds.length > 0 && (
                <span className="ms-1.5 text-xs text-muted-foreground">
                  ({memberIds.length})
                </span>
              )}
            </Label>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1">
              {members.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("attendance_no_members")}
                </p>
              ) : (
                members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-start text-sm transition-colors hover:bg-accent",
                      memberIds.includes(m.id) && "bg-accent"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{initials(m.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {m.name}
                    </span>
                    {memberIds.includes(m.id) && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common_cancel")}
          </Button>
          <Button type="button" onClick={onSubmit} disabled={saving}>
            {saving ? t("common_saving") : t("common_save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
