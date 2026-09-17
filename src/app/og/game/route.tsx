import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getGameByInviteCode } from "@/lib/public-games";

export const runtime = "nodejs";
export const revalidate = 300;

/**
 * Dynamic 1200×630 card for shared game links (/games?join=CODE).
 * Shows the Playza logo + game details: name, sport, date & time, location,
 * spots and the per-player share. Drives WhatsApp/Telegram/Facebook previews.
 */

const bgNavy = "#0b2440";
const bgGreen = "#0e8f61";
const accent = "#2dd4a7";
const white = "#ffffff";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(t: string): string {
  try {
    const [h, m] = t.slice(0, 5).split(":").map(Number);
    const date = new Date();
    date.setHours(h, m);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch {
    return t.slice(0, 5);
  }
}

async function loadLogoDataUri(): Promise<string | null> {
  try {
    const file = path.join(process.cwd(), "public", "icons", "icon-512.png");
    const buf = await readFile(file);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || "";

  const [game, logo] = await Promise.all([getGameByInviteCode(code), loadLogoDataUri()]);

  const fallback = () =>
    new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: white,
            background: `linear-gradient(135deg, ${bgNavy} 0%, ${bgGreen} 100%)`,
            fontFamily: "sans-serif",
          }}
        >
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={120} height={120} alt="" style={{ borderRadius: 24 }} />
          )}
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 16 }}>Playza</div>
          <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
            Friendly games in Egypt
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );

  if (!game) return fallback();

  const shareText =
    game.host_pays || (game.share_price ?? 0) === 0
      ? "Free — host covers the court"
      : `EGP ${game.share_price} per player`;

  const label = (icon: string, text: string, sub: string) => (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1 }}>
          {text}
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, color: white }}>{sub}</div>
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          color: white,
          background: `linear-gradient(135deg, ${bgNavy} 0%, ${bgGreen} 100%)`,
          fontFamily: "sans-serif",
          padding: "48px 56px",
        }}
      >
        {/* Left: logo + identity */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 280,
            flexShrink: 0,
            alignItems: "flex-start",
          }}
        >
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={88} height={88} alt="" style={{ borderRadius: 20 }} />
          )}
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 14 }}>Playza</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.4, marginTop: 4 }}>
            Friendly games
            <br />
            in Egypt
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 22 }}>
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.6)" }}>{game.joined}/{game.max_players}</div>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: accent }} />
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.75)" }}>spots filled</div>
          </div>
        </div>

        {/* Right: game details */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: 8,
              fontSize: 16,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              color: accent,
              background: "rgba(45,212,167,0.14)",
              padding: "6px 14px",
              borderRadius: 20,
            }}
          >
            {game.sport}
          </div>

          <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1, marginTop: 14 }}>
            {game.title}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 22,
            }}
          >
            {label("🗓", "Date & time", `${formatDate(game.game_date)} · ${formatTime(game.start_time)}`)}
            {label("📍", "Location", game.map_label)}
            {label("💰", "Share", shareText)}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: "auto",
              fontSize: 14,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: 3, background: accent }} />
            {game.is_public ? "Public game" : "Private game — join via this link"} · Plays on Playza
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // OG cards embed best as JPEG while keeping the PNG-ish look — PNG keeps
      // sharp text; keep PNG for crispness.
      headers: {
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
      },
    }
  );
}