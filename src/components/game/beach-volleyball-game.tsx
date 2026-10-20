"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Zap,
  CalendarDays,
  Gift,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { GameInputController, gameKeyInput } from "@/lib/game/input-controller";
import controls from "./game-controls.module.css";
import { DIFFICULTIES, WORLD } from "@/lib/game/config";
import { AI_LOOK, HUMAN_LOOKS, renderGame, type HumanLook } from "@/lib/game/render";
import {
  beginCountdown,
  beginTutorial,
  createGameState,
  currentStats,
  stepGame,
} from "@/lib/game/simulation";
import { gameText, difficultyLabel } from "@/lib/game/i18n";
import { GameAudio } from "@/lib/game/audio";
import { trackGameEvent } from "@/lib/game/analytics";
import {
  getBest,
  getMuted,
  saveBest,
  setMuted,
  setTutorialDone,
} from "@/lib/game/storage";
import {
  GAME_PATH,
  copyGameLink,
  gameUrl,
  shareResultCard,
} from "@/lib/game/share";
import type {
  Difficulty,
  GameState,
  InputState,
  Side,
} from "@/lib/game/types";

const FIXED_DT = 1 / 60;

type UiMode = "ready" | "playing" | "paused" | "result";

export interface BeachVolleyballGameProps {
  variant?: "inline" | "page";
  onRequestClose?: () => void;
  bookingHref?: string;
  className?: string;
}

function emptyInput(): InputState {
  return { left: false, right: false, jump: false, hit: false, tip: false };
}

function wins(side: Side | "draw" | null, target: Side): boolean {
  return side === target;
}

