# Volleyball player discovery and signup rollout

Updated 14 October 2026. Bing work is deferred at the owner's request.

## Implemented

- Game listings and shared invitations explain individual requests, organizer requirements, waitlists, equipment questions, arrival instructions and booking/payment confirmation. A beginner label requires an organizer-specified beginner level; unknown equipment or coaching availability is not invented.
- Game signup links retain a safe internal destination. Email confirmation, password sign-in, Google sign-in and switching between signup/login preserve it. A selected public game returns first in its sport listing. Unavailable games are not automatically booked. Existing permissions, joining and payment rules still apply.
- Public English and Arabic guides: `/guides/volleyball-cairo`, `/guides/join-volleyball-without-team`, `/guides/beach-volleyball-beginners`, with corresponding `/ar/guides/...` routes and guide indexes.
- Guides have server-rendered text, reciprocal language alternates, self-canonicals, article markup matching visible content, sitemap entries and links from the homepage, sport pages and the AI overview.

## Google and AI discovery

Existing robots rules allow Googlebot and search/assistant crawlers to public content while excluding auth and private application paths. No special AI schema, indexing guarantee, or new training-crawler preference is introduced. Google documents ordinary SEO fundamentals and index/snippet eligibility for AI search:
https://developers.google.com/search/docs/appearance/ai-features

After deployment, in the verified Google Search Console property:

1. Submit or refresh `/sitemap.xml` under Sitemaps.
2. Inspect each of the six guide article URLs and both guide indexes, test live URLs and request indexing where appropriate.
3. Check Page indexing and the selected canonical/language versions. Ensure hosting/firewall rules do not challenge Googlebot or public assistant fetches.
4. Monitor Web performance for volleyball, beach volleyball, كرة طائرة, طائرة شاطئية and relevant beginner/Cairo queries. Any generative AI setting/report offered in the property must be checked in the account itself; it has not been changed from code.

Search Console account actions were not executed because no authenticated account session is available. No Bing configuration or submission was performed. Live login/signup/email-confirmation/OAuth/payment completion requires test accounts and provider access; automated tests cover destination safety and integration, without making real purchases or creating accounts.
