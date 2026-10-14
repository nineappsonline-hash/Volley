"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { Maximize2, Minimize2, Play, Trophy, Users, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { gameText } from "@/lib/game/i18n";
import { trackGameEvent } from "@/lib/game/analytics";
import type { BeachVolleyballGameProps } from "@/components/game/beach-volleyball-game";

type GameComponent = ComponentType<BeachVolleyballGameProps>;

export function BeachVolleyballGameCard() {
  const { lang, dir } = useI18n();
  const t = gameText(lang);
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
              trackGameEvent("game_card_view", { placement: "homepage" });
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
  }, []);

  const load = () => {
    setFailed(false);
    if (Game) return;
    setLoading(true);
    import("@/components/game/beach-volleyball-game")
      .then((mod) => {
        setGame(() => mod.BeachVolleyballGame);
      })
      .catch(() => {
        setFailed(true);
        trackGameEvent("game_load_error", { placement: "homepage" });
      })
      .finally(() => setLoading(false));
  };

  const open = () => {
    trackGameEvent("game_open", { source: "homepage" });
    setOpened(true);
    load();
  };

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return (
    <section
      id="beach-challenge"
      aria-labelledby="beach-challenge-title"
      dir={dir}
      className="mx-auto max-w-6xl scroll-mt-6 px-4 py-12 sm:px-6"
    >
      <div
        ref={cardRef}
        className="overflow-hidden rounded-3xl border border-white/10 bg-[#14213D] text-white shadow-xl"
      >
        {!opened ? (
          <div className="grid gap-6 p-6 sm:p-10 md:grid-cols-[1.1fr_1fr] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#C7F23D]">
                {t.cardKicker}
              </p>
              <h2
                id="beach-challenge-title"
                className="mt-3 text-3xl font-black leading-tight sm:text-4xl"
              >
                {t.cardTitle}
              </h2>
              <p className="mt-3 max-w-md text-sm text-white/75">{t.cardDesc}</p>
              <ul className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-white/80">
                <li className="inline-flex items-center gap-1.5">
                  <Zap size={14} className="text-[#C7F23D]" /> {t.cardHighlights[0]}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Users size={14} className="text-[#C7F23D]" /> {t.cardHighlights[1]}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Trophy size={14} className="text-[#C7F23D]" /> {t.cardHighlights[2]}
                </li>
              </ul>
              <button
                type="button"
                onClick={open}
                className={cn(
                  "mt-6 inline-flex items-center gap-2 rounded-full bg-[#C7F23D] px-6 py-3 font-bold text-[#14213D] transition hover:bg-[#B4DF2D]",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C7F23D]",
                )}
              >
                <Play size={18} /> {t.playFree}
              </button>
            </div>
            <div aria-hidden="true" className="relative hidden aspect-video md:block">
              <MiniCourt />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              fullscreen
                ? "fixed inset-0 z-[120] flex flex-col justify-center overflow-y-auto bg-[#0E182D] p-2 sm:p-6"
                : "p-3 sm:p-4",
            )}
          >
            <div className={cn("mx-auto w-full", fullscreen ? "max-w-5xl" : "")}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setFullscreen(!fullscreen)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10"
                >
                  {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  {fullscreen ? t.exitBiggerScreen : t.biggerScreen}
                </button>
              </div>

              {loading && (
                <div
                  className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#14213D] text-white"
                  role="status"
                >
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-[#C7F23D]" />
                  <p className="text-sm font-semibold text-white/80">{t.loading}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpened(false);
                      setLoading(false);
                      setFullscreen(false);
                    }}
                    className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-bold hover:bg-white/10"
                  >
                    {t.cancel}
                  </button>
                </div>
              )}

              {failed && !loading && (
                <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#14213D] text-white">
                  <p className="text-sm font-semibold text-white/80">{t.loadError}</p>
                  <button
                    type="button"
                    onClick={load}
                    className="rounded-full bg-[#C7F23D] px-5 py-2 text-sm font-bold text-[#14213D]"
                  >
                    {t.retry}
                  </button>
                </div>
              )}

              {Game && !loading && !failed && <Game variant={fullscreen ? "page" : "inline"} />}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MiniCourt() {
  return (
    <svg viewBox="0 0 640 360" className="h-full w-full" fill="none">
      <rect width="640" height="360" rx="20" fill="#0E182D" />
      <circle cx="520" cy="70" r="42" fill="#C7F23D" opacity="0.9" />
      <path d="M40 250L320 150L610 250L330 350Z" fill="#E4D3AD" />
      <path d="M40 240L320 140L610 240L330 340Z" fill="#F5EAD3" stroke="#14213D" strokeWidth="3" />
      <path d="M150 210V120L470 208V300" stroke="#14213D" strokeWidth="6" strokeLinecap="round" />
      <path d="M154 128L466 216V262L154 174Z" fill="#fff" fillOpacity="0.35" stroke="#14213D" strokeWidth="2" />
      {Array.from({ length: 11 }, (_, i) => (
        <path key={i} d={`M${160 + i * 30} ${132 + i * 12}v42`} stroke="#14213D" strokeWidth="1.2" />
      ))}
      <circle cx="220" cy="120" r="18" fill="#F6F8FA" stroke="#14213D" strokeWidth="2" />
      <path
        d="M204 114Q220 126 236 108M220 120Q216 132 210 136M220 120Q234 118 240 124"
        stroke="#14213D"
        strokeWidth="2"
      />
      <g stroke="#14213D" strokeWidth="8" strokeLinecap="round">
        <path d="M170 230L158 268M182 232L198 268" />
        <path d="M176 196L176 226" />
      </g>
      <circle cx="176" cy="184" r="12" fill="#E2B79C" stroke="#14213D" strokeWidth="2" />
    </svg>
  );
}
