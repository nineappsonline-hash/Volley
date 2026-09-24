"use client";

import { useUnreadContactCount } from "@/lib/queries";
import { useRealtime } from "@/lib/useRealtime";

/** Live unread counter shown next to the "Messages" admin nav item. */
export function MessagesUnreadBadge() {
  const { data: unread = 0 } = useUnreadContactCount();
  useRealtime(["contact_messages"]);

  if (unread <= 0) return null;

  return (
    <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-primary-foreground">
      {Math.min(unread, 99)}
    </span>
  );
}