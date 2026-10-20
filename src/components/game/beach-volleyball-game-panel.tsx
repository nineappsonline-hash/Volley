"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { gameText } from "@/lib/game/i18n";
import type { BeachVolleyballGameProps } from "./beach-volleyball-game";

type GameComponent = ComponentType<BeachVolleyballGameProps>;

export interface BeachVolleyballGamePanelProps {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onCancel: () => void;
  Game: GameComponent | null;
}

/**
 * The lazily-mounted court itself: fullscreen toggle, loading and failure
 * states, and the iframe-backed game. Shared so the homepage and dashboard
 * cards cannot drift apart.
 */
export function BeachVolleyballGamePanel({
  fullscreen,
  onToggleFullscreen,
  loading,
  failed,
  onRetry,
  onCancel,
  Game,
}: BeachVolleyballGamePanelProps) {
  const { lang } = useI18n();
  const t = gameText(lang);

  return (
    <div
      className={cn(
        fullscreen
          ? "fixed inset-0 z-[120] flex flex-col overflow-y-auto bg-brand-950 p-2 sm:p-6"
          : "p-3 sm:p-4",
      )}
    >
      <div className={cn("mx-auto w-full", fullscreen ? "my-auto max-w-5xl shrink-0" : "")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10"
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {fullscreen ? t.exitBiggerScreen : t.biggerScreen}
          </button>
        </div>

        {loading && (
          <div
            className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-brand text-white"
            role="status"
          >
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-[var(--color-primary)]" />
            <p className="text-sm font-semibold text-white/80">{t.loading}</p>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-bold hover:bg-white/10"
            >
              {t.cancel}
            </button>
          </div>
        )}

        {failed && !loading && (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-brand text-white">
            <p className="text-sm font-semibold text-white/80">{t.loadError}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-foreground"
            >
              {t.retry}
            </button>
          </div>
        )}

        {Game && !loading && !failed && <Game variant={fullscreen ? "page" : "inline"} />}
      </div>
    </div>
  );
}
