"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export interface CarouselMetrics {
  index: number;
  pages: number;
  atStart: boolean;
  atEnd: boolean;
}

/**
 * Tracks the real scroll position of a horizontal snap list so the arrows, edge
 * fades and dots all describe where the member actually is instead of guessing.
 * RTL flips the scroll direction so "next" keeps pointing at the next card.
 */
export function useCarousel(lang: string) {
  const track = useRef<HTMLUListElement>(null);
  const [metrics, setMetrics] = useState<CarouselMetrics>({
    index: 0,
    pages: 1,
    atStart: true,
    atEnd: true,
  });

  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    const pages = max <= 1 ? 1 : Math.round(max / Math.max(element.clientWidth, 1)) + 1;
    setMetrics({
      index: max <= 1 ? 0 : Math.round((element.scrollLeft / max) * (pages - 1)),
      pages,
      atStart: element.scrollLeft <= 1,
      atEnd: element.scrollLeft >= max - 1,
    });
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    measure();
    element.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // Images inside the cards change the scroll width after they decode.
    for (const image of Array.from(element.querySelectorAll("img"))) {
      image.addEventListener("load", measure);
      image.addEventListener("error", measure);
    }
    return () => {
      element.removeEventListener("scroll", measure);
      observer.disconnect();
      for (const image of Array.from(element.querySelectorAll("img"))) {
        image.removeEventListener("load", measure);
        image.removeEventListener("error", measure);
      }
    };
  }, [measure]);

  const scroll = useCallback(
    (direction: number) => {
      const element = track.current;
      if (!element) return;
      element.scrollBy({
        left: direction * (lang === "ar" ? -1 : 1) * element.clientWidth * 0.85,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    },
    [lang]
  );

  return { track, scroll, ...metrics };
}

export function CarouselArrows({
  onPrev,
  onNext,
  canPrev,
  canEnd,
  prevLabel,
  nextLabel,
  className,
  disabled,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canEnd: boolean;
  prevLabel: string;
  nextLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 min-w-11 rounded-full sm:min-w-8"
        disabled={disabled || !canPrev}
        aria-label={prevLabel}
        onClick={onPrev}
      >
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 min-w-11 rounded-full sm:min-w-8"
        disabled={disabled || !canEnd}
        aria-label={nextLabel}
        onClick={onNext}
      >
        <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function CarouselDots({ pages, index }: Pick<CarouselMetrics, "pages" | "index">) {
  if (pages < 2) return null;
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: pages }, (_, dot) => (
        <span
          key={dot}
          className={cn(
            "h-1.5 rounded-full transition-all",
            dot === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}

/** Soft fade telling the member there is more content past this edge. */
export function CarouselFade({
  side,
  visible,
}: {
  side: "start" | "end";
  visible: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-0 z-10 w-8 transition-opacity duration-200",
        side === "start" ? "start-0 bg-gradient-to-r from-card to-transparent" : "end-0 bg-gradient-to-l from-card to-transparent",
        visible ? "opacity-100" : "opacity-0"
      )}
    />
  );
}