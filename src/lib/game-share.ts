/** Keep the share-link text and generated image consistent. */
export function gameSharePrice(game: { host_pays?: boolean; share_price: number | null }): string {
  if (game.host_pays) return "Free — host covers the court";
  if (game.share_price === 0) return "Free to join";
  if (game.share_price == null) return "Price to be confirmed";
  return `EGP ${game.share_price} per player`;
}
