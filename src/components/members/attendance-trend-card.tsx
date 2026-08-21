"use client";

import { useMemo } from "react";
import { format, startOfMonth } from "date-fns";
import { TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import type { Attendance, TrainingSession } from "@/lib/types";

interface AttendanceTrendCardProps {
  memberId: string;
  attendance: Attendance[];
  sessions: TrainingSession[];
}

export function AttendanceTrendCard({
  memberId,
  attendance,
  sessions,
}: AttendanceTrendCardProps) {
  const { t, locale } = useI18n();

  const data = useMemo(() => {
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const months: { key: string; label: string; held: number; attended: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = startOfMonth(new Date(now.getFullYear(), now.getMonth() - i, 1));
      months.push({
        key: format(d, "yyyy-MM"),
        label: format(d, "MMM", { locale }),
        held: 0,
        attended: 0,
      });
    }
    const byKey = new Map(months.map((m) => [m.key, m]));

    for (const s of sessions) {
      if (s.status === "canceled") continue;
      const m = byKey.get(s.date.slice(0, 7));
      if (m) m.held += 1;
    }
    for (const a of attendance) {
      if (a.member_id !== memberId || !a.is_present) continue;
      const session = sessionById.get(a.session_id);
      if (!session || session.status === "canceled") continue;
      const m = byKey.get(session.date.slice(0, 7));
      if (m) m.attended += 1;
    }

    return months.map((m) => ({
      label: m.label,
      rate: m.held > 0 ? Math.round((m.attended / m.held) * 100) : 0,
    }));
  }, [memberId, attendance, sessions, locale]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          {t("trend_title")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("trend_hint")}</p>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip
                formatter={(value) => [`${value}%`, t("dash_my_attendance_rate")]}
                contentStyle={{ borderRadius: 8 }}
              />
              <Bar dataKey="rate" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
