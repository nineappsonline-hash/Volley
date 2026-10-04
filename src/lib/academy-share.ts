/**
 * Share-link helpers for academies and their training programs.
 *
 * Links are absolute so they survive being pasted into WhatsApp or any other
 * app, and the text stays deliberately short — the destination page already
 * lists the plans, so the message only needs to say who it is from.
 */
import { SITE_URL } from "@/lib/seo";

/** Public academy page. */
export function academyShareLink(slug: string): string {
  return `${SITE_URL}/a/${encodeURIComponent(slug)}`;
}

/** A single plan, deep-linked to its expanded card on the academy page. */
export function programShareLink(slug: string, programId: string): string {
  return `${academyShareLink(slug)}#training-${encodeURIComponent(programId)}`;
}

/**
 * Line shown above the link in the share sheet. Program shares name the plan
 * first so the recipient knows which group it is before opening anything.
 */
export function academyShareText(
  academy: { name: string; area?: string | null; governorate?: string | null },
  program?: { name?: string | null } | null
): string {
  const place = [academy.area, academy.governorate].filter(Boolean).join(", ");
  const academyLine = place ? `${academy.name} · ${place}` : academy.name;
  return program?.name ? `${program.name} · ${academyLine}` : academyLine;
}
