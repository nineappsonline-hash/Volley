"use client";

import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  message: string;
  compact?: boolean;
  hint?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function EmptyState({
  message,
  compact = false,
  hint,
  icon: Icon = Inbox,
  action,
}: EmptyStateProps) {
  return (
    <div className={`animate-fade-in-up flex flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center ${compact ? "gap-2 py-5" : "gap-3 py-12"}`}>
      <div className={`flex items-center justify-center rounded-full bg-muted text-muted-foreground ${compact ? "h-9 w-9" : "h-12 w-12"}`}>
        <Icon className={compact ? "h-4 w-4" : "h-6 w-6"} />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground/80">{hint}</p>}
      {action}
    </div>
  );
}