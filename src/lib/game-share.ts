/** Keep the share-link text and generated image consistent. */
export function gameSharePrice(game: { host_pays?: boolean; share_price: number | null }): string {
  if (game.host_pays) return "Free — host covers the court";
  if (game.share_price === 0) return "Free to join";
  if (game.share_price == null) return "Price to be confirmed";
  return `EGP ${game.share_price} per player`;
}

export type ShareableGame = {
  id: string; title: string; sport: string; game_date: string; start_time: string;
  status: string; max_players: number; joined: number; share_price: number | null;
  host_pays?: boolean; is_public: boolean; invite_code?: string | null;
  place: string; duration_hours?: number;
};

/** Public links never carry invitation codes; private links must retain their code. */
export function gameSharingTarget(game: ShareableGame, origin: string, lang: "en" | "ar" = "en", source = "whatsapp") {
  if (!game.is_public && !game.invite_code) return null;
  const cleanUrl = game.is_public
    ? `${origin.replace(/\/+$/, "")}/games/${encodeURIComponent(game.id)}`
    : `${origin.replace(/\/+$/, "")}/games?join=${encodeURIComponent(game.invite_code!)}`;
  const url = `${cleanUrl}${game.is_public ? "?" : "&"}utm_source=${encodeURIComponent(source)}&utm_medium=share&utm_campaign=game_share`;
  const ar = lang === "ar";
  const date = new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "full", timeZone: "Africa/Cairo" }).format(new Date(`${game.game_date}T12:00:00Z`));
  const price = ar ? game.host_pays || game.share_price === 0 ? "مجاني" : game.share_price == null ? "التكلفة لم تتحدد بعد" : `${game.share_price} جنيه لكل لاعب` : gameSharePrice(game);
  const spots = Math.max(0, game.max_players - game.joined);
  const availability = game.status === "cancelled" ? ar ? "الماتش اتلغى" : "Cancelled" : game.status === "completed" ? ar ? "الماتش انتهى" : "Completed" : game.status === "full" || spots === 0 ? ar ? "العدد مكتمل" : "Full" : ar ? `${spots} أماكن متاحة وقت المشاركة` : `${spots} spots available at time of sharing`;
  const text = [game.title, game.sport, `${date} · ${game.start_time.slice(0, 5)} (${ar ? "بتوقيت القاهرة" : "Cairo time"})`, game.place, price, availability, ar ? "راجع آخر التفاصيل والتوفر قبل الانضمام." : "Check the latest details and availability before joining."].filter(Boolean).join("\n");
  return { title: game.title, text, url, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}` };
}
