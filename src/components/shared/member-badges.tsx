"use client";

import { useMemberBadges } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { Trophy } from "lucide-react";

const BADGE_CONFIG: Record<string, { icon: string; color: string }> = {
  first_session: { icon: "⭐", color: "bg-yellow-100 border-yellow-300" },
  ten_sessions: { icon: "🔥", color: "bg-orange-100 border-orange-300" },
  twenty_five_sessions: { icon: "💪", color: "bg-blue-100 border-blue-300" },
  fifty_sessions: { icon: "🏆", color: "bg-purple-100 border-purple-300" },
  hundred_sessions: { icon: "👑", color: "bg-amber-100 border-amber-300" },
};

export function MemberBadges({ memberId }: { memberId?: string }) {
  const { t: tk } = useI18n();
  const t = (key: string) => tk(key as any);
  const { data: badges = [] } = useMemberBadges(memberId);

  const totalBadges = Object.keys(BADGE_CONFIG).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" />
          {t("badges_title")}
          <Badge variant="secondary" className="ml-auto">
            {badges.length}/{totalBadges}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {badges.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("badges_earned").replace("{n}", "0")}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {badges.map((badge) => {
              const config = BADGE_CONFIG[badge.badge_type] || { icon: badge.icon || "🏅", color: "bg-gray-100 border-gray-300" };
              return (
                <div
                  key={badge.id}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-center ${config.color}`}
                >
                  <span className="text-2xl">{config.icon}</span>
                  <span className="text-xs font-medium">{badge.badge_name}</span>
                  {badge.description && (
                    <span className="text-[10px] text-muted-foreground">{badge.description}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
