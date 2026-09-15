"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight entrance animation wrapper (CSS-only, respects the reduced-motion
 * media query via the global `prefers-reduced-motion` guard on keyframes).
 * Pass an `index` to stagger children.
 */
export function Reveal({
  children,
  index = 0,
  className,
  style,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("animate-fade-in-up motion-reduce:animate-none", className)}
      style={{ animationDelay: `${Math.min(Math.max(index, 0), 12) * 70}ms`, ...style }}
    >
      {children}
    </div>
  );
}