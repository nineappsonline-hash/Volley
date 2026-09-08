"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Radar, Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PremiumGate } from "@/components/shared/premium-gate";
import { useI18n } from "@/lib/i18n";
import {
  useCommunityMembers,
  useScoutNotes,
  useToggleScoutNote,
} from "@/lib/queries";
import type { Profile, SkillLevel } from "@/lib/types";

const SKILLS: SkillLevel[] = ["beginner", "intermediate", "advanced"];

export function ScoutingClient({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const { data: members, isLoading } = useCommunityMembers();
  const { data: notes } = useScoutNotes();
  const toggleNote = useToggleScoutNote();

  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState<"all" | SkillLevel>("all");
  const [sport, setSport] = useState<string>("all");
  const [notedOnly, setNotedOnly] = useState(false);

  const notedIds = useMemo(
    () => new Set((notes ?? []).map((n) => n.player_id)),
    [notes]
  );

  const sports = useMemo(() => {
    const set = new Set<string>();
    for (const m of members ?? []) {
      for (const s of m.interested_sports ?? []) set.add(s);
    }
    return [...set].sort();
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (members ?? []).filter((m) => {
      if (m.id === profile.id) return false;
      if (notedOnly && !notedIds.has(m.id)) return false;
      if (skill !== "all" && m.skill_level !== skill) return false;
      if (sport !== "all" && !(m.interested_sports ?? []).includes(sport))
        return false;
      if (q) {
        const haystack = [m.name, m.academy_name, m.area, m.position]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [members, query, skill, sport, notedOnly, notedIds, profile.id]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("scouting_title")}
        subtitle={t("scouting_subtitle")}
      />

      <PremiumGate
        profile={profile}
        description={t("scouting_premium_hint")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("scouting_search")}
            className="max-w-xs"
          />
          <div className="flex flex-wrap items-center gap-1">
            {SKILLS.map((s) => (
              <Button
                key={s}
                type="button"
                variant={skill === s ? "default" : "outline"}
                size="sm"
                onClick={() => setSkill(skill === s ? "all" : s)}
              >
                {t(`skill_${s}` as any)}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              variant={sport === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSport("all")}
            >
              {t("community_filter_all_sports")}
            </Button>
            {sports.map((s) => (
              <Button
                key={s}
                type="button"
                variant={sport === s ? "default" : "outline"}
                size="sm"
                onClick={() => setSport(sport === s ? "all" : s)}
              >
                {s}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant={notedOnly ? "default" : "outline"}
            size="sm"
            className="ms-auto gap-1"
            onClick={() => setNotedOnly((v) => !v)}
          >
            <Star className="h-4 w-4" />
            {t("scouting_noted_only")}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            message={t("scouting_empty")}
            hint={t("scouting_empty_hint")}
            icon={Radar}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((m) => {
              const noted = notedIds.has(m.id);
              return (
                <Card key={m.id} className={noted ? "border-primary/40" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="truncate text-base">
                        {m.name}
                      </CardTitle>
                      <Button
                        variant={noted ? "default" : "outline"}
                        size="icon"
                        aria-label={t("scouting_note")}
                        disabled={toggleNote.isPending}
                        onClick={() => toggleNote.mutateAsync(m.id)}
                      >
                        <Star
                          className={
                            noted
                              ? "h-4 w-4 fill-interactive-400 text-interactive-400"
                              : "h-4 w-4"
                          }
                        />
                      </Button>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {m.academy_name ?? t("community_member_independent")}
                      {m.area ? ` · ${m.area}` : ""}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.skill_level && (
                        <Badge variant="secondary" className="text-[10px]">
                          {t(`skill_${m.skill_level}` as any)}
                        </Badge>
                      )}
                      {m.position && (
                        <Badge variant="outline" className="text-[10px]">
                          {m.position}
                        </Badge>
                      )}
                    </div>
                    {(m.interested_sports ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(m.interested_sports ?? []).map((s) => (
                          <Badge
                            key={s}
                            variant="outline"
                            className="text-[10px] text-primary"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {(m.availability_days ?? []).length > 0 && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {m.availability_days.join(" · ")}
                      </p>
                    )}
                    {m.bio && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {m.bio}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </PremiumGate>
    </div>
  );
}