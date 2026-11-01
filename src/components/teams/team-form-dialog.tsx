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
  useAcademy,
  useAcademyVenues,
  useCoaches,
  useProfiles,
  useSaveTeam,
  useSetTeamMembers,
  useSports,
  useTeams,
} from "@/lib/queries";
import type { TeamGender, TeamWithDetails } from "@/lib/types";

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
  const { data: academy } = useAcademy();
  const { data: academyVenues } = useAcademyVenues(academy?.id);

  const [name, setName] = useState("");
  const [sportId, setSportId] = useState<string>("none");
  const [coachId, setCoachId] = useState<string>("none");
  const [venueId, setVenueId] = useState<string>("none");
  const [gender, setGender] = useState<TeamGender>("mixed");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [skillLevel, setSkillLevel] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(team?.name ?? "");
      setSportId(team?.sport_id ?? "none");
      setCoachId(team?.coach_id ?? "none");
      setVenueId(team?.venue_id ?? "none");
      setGender(team?.gender ?? "mixed");
      setMinAge(team?.min_age != null ? String(team.min_age) : "");
      setMaxAge(team?.max_age != null ? String(team.max_age) : "");
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
    if (sportId === "none") {
      toast.error(t("teams_sport_required"));
      return;
    }
    const min = minAge.trim() === "" ? null : Number(minAge);
    const max = maxAge.trim() === "" ? null : Number(maxAge);
    if (
      (min === null) !== (max === null) ||
      (min !== null && (!Number.isInteger(min) || min < 0)) ||
      (max !== null &&
        (!Number.isInteger(max) || max < 0 || (min !== null && max < min)))
    ) {
      toast.error(t("teams_age_invalid"));
      return;
    }
    setSaving(true);
    try {
      const teamId = await saveTeam.mutateAsync({
        id: team?.id,
        name: name.trim(),
        sport_id: sportId === "none" ? null : sportId,
        coach_id: coachId === "none" ? null : coachId,
        venue_id: venueId === "none" ? null : venueId,
        gender,
        min_age: min,
        max_age: max,
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
              <Label>{t("schedule_sport")} *</Label>
              <Select value={sportId} onValueChange={setSportId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("common_select")}</SelectItem>
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

          <div className="space-y-2">
            <Label>{t("teams_playground")}</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("teams_playground_none")}</SelectItem>
                {(academyVenues ?? []).map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {[venue.name, venue.area].filter(Boolean).join(" · ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("teams_gender")}</Label>
              <Select
                value={gender}
                onValueChange={(value) => setGender(value as TeamGender)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="boys">{t("teams_gender_boys")}</SelectItem>
                  <SelectItem value="girls">{t("teams_gender_girls")}</SelectItem>
                  <SelectItem value="mixed">{t("teams_gender_mixed")}</SelectItem>
                </SelectContent>
              </Select>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("teams_age_from")}</Label>
              <Input
                type="number"
                min="0"
                max="120"
                inputMode="numeric"
                value={minAge}
                onChange={(e) => setMinAge(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("teams_age_to")}</Label>
              <Input
                type="number"
                min="0"
                max="120"
                inputMode="numeric"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
              />
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
                      <AvatarFallback>{initials(m.nickname || m.name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {m.nickname || m.name}
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
