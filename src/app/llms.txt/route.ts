import { SITE_URL } from "@/lib/seo";
import { DISCOVERY_SPORTS, discoveryPath } from "@/lib/sport-discovery";

export const dynamic = "force-static";

export function GET() {
  const sports = DISCOVERY_SPORTS.map(sport =>
    `- [${sport.name} in Cairo](${SITE_URL}${discoveryPath("en", sport.slug)}): ${sport.advice.en} [العربية](${SITE_URL}${discoveryPath("ar", sport.slug)})`
  ).join("\n");
  const body = `# Playza / بلايزا

> Playza is an Arabic and English sports platform. Players discover public games, academies and tournaments; academy administrators manage training, members and competitions. The player discovery guides focus on Cairo, Egypt.

## Find a place to play

- [Home](${SITE_URL})
- [Sports in Cairo](${SITE_URL}/sports): Guides for all 27 supported sports, with public activity and academy links.
- [الرياضة في القاهرة](${SITE_URL}/ar/sports): Arabic versions of the sport guides.
- [Public courts](${SITE_URL}/courts): Approved Egypt courts with addresses, sports, listed rental prices and public venue profiles. [العربية](${SITE_URL}/ar/courts)
- [Volleyball courts](${SITE_URL}/courts?sport=volleyball)
- [Beach volleyball courts](${SITE_URL}/courts?sport=beach-volleyball)
- [Games](${SITE_URL}/games): Upcoming public activities with dates, places and participation costs.
- [Academies](${SITE_URL}/academies): Public academy directory; each academy page describes its published location and sports.
- [Tournaments](${SITE_URL}/tournaments): Tournament discovery for free and paid accounts.
- [Court booking guide](${SITE_URL}/book-courts)
- [Frequently asked questions](${SITE_URL}/faq)

## Sport guides

${sports}

## Participation and availability

- Account registration and public browsing are free. Joining activities requires sign-in; an activity can have a separate participation, venue or coaching fee.
- Availability, venue addresses, dates, experience requirements and prices come from individual listings. Supporting a sport does not mean that a session is currently available in every district.
- Check a listing and booking/payment status before attending. Do not infer availability or a confirmed reservation from these guides.
- Tournament access does not require a premium subscription. Tournament management remains restricted to authorized academy administrators and platform administrators.
- [Academy management solutions](${SITE_URL}/solutions): Information for academy owners.
- [Sitemap](${SITE_URL}/sitemap.xml): Public discovery pages.
`;
  return new Response(body, { headers: {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=3600",
  } });
}
