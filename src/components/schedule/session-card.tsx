"use client";

import { format } from "date-fns";
import {
  Ban,
  CalendarDays,
  Clock,
  MapPin,
  RotateCcw,
  StickyNote,
  Trash2,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProfitLossIndicator } from "@/components/shared/profit-loss-indicator";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatTime12h } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { SessionCalculation, SessionGuest, TrainingSession } from "@/lib/types";

interface SessionCardProps {
  session: TrainingSession;
  sportName?: string | null;
  coachName?: string | null;
  venueName?: string | null;
  presentCount?: number;
  guests?: SessionGuest[];
  calculation?: SessionCalculation | null;
  onOpenDetails?: () => void;
  onEdit?: () => void;
  onMarkAttendance?: () => void;
  onCancel?: () => void;
  onRestore?: () => void;
  onDelete?: () => void;
}

export function SessionCard({
  session,
  sportName,
  coachName,
  venueName,
  presentCount,
  guests,
  calculation,
  onOpenDetails,
  onEdit,
  onMarkAttendance,
  onCancel,
  onRestore,
  onDelete,
}: SessionCardProps) {
  const { t, lang, locale } = useI18n();
  const d = new Date(session.date + "T00:00:00");
  const canceled = session.status === "canceled";
  const completed = session.status === "completed";

  // Only surface an excess/loss badge when there is real financial data
  // (costs configured or attendance marked) — a plain "Excess 0.00" on
  // sessions nobody has set up yet is misleading.
  const hasFinances =
    !!calculation &&
    (Number(calculation.cost_per_session) > 0 ||
      Number(calculation.total_revenue) > 0);

  return (
    <Card
      onClick={onOpenDetails}
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      onKeyDown={
        onOpenDetails
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                // Don't steal Enter/Space from the card's own buttons.
                if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) {
                  return;
                }
                e.preventDefault();
                onOpenDetails();
              }
            }
          : undefined
      }
      className={cn(
        "group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md",
        onOpenDetails && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        completed && "opacity-70",
        canceled && "border-negative-300/60 opacity-70 dark:border-negative-500/30"
      )}
    >
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={completed ? "secondary" : "default"} className="gap-1">
              <CalendarDays className="h-3 w-3" />
              {format(d, "EEE, MMM d", { locale })}
            </Badge>
            {canceled && (
              <Badge variant="destructive" className="gap-1">
                <Ban className="h-3 w-3" />
                {t("schedule_canceled")}
              </Badge>
            )}
            {completed && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                {t("schedule_completed")}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 font-mono">
              <Clock className="h-3 w-3" />
              {formatTime12h(session.time, lang)}
            </Badge>
            {sportName && (
              <Badge variant="secondary" className="gap-1">
                <Trophy className="h-3 w-3" />
                {sportName}
              </Badge>
            )}
            {coachName && (
              <Badge variant="outline" className="gap-1">
                <UserRound className="h-3 w-3" />
                {coachName}
              </Badge>
            )}
            {session.age_group && (
              <Badge variant="outline" className="font-mono">
                {session.age_group}
              </Badge>
            )}
            {session.skill_level && (
              <Badge variant="outline">{t(`skill_${session.skill_level}`)}</Badge>
            )}
          </div>
          {hasFinances && calculation && (
            <ProfitLossIndicator value={calculation.profit_loss} />
          )}
        </div>
        <div className="space-y-2 px-4 py-3">
          {(session.location || venueName) && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              {venueName ?? session.location}
            </p>
          )}
          {session.notes && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <StickyNote className="h-4 w-4 shrink-0 text-primary" />
              {session.notes}
            </p>
          )}
          <div className="flex items-center justify-between pt-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {!canceled && (
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
              )}
              {!canceled && guests && guests.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                  <span className="font-semibold text-foreground">{guests.length}</span>
                  {t("guests_short")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {!completed && !canceled && onMarkAttendance && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAttendance();
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("attendance_title")}
                </button>
              )}
              {!canceled && onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="text-xs font-medium text-muted-foreground hover:underline"
                >
                  {t("common_edit")}
                </button>
              )}
              {!completed && !canceled && onCancel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                  }}
                  title={t("schedule_cancel")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-warning-ink hover:underline dark:text-attention-400"
                >
                  <Ban className="h-3 w-3" />
                  {t("common_cancel")}
                </button>
              )}
              {canceled && onRestore && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore();
                  }}
                  title={t("schedule_restore")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t("schedule_restore")}
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  title={t("common_delete")}
                  className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("common_delete")}
                </button>
              )}
            </div>
          </div>
          {hasFinances && calculation && (
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">{t("attendance_revenue")}</span>
              <span className="font-mono font-semibold">
                {formatMoney(calculation.total_revenue, lang)}
              </span>
            </div>
          )}
          {!hasFinances && guests && guests.length > 0 && (
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-xs">
              <span className="text-muted-foreground">{t("guests_revenue")}</span>
              <span className="font-mono font-semibold">
                {formatMoney(
                  guests.reduce((s, g) => s + Number(g.amount_paid), 0),
                  lang
                )}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
