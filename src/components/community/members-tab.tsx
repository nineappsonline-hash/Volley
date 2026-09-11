"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Flag, MoreVertical, Search, ShieldOff, Star, UserRound } from "lucide-react";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { ReportDialog } from "@/components/shared/report-dialog";
import { useI18n, type Dict } from "@/lib/i18n";
import { COMMUNITY_SPORTS } from "@/lib/constants";
import {
  useBlockedMembers,
  useBlockMember,
  useCommunityMembers,
  useMyBlocks,
  useUnblockMember,
  useUpdateCommunityProfile,
} from "@/lib/queries";
import { matchesBilingual } from "@/lib/search";
import { errorMessage } from "@/lib/utils";
import type { CommunityMember, Profile } from "@/lib/types";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function MemberCard({
  member,
  profileId,
}: {
  member: CommunityMember;
  profileId: string;
}) {
  const { t } = useI18n();
  const { data: blocks } = useMyBlocks();
  const block = useBlockMember();
  const unblock = useUnblockMember();
  const [reportOpen, setReportOpen] = useState(false);

  const isBlocked = (blocks ?? []).some((b) => b.blocked_id === member.id);
  const show = isBlocked ? (
    <Card className="opacity-60">
      <CardContent className="flex items-center gap-3 p-4">
        <ProfileAvatar name={member.name} url={member.avatar_url} className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{member.name}</p>
          <p className="text-xs text-muted-foreground">{t("blocked_label")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            unblock.mutateAsync(member.id).catch((e) =>
              toast.error(errorMessage(e, t("common_error")))
            )
          }
        >
          <ShieldOff className="me-1 h-3.5 w-3.5" />
          {t("unblock")}
        </Button>
      </CardContent>
    </Card>
  ) : (
    <Card className="animate-fade-in-up hover:border-primary/30 transition-colors">
      <CardContent className="flex items-start gap-3 p-4">
        <ProfileAvatar name={member.name} url={member.avatar_url} className="h-10 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-semibold">{member.name}</p>
            {member.username && (
              <span className="truncate text-xs text-muted-foreground">
                @{member.username}
              </span>
            )}
            {member.skill_level && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Star className="h-3 w-3 text-warning-ink" />
                {t(`skill_${member.skill_level}`)}
              </Badge>
            )}
            {member.position && (
              <span className="text-xs text-muted-foreground">
                · {member.position}
              </span>
            )}
          </div>
          {member.academy_name && (
            <p className="truncate text-xs text-muted-foreground">
              {member.academy_name}
              {member.area ? ` · ${member.area}` : ""}
            </p>
          )}
          {!member.academy_name && (
            <Badge variant="outline" className="mt-1.5">
              {t("community_member_independent")}
            </Badge>
          )}
          {member.bio && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {member.bio}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("community_more")}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => setReportOpen(true)}>
              <Flag className="me-2 h-3.5 w-3.5 text-destructive" />
              {t("report_member")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                block
                  .mutateAsync(member.id)
                  .then(() => toast.success(t("blocked_ok")))
                  .catch((e) => toast.error(errorMessage(e, t("common_error"))))
              }
              disabled={block.isPending}
            >
              <ShieldOff className="me-2 h-3.5 w-3.5" />
              {t("block_member")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="member"
        targetId={member.id}
        targetLabel={member.name}
      />
    </Card>
  );

  return (
    <div>
      {profileId !== member.id && show}
    </div>
  );
}

export function MembersTab({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const { data: members, isLoading } = useCommunityMembers();
  const update = useUpdateCommunityProfile();
  const { data: blocked } = useBlockedMembers();
  const unblock = useUnblockMember();

  const [bio, setBio] = useState(profile.bio ?? "");
  const [visible, setVisible] = useState(profile.community_visible ?? true);
  const [skillLevel, setSkillLevel] = useState(profile.skill_level ?? "any");
  const [position, setPosition] = useState(profile.position ?? "");
  const [days, setDays] = useState<number[]>(profile.availability_days ?? []);
  const [sports, setSports] = useState<string[]>(
    profile.interested_sports ?? []
  );
  const [alerts, setAlerts] = useState(profile.notify_game_alerts ?? false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim();
    const list = (members ?? []).filter((m) => m.id !== profile.id);
    if (!q) return list;
    return list.filter((m) =>
      matchesBilingual(`${m.name} ${m.username ?? ""} ${m.academy_name ?? ""} ${m.area ?? ""}`, q)
    );
  }, [members, search, profile.id]);

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  const toggleSport = (s: string) =>
    setSports((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        id: profile.id,
        bio: bio.trim() || null,
        community_visible: visible,
        skill_level: skillLevel === "any" ? null : skillLevel,
        position: position.trim() || null,
        availability_days: days.length ? days : [],
        interested_sports: sports,
        notify_game_alerts: alerts,
      });
      toast.success(t("community_saved"));
    } catch (err) {
      toast.error(errorMessage(err, t("common_error")));
    }
  };

  return (
    <div className="space-y-6">
      {/* My community profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("community_my_profile")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("community_bio")}</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t("community_bio_placeholder")}
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("profile_skill_level")}</Label>
                <Select value={skillLevel} onValueChange={setSkillLevel}>
                  <SelectTrigger aria-label={t("profile_skill_level")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("community_any_level")}</SelectItem>
                    <SelectItem value="beginner">{t("skill_beginner")}</SelectItem>
                    <SelectItem value="intermediate">
                      {t("skill_intermediate")}
                    </SelectItem>
                    <SelectItem value="advanced">{t("skill_advanced")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("profile_position")}</Label>
                <Input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder={t("profile_position_ph")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("profile_availability")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      days.includes(d)
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {t(`avail_day_${d}` as keyof Dict)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("profile_interest_sports")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {COMMUNITY_SPORTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSport(s)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      sports.includes(s)
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={alerts}
                    onCheckedChange={setAlerts}
                    id="notify-game-alerts"
                  />
                  <Label htmlFor="notify-game-alerts">
                    {t("profile_game_alerts")}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("profile_game_alerts_hint")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 lg:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Switch
                  checked={visible}
                  onCheckedChange={setVisible}
                  id="community-visible"
                />
                <Label htmlFor="community-visible">
                  {t("community_visible_label")}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">{t("community_visible_hint")}</p>
            </div>
            <Button onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? t("common_saving") : t("common_save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Directory */}
      <div className="space-y-4">
        <div className="max-w-md">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("community_search_members")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            message={
              search.trim()
                ? t("community_no_members")
                : t("community_members_empty")
            }
            icon={UserRound}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <MemberCard key={m.id} member={m} profileId={profile.id} />
            ))}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-success-ink" />
            {filtered.length}{" "}
            {filtered.length === 1
              ? t("community_member_count_one")
              : t("community_member_count_other")}
          </p>
        )}
      </div>

      {/* Blocked members */}
      {(blocked ?? []).length > 0 && (
        <Card className="animate-fade-in-up">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldOff className="h-4 w-4 text-destructive" />
              {t("community_blocked_title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(blocked ?? []).map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <ProfileAvatar name={b.blocked_name} className="h-9 w-9 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {b.blocked_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("blocked_label")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      unblock
                        .mutateAsync(b.blocked_id)
                        .then(() => toast.success(t("unblocked_ok")))
                        .catch((e) =>
                          toast.error(errorMessage(e, t("common_error")))
                        )
                    }
                    disabled={unblock.isPending}
                  >
                    <Check className="me-1 h-3.5 w-3.5" />
                    {t("unblock")}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}