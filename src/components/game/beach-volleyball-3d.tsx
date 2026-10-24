"use client";
import { BeachGameStats } from "./beach-game-stats";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const container = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [screenNotice, setScreenNotice] = useState("");
  useEffect(() => {
    const change = () => setFullscreen(document.fullscreenElement === container.current);
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") {setExpanded(false);setScreenNotice("");} };
    document.addEventListener("fullscreenchange", change);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("fullscreenchange", change);document.removeEventListener("keydown", key); };
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);
  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) { await document.exitFullscreen().catch(() => {});return; }
    if (expanded) { setExpanded(false);setScreenNotice("");return; }
    try {
      if (!container.current?.requestFullscreen || !document.fullscreenEnabled) throw new Error("Fullscreen unavailable");
      await container.current.requestFullscreen();
      setScreenNotice("");
    } catch { setExpanded(true);setScreenNotice(lang === "ar" ? "عرض موسّع — ملء الشاشة مش متاح في المتصفح ده." : "Expanded view — browser fullscreen is unavailable."); }
  }, [expanded, lang]);

  const [ability, setAbility] = useState("power");
  const [teamSize, setTeamSize] = useState("4");
  const [matchFormat, setMatchFormat] = useState("rally");
  const [camera, setCamera] = useState("third");
  const [difficulty, setDifficulty] = useState("easy");
  const [session, setSession] = useState<{ mode: "match" | "practice"; lang: string; difficulty: string; ability: string; teamSize: string; camera: string; matchFormat: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const playButton = useRef<HTMLButtonElement>(null);
  const closeGame = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setExpanded(false);setScreenNotice("");setSession(null);setLoading(false);
    requestAnimationFrame(() => playButton.current?.focus());
  }, []);
  const copy = (en: string, ar: string) => lang === "ar" ? ar : en;

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.channel !== "playza-beach") return;
      switch (event.data.type) {
        case "fullscreen": void toggleFullscreen();break;
        case "ready": setLoading(false);trackGameEvent("game_load_complete", { renderer: "3d" });break;
        case "exit": closeGame();onRequestClose?.();break;
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
  }, [onRequestClose, closeGame, toggleFullscreen]);

  useEffect(() => {
    if (!session || !loading) return;
    const timeout = window.setTimeout(() => { setFailed(true);setLoading(false);setSession(null); }, 30000);
    return () => window.clearTimeout(timeout);
  }, [session, loading]);

  function start(mode: "match" | "practice") {
    setFailed(false);setLoading(true);setSession({ mode, lang, difficulty, ability, teamSize: mode === "practice" ? "1" : teamSize, camera, matchFormat });
    trackGameEvent("game_open", { source: variant === "inline" ? "homepage-3d" : "page-3d", mode });
  }

  return <div ref={container} className={cn("relative select-none overflow-hidden rounded-2xl bg-brand text-white", (fullscreen || expanded) && "fixed inset-0 z-[150] flex h-[100dvh] w-full flex-col rounded-none", className)} dir={dir}>
    <div className={cn("flex shrink-0 flex-wrap items-center justify-end gap-3 border-b border-white/10 p-3", session && (fullscreen || expanded) && "hidden")}>
      {screenNotice && <span className="mr-auto text-xs text-white/80" role="status">{screenNotice}</span>}
      <button type="button" onClick={() => void toggleFullscreen()} aria-pressed={fullscreen || expanded} className="min-h-12 rounded-full border border-white/30 px-5 py-2 text-sm font-bold text-white">
        {fullscreen || expanded ? copy("Exit fullscreen", "اخرج من ملء الشاشة") : copy("Play fullscreen ⛶", "العب بملء الشاشة ⛶")}
      </button>
      {session && <button type="button" onClick={closeGame} className="min-h-12 rounded-full bg-white/10 px-5 py-2 text-sm text-white">{copy("Close game", "اقفل اللعبة")}</button>}
    </div>
    {session ? <>
      <iframe ref={frame} title={copy("Playza Beach Challenge — 3D volleyball", "تحدي بلايزا — كرة طائرة ثلاثية الأبعاد")}
        src={`/beach-challenge/index.html?embed=1&mode=${session.mode}&lang=${session.lang}&difficulty=${session.difficulty}&ability=${session.ability}&teamSize=${session.teamSize}&camera=${session.camera}&matchFormat=${session.matchFormat}`}
        allow="fullscreen; clipboard-write; web-share" allowFullScreen
        className={cn("block w-full border-0", (fullscreen || expanded) ? "min-h-0 flex-1" : variant === "page" ? "h-[min(75vh,800px)] min-h-[500px]" : "h-[500px] sm:h-[600px]")}
      />
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-brand" role="status">{copy("Loading the 3D court…", "بنجهز الملعب…")}</div>}
    </> : <div className="grid gap-8 overflow-auto p-6 sm:p-10 md:grid-cols-2 md:items-center">
      <div>
        <AppLogo className="mb-5 w-36" />
        <p className="text-xs font-bold uppercase tracking-widest text-highlight">{copy("PLAYZA BEACH CHALLENGE · 3D", "تحدي بلايزا · ثلاثي الأبعاد")}</p>
        <h2 className="mt-3 text-3xl font-black text-white">{copy("Your court. Your next point.", "ملعبك. ونقطتك الجاية.")}</h2>
        <p className="mt-3 text-sm leading-7 text-white/75">{copy("Play a full 4v4 rally match or a quick 90-second challenge. Free third-person volleyball, with no account needed.", "العب ماتش 4 ضد 4 بالنقط، أو تحدي سريع 90 ثانية. كرة طائرة بمنظور الشخص الثالث، ببلاش ومن غير حساب.")}</p>
        <BeachGameStats className="mt-5" />
        {failed && <p className="mt-3 text-sm text-highlight" role="alert">{copy("The game couldn’t load. Try again in a WebGL2-capable browser.", "اللعبة مقدرتش تشتغل. جرّب تاني بمتصفح بيدعم WebGL2.")}</p>}
        <label className="mt-5 block text-sm text-white">{copy("Opponent", "المنافس")}
          <select className="mt-2 block w-full rounded-lg border border-white/25 bg-brand-950 p-3 text-white" value={difficulty} onChange={event => setDifficulty(event.target.value)}>
            <option value="easy">{copy("Easy", "سهل")}</option><option value="medium">{copy("Medium", "متوسط")}</option><option value="hard">{copy("Hard", "صعب")}</option>
          </select>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">{copy("Match", "الماتش")}<select className="mt-2 block w-full rounded-lg border border-white/25 bg-brand-950 p-3" value={teamSize} onChange={e=>setTeamSize(e.target.value)}><option value="4">{copy("4v4 local teams", "4 ضد 4 محلي")}</option><option value="2">{copy("2v2 doubles", "اتنين ضد اتنين")}</option><option value="1">{copy("1v1 duel", "واحد ضد واحد")}</option></select></label>
          <label className="text-sm">{copy("Format", "نظام اللعب")}<select className="mt-2 block w-full rounded-lg border border-white/25 bg-brand-950 p-3" value={matchFormat} onChange={e=>setMatchFormat(e.target.value)}><option value="rally">{copy("First to 25 · win by 2", "أول فريق يوصل 25 بفرق نقطتين")}</option><option value="challenge">{copy("90-second challenge", "تحدي 90 ثانية")}</option></select></label><label className="text-sm">{copy("Camera", "الكاميرا")}<select className="mt-2 block w-full rounded-lg border border-white/25 bg-brand-950 p-3" value={camera} onChange={e=>setCamera(e.target.value)}><option value="third">{copy("Third person", "الشخص الثالث")}</option><option value="first">{copy("First person", "الشخص الأول")}</option></select></label>
          <label className="text-sm">{copy("Ability", "القدرة")}<select className="mt-2 block w-full rounded-lg border border-white/25 bg-brand-950 p-3" value={ability} onChange={e=>setAbility(e.target.value)}><option value="power">{copy("Power Strike", "ضربة قوية")}</option><option value="curve">{copy("Curve Strike", "سحقة ملفوفة")}</option><option value="dash">{copy("Quick Step", "خطوة سريعة")}</option><option value="shield">{copy("Sky Wall", "حائط السما")}</option></select></label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3"><button ref={playButton} type="button" onClick={() => start("match")} className="rounded-full bg-primary px-6 py-3 font-bold text-foreground">{copy("Play free →", "العب ببلاش ←")}</button>
          <button type="button" onClick={() => start("practice")} className="rounded-full border border-white/30 px-6 py-3 font-bold">{copy("Learn to play", "اتعلم تلعب")}</button></div>
        <Link href={bookingHref} className="mt-5 inline-block text-sm text-highlight underline" onClick={() => trackGameEvent("game_booking_click", { origin: "3d-ready" })}>{copy("Book a real beach volleyball game", "احجز ماتش طائرة شاطئية حقيقي")}</Link>
      </div>
      <div><Image src="/beach-challenge/preview.svg" alt={copy("Playza sand volleyball court", "ملعب بلايزا لكرة الطائرة الشاطئية")} width={640} height={650} className="aspect-square w-full rounded-2xl object-cover" />
        <p className="mt-3 text-xs leading-6 text-white/70">{copy("WASD move · Click bump / spike · Q set / block · Ctrl dive · Space jump · R ability. Touch controls available on mobile.", "WASD للحركة · اضغط للاستقبال والسحق · Q للإعداد والصد · Ctrl للدفاع · Space للنط · R للقدرة. تحكم باللمس على الموبايل.")}</p></div>
    </div>}
  </div>;
}
