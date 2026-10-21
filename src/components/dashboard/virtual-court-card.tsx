"use client";

import Image from "next/image";
import { Gamepad2, Play, Timer, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useBeachGameCard } from "@/lib/game/use-beach-game-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BeachVolleyballGamePanel } from "@/components/game/beach-volleyball-game-panel";
import styles from "./dashboard.module.css";

/**
 * Member dashboard entry point for the virtual 3D court. It mirrors the
 * homepage card's content but adopts the dashboard shell: navy gradient header,
 * lime accents and the shared rounded-2xl Card surface.
 */
export function VirtualCourtCard() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const copy = ar ? {
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
    useBeachGameCard("dashboard");

  const highlights = [
    { icon: Gamepad2, label: copy.highlights[0] },
    { icon: Timer, label: copy.highlights[1] },
    { icon: Zap, label: copy.highlights[2] },
  ];

  return (
    <Card ref={cardRef} className="overflow-hidden rounded-2xl shadow-none">
      <CardHeader
        className={cn(
          styles.colorCardHeader,
          styles.compactCardHeader,
          "flex-row flex-wrap items-center justify-between gap-3 space-y-0 bg-gradient-to-br from-brand to-brand-900",
        )}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="rounded-lg bg-white/10 p-2">
            <Gamepad2 className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          {ar ? "الملعب الافتراضي" : "Virtual court"}
        </CardTitle>
        <Badge variant="outline" className="gap-1 border-white/30 text-white">
          3D · {ar ? "منظور اللاعب" : "FIRST PERSON"}
        </Badge>
        <p className={cn(styles.colorCardHint, "basis-full")}>{copy.kicker}</p>
      </CardHeader>

      {opened ? (
        <CardContent className="p-3 sm:p-4">
          <div className="rounded-xl bg-brand p-2 sm:p-3">
            <BeachVolleyballGamePanel
              fullscreen={fullscreen}
              onToggleFullscreen={() => setFullscreen(!fullscreen)}
              loading={loading}
              failed={failed}
              onRetry={load}
              onCancel={close}
              Game={Game}
            />
          </div>
        </CardContent>
      ) : (
        <CardContent className="grid gap-5 p-4 sm:p-5 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div>
            <h3 className="text-xl font-black leading-tight text-foreground sm:text-2xl">
              {copy.title}
              <br />
              <span className="text-primary">{copy.accent}</span>
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
            <ul className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
              {highlights.map(({ icon: Icon, label }) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                  <Icon size={14} className="text-primary" aria-hidden="true" /> {label}
                </li>
              ))}
            </ul>
            <Button type="button" onClick={open} className="mt-5 gap-2 rounded-full">
              <Play size={16} aria-hidden="true" /> {copy.action}
            </Button>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy.note}</p>
          </div>
          <div className="relative min-w-0 overflow-hidden rounded-xl border border-border bg-muted/40">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <span className="text-xs font-bold tracking-wider text-muted-foreground">{copy.preview}</span>
              <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-black text-primary-foreground">3D</span>
            </div>
            <Image
              src="/beach-challenge/assets/gameplay-preview.png"
              alt={copy.previewAlt}
              width={800}
              height={370}
              sizes="(min-width: 768px) 50vw, 100vw"
              className="h-auto w-full"
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
