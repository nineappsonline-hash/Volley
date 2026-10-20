"use client";

import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "info" | "success" | "destructive" | "warning" | "brand";
  index?: number;
  colorful?: boolean;
}

const toneClasses: Record<string, string> = {
  default:
    "bg-interactive-50 text-secondary",
  info: "bg-interactive-50 text-info-ink ",
  success:
    "bg-positive-50 text-success-ink ",
  destructive:
    "bg-negative-50 text-error-ink ",
  warning:
    "bg-attention-50 text-warning-ink ",
  brand: "bg-brand-100/80 text-brand-800 ",
};

const accentClasses: Record<string, string> = {
  default: "from-interactive-500 to-positive-400",
  info: "from-interactive-400 to-interactive-600",
  success: "from-positive-400 to-positive-600",
  destructive: "from-negative-400 to-negative-600",
  warning: "from-attention-400 to-attention-600",
  brand: "from-brand-500 to-interactive-500",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  tone = "default",
  index,
  colorful = false,
}: StatCardProps) {
  const delay: CSSProperties = index != null ? { animationDelay: `${index * 70}ms` } : {};
  return (
    <Card
      className="group relative h-full animate-fade-in-up overflow-hidden rounded-2xl bg-card text-card-foreground transition-shadow hover:shadow-md motion-reduce:animate-none"
      style={delay}
    >
      {colorful && <Icon aria-hidden="true" className="pointer-events-none absolute -bottom-4 -end-3 h-24 w-24 -rotate-12 text-muted-foreground/10" strokeWidth={1} />}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          accentClasses[tone]
        )}
      />
      <CardContent className="flex items-start gap-4 p-5">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:-rotate-3 group-hover:scale-110",
            toneClasses[tone]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-sm", "text-muted-foreground")}>{title}</p>
          <p className="mt-1 truncate text-2xl font-extrabold tracking-tight">
            {value}
          </p>
          {hint && <p className={cn("mt-0.5 text-xs", "text-muted-foreground")}>{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}