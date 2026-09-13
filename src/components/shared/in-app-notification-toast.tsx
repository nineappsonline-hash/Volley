"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TYPE_ICONS } from "@/components/layout/notifications";
import type { AppNotification } from "@/lib/types";

function showAlert(router: ReturnType<typeof useRouter>, n: AppNotification) {
  const Icon = TYPE_ICONS[n.type] ?? Bell;
  let id: string | number = "";
  id = toast.custom(
    () => (
      <button
        type="button"
        onClick={() => {
          toast.dismiss(id);
          if (n.link) router.push(n.link);
        }}
        className="flex w-80 items-start gap-3 rounded-xl border bg-background p-3 text-start shadow-lg"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug">
            {n.title}
          </span>
          {n.body && (
            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
              {n.body}
            </span>
          )}
        </span>
      </button>
    ),
    { duration: 6000, position: "top-right" }
  );
}

/**
 * Shows an in-app alert (toast with the notification-type icon) the moment a
 * new notification arrives for the signed-in user — e.g. "someone joined your
 * game" — even while they're browsing. Tapping it opens the linked page.
 *
 * Pairs with the OS push notification: the system alert covers the user while
 * the app is closed, this covers them while the app is open.
 */
export function InAppNotificationToast({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;
    const client = createClient();

    const channel = client
      .channel("in-app-notification-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          showAlert(router, payload.new as AppNotification);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}