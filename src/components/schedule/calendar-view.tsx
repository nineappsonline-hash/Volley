"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { TrainingSession } from "@/lib/types";

interface CalendarViewProps {
  sessions: TrainingSession[];
  onSelectSession?: (session: TrainingSession) => void;
}

type ViewMode = "month" | "week";

export function CalendarView({ sessions, onSelectSession }: CalendarViewProps) {
  const { t, locale } = useI18n();
  const [cursor, setCursor] = useState(new Date());
  const [mode, setMode] = useState<ViewMode>("month");

  const days = useMemo(() => {
    if (mode === "month") {
      return eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      });
    }
    return eachDayOfInterval({
      start: startOfWeek(cursor, { weekStartsOn: 1 }),
      end: endOfWeek(cursor, { weekStartsOn: 1 }),
    });
  }, [cursor, mode]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    for (const s of sessions) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [sessions]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: endOfWeek(start, { weekStartsOn: 1 }) });
  }, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setCursor((c) => (mode === "month" ? subMonths(c, 1) : addDays(c, -7)))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setCursor((c) => (mode === "month" ? addMonths(c, 1) : addDays(c, 7)))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            {t("schedule_today")}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold capitalize">
            {format(cursor, "MMMM yyyy", { locale })}
          </h3>
          <div className="flex rounded-lg border p-0.5">
            <button
              onClick={() => setMode("month")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                mode === "month"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("schedule_month_view")}
            </button>
            <button
              onClick={() => setMode("week")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                mode === "week"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("schedule_week_view")}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((d) => (
          <div
            key={d.toISOString()}
            className="pb-1 text-center text-xs font-semibold text-muted-foreground"
          >
            {format(d, "EEEEEE", { locale })}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const daySessions = sessionsByDate.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={key}
              onClick={() => daySessions[0] && onSelectSession?.(daySessions[0])}
              className={cn(
                "flex min-h-16 flex-col items-stretch gap-1 rounded-lg border p-1.5 text-start transition-all hover:border-primary/40 hover:bg-accent/50",
                !inMonth && "opacity-40",
                isToday && "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
              )}
            >
              <span
                className={cn(
                  "text-xs font-semibold",
                  isToday ? "text-primary" : "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              {daySessions.slice(0, 3).map((s) => (
                <span
                  key={s.id}
                  className={cn(
                    "truncate rounded px-1 py-0.5 text-[10px] font-medium",
                    s.status === "canceled"
                      ? "bg-red-100 text-red-700 line-through dark:bg-red-500/20 dark:text-red-300"
                      : s.status === "completed"
                        ? "bg-muted text-muted-foreground line-through"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                  )}
                >
                  {s.time.slice(0, 5)}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
