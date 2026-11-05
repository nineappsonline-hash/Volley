import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { PLAYZA } from "@/lib/brand";
import { GameCardBackground } from "@/components/games/game-card-background";
import { gameSharePrice } from "@/lib/game-share";

type PreviewGame = {
  title: string; sport: string; game_date: string; start_time: string;
  map_label: string; joined: number; max_players: number; share_price: number | null;
  host_pays?: boolean; is_public: boolean;
};
const arabic = (value: string) => /[\u0600-\u06ff]/.test(value);
const shorten = (value: string, max: number) => Array.from(value).length > max ? `${Array.from(value).slice(0, max - 1).join("")}…` : value;
const words = (value: string) => arabic(value) ? value.split(/\s+/).map((word, i) => <span key={i} style={{ lineHeight: 1, height: "1.5em" }}>{word}</span>) : value;

/** Bundled fonts/assets make social previews independent of third-party image hosts. */
export async function createSocialImage(game: PreviewGame | null) {
  const [logo, regular, bold, arabicFont] = await Promise.all([
    readFile(path.join(process.cwd(), "public/logo.png")).then(buffer => `data:image/png;base64,${buffer.toString("base64")}`),
    readFile(path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf")),
    readFile(path.join(process.cwd(), "public/fonts/NotoSansArabic-Regular.ttf")),
  ]);
  const date = game ? new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone: "Africa/Cairo" }).format(new Date(`${game.game_date}T12:00:00Z`)) : "";
  const [hour, minute] = (game?.start_time ?? "00:00").split(":");
  const time = `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? "PM" : "AM"}`;
  const title = game ? shorten(game.title, 66) : "Find your game. Own your moment.";
  const full = game ? game.joined >= game.max_players : false;
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "linear-gradient(120deg, #24103F 0%, #4C1D95 62%, #7B2CBF 100%)", color: "white", fontFamily: "Noto Sans, Arabic", position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", position: "absolute", top: -250, right: -200, width: 800, height: 800, borderRadius: 400, border: "1px solid #ffffff20" }} />
      <div style={{ display: "flex", position: "absolute", bottom: -390, left: -130, width: 780, height: 780, borderRadius: 390, border: "1px solid #ffffff15" }} />
      <div style={{ display: "flex", width: 800, padding: "38px 42px 30px 46px", flexDirection: "column", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", background: "white", borderRadius: 14, padding: "0 8px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={152} height={76} alt="Playza" />
          </div>
          <div style={{ display: "flex", color: "#DDD0F2", fontSize: 16, letterSpacing: 3 }}>{game ? "YOU’RE INVITED" : "YOUR GAME. YOUR PEOPLE."}</div>
        </div>
        <div style={{ display: "flex", marginTop: 28, color: PLAYZA.lime, fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>{game ? `${game.sport.toUpperCase()} · ${game.is_public ? "PUBLIC GAME" : "PRIVATE INVITATION"}` : "PLAY MORE. FEEL ALIVE."}</div>
        <div style={{ display: "flex", fontSize: arabic(title) ? 43 : game ? (title.length > 45 ? 42 : 53) : 66, fontWeight: 700, lineHeight: 1.12, marginTop: 13, height: game ? 132 : 154, overflow: "hidden", width: "100%", flexDirection: arabic(title) ? "row-reverse" : "row", flexWrap: "wrap", alignContent: "flex-start", columnGap: 9 }}>{words(title)}</div>
        {game ? <div style={{ display: "flex", flexDirection: "column", marginTop: 8, gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={PLAYZA.lime} strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 2v6m10-6v6M3 11h18" /></svg>
            <div style={{ display: "flex", fontSize: 25, fontWeight: 700 }}>{date} · {time}</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={PLAYZA.lime} strokeWidth="1.8"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
            <div style={{ display: "flex", fontSize: arabic(game.map_label) ? 22 : 24, color: "#E1D7EF", width: 635, height: 64, overflow: "hidden", lineHeight: 1.3, flexDirection: arabic(game.map_label) ? "row-reverse" : "row", flexWrap: "wrap", columnGap: 6 }}>{words(shorten(game.map_label || "Location in game details", 75))}</div>
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, color: PLAYZA.lime }}>{gameSharePrice(game)}</div>
        </div> : <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 5 }}>
          <div style={{ display: "flex", fontSize: 25, color: "#E1D7EF" }}>Great games. New friends. More you.</div>
          <div style={{ display: "flex", flexDirection: "row-reverse", justifyContent: "flex-end", columnGap: 7, color: PLAYZA.lime, fontSize: 32 }}>{words("هنلعب إيه النهاردة؟")}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>{["Games", "Academies", "Tournaments"].map(label => <span key={label} style={{ border: "1px solid #ffffff35", borderRadius: 24, padding: "8px 15px", fontSize: 17 }}>{label}</span>)}</div>
        </div>}
        <div style={{ display: "flex", marginTop: "auto", paddingTop: 15, fontSize: 16, color: "#CDBAE5" }}>playza.nineapps.online</div>
      </div>
      <div style={{ display: "flex", position: "absolute", right: 30, top: 30, bottom: 30, width: 342, flexDirection: "column", alignItems: "center", justifyContent: "space-between", borderRadius: 30, background: PLAYZA.lime, padding: "28px 24px", color: "#35116B", overflow: "hidden" }}>
        <div style={{ display: "flex", fontSize: 16, letterSpacing: 3, fontWeight: 700 }}>{game ? "MAKE YOUR MOVE" : "LET’S PLAY"}</div>
        <div style={{ display: "flex", width: 278, height: 278, borderRadius: 139, alignItems: "center", justifyContent: "center", border: "1px solid #35116B40", background: "#4C1D95", transform: "rotate(-14deg)" }}>{GameCardBackground({ sport: game?.sport ?? "Volleyball", variant: "share" })}</div>
        <div style={{ display: "flex", alignItems: "center", flexDirection: "column", gap: 5 }}>
          <div style={{ display: "flex", fontSize: game ? 44 : 32, fontWeight: 700 }}>{game ? `${game.joined} / ${game.max_players}` : "Hanel3ab?"}</div>
          <div style={{ display: "flex", fontSize: 17 }}>{game ? full ? "Game full · View details" : "players ready to play" : "Find your next game"}</div>
        </div>
        <div style={{ display: "flex", width: "100%", borderRadius: 15, background: "#35116B", color: "white", padding: "15px 16px", justifyContent: "space-between", alignItems: "center", fontSize: 19, fontWeight: 700 }}><span>{game ? "View game" : "Discover Playza"}</span><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M5 19 19 5M5 5h14v14" /></svg></div>
      </div>
    </div>,
    { width: 1200, height: 630, fonts: [{ name: "Noto Sans", data: regular, weight: 400, style: "normal" }, { name: "Noto Sans", data: bold, weight: 700, style: "normal" }, { name: "Arabic", data: arabicFont, weight: 400, style: "normal" }], headers: { "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" } }
  );
}
