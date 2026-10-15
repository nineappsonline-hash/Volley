"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import Image from "next/image";
import { Maximize2, Minimize2, Play, Gamepad2, Timer, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { gameText } from "@/lib/game/i18n";
import { trackGameEvent } from "@/lib/game/analytics";
import type { BeachVolleyballGameProps } from "@/components/game/beach-volleyball-game";

type GameComponent = ComponentType<BeachVolleyballGameProps>;

export function BeachVolleyballGameCard() {
  const { lang, dir } = useI18n();
  const t = gameText(lang);
  const copy = lang === "ar" ? {
    kicker: "ملعب بلايزا الافتراضي · لعبة ثلاثية الأبعاد",
    title: "انزل الرمل من شاشتك.", accent: "والعب بتقنية 3D.",
    description: "جرّب حماس الطائرة الشاطئية في تجربة افتراضية من منظور اللاعب. استقبل الكرة، انط واضرب، وتحدى الكمبيوتر في ماتش مدته ٩٠ ثانية.",
    highlights: ["منظور اللاعب بتقنية 3D", "ماتشات ٩٠ ثانية", "ببلاش ومن غير حساب"],
    action: "جرّب التجربة ثلاثية الأبعاد", note: "العب دلوقتي على الموبايل أو الكمبيوتر.",
    preview: "لقطة من اللعبة", previewAlt: "اللعبة ثلاثية الأبعاد من منظور اللاعب: كرة بلايزا فوق ملعب الطائرة الشاطئية",
  } : {
    kicker: "PLAYZA VIRTUAL COURT · 3D GAME",
    title: "Step onto the sand.", accent: "Play in 3D.",
    description: "Get a taste of beach volleyball from the player’s point of view. Receive, jump and spike your way through a 90-second match against the computer.",
    highlights: ["First-person 3D", "90-second matches", "Free · No sign-up"],
    action: "Try the 3D experience", note: "Jump in on your phone or computer. Your virtual court is ready.",
    preview: "ACTUAL GAMEPLAY", previewAlt: "First-person 3D gameplay showing a Playza volleyball on the beach court",
  };
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
    import("@/components/game/beach-volleyball-3d")
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
                {copy.kicker}
              </p>
              <h2
                id="beach-challenge-title"
                className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl"
              >
                {copy.title}<br /><span className="text-[#C7F23D]">{copy.accent}</span>
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-white/80">{copy.description}</p>
              <ul className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-white/80">
                <li className="inline-flex items-center gap-1.5">
                  <Gamepad2 size={14} className="text-[#C7F23D]" /> {copy.highlights[0]}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Timer size={14} className="text-[#C7F23D]" /> {copy.highlights[1]}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Zap size={14} className="text-[#C7F23D]" /> {copy.highlights[2]}
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
                <Play size={18} aria-hidden="true" /> {copy.action}
              </button>
              <p className="mt-3 text-xs leading-relaxed text-white/65">{copy.note}</p>
            </div>
            <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/20 bg-[#0E182D] shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <span className="text-xs font-bold tracking-wider text-white/80">{copy.preview}</span>
                <span className="rounded-md bg-[#C7F23D] px-2.5 py-1 text-sm font-black text-[#14213D]">3D</span>
              </div>
              <Image src="/beach-challenge/assets/gameplay-preview.png" alt={copy.previewAlt} width={800} height={370} sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full" />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              fullscreen
                ? "fixed inset-0 z-[120] flex flex-col overflow-y-auto bg-[#0E182D] p-2 sm:p-6"
                : "p-3 sm:p-4",
            )}
          >
            <div className={cn("mx-auto w-full", fullscreen ? "my-auto max-w-5xl shrink-0" : "")}>
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
