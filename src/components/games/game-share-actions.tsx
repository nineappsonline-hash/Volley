"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { ShareableGame } from "@/lib/game-share";

const GameShareActionsMenu = dynamic(
  () => import("./game-share-actions-menu").then(module => module.GameShareActionsMenu),
  { ssr: false }
);

/** Render a lightweight share trigger until a visitor actually requests options. */
export function GameShareActions({ game, compact = false }: { game: ShareableGame; compact?: boolean }) {
  const [activated, setActivated] = useState(false);
  const [open, setOpen] = useState(false);
  const { lang } = useI18n();
  const ar = lang === "ar";

  if (activated) {
    return (
      <GameShareActionsMenu
        game={game}
        compact={compact}
        open={open}
        onOpenChange={setOpen}
      />
    );
  }

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5 px-2.5"
      aria-haspopup="menu"
      aria-expanded={false}
      onClick={() => { setActivated(true); setOpen(true); }}
    >
      <Share2 className="h-4 w-4" aria-hidden="true" />
      {ar ? "مشاركة" : "Share"}
    </Button>
  );

  return compact ? (
    <div className="max-w-64 space-y-1">{trigger}</div>
  ) : (
    <section aria-label={ar ? "ادعُ أصحابك للماتش" : "Invite friends to this game"} className="space-y-3 rounded-xl border p-4">
      <h2 className="font-bold">{ar ? "اللعب مع أصحابك أحلى" : "Bring a friend to the game"}</h2>
      {trigger}
    </section>
  );
}
