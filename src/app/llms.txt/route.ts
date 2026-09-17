import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export function GET() {
  const body = `# Playza

> Playza is a bilingual (Arabic/English) platform for sports academies and player communities in Egypt and the Gulf. Academy owners run members, subscriptions, QR attendance, training schedules, payments and automated profit tracking; players discover and join friendly matches, public and community games, and tournaments at real venues. Built for football, volleyball, basketball, padel and swimming.

Playza connects two sides of the same market: (1) academy management software — members and family accounts, subscription plans, QR code check-in, session scheduling and court booking, payment receipts and automatic per-session profit & loss; and (2) a player community — browse games by sport and location, join with a share per player, use weekly recurring games, follow academies, and enter tournaments. The app is fully available in Arabic (RTL) and English, with Egyptian Arabic phrasing throughout.

## Key information

- [Home page](PLAYZA_SITE_URL): Overview of Playza's academy management platform and community features.
- [Sports academy management solutions](PLAYZA_SITE_URL/solutions): How Playza works for football, volleyball, basketball, padel and swimming academies.
- [Browse academies](PLAYZA_SITE_URL/academies): Public directory of sports academies with locations, sports and follow options.
- [Friendly games and matches](PLAYZA_SITE_URL/games): Find or create friendly games — join by share per player, set visibility, and share invite links.
- [Tournaments](PLAYZA_SITE_URL/tournaments): Create and join public tournaments across sports.
- [Frequently asked questions](PLAYZA_SITE_URL/faq): Answers about accounts, subscriptions, games, tournaments, attendance, payments and security.
- [Create an account](PLAYZA_SITE_URL/signup): Free sign-up for players and academy owners.

## Sport-specific solutions

- [Football academy management](PLAYZA_SITE_URL/solutions/football): Manage a football academy — members, attendance, payments, profit tracking.
- [Volleyball academy management](PLAYZA_SITE_URL/solutions/volleyball): Volleyball-specific academy tools and player community features.
- [Basketball academy management](PLAYZA_SITE_URL/solutions/basketball): Basketball academy management and friendly game discovery.
- [Padel academy management](PLAYZA_SITE_URL/solutions/padel): Padel court booking, members and automated profit tracking.
- [Swimming academy management](PLAYZA_SITE_URL/solutions/swimming): Swimming lesson scheduling, class management and memberships.

## Availability

- Playza is offered as a web application. Sign-in is required for academy management, joining games and creating tournaments.
- Prices and feature limits for academy and tournament plans are shown during sign-up and in the FAQ.
`
    .replaceAll("PLAYZA_SITE_URL", SITE_URL);
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}