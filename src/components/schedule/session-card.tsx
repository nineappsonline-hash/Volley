"use client";

import { format } from "date-fns";
import { CalendarDays, Clock, MapPin, StickyNote, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProfitLossIndicator } from "@/components/shared/profit-loss-indicator";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import type { SessionCalculation, TrainingSession } from "@/lib/types";

interface SessionCardProps {
  session: TrainingSession;
  presentCount?: number;
  calculation?: SessionCalculation | null;
  onEdit?: () => void;
  onMarkAttendance?: () => void;
}

export function SessionCard({
  session,
  presentCount,
  calculation,
  onEdit,
  onMarkAttendance,
}: SessionCardProps) {
  const { t, lang, locale } = useI18n();
  const d = new Date(session.date + "T00:00:00");

  return (
    <Card
      className={`group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md ${
        session.is_completed ? "opacity-70" : ""
      }`}
    >
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Badge
              variant={session.is_completed ? "secondary" : "default"}
              className="gap-1"
            >
              <CalendarDays className="h-3 w-3" />
              {format(d, "EEE, MMM d", { locale })}
            </Badge>
            <Badge variant="outline" className="gap-1 font-mono">
              <Clock className="h-3 w-3" />
              {session.time.slice(0, 5)}
            </Badge>
          </div>
          {calculation && <ProfitLossIndicator value={calculation.profit_loss} />}
        </div>
        <div className="space-y-2 px-4 py-3">
          {session.location && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              {session.location}
            </p>
          )}
          {session.notes && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <StickyNote className="h-4 w-4 shrink-0 text-primary" />
              {session.notes}
            </p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-4 w-4" />
              {presentCount !== undefined ? (
                <>
                  <span className="font-semibold text-foreground">
                    {presentCount}
                  </span>
                  {t("schedule_attending")}
                </>
              ) : (
                t("common_not_set")
              )}
            </span>
            <div className="flex gap-1">
              {onMarkAttendance && (
                <button
                  onClick={onMarkAttendance}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("attendance_title")}
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="text-xs font-medium text-muted-foreground hover:underline"
                >
                  {t("common_edit")}
                </button>
              )}
            </div>
          </div>
          {calculation && (
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">{t("attendance_revenue")}</span>
              <span className="font-mono font-semibold">
                {formatMoney(calculation.total_revenue, lang)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
