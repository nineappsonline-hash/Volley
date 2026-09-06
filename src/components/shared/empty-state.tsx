"use client";

import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  message: string;
  hint?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function EmptyState({
  message,
  hint,
  icon: Icon = Inbox,
  action,
}: EmptyStateProps) {
  return (
    <div className="animate-fade-in-up flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground/80">{hint}</p>}
      {action}
    </div>
  );
}