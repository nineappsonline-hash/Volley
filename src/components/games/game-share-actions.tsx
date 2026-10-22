"use client";

import { useState } from "react";
import { Share2, Copy, MessageCircle, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { trackBusinessEvent } from "@/lib/analytics/events";
import { SITE_URL } from "@/lib/seo";
import { gameSharingTarget, type ShareableGame } from "@/lib/game-share";

export function GameShareActions({ game, compact = false }: { game: ShareableGame; compact?: boolean }) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const target = gameSharingTarget(game, SITE_URL, lang, "copy_link");
  const [message, setMessage] = useState("");
  const [instagramSelected, setInstagramSelected] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  if (!target) return null;
  const link = (source: string) => gameSharingTarget(game, SITE_URL, lang, source)!;
  function track(method: string) {
    trackBusinessEvent("share_game", { share_method: method, sport: game.sport, game_status: game.status });
  }
  async function copy(source = "copy_link") {
    setInstagramSelected(source === "instagram");
    try {
      await navigator.clipboard.writeText(link(source).url);
      track(source);
      setMessage(source === "instagram" ? (ar ? "نسخنا لينك الماتش. افتح إنستجرام والصقه في رسالة أو ستوري." : "Game link copied. Open Instagram and paste it into a message or story.") : ar ? "تم نسخ رابط الماتش" : "Game link copied");
      setManualCopy(false);
    } catch {
      setManualCopy(true);
      setMessage(ar ? "اختار الرابط الموجود بالأسفل وانسخه يدويًا." : "Select the link below and copy it manually.");
    }
  }
  async function share() {
    if (!navigator.share) { await copy(); return; }
    try {
      await navigator.share({ title: target!.title, text: target!.text, url: link("native_share").url });
      track("native_share");
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return;
      await copy();
    }
  }
  const platforms = [
    { source: "whatsapp", label: ar ? "واتساب" : "WhatsApp", href: link("whatsapp").whatsappUrl, Icon: MessageCircle },
    { source: "facebook", label: ar ? "فيسبوك" : "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link("facebook").url)}`, Icon: Facebook },
    { source: "telegram", label: ar ? "تيليجرام" : "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link("telegram").url)}&text=${encodeURIComponent(target.text)}`, Icon: Share2 },
    { source: "x", label: "X", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(link("x").url)}&text=${encodeURIComponent(target.title)}`, Icon: Share2 },
    { source: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link("linkedin").url)}`, Icon: Share2 },
  ];
  const menu = <DropdownMenu dir={ar ? "rtl" : "ltr"}>
    <DropdownMenuTrigger asChild><Button variant="outline" size={compact ? "default" : "sm"}><Share2 className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "مشاركة" : "Share"}</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {platforms.map(({ source, label, href, Icon }) => <DropdownMenuItem key={source} asChild><a href={href} target="_blank" rel="noopener noreferrer" onClick={() => track(source)}><Icon className="me-2 h-4 w-4" aria-hidden="true" />{label}</a></DropdownMenuItem>)}
      <DropdownMenuItem onSelect={() => void copy("instagram")}><Instagram className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "إنستجرام — انسخ اللينك" : "Instagram — copy link"}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void share()}><Share2 className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "تطبيقات تانية" : "More apps"}</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => void copy()}><Copy className="me-2 h-4 w-4" aria-hidden="true" />{ar ? "انسخ الرابط" : "Copy link"}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
  const feedback = <>
    {(!compact || manualCopy) && <label className="block text-xs">{ar ? "رابط الماتش" : "Game link"}<input aria-label={ar ? "رابط الماتش" : "Game link"} className="mt-1 w-full rounded border bg-background px-3 py-2 text-xs text-foreground" dir="ltr" readOnly value={target.url} onFocus={event => event.currentTarget.select()} /></label>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {instagramSelected && message && <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="text-sm underline">{ar ? "افتح إنستجرام" : "Open Instagram"}</a>}
  </>;
  if (compact) return <div className="space-y-2">{menu}{feedback}</div>;
  return <section aria-label={ar ? "ادعُ أصحابك للماتش" : "Invite friends to this game"} className="space-y-3 rounded-xl border p-4">
    <h2 className="font-bold">{ar ? "اللعب مع أصحابك أحلى" : "Bring a friend to the game"}</h2>
    {menu}{feedback}
  </section>;
}
