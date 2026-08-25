"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Attendance, Profile, TrainingSession } from "@/lib/types";

interface AnalyticsProps {
  sessions: TrainingSession[];
  attendance: Attendance[];
  profiles: Profile[];
}

export function AttendanceAnalytics({ sessions, attendance, profiles }: AnalyticsProps) {
  const { t: tk } = useI18n();
  const t = (key: string) => tk(key as any);

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const totalSessions = completedSessions.length;

  // Overall stats
  const totalPresent = attendance.filter((a) => a.is_present).length;
  const avgAttendance = totalSessions > 0 ? (totalPresent / totalSessions).toFixed(1) : "0";
  const totalPossible = totalSessions * profiles.filter((p) => p.is_active).length;
  const attendanceRate = totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(0) : "0";

  // Weekly trend (last 12 weeks)
  const now = new Date();
  const weeks: { label: string; count: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (w * 7 + now.getDay()));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const count = attendance.filter((a) => {
      if (!a.is_present) return false;
      const session = completedSessions.find((s) => s.id === a.session_id);
      if (!session) return false;
      const d = new Date(session.date);
      return d >= weekStart && d <= weekEnd;
    }).length;

    weeks.push({
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      count,
    });
  }

  const maxCount = Math.max(...weeks.map((w) => w.count), 1);

  // Per-member attendance
  const memberAttendance = profiles
    .filter((p) => p.is_active)
    .map((p) => ({
      name: p.name,
      attended: attendance.filter((a) => a.member_id === p.id && a.is_present).length,
      rate: totalSessions > 0
        ? ((attendance.filter((a) => a.member_id === p.id && a.is_present).length / totalSessions) * 100).toFixed(0)
        : "0",
    }))
    .sort((a, b) => b.attended - a.attended);

  if (totalSessions === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            {t("analytics_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("analytics_no_data")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          {t("analytics_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold">{totalSessions}</p>
            <p className="text-xs text-muted-foreground">{t("analytics_total_sessions")}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{avgAttendance}</p>
            <p className="text-xs text-muted-foreground">{t("analytics_avg_attendance")}</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{attendanceRate}%</p>
            <p className="text-xs text-muted-foreground">{t("analytics_attendance_rate")}</p>
          </div>
        </div>

        {/* Weekly trend bar chart */}
        <div>
          <p className="text-sm font-medium mb-3">{t("analytics_trend")}</p>
          <div className="flex items-end gap-1 h-32">
            {weeks.map((week, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary rounded-t"
                  style={{ height: `${(week.count / maxCount) * 100}%`, minHeight: week.count > 0 ? "4px" : "0" }}
                />
                <span className="text-[8px] text-muted-foreground truncate w-full text-center">
                  {week.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Per-member attendance */}
        {memberAttendance.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-3">{t("analytics_top_attendees")}</p>
            <div className="space-y-2">
              {memberAttendance.slice(0, 10).map((m, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-28 truncate font-medium">{m.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${m.rate}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {m.attended}/{totalSessions}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
