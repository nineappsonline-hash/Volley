"use client";

import { Bell } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/constants";
import { useAllPayments, useUpcomingSessions } from "@/lib/queries";

export function Notifications() {
  const { t, lang, locale } = useI18n();
  const { data: payments } = useAllPayments();
  const { data: upcoming } = useUpcomingSessions();

  const recentPayments = (payments ?? []).slice(0, 3);
  const total = (recentPayments.length ?? 0) + (upcoming?.length ?? 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notif_title")}>
          <Bell className="h-5 w-5" />
          {total > 0 && (
            <span className="absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {Math.min(total, 9)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b p-3 font-semibold">{t("notif_title")}</div>
        <div className="max-h-80 overflow-y-auto p-2">
          {upcoming && upcoming.length > 0 && (
            <div className="mb-2 rounded-md bg-blue-50 p-3 text-sm dark:bg-blue-500/10">
              <p className="font-medium text-blue-700 dark:text-blue-300">
                {upcoming.length} {t("notif_upcoming")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {format(
                  new Date(upcoming[0].date + "T00:00:00"),
                  "EEE, MMM d",
                  { locale }
                )}
                {" · "}
                {upcoming[0].time.slice(0, 5)}
              </p>
            </div>
          )}
          {recentPayments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              <span className="text-muted-foreground">{t("notif_new_payment")}</span>
              <span className="flex items-center gap-2">
                <Badge variant="success" className="font-mono">
                  {formatMoney(p.amount, lang)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(p.payment_date + "T00:00:00"), "MMM d", {
                    locale,
                  })}
                </span>
              </span>
            </div>
          ))}
          {recentPayments.length === 0 && (!upcoming || upcoming.length === 0) && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {t("notif_empty")}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