export function BeachVolleyballGame({
  variant = "inline",
  onRequestClose,
  bookingHref = "/games?sport=beach-volleyball",
  className,
}: BeachVolleyballGameProps) {
  const { lang, dir } = useI18n();
  const t = useMemo(() => gameText(lang), [lang]);

  const [ui, setUi] = useState<UiMode>("ready");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [look, setLook] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [touchInput, setTouchInput] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [phase, setPhase] = useState<GameState["phase"]>("ready");
  const [hud, setHud] = useState({
    humanPoints: 0,
    aiPoints: 0,
    remaining: 90,
    countdown: 0,
    servePrompt: false,
    pointReason: null as GameState["pointReason"],
    pointWinner: null as Side | null,
    tutorial: { moved: false, jumped: false, hit: false },
  });
  const [pauseMenu, setPauseMenu] = useState(false);
  const [resumeIn, setResumeIn] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [result, setResult] = useState<{
    stats: ReturnType<typeof currentStats>;
    isNewBest: boolean;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>(emptyInput());
  const audioRef = useRef<GameAudio | null>(null);
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const alphaRef = useRef(1);
  const pausedRef = useRef(false);
  const resumeHoldRef = useRef(0);
  const lastPhaseRef = useRef<GameState["phase"]>("ready");
  const hudSigRef = useRef("");
  const finishedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const lookRef = useRef<HumanLook>(HUMAN_LOOKS[0]);
  const uiRef = useRef<UiMode>("ready");
  const sessionReportedRef = useRef(false);

  uiRef.current = ui;

  // Initialise mutable game singletons once.
  if (!stateRef.current) {
    stateRef.current = createGameState({ mode: "match", difficulty: "medium", seed: Date.now() });
  }
  if (!audioRef.current) {
    audioRef.current = new GameAudio(true);
  }

  const inputController = useRef(new GameInputController());
  const clearInput = useCallback(() => {
    inputRef.current = inputController.current.clear();
    containerRef.current?.querySelectorAll("[data-pressed]").forEach(node => node.removeAttribute("data-pressed"));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const beginSession = useCallback(
    (next: GameState) => {
      stateRef.current = next;
      clearInput();
      accRef.current = 0;
      lastRef.current = performance.now();
      finishedRef.current = false;
      setPauseMenu(false);
      setResumeIn(0);
      resumeHoldRef.current = 0;
      pausedRef.current = false;
      lastPhaseRef.current = next.phase;
      setPhase(next.phase);
      setUi("playing");
      uiRef.current = "playing";
      sessionReportedRef.current = false;
      trackGameEvent("game_match_start", {
        mode: next.mode,
        difficulty: next.difficulty,
        rulesVersion: next.rulesVersion,
      });
      requestAnimationFrame(() => containerRef.current?.focus({ preventScroll: true }));
    },
    [clearInput],
  );

  const startMatch = useCallback(() => {
    const next = createGameState({ mode: "match", difficulty, seed: Date.now() });
    beginCountdown(next);
    finishedRef.current = false;
    beginSession(next);
  }, [beginSession, difficulty]);

  const startTutorial = useCallback(() => {
    const next = createGameState({ mode: "tutorial", difficulty: "easy", seed: Date.now() });
    beginTutorial(next);
    beginSession(next);
  }, [beginSession]);

  const pause = useCallback(() => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    clearInput();
    setUi("paused");
    uiRef.current = "paused";
    setPauseMenu(true);
  }, [clearInput]);

  const resume = useCallback(() => {
    setPauseMenu(false);
    resumeHoldRef.current = 1.5;
    setResumeIn(1.5);
    pausedRef.current = true;
  }, []);

  const quitToStart = useCallback(() => {
    const state = stateRef.current;
    if (state && state.phase !== "matchResult") {
      trackGameEvent("game_match_abandon", {
        mode: state.mode,
        progress: Math.round(state.activeTime),
        reason: "user_quit",
      });
    }
    pausedRef.current = false;
    resumeHoldRef.current = 0;
    clearInput();
    const fresh = createGameState({ mode: "match", difficulty, seed: Date.now() });
    stateRef.current = fresh;
    finishedRef.current = false;
    lastPhaseRef.current = "ready";
    setPhase("ready");
    setUi("ready");
    uiRef.current = "ready";
  }, [clearInput, difficulty]);

  const toggleSound = useCallback(() => {
    const next = !soundOn;
    setSoundOn(next);
    setMuted(next);
    audioRef.current?.setMuted(!next);
    if (next) audioRef.current?.unlock();
  }, [soundOn]);

  // Read preferences once on the client.
  useEffect(() => {
    const muted = getMuted();
    setSoundOn(!muted);
    audioRef.current?.setMuted(muted);
    reducedMotionRef.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    setTouchInput(
      window.matchMedia?.("(pointer: coarse)").matches ??
        "ontouchstart" in window,
    );
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    lookRef.current = HUMAN_LOOKS[look % HUMAN_LOOKS.length];
  }, [look]);

  // Report a durable load-complete event once mounted.
  useEffect(() => {
    trackGameEvent("game_load_complete", {
      deviceClass: window.innerWidth < 768 ? "mobile" : "desktop",
    });
  }, []);

  // Main render/simulation loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let disposed = false;

    const resize = () => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const observer = new ResizeObserver(resize);
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    resize();

    const loop = (time: number) => {
      if (disposed) return;
      rafRef.current = requestAnimationFrame(loop);
      const state = stateRef.current;
      if (!state) return;

      const dt = Math.min(0.05, (time - lastRef.current) / 1000 || 0);
      lastRef.current = time;

      if (resumeHoldRef.current > 0) {
        resumeHoldRef.current -= dt;
        setResumeIn(Math.max(0, resumeHoldRef.current));
        if (resumeHoldRef.current <= 0) {
          pausedRef.current = false;
          setResumeIn(0);
          if (uiRef.current === "paused") {
            uiRef.current = "playing";
            setUi("playing");
            requestAnimationFrame(() => containerRef.current?.focus({ preventScroll: true }));
          }
        }
      }

      const activelyStepping = !pausedRef.current;
      if (activelyStepping) {
        accRef.current += dt;
        let steps = 0;
        const events: GameState["pendingEvents"] = [];
        while (accRef.current >= FIXED_DT && steps < 5) {
          events.push(...stepGame(state, inputRef.current, FIXED_DT));
          accRef.current -= FIXED_DT;
          steps += 1;
        }
        if (steps === 5) accRef.current = 0;
        alphaRef.current = accRef.current / FIXED_DT;
        if (events.length) {
          audioRef.current?.handle(events);
          for (const event of events) {
            if (event.type === "point") {
              const who = event.side === "human" ? t.pointYou : t.pointOpponent;
              setAnnounce(who);
            }
          }
        }
      } else {
        alphaRef.current = 1;
      }

      // Resize transform every frame (cheap) so DPR changes are respected.
      const scale = canvas.width / WORLD.width;
      ctx.setTransform(scale, 0, 0, canvas.height / WORLD.height, 0, 0);

      renderGame(ctx, state, alphaRef.current, {
        reducedMotion: reducedMotionRef.current,
        humanName: t.you,
        aiName: t.opponent,
        humanLook: lookRef.current,
        aiLook: AI_LOOK,
      });

      // Push lightweight HUD + phase changes to React, but only when they change.
      if (state.phase !== lastPhaseRef.current) {
        lastPhaseRef.current = state.phase;
        setPhase(state.phase);
        if (state.phase === "matchResult" && !finishedRef.current) {
          finishedRef.current = true;
          const stats = currentStats(state);
          const isNewBest = saveBest(state.difficulty, {
            score: stats.score,
            playerPoints: stats.playerPoints,
            opponentPoints: stats.opponentPoints,
            perfectHits: stats.perfectHits,
            longestWinningStreak: stats.longestWinningStreak,
            achievedAt: Date.now(),
          });
          setResult({ stats, isNewBest });
          setUi("result");
          uiRef.current = "result";
          trackGameEvent("game_match_complete", {
            score: stats.score,
            playerPoints: stats.playerPoints,
            opponentPoints: stats.opponentPoints,
            activeDuration: Math.round(state.activeTime),
            difficulty: state.difficulty,
            rulesVersion: state.rulesVersion,
          });
        }
      }

      const remaining = Math.max(
        0,
        Math.round((90 - state.activeTime) * 10) / 10,
      );
      const sig = [
        state.humanPoints,
        state.aiPoints,
        Math.ceil(remaining),
        state.countdown > 0 ? Math.ceil(state.countdown) : 0,
        state.servePrompt ? 1 : 0,
        state.phase,
        state.tutorialTasks.moved ? 1 : 0,
        state.tutorialTasks.jumped ? 1 : 0,
        state.tutorialTasks.hit ? 1 : 0,
        state.pointReason ?? "",
      ].join("|");
      if (sig !== hudSigRef.current) {
        hudSigRef.current = sig;
        setHud({
          humanPoints: state.humanPoints,
          aiPoints: state.aiPoints,
          remaining,
          countdown: state.countdown,
          servePrompt: state.servePrompt,
          pointReason: state.pointReason,
          pointWinner: state.pointWinner,
          tutorial: { ...state.tutorialTasks },
        });
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Mark tutorial tasks complete when they occur.
  useEffect(() => {
    const state = stateRef.current;
    if (state && state.mode === "tutorial") {
      if (
        state.tutorialTasks.moved &&
        state.tutorialTasks.jumped &&
        state.tutorialTasks.hit &&
        !sessionReportedRef.current
      ) {
        sessionReportedRef.current = true;
        setTutorialDone(true);
        trackGameEvent("game_tutorial_complete", { inputType: "mixed" });
      }
    }
  }, [hud.tutorial.moved, hud.tutorial.jumped, hud.tutorial.hit]);

  // Keyboard and fingers have independent ownership of their held actions.
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (uiRef.current !== "playing" || pausedRef.current) return;
    if (e.key === "Escape") { e.preventDefault(); pause(); return; }
    const input = gameKeyInput(e.key);
    if (!input) return;
    e.preventDefault();
    inputRef.current = inputController.current.set(`keyboard:${e.code || e.key}`, input);
  }, [pause]);
  const onKeyUp = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (gameKeyInput(e.key)) inputRef.current = inputController.current.release(`keyboard:${e.code || e.key}`);
  }, []);

  // Escape anywhere while playing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && uiRef.current === "playing" && !pausedRef.current) {
        pause();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pause]);

  // Reset inputs if the tab loses focus, and pause when it is hidden so the
  // 90-second clock never runs in the background.
  useEffect(() => {
    const onBlur = () => clearInput();
    const onVisibility = () => {
      clearInput();
      if (document.hidden && uiRef.current === "playing" && !pausedRef.current) {
        pause();
      }
    };
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [clearInput, pause]);

  // Pause while the game surface is scrolled out of view.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || ui !== "playing") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio < 0.15 && !pausedRef.current) pause();
        }
      },
      { threshold: [0.15] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ui, pause]);

  // Clean up audio when unmounted.
  useEffect(() => {
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  const holdHandlers = useCallback((key: keyof InputState, extra?: Partial<InputState>) => {
    const release = (e: ReactPointerEvent<HTMLButtonElement>) => {
      inputRef.current = inputController.current.release(`pointer:${e.pointerId}`);
      if (inputRef.current[key]) e.currentTarget.setAttribute("data-pressed", "true");
      else e.currentTarget.removeAttribute("data-pressed");
    };
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (uiRef.current !== "playing" || pausedRef.current) return;
        containerRef.current?.focus({ preventScroll: true });
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.setAttribute("data-pressed", "true");
        audioRef.current?.unlock();
        inputRef.current = inputController.current.set(`pointer:${e.pointerId}`, { [key]: true, ...extra });
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onClick: (e: React.MouseEvent) => e.preventDefault(),
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    };
  }, []);

  const onShare = useCallback(async () => {
    const state = stateRef.current;
    if (!state || !result) return;
    trackGameEvent("game_share_click", { method: "card" });
    const url = gameUrl(GAME_PATH);
    const outcome = await shareResultCard({
      lang,
      score: result.stats.score,
      playerPoints: result.stats.playerPoints,
      opponentPoints: result.stats.opponentPoints,
      perfectHits: result.stats.perfectHits,
      longestStreak: result.stats.longestWinningStreak,
      url,
      difficultyLabel: difficultyLabel(state.difficulty, lang),
    });
    setAnnounce(
      outcome === "shared"
        ? t.shareResult
        : outcome === "failed"
          ? ""
          : t.copied,
    );
    trackGameEvent("game_share_result", { result: outcome });
  }, [lang, result, t]);

  const onCopyChallenge = useCallback(async () => {
    const ok = await copyGameLink(gameUrl(`${GAME_PATH}?play=1`));
    setAnnounce(ok ? t.copied : "");
  }, [t.copied]);

  const focusStyles =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  const isPlaying = ui === "playing";
  const showTouch = isPlaying && touchInput;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label={t.title}
      dir={dir}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border bg-brand text-white outline-none",
        focusStyles,
        className,
      )}
    >
      <div ref={wrapperRef} className="relative w-full" style={{ aspectRatio: ui === "ready" ? undefined : "16 / 9" }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-label={t.title}
          role="img"
        />

        {showTouch && (
          <div className={controls.overlay} dir="ltr" aria-label={t.move}>
            <div className={controls.group}>
              <button type="button" aria-label={t.move + " ◀"} className={controls.button} {...holdHandlers("left")}><ArrowLeft aria-hidden="true" /></button>
              <button type="button" aria-label={t.move + " ▶"} className={controls.button} {...holdHandlers("right")}><ArrowRight aria-hidden="true" /></button>
            </div>
            <div className={controls.group}>
              <button type="button" aria-label={t.tip} className={controls.button} {...holdHandlers("tip", { hit: true })}><Crosshair aria-hidden="true" /><span>{t.tip}</span></button>
              <button type="button" aria-label={t.jump} className={`${controls.button} ${controls.accent}`} {...holdHandlers("jump")}><ArrowUp aria-hidden="true" /><span>{t.jump}</span></button>
              <button type="button" aria-label={t.hit} className={controls.button} {...holdHandlers("hit")}><Zap aria-hidden="true" /><span>{t.hit}</span></button>
            </div>
          </div>
        )}

        {/* HUD */}
        {isPlaying && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
            <div className="flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold backdrop-blur">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              {t.you} {hud.humanPoints}
              <span className="text-white/50">·</span>
              {hud.aiPoints} {t.opponent}
              <span className="ms-1 inline-block h-2 w-2 rounded-full bg-[#F4A17E]" />
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-black/45 px-3 py-1.5 font-mono text-xs font-bold backdrop-blur">
                {Math.ceil(hud.remaining)}s
              </div>
              <div className="pointer-events-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-pressed={soundOn}
                  aria-label={soundOn ? t.soundOn : t.soundOff}
                  className={cn("rounded-full bg-black/45 p-2 backdrop-blur hover:bg-black/60", focusStyles)}
                >
                  {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? t.exitBiggerScreen : t.biggerScreen}
                  className={cn("rounded-full bg-black/45 p-2 backdrop-blur hover:bg-black/60", focusStyles)}
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                                <button
                  type="button"
                  onClick={pause}
                  aria-label={t.pause}
                  className={cn("rounded-full bg-black/45 p-2 backdrop-blur hover:bg-black/60", focusStyles)}
                >
                  <Pause size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Countdown */}
        {isPlaying && phase === "countdown" && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <span className="text-6xl font-black text-white drop-shadow-lg sm:text-8xl">
              {Math.max(1, Math.ceil(hud.countdown))}
            </span>
          </div>
        )}

        {/* Serve prompt */}
        {isPlaying && phase === "serve" && hud.servePrompt && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <span className="rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-foreground">
              {t.serve}
            </span>
          </div>
        )}

        {/* Point reason */}
        {isPlaying && phase === "pointResult" && hud.pointReason && (
          <div className="absolute inset-x-0 top-14 flex justify-center px-3">
            <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-bold text-white">
              {hud.pointWinner === "human" ? t.pointYou : t.pointOpponent} —{" "}
              {hud.pointReason === "fourTouches"
                ? t.reasonFourTouches
                : hud.pointReason === "out"
                  ? t.reasonOut
                  : hud.pointReason === "timeout"
                    ? t.reasonTimeout
                    : t.reasonGround}
            </span>
          </div>
        )}

        {/* Tutorial checklist */}
        {isPlaying &&
          phase !== "matchResult" &&
          stateRef.current?.mode === "tutorial" && (
            <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-2 px-2">
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  [t.tutorialMove, hud.tutorial.moved],
                  [t.tutorialJump, hud.tutorial.jumped],
                  [t.tutorialHit, hud.tutorial.hit],
                ].map(([label, done]) => (
                  <span
                    key={label as string}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-bold",
                      done ? "bg-primary text-foreground" : "bg-black/50 text-white/80",
                    )}
                  >
                    {done ? "✓ " : ""}
                    {label as string}
                  </span>
                ))}
              </div>
              {hud.tutorial.moved && hud.tutorial.jumped && hud.tutorial.hit && (
                <button
                  type="button"
                  onClick={startMatch}
                  className={cn(
                    "pointer-events-auto rounded-full bg-primary px-5 py-2 text-sm font-bold text-foreground",
                    focusStyles,
                  )}
                >
                  {t.startChallenge}
                </button>
              )}
            </div>
          )}

        {/* Start screen */}
        {ui === "ready" && (
          <div className="relative z-20 flex min-h-96 flex-col items-center justify-center gap-4 bg-brand/85 px-4 py-8 text-center backdrop-blur-sm">
            <h2 className="text-2xl font-black text-white sm:text-3xl">{t.title}</h2>
            <p className="max-w-md text-sm text-white/80">{t.cardDesc}</p>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/70">
                {t.chooseDifficulty}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={difficulty === level}
                    onClick={() => setDifficulty(level)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-bold",
                      difficulty === level
                        ? "bg-primary text-foreground"
                        : "bg-white/10 text-white hover:bg-white/20",
                      focusStyles,
                    )}
                  >
                    {DIFFICULTIES[level].label[lang]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70">{lang === "ar" ? "الشكل" : "Look"}</span>
              {HUMAN_LOOKS.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`${lang === "ar" ? "شكل" : "Look"} ${index + 1}`}
                  aria-pressed={look === index}
                  onClick={() => setLook(index)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2",
                    look === index ? "border-primary" : "border-white/30",
                    focusStyles,
                  )}
                  style={{ background: HUMAN_LOOKS[index].shirt }}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={startMatch}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-foreground hover:bg-primary-hover",
                  focusStyles,
                )}
              >
                <Play size={18} />
                {t.startChallenge}
              </button>
              <button
                type="button"
                onClick={startTutorial}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-3 font-bold text-white hover:bg-white/10",
                  focusStyles,
                )}
              >
                {t.tryTutorial}
              </button>
            </div>
            <Link
              href={bookingHref}
              onClick={() =>
                trackGameEvent("game_booking_click", { origin: "start", mode: "match" })
              }
              className={cn(
                "text-xs font-bold text-highlight underline underline-offset-2 hover:text-primary-hover",
                focusStyles,
              )}
            >
              {t.viewBeachGames}
            </Link>
            <p className="text-xs text-white/60">{t.rulesNotice}</p>
          </div>
        )}

        {/* Pause overlay */}
        {ui === "paused" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 p-4 text-center">
            {resumeIn > 0 ? (
              <span className="text-6xl font-black">{Math.ceil(resumeIn)}</span>
            ) : pauseMenu ? (
              <>
                <h3 className="text-xl font-black">{t.pause}</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={resume}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-bold text-foreground",
                      focusStyles,
                    )}
                  >
                    <Play size={16} /> {t.resume}
                  </button>
                  <button
                    type="button"
                    onClick={quitToStart}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 font-bold text-white hover:bg-white/10",
                      focusStyles,
                    )}
                  >
                    {t.quit}
                  </button>
                                    <button
                    type="button"
                    onClick={toggleFullscreen}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 font-bold text-white hover:bg-white/10",
                      focusStyles,
                    )}
                  >
                    {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    {isFullscreen ? t.exitBiggerScreen : t.biggerScreen}
                  </button>
                </div>
                <p className="max-w-xs text-xs text-white/70">{t.quitConfirm}</p>
              </>
            ) : null}
          </div>
        )}

        {/* Result overlay */}
        {ui === "result" && result && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-brand/90 p-4 text-center">
            <Trophy className="text-highlight" size={34} />
            <h3 className="text-2xl font-black">
              {wins(stateRef.current?.winner ?? null, "human")
                ? t.youWon
                : stateRef.current?.winner === "draw"
                  ? t.draw
                  : t.youLost}
            </h3>
            <p className="text-sm text-white/80">
              {t.matchPoints}: {result.stats.playerPoints} - {result.stats.opponentPoints}
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-sm">
              <span className="rounded-lg bg-white/10 px-3 py-1.5">
                {t.yourScore}: <strong className="text-highlight">{result.stats.score}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5">
                {t.perfectHits}: <strong>{result.stats.perfectHits}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5">
                {t.longestStreak}: <strong>{result.stats.longestWinningStreak}</strong>
              </span>
            </div>
            {result.isNewBest ? (
              <p className="text-sm font-bold text-highlight">{t.newBest}</p>
            ) : (
              <p className="text-xs text-white/60">
                {t.bestLocal}: {getBest(stateRef.current?.difficulty ?? "medium")?.score ?? 0}
              </p>
            )}
            <p className="text-xs text-white/50">{t.localResult}</p>

            <div className="mt-1 grid w-full max-w-md grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  trackGameEvent("game_replay_click", { mode: "match" });
                  startMatch();
                }}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 font-bold text-foreground",
                  focusStyles,
                )}
              >
                <RotateCcw size={16} /> {t.playAgain}
              </button>
              <button
                type="button"
                onClick={onShare}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-4 py-2.5 font-bold text-white hover:bg-white/10",
                  focusStyles,
                )}
              >
                <Share2 size={16} /> {t.shareResult}
              </button>
            </div>

            <div className="mt-1 w-full max-w-md rounded-xl border border-primary/40 bg-primary/10 p-3">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-highlight">
                <Gift size={16} /> {t.ctaTitle}
              </p>
              <p className="mt-1 text-xs text-white/80">{t.ctaDesc}</p>
              <Link
                href={bookingHref}
                onClick={() =>
                  trackGameEvent("game_booking_click", { origin: "result", mode: "match" })
                }
                className={cn(
                  "mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-foreground",
                  focusStyles,
                )}
              >
                <CalendarDays size={16} /> {t.viewBeachGames}
              </Link>
            </div>
          </div>
        )}

        {/* Close button for overlay variants */}
        {onRequestClose && (
          <button
            type="button"
            onClick={() => {
              const state = stateRef.current;
              if (state && state.phase !== "matchResult" && state.phase !== "ready") {
                trackGameEvent("game_match_abandon", {
                  mode: state.mode,
                  progress: Math.round(state.activeTime),
                  reason: "close",
                });
              }
              onRequestClose();
            }}
            aria-label={t.exitBiggerScreen}
            className="absolute end-2 top-2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Accessible live region: results and point messages only, never per-frame. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      {/* Keyboard hint for desktop, never shown over a live rally. */}
      {variant === "page" && isPlaying && phase !== "rally" && (
        <p className="px-3 py-2 text-center text-xs text-white/50">{t.fullscreenHint}</p>
      )}
    </div>
  );
}
