"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { trackGameEvent } from "./analytics";
import type { BeachVolleyballGameProps } from "@/components/game/beach-volleyball-game";

type GameComponent = ComponentType<BeachVolleyballGameProps>;

export type GameCardPlacement = "homepage" | "dashboard";

const loadGame = () => import("@/components/game/beach-volleyball-3d");

/**
 * Shared lifecycle for every entry point that lazily boots the 3D beach game.
 *
 * The homepage and dashboard render different shells, but opening, lazy loading,
 * fullscreen and the once-only card-view beacon must behave the same in both,
 * so they live here and the cards stay presentational.
 */
export function useBeachGameCard(placement: GameCardPlacement) {
  const [opened, setOpened] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [Game, setGame] = useState<GameComponent | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const viewLogged = useRef(false);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || viewLogged.current) return;
    let timer: number | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= 0.5 && timer === null && !viewLogged.current) {
            timer = window.setTimeout(() => {
              viewLogged.current = true;
              trackGameEvent("game_card_view", { placement });
              observer.disconnect();
            }, 1000);
          } else if (entry.intersectionRatio < 0.5 && timer !== null) {
            window.clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: [0.5] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [placement]);

  const load = () => {
    setFailed(false);
    if (Game) return;
    setLoading(true);
    loadGame()
      .then((mod) => setGame(() => mod.BeachVolleyballGame))
      .catch(() => {
        setFailed(true);
        trackGameEvent("game_load_error", { placement });
      })
      .finally(() => setLoading(false));
  };

  const open = () => {
    trackGameEvent("game_open", { source: placement });
    setOpened(true);
    load();
  };

  const close = () => {
    setOpened(false);
    setLoading(false);
    setFullscreen(false);
  };

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return {
    opened,
    fullscreen,
    setFullscreen,
    loading,
    failed,
    Game,
    cardRef,
    open,
    load,
    close,
  };
}
