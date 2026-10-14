"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Gamepad2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { gameText } from "@/lib/game/i18n";
import { trackGameEvent } from "@/lib/game/analytics";
import type { BeachVolleyballGameProps } from "@/components/game/beach-volleyball-game";

type GameComponent = ComponentType<BeachVolleyballGameProps>;

const BOOKING_HREF = "/games?sport=beach-volleyball";

export function BeachVolleyballPage() {
  const { lang, dir } = useI18n();
  const t = gameText(lang);
  const [Game, setGame] = useState<GameComponent | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    import("@/components/game/beach-volleyball-game")
      .then((mod) => {
        if (active) setGame(() => mod.BeachVolleyballGame);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background" dir={dir}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          {lang === "ar" ? "رجوع للرئيسية" : "Back to home"}
        </Link>

        <header className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#14213D]/70">
            {t.cardKicker}
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#14213D] sm:text-4xl">{t.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t.cardDesc}</p>
        </header>

        <div className="mt-6 overflow-hidden rounded-3xl border border-[#14213D]/10 bg-[#14213D] p-2 shadow-lg sm:p-3">
          {failed ? (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl text-white">
              <p className="text-sm font-semibold text-white/80">{t.loadError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full bg-[#C7F23D] px-5 py-2 text-sm font-bold text-[#14213D]"
              >
                {t.retry}
              </button>
            </div>
          ) : Game ? (
            <Game variant="page" bookingHref={BOOKING_HREF} />
          ) : (
            <div
              className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl text-white"
              role="status"
            >
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-[#C7F23D]" />
              <p className="text-sm font-semibold text-white/80">{t.loading}</p>
            </div>
          )}
        </div>

        <section className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Gamepad2 size={18} className="text-[#14213D]" />
              {t.gameRules}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• {t.ruleThreeTouches}</li>
              <li>• {t.ruleLinesIn}</li>
              <li>• {t.ruleTiming}</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{t.rulesNotice}</p>
          </div>

          <div className="rounded-2xl border border-[#C7F23D]/50 bg-[#C7F23D]/10 p-5">
            <h2 className="text-lg font-bold text-[#14213D]">{t.ctaTitle}</h2>
            <p className="mt-2 text-sm text-[#14213D]/80">{t.ctaDesc}</p>
            <Link
              href={BOOKING_HREF}
              onClick={() =>
                trackGameEvent("game_booking_click", { origin: "page", mode: "match" })
              }
              className={cn(
                "mt-4 inline-flex items-center gap-2 rounded-full bg-[#14213D] text-white px-5 py-2.5 text-sm font-bold hover:bg-[#0E182D]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14213D]",
              )}
            >
              <CalendarDays size={16} /> {t.viewBeachGames}
            </Link>
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground">{t.fullscreenHint}</p>
      </div>
    </main>
  );
}
