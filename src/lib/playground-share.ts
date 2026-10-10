/**
 * Share-link helpers for playgrounds.
 *
 * Links are absolute so they survive being pasted into WhatsApp or any other
 * app, and the text stays deliberately short — the destination page already
 * lists availability, so the message only needs to say which playground it is.
 */
import { SITE_URL } from "@/lib/seo";

/** Public, shareable playground page. */
export function playgroundShareLink(id: string): string {
  return `${SITE_URL}/p/${encodeURIComponent(id)}`;
}

/**
 * Line shown above the link in the share sheet. Names the playground first so
 * the recipient knows which venue it is before opening anything.
 */
export function playgroundShareText(venue: {
  name: string;
  area?: string | null;
  governorate?: string | null;
}): string {
  const place = [venue.area, venue.governorate].filter(Boolean).join(", ");
  return place ? `${venue.name} · ${place}` : venue.name;
}