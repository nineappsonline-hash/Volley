import type { Lang } from "@/lib/i18n/dictionary";
import { gameText } from "./i18n";

export const GAME_PATH = "/games/beach-volleyball";

export function gameUrl(path = GAME_PATH): string {
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return path;
}

export function buildShareText(score: number, lang: Lang, url: string): string {
  const t = gameText(lang);
  if (lang === "ar") {
    return `جبت ${score} في ${t.title} 🏐 مين يقدر يعدّي نتيجتي؟ ${url}`;
  }
  return `I scored ${score} in ${t.title} 🏐 Who can beat me? ${url}`;
}

export interface ShareCardInput {
  lang: Lang;
  score: number;
  playerPoints: number;
  opponentPoints: number;
  perfectHits: number;
  longestStreak: number;
  name?: string;
  url: string;
  difficultyLabel: string;
}

async function loadLogo(): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined") return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/logo.png";
  });
}

/** Render a 1080x1350 PNG share card onto a fresh canvas. */
export async function drawShareCard(input: ShareCardInput): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const navy = "#14213D";
  const lime = "#C7F23D";
  const cream = "#F6F8FA";
  const ar = input.lang === "ar";

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, navy);
  grad.addColorStop(1, "#0E182D");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = lime;
  ctx.beginPath();
  ctx.arc(895, 190, 150, 0, Math.PI * 2);
  ctx.fill();

  const logo = await loadLogo();
  if (logo) {
    const w = 360;
    const h = (logo.height / logo.width) * w;
    ctx.drawImage(logo, 90, 90, w, h);
  } else {
    ctx.fillStyle = cream;
    ctx.font = "800 56px Manrope, Alexandria, sans-serif";
    ctx.fillText("Playza", 90, 140);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = cream;
  ctx.font = `700 44px ${ar ? "Alexandria" : "Manrope"}, sans-serif`;
  ctx.fillText(gameText(input.lang).title, canvas.width / 2, 470);

  ctx.fillStyle = lime;
  ctx.font = "800 240px Manrope, Alexandria, sans-serif";
  ctx.fillText(String(input.score), canvas.width / 2, 760);

  ctx.fillStyle = cream;
  ctx.font = `600 36px ${ar ? "Alexandria" : "Manrope"}, sans-serif`;
  const stats = `${input.playerPoints} - ${input.opponentPoints}  ·  ${input.difficultyLabel}`;
  ctx.fillText(stats, canvas.width / 2, 840);

  ctx.font = `500 34px ${ar ? "Alexandria" : "Manrope"}, sans-serif`;
  ctx.fillStyle = "#C7F23D";
  ctx.fillText(
    `${gameText(input.lang).perfectHits}: ${input.perfectHits}   ${gameText(input.lang).longestStreak}: ${input.longestStreak}`,
    canvas.width / 2,
    900,
  );

  if (input.name) {
    ctx.fillStyle = cream;
    ctx.font = `700 40px ${ar ? "Alexandria" : "Manrope"}, sans-serif`;
    ctx.fillText(input.name, canvas.width / 2, 970);
  }

  ctx.font = "500 30px Manrope, Alexandria, sans-serif";
  ctx.fillStyle = "#94A3B8";
  ctx.fillText(input.url.replace(/^https?:\/\//, ""), canvas.width / 2, 1250);

  return canvas;
}

export async function downloadShareCard(input: ShareCardInput): Promise<void> {
  const canvas = await drawShareCard(input);
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "playza-beach-challenge.png";
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

export type ShareResult = "shared" | "downloaded" | "copied" | "failed";

/**
 * Try the device share sheet with a card file, then fall back to downloading
 * the card and copying the link. Never claims the link was posted anywhere.
 */
export async function shareResultCard(input: ShareCardInput): Promise<ShareResult> {
  const text = buildShareText(input.score, input.lang, input.url);
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  if (canShare) {
    try {
      const canvas = await drawShareCard(input);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      const files =
        blob && typeof File !== "undefined"
          ? [new File([blob], "playza-beach-challenge.png", { type: "image/png" })]
          : undefined;
      const data: ShareData = { title: gameText(input.lang).title, text };
      if (files && navigator.canShare?.({ files })) data.files = files;
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "failed";
    }
  }

  let copied = false;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    copied = false;
  }

  try {
    await downloadShareCard(input);
    return copied ? "downloaded" : "downloaded";
  } catch {
    return copied ? "copied" : "failed";
  }
}

export async function copyGameLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
