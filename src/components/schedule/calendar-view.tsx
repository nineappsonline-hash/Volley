"use client";

import Link from "next/link";
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
import { formatTime12h } from "@/lib/constants";
import type { TrainingAgendaItem } from "@/lib/member-training";
import type { TrainingSession } from "@/lib/types";

interface CalendarViewProps {
  sessions: TrainingSession[];
  training?: TrainingAgendaItem[];
  sportNameById?: Map<string, string>;
  venueNameById?: Map<string, string>;
  coachNameById?: Map<string, string>;
  games?: { id: string; title: string; sport: string; game_date: string; start_time: string; location: string | null; invite_code: string | null }[];
  onSelectSession?: (session: TrainingSession) => void;
}

type ViewMode = "month" | "week";

export function CalendarView({ sessions, onSelectSession, sportNameById, venueNameById, coachNameById, games = [], training = [] }: CalendarViewProps) {
  const { t, lang, locale } = useI18n();
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
                  ? "bg-info text-info-foreground"
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
                  ? "bg-info text-info-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("schedule_week_view")}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto"><div className="grid min-w-[840px] grid-cols-7 gap-1">
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
            <div
              key={key}
              className={cn(
                "flex min-h-16 flex-col items-stretch gap-1 rounded-lg border p-1.5 text-start transition-all hover:border-info/40 hover:bg-accent/50",
                !inMonth && "opacity-40",
                isToday && "border-info/60 bg-info/5 ring-1 ring-info/30"
              )}
            >
              <span
                className={cn(
                  "text-xs font-semibold",
                  isToday ? "text-info-ink" : "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </span>
              {training.filter(item => item.date === key).map(item => <Link key={item.id} href={item.href} className="rounded bg-emerald-100 px-2 py-1.5 text-xs text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200"><span className="block font-bold">{item.name || (lang === "ar" ? "تدريب" : "Training")}</span><span className="block">{formatTime12h(item.time, lang)}</span><span className="block">{item.location}</span></Link>)}
              {daySessions.map((s) => (
                <button
                  type="button"
                  onClick={() => onSelectSession?.(s)}
                  key={s.id}
                  className={cn(
                    "rounded px-2 py-1.5 text-start text-xs font-medium break-words focus-visible:ring-2 focus-visible:ring-ring",
                    s.status === "canceled"
                      ? "bg-negative-100 text-error-ink line-through dark:bg-negative-500/20 dark:text-negative-300"
                      : s.status === "completed"
                        ? "bg-muted text-muted-foreground line-through"
                        : "bg-interactive-100 text-info-ink dark:bg-interactive-500/20 dark:text-interactive-300"
                  )}
                >
                  <span className="block font-bold">{sportNameById?.get(s.sport_id ?? "") ?? (lang === "ar" ? "تدريب" : "Training")}</span>
                  <span className="block">{lang === "ar" ? "حصة تدريب" : "Training session"} · {formatTime12h(s.time, lang)}</span>
                  <span className="block">{venueNameById?.get(s.venue_id ?? "") ?? s.location}</span>
                  {s.coach_id && <span className="block">{coachNameById?.get(s.coach_id)}</span>}
                  {s.age_group && <span className="block">{s.age_group}</span>}
                </button>
              ))}
              {games.filter(game => game.game_date === key).map(game => (
                <Link key={game.id} href={game.invite_code ? `/games?join=${encodeURIComponent(game.invite_code)}` : "/games"}
                  className="rounded bg-primary/10 px-2 py-1.5 text-xs text-primary break-words focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="block font-bold">{game.sport} · {lang === "ar" ? "ماتش" : "Game"}</span>
                  <span className="block">{game.title}</span>
                  <span className="block">{formatTime12h(game.start_time, lang)}</span>
                  <span className="block">{game.location}</span>
                </Link>
              ))}
            </div>
          );
        })}
      </div></div>
    </div>
  );
}
