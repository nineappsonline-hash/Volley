"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AppLogo } from "@/components/shared/app-logo";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { trackGameEvent } from "@/lib/game/analytics";
import type { BeachVolleyballGameProps } from "./beach-volleyball-game";

/** Local static runtime isolates WebGL/input from the rest of Playza. No external host or login. */
export function BeachVolleyballGame({ variant = "inline", bookingHref = "/games?sport=beach-volleyball", onRequestClose, className }: BeachVolleyballGameProps) {
  const { lang, dir } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const [difficulty, setDifficulty] = useState("easy");
  const [session, setSession] = useState<{ mode: "match" | "practice"; lang: string; difficulty: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const playButton = useRef<HTMLButtonElement>(null);
  const copy = (en: string, ar: string) => lang === "ar" ? ar : en;

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "playza-beach") return;
      switch (event.data.type) {
        case "ready": setLoading(false);trackGameEvent("game_load_complete", { renderer: "3d" });break;
        case "exit": setSession(null);setLoading(false);onRequestClose?.();requestAnimationFrame(() => playButton.current?.focus());break;
        case "error": setFailed(true);setSession(null);setLoading(false);trackGameEvent("game_load_error", { renderer: "3d" });break;
        case "match-start": trackGameEvent("game_match_start", { mode: event.data.mode === "practice" ? "practice" : "match", renderer: "3d" });break;
        case "result": {
          const score = event.data.score;
          if (typeof score === "number" && Number.isFinite(score)) trackGameEvent("game_match_complete", { score, verified: false, renderer: "3d" });
          break;
        }
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [onRequestClose]);

  useEffect(() => {
    if (!session || !loading) return;
    const timeout = window.setTimeout(() => { setFailed(true);setLoading(false);setSession(null); }, 30000);
    return () => window.clearTimeout(timeout);
  }, [session, loading]);

  function start(mode: "match" | "practice") {
    setFailed(false);setLoading(true);setSession({ mode, lang, difficulty });
    trackGameEvent("game_open", { source: variant === "inline" ? "homepage-3d" : "page-3d", mode });
  }

  return <div className={cn("relative overflow-hidden rounded-2xl bg-[#14213D] text-white", className)} dir={dir}>
    {session ? <>
      <iframe ref={frame} title={copy("Playza Beach Challenge — 3D volleyball", "تحدي بلايزا — كرة طائرة ثلاثية الأبعاد")}
        src={`/beach-challenge/index.html?embed=1&mode=${session.mode}&lang=${session.lang}&difficulty=${session.difficulty}`}
        allow="fullscreen" allowFullScreen
        className={cn("block w-full border-0", variant === "page" ? "h-[min(75vh,800px)] min-h-[500px]" : "h-[500px] sm:h-[600px]")}
      />
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-[#14213D]" role="status">{copy("Loading the 3D court…", "بنجهز الملعب…")}</div>}
      <button type="button" className="absolute bottom-3 right-3 rounded-full bg-[#14213D]/90 px-4 py-2 text-xs text-white" onClick={() => { setSession(null);setLoading(false);playButton.current?.focus(); }}>
        {copy("Close game", "اقفل اللعبة")}
      </button>
    </> : <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-2 md:items-center">
      <div>
        <AppLogo className="mb-5 w-36" />
        <p className="text-xs font-bold uppercase tracking-widest text-[#C7F23D]">{copy("PLAYZA BEACH CHALLENGE · 3D", "تحدي بلايزا · ثلاثي الأبعاد")}</p>
        <h2 className="mt-3 text-3xl font-black">{copy("Your court. Your next point.", "ملعبك. ونقطتك الجاية.")}</h2>
        <p className="mt-3 text-sm leading-7 text-white/75">{copy("90 seconds. You versus the computer. Free first-person volleyball, with no account needed.", "٩٠ ثانية. إنت ضد الكمبيوتر. كرة طائرة بمنظور الشخص الأول، ببلاش ومن غير حساب.")}</p>
        {failed && <p className="mt-3 text-sm text-[#C7F23D]" role="alert">{copy("The game couldn’t load. Try again in a WebGL2-capable browser.", "اللعبة مقدرتش تشتغل. جرّب تاني بمتصفح بيدعم WebGL2.")}</p>}
        <label className="mt-5 block text-sm">{copy("Opponent", "المنافس")}
          <select className="mt-2 block w-full rounded-lg border border-white/25 bg-[#0E182D] p-3" value={difficulty} onChange={event => setDifficulty(event.target.value)}>
            <option value="easy">{copy("Easy", "سهل")}</option><option value="medium">{copy("Medium", "متوسط")}</option><option value="hard">{copy("Hard", "صعب")}</option>
          </select>
        </label>
        <div className="mt-5 flex flex-wrap gap-3"><button ref={playButton} type="button" onClick={() => start("match")} className="rounded-full bg-[#C7F23D] px-6 py-3 font-bold text-[#14213D]">{copy("Play free →", "العب ببلاش ←")}</button>
          <button type="button" onClick={() => start("practice")} className="rounded-full border border-white/30 px-6 py-3 font-bold">{copy("Learn to play", "اتعلم تلعب")}</button></div>
        <Link href={bookingHref} className="mt-5 inline-block text-sm text-[#C7F23D] underline" onClick={() => trackGameEvent("game_booking_click", { origin: "3d-ready" })}>{copy("Book a real beach volleyball game", "احجز ماتش طائرة شاطئية حقيقي")}</Link>
      </div>
      <div><Image src="/beach-challenge/preview.svg" alt={copy("Playza sand volleyball court", "ملعب بلايزا لكرة الطائرة الشاطئية")} width={640} height={650} className="aspect-square w-full rounded-2xl object-cover" />
        <p className="mt-3 text-xs leading-6 text-white/70">{copy("WASD move · Mouse look · Click / F hit · Space jump · E tip. Touch controls available on mobile.", "WASD للحركة · الماوس للنظر · اضغط / F للضرب · Space للنط · E للإسقاط. تحكم باللمس على الموبايل.")}</p></div>
    </div>}
  </div>;
}
