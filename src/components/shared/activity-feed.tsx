"use client";

import { useActivityFeed } from "@/lib/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import {
  Activity,
  UserPlus,
  CheckCircle,
  CreditCard,
  Trophy,
  ClipboardCheck,
  Star,
  QrCode,
} from "lucide-react";

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  joined: <UserPlus className="h-4 w-4 text-success-ink" />,
  attended: <CheckCircle className="h-4 w-4 text-info-ink" />,
  payment: <CreditCard className="h-4 w-4 text-success-ink" />,
  badge: <Trophy className="h-4 w-4 text-warning-ink" />,
  evaluation: <ClipboardCheck className="h-4 w-4 text-foreground" />,
  rating: <Star className="h-4 w-4 text-warning-ink" />,
  checkin: <QrCode className="h-4 w-4 text-info-ink" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
  joined: "bg-positive-100 text-success-ink",
  attended: "bg-interactive-100 text-info-ink",
  payment: "bg-positive-100 text-success-ink",
  badge: "bg-attention-100 text-warning-ink",
  evaluation: "bg-brand-100 text-foreground",
  rating: "bg-attention-100 text-warning-ink",
  checkin: "bg-interactive-100 text-info-ink",
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-GB");
}

export function ActivityFeed({ memberId, limit = 20 }: { memberId?: string; limit?: number }) {
  const { t: tk } = useI18n();
  const t = (key: string) => tk(key as any);
  const { data: activities = [], isLoading } = useActivityFeed(memberId, limit);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          {t("activity_title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("activity_empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {activities.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {ACTIVITY_ICONS[item.activity_type] || <Activity className="h-4 w-4 text-neutral-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{item.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${ACTIVITY_COLORS[item.activity_type] || ""}`}
                    >
                      {t(`activity_${item.activity_type}` as any)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(item.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
