"use client";

import { useState } from "react";
import type { SharedGameMeta } from "@/lib/public-games";
import { Button } from "@/components/ui/button";
import { Share2, Link, Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { publicGamePath } from "@/lib/game-discovery";
import { gameIsJoinable } from "@/lib/game-discovery";

export function InvitePlayers({ game }: { game: SharedGameMeta | null }) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";  const [message, setMessage] = useState("");
  if (!game) return null;
  const inviteText = ar
    ? `اعزم أصحابك يلعبوا ماتش ${game.sport} ${game.title} ${game.game_date} ${game.start_time.slice(0, 5)}`
    : `Invite friends to play ${game.sport} ${game.title} on ${game.game_date} at ${game.start_time.slice(0, 5)}`;


  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicGamePath(game.id));
      setMessage(ar ? "تم نسخ الرابط" : "Link copied");
    } catch {
      setMessage(ar ? "عذراً، لم يتم النسخ" : "Could not copy link");
    }
  };

  const handleShare = async () => {
    if (!navigator.share) {
      await handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: game.title,
        text: inviteText,
        url: publicGamePath(game.id),
      });
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return;
      await handleCopy();
    }
  };

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <h2 className="font-bold">{ar ? "اللعب مع أصحابك أحلى" : "Bring a friend to the game"}</h2>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`https://wa.me/?text=${encodeURIComponent(`${inviteText}\n${publicGamePath(game.id)}`)}`} target="_blank" rel="noopener noreferrer">
            <Mail className="me-2 h-4 w-4" />{ar ? "شارك على واتساب" : "WhatsApp"}
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
          <Link className="me-2 h-4 w-4" />{ar ? "انسخ الرابط" : "Copy link"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void handleShare()}>
          <Share2 className="me-2 h-4 w-4" />{ar ? "مشاركة" : "Share"}
        </Button>
      </div>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}