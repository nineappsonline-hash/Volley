"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Bell,
  BellRing,
  CheckCheck,
  Flag,
  PlusCircle,
  RefreshCw,
  Trophy,
  UserPlus,
  UserRoundPlus,
  UserRoundX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/lib/queries";
import { usePushNotifications } from "@/lib/push";
import { useRealtime } from "@/lib/useRealtime";
import type { NotificationType } from "@/lib/types";

export const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  game_join: UserPlus,
  game_left: UserRoundX,
  game_filled: PlusCircle,
  game_alert: Bell,
  game_cancelled: Flag,
  game_result: Trophy,
  tournament_announced: Trophy,
  coach_invite: UserRoundPlus,
};

export function Notifications() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { data: items } = useNotifications(40);
  const markRead = useMarkNotificationsRead();
  useRealtime(["notifications"]);
  const push = usePushNotifications();
  const [open, setOpen] = useState(false);

  const handleTogglePush = async (on: boolean) => {
    if (on) {
      const ok = await push.subscribe();
      if (!ok) toast.error(t("push_permission_denied"));
    } else {
      await push.unsubscribe();
    }
  };

  const unread = useMemo(
    () => (items ?? []).filter((n) => !n.is_read).length,
    [items]
  );

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && unread > 0) {
      markRead.mutate(undefined);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t("notif_title")}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute end-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {Math.min(unread, 9)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(21rem,calc(100vw-2rem))] p-0"
      >
        <div className="flex items-center justify-between border-b p-3">
          <span className="font-semibold">{t("notif_title")}</span>
          {items && items.length > 0 && (
            <button
              onClick={() => markRead.mutate(undefined)}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t("notif_mark_all")}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {items && items.length > 0 ? (
            items.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Bell;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (n.link) {
                      router.push(n.link);
                      setOpen(false);
                    }
                  }}
                  className={`block w-full text-start ${
                    n.link ? "cursor-pointer" : "cursor-default"
                  } flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent ${
                    n.is_read ? "opacity-70" : ""
                  }`}
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{n.title}</p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), {
                        addSuffix: true,
                        locale,
                      })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <Bell className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t("notif_empty")}</p>
            </div>
          )}
        </div>
        {markRead.isPending && (
          <div className="flex items-center justify-center gap-1 border-t p-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3 animate-spin" />
            {t("notif_updating")}
          </div>
        )}
        {push.supported && (
          <div className="flex items-center justify-between border-t p-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-muted-foreground" />
              <div className="space-y-0">
                <p className="text-xs font-medium">{t("push_browser_title")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("push_browser_hint")}
                </p>
              </div>
            </div>
            <Switch
              checked={push.subscribed}
              disabled={push.busy}
              onCheckedChange={handleTogglePush}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}