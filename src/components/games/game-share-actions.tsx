"use client";

import { useState } from "react";
import { Share2, Copy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { trackBusinessEvent } from "@/lib/analytics/events";
import { SITE_URL } from "@/lib/seo";
import { gameSharingTarget, type ShareableGame } from "@/lib/game-share";

export function GameShareActions({ game, compact = false }: { game: ShareableGame; compact?: boolean }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const target = gameSharingTarget(game, SITE_URL, lang);
  const [message, setMessage] = useState("");
  if (!target) return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(target!.url);
      trackBusinessEvent("share_game", { share_method: "copy_link", sport: game.sport, game_status: game.status });
      setMessage(ar ? "تم نسخ رابط الماتش" : "Game link copied");
    } catch { setMessage(compact ? (ar ? "مقدرناش ننسخ اللينك. انسخ عنوان الصفحة من المتصفح." : "Could not copy the link. Copy the page address from your browser.") : ar ? "اختار الرابط الموجود بالأسفل وانسخه يدويًا." : "Select the link below and copy it manually."); }
  }
  async function share() {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: target!.title, text: target!.text, url: target!.url }); }
    catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return;
      if (compact) { await copy(); return; }
      setMessage(ar ? "المشاركة مش متاحة حاليًا. استخدم واتساب أو انسخ الرابط." : "Sharing is unavailable. Use WhatsApp or copy the link.");
    }
    trackBusinessEvent("share_game", { share_method: "whatsapp", sport: game.sport, game_status: game.status });
  }
  if (compact) return <div className="space-y-2">
    <Button variant="outline" onClick={() => void share()}><Share2 className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "مشاركة" : "Share"}</Button>
    {message && <p role="status" className="text-sm">{message}</p>}
  </div>;
  return <section aria-label={ar ? "ادعُ أصحابك للماتش" : "Invite friends to this game"} className="space-y-3 rounded-xl border p-4">
    <h2 className="font-bold">{ar ? "اللعب مع أصحابك أحلى" : "Bring a friend to the game"}</h2>
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm" onClick={() => { trackBusinessEvent("invite_players_click", { share_method: "whatsapp", sport: game.sport, game_status: game.status }); } }><a href={target.whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="me-2 h-4 w-4" />{ar ? "شارك على واتساب" : "WhatsApp"}</a></Button>
      <Button variant="outline" size="sm" onClick={() => void copy()}><Copy className="me-2 h-4 w-4" />{ar ? "انسخ الرابط" : "Copy link"}</Button>
      <Button variant="outline" size="sm" onClick={() => void share()}><Share2 className="me-2 h-4 w-4" />{ar ? "مشاركة" : "Share"}</Button>
    </div>
    <label className="block text-xs text-muted-foreground">{ar ? "رابط الماتش" : "Game link"}<input aria-label={ar ? "رابط الماتش" : "Game link"} className="mt-1 w-full rounded border bg-background px-3 py-2 text-xs" dir="ltr" readOnly value={target.url} onFocus={event => event.currentTarget.select()} /></label>
    <p role="status" className="text-sm text-muted-foreground">{message}</p>
  </section>;
}
