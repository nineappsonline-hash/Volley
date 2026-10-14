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
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
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

  const setInput = useCallback((patch: Partial<InputState>) => {
    inputRef.current = { ...inputRef.current, ...patch };
  }, []);

  const clearInput = useCallback(() => {
    inputRef.current = emptyInput();
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
      requestAnimationFrame(() => containerRef.current?.focus());
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
            requestAnimationFrame(() => containerRef.current?.focus());
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

  // Keyboard controls on the focused game surface.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const state = stateRef.current;
      if (!state) return;
      const key = e.key;
      const playing = uiRef.current === "playing";
      let handled = true;
      if (key === "ArrowLeft" || key === "a" || key === "A") setInput({ left: true });
      else if (key === "ArrowRight" || key === "d" || key === "D") setInput({ right: true });
      else if (
        key === "ArrowUp" ||
        key === "w" ||
        key === "W" ||
        key === " "
      )
        setInput({ jump: true });
      else if (key === "j" || key === "J") setInput({ hit: true });
      else if (key === "k" || key === "K") setInput({ hit: true, tip: true });
      else if (key === "Escape") {
        if (playing) pause();
      } else handled = false;
      if (handled && playing) e.preventDefault();
    },
    [pause, setInput],
  );

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const key = e.key;
      if (key === "ArrowLeft" || key === "a" || key === "A") setInput({ left: false });
      else if (key === "ArrowRight" || key === "d" || key === "D")
        setInput({ right: false });
      else if (key === "ArrowUp" || key === "w" || key === "W" || key === " ")
        setInput({ jump: false });
      else if (key === "j" || key === "J") setInput({ hit: false });
      else if (key === "k" || key === "K") setInput({ hit: false, tip: false });
    },
    [setInput],
  );

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

  // Reset inputs if the tab loses focus mid-rally.
  useEffect(() => {
    const reset = () => clearInput();
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [clearInput]);

  // Clean up audio when unmounted.
  useEffect(() => {
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  const holdHandlers = useCallback(
    (
      key: keyof InputState,
      downExtra?: Partial<InputState>,
      upExtra?: Partial<InputState>,
    ) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        audioRef.current?.unlock();
        setInput({ [key]: true, ...(downExtra ?? {}) } as Partial<InputState>);
      },
      onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setInput({ [key]: false, ...(upExtra ?? {}) } as Partial<InputState>);
      },
      onPointerCancel: () =>
        setInput({ [key]: false, ...(upExtra ?? {}) } as Partial<InputState>),
      onPointerLeave: () =>
        setInput({ [key]: false, ...(upExtra ?? {}) } as Partial<InputState>),
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    }),
    [setInput],
  );

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
        "relative w-full overflow-hidden rounded-2xl border bg-[#14213D] text-white outline-none",
        focusStyles,
        className,
      )}
    >
      <div ref={wrapperRef} className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-label={t.title}
          role="img"
        />

        {/* HUD */}
        {isPlaying && (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
            <div className="flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold backdrop-blur">
              <span className="inline-block h-2 w-2 rounded-full bg-[#C7F23D]" />
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
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl font-black text-white drop-shadow-lg sm:text-8xl">
              {Math.max(1, Math.ceil(hud.countdown))}
            </span>
          </div>
        )}

        {/* Serve prompt */}
        {isPlaying && phase === "serve" && hud.servePrompt && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center">
            <span className="rounded-full bg-[#C7F23D] px-4 py-1.5 text-sm font-bold text-[#14213D]">
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
                      done ? "bg-[#C7F23D] text-[#14213D]" : "bg-black/50 text-white/80",
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
                    "pointer-events-auto rounded-full bg-[#C7F23D] px-5 py-2 text-sm font-bold text-[#14213D]",
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#14213D]/85 p-4 text-center backdrop-blur-sm">
            <h2 className="text-2xl font-black sm:text-3xl">{t.title}</h2>
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
                        ? "bg-[#C7F23D] text-[#14213D]"
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
                    look === index ? "border-[#C7F23D]" : "border-white/30",
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
                  "inline-flex items-center gap-2 rounded-full bg-[#C7F23D] px-6 py-3 font-bold text-[#14213D] hover:bg-[#B4DF2D]",
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
                "text-xs font-bold text-[#C7F23D] underline underline-offset-2 hover:text-[#B4DF2D]",
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 p-4 text-center">
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
                      "inline-flex items-center gap-2 rounded-full bg-[#C7F23D] px-5 py-2.5 font-bold text-[#14213D]",
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
                </div>
                <p className="max-w-xs text-xs text-white/70">{t.quitConfirm}</p>
              </>
            ) : null}
          </div>
        )}

        {/* Result overlay */}
        {ui === "result" && result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-[#14213D]/90 p-4 text-center">
            <Trophy className="text-[#C7F23D]" size={34} />
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
                {t.yourScore}: <strong className="text-[#C7F23D]">{result.stats.score}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5">
                {t.perfectHits}: <strong>{result.stats.perfectHits}</strong>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5">
                {t.longestStreak}: <strong>{result.stats.longestWinningStreak}</strong>
              </span>
            </div>
            {result.isNewBest ? (
              <p className="text-sm font-bold text-[#C7F23D]">{t.newBest}</p>
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
                  "inline-flex items-center justify-center gap-2 rounded-full bg-[#C7F23D] px-4 py-2.5 font-bold text-[#14213D]",
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

            <div className="mt-1 w-full max-w-md rounded-xl border border-[#C7F23D]/40 bg-[#C7F23D]/10 p-3">
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-[#C7F23D]">
                <Gift size={16} /> {t.ctaTitle}
              </p>
              <p className="mt-1 text-xs text-white/80">{t.ctaDesc}</p>
              <Link
                href={bookingHref}
                onClick={() =>
                  trackGameEvent("game_booking_click", { origin: "result", mode: "match" })
                }
                className={cn(
                  "mt-2 inline-flex items-center gap-2 rounded-full bg-[#C7F23D] px-4 py-2 text-sm font-bold text-[#14213D]",
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

      {/* Touch controls */}
      {showTouch && (
        <div
          className="flex select-none items-end justify-between gap-2 sm:gap-3 border-t border-white/10 bg-[#0E182D] p-2 sm:p-3"
          style={{ touchAction: "none" }}
        >
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              aria-label={t.move + " ◀"}
              {...holdHandlers("left")}
              className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black active:bg-[#C7F23D] active:text-[#14213D]"
            >
              ◀
            </button>
            <button
              type="button"
              aria-label={t.move + " ▶"}
              {...holdHandlers("right")}
              className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black active:bg-[#C7F23D] active:text-[#14213D]"
            >
              ▶
            </button>
          </div>
          <div className="flex items-end gap-2 sm:gap-3">
            <button
              type="button"
              aria-label={t.tip}
              {...holdHandlers("tip", { hit: true }, { hit: false })}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-xs font-bold active:bg-[#C7F23D] active:text-[#14213D]"
            >
              {t.tip}
            </button>
            <button
              type="button"
              aria-label={t.jump}
              {...holdHandlers("jump")}
              className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[#C7F23D] text-sm font-black text-[#14213D] active:bg-[#B4DF2D]"
            >
              {t.jump}
            </button>
            <button
              type="button"
              aria-label={t.hit}
              {...holdHandlers("hit")}
              className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-white/20 text-sm font-black active:bg-[#C7F23D] active:text-[#14213D]"
            >
              {t.hit}
            </button>
          </div>
        </div>
      )}

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
