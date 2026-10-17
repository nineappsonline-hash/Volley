import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { getGameByInviteCode } from "@/lib/public-games";
import { GameCardBackground } from "@/components/games/game-card-background";
import { gameSharePrice } from "@/lib/game-share";
import { PLAYZA } from "@/lib/brand";

export const runtime = "nodejs";
export const revalidate = 300;

const isArabic = (value: string) => /[\u0600-\u06ff]/.test(value);
// Satori lays out text tokens left-to-right. Separate words allow an RTL flex
// flow while the font shapes each Arabic word, including wrapped lines.
const words = (value: string) => isArabic(value)
  ? value.split(/\s+/).map((word, index) => <span key={index} style={{ lineHeight: 1, height: "1.5em" }}>{word}</span>)
  : value;

const truncate = (value: string, max: number) => {
  const chars = Array.from(value);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : value;
};

/** Bundled PNG avoids a second network request while a sharing crawler waits. */
async function loadLogo(): Promise<string | null> {
  try {
    const buffer = await readFile(path.join(process.cwd(), "public/logo.png"));
    return `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/** 1200×630 PNG used by WhatsApp and other Open Graph link previews. */
export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code") || "";
  const [game, logo, arabicFont, regularFont, boldFont] = await Promise.all([
    getGameByInviteCode(code), loadLogo(),
    readFile(path.join(process.cwd(), "public/fonts/NotoSansArabic-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf")),
  ]);
  const date = game ? new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Cairo" }).format(new Date(`${game.game_date}T12:00:00Z`)) : "";
  const [hour, minute] = (game?.start_time ?? "00:00").split(":");
  const time = `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? "PM" : "AM"}`;

  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: PLAYZA.navy, color: "white", fontFamily: "Noto Sans, Arabic", padding: 44, position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", position: "absolute", right: 0, top: 0, width: 420, height: 630, background: "linear-gradient(150deg, #14213D, #0E182D)" }} />
      <div style={{ display: "flex", flexDirection: "column", width: 675, position: "relative" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} width={240} height={120} alt="Playza" style={{ borderRadius: 16 }} />
        ) : <div style={{ display: "flex", fontSize: 52, fontWeight: 700, color: PLAYZA.lime }}>Playza</div>}
        <div style={{ display: "flex", fontSize: game && isArabic(game.title) ? 30 : 40, fontWeight: 700, lineHeight: 1.3, marginTop: 22, height: 112, overflow: "hidden", width: 650, flexDirection: game && isArabic(game.title) ? "row-reverse" : "row", flexWrap: "wrap", alignContent: "flex-start", columnGap: 8 }}>
          {game ? words(truncate(game.title, 70)) : "Your next game starts on Playza"}
        </div>
        {game ? <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          <div style={{ display: "flex", fontSize: 27, fontWeight: 700, color: PLAYZA.lime }}>{date} · {time}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", fontSize: 16, color: "#A7BACB", letterSpacing: 2 }}>LOCATION</div>
            <div style={{ display: "flex", fontSize: 25, lineHeight: 1.3, height: 66, overflow: "hidden", width: 640, flexDirection: isArabic(game.map_label) ? "row-reverse" : "row", flexWrap: "wrap", alignContent: "flex-start", columnGap: 6 }}>{words(truncate(game.map_label, 85))}</div>
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700 }}>{gameSharePrice(game)}</div>
        </div> : <div style={{ display: "flex", fontSize: 28, marginTop: 20 }}>Find games, meet players and play your sport.</div>}
        <div style={{ display: "flex", marginTop: "auto", fontSize: 17, color: "#A7BACB" }}>{game ? (game.is_public ? "Public game · Open the link for details" : "Invitation game · Open the link for details") : "Games · Academies · Tournaments"}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 370, position: "absolute", right: 25, top: 60, bottom: 48 }}>
        <div style={{ display: "flex", fontSize: 29, fontWeight: 700, textAlign: "center", color: PLAYZA.lime }}>{game?.sport ?? "LET’S PLAY"}</div>
        {game && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 320, marginTop: 20 }}>{GameCardBackground({ sport: game.sport, variant: "share" })}</div>}
        {game && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700 }}>{game.joined} / {game.max_players}</div>
          <div style={{ display: "flex", fontSize: 20, color: "#D1E8E1", marginTop: 4 }}>players joined</div>
        </div>}
      </div>
    </div>,
    { width: 1200, height: 630, fonts: [{ name: "Noto Sans", data: regularFont, weight: 400, style: "normal" }, { name: "Noto Sans", data: boldFont, weight: 700, style: "normal" }, { name: "Arabic", data: arabicFont, weight: 400, style: "normal" }], headers: { "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" } }
  );
}
