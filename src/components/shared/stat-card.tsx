"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "success" | "destructive" | "warning";
}

const toneClasses: Record<string, string> = {
  default: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  success:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  destructive:
    "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  warning:
    "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: StatCardProps) {
  return (
    <Card className="group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
            toneClasses[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 truncate text-2xl font-extrabold tracking-tight">
            {value}
          </p>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
