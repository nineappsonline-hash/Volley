"use client";
import { BeachGameStats } from "./beach-game-stats";

import Image from "next/image";
import { Play, Gamepad2, Timer, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useBeachGameCard } from "@/lib/game/use-beach-game-card";
import { BeachVolleyballGamePanel } from "@/components/game/beach-volleyball-game-panel";

export function BeachVolleyballGameCard() {
  const { lang, dir } = useI18n();
  const copy = lang === "ar" ? {
    kicker: "ملعب بلايزا الافتراضي · لعبة ثلاثية الأبعاد",
    title: "انزل الرمل من شاشتك.", accent: "والعب بتقنية 3D.",
    description: "جرّب حماس الطائرة الشاطئية في تجربة افتراضية من منظور اللاعب. استقبل الكرة، انط واضرب، وتحدى الكمبيوتر في ماتش مدته 90 ثانية.",
    highlights: ["منظور اللاعب بتقنية 3D", "ماتشات 90 ثانية", "ببلاش ومن غير حساب"],
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
  const { opened, fullscreen, setFullscreen, loading, failed, Game, cardRef, open, load, close } =
    useBeachGameCard("homepage");

  return (
    <section
      id="beach-challenge"
      aria-labelledby="beach-challenge-title"
      dir={dir}
      className="mx-auto max-w-6xl scroll-mt-6 px-4 py-12 sm:px-6"
    >
      <div
        ref={cardRef}
        className="overflow-hidden rounded-3xl border border-white/10 bg-brand text-white shadow-xl"
      >
        {!opened ? (
          <div className="grid gap-6 p-6 sm:p-10 md:grid-cols-[1.1fr_1fr] md:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-highlight">
                {copy.kicker}
              </p>
              <h2
                id="beach-challenge-title"
                className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl"
              >
                {copy.title}<br /><span className="text-highlight">{copy.accent}</span>
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-white/80">{copy.description}</p>
              <ul className="mt-5 flex flex-wrap gap-3 text-xs font-semibold text-white/80">
                <li className="inline-flex items-center gap-1.5">
                  <Gamepad2 size={14} className="text-highlight" /> {copy.highlights[0]}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Timer size={14} className="text-highlight" /> {copy.highlights[1]}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Zap size={14} className="text-highlight" /> {copy.highlights[2]}
                </li>
              </ul>
              <BeachGameStats className="mt-5" />
              <button
                type="button"
                onClick={open}
                className={cn(
                  "mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-foreground transition hover:bg-primary-hover",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
                )}
              >
                <Play size={18} aria-hidden="true" /> {copy.action}
              </button>
              <p className="mt-3 text-xs leading-relaxed text-white/65">{copy.note}</p>
            </div>
            <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/20 bg-brand-950 shadow-2xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <span className="text-xs font-bold tracking-wider text-white/80">{copy.preview}</span>
                <span className="rounded-md bg-primary px-2.5 py-1 text-sm font-black text-foreground">3D</span>
              </div>
              <Image src="/beach-challenge/assets/gameplay-preview.png" alt={copy.previewAlt} width={800} height={370} sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full" />
            </div>
          </div>
        ) : (
          <BeachVolleyballGamePanel
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen(!fullscreen)}
            loading={loading}
            failed={failed}
            onRetry={load}
            onCancel={close}
            Game={Game}
          />
        )}
      </div>
    </section>
  );
}
