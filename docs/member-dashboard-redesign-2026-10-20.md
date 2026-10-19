# Member dashboard and discovery redesign

The member dashboard follows the supplied mobile references using Playza navy and lemon green. It adds a photo activity grid, personal greeting, working share/invite control, sport shortcuts, a recommendations carousel and a floating bottom navigation bar. Existing QR check-in, training, family, tournaments, alerts and virtual-court features remain reachable. The academy-owner dashboard keeps its management layout.

Game discovery now uses compact list summaries with a thumbnail, venue, date, time, price, player capacity, participation and booking status. Expanding a row retains the existing participation, payment and organizer controls. The header's create-game, follow-sport and alert controls remain together. Games, tournaments and training have real navigation links. Sport shortcuts use a supported `sport` query parameter; archery links to its existing sport page rather than advertising unsupported game filtering.

A new locally served 134 KB WebP contact sheet supplies category artwork. The final generated image was reviewed for the user's clothing preference: women wear full-length trousers and long-sleeved sportswear. The earlier generated sheet was not added. Existing saved venue images still supply actual listing thumbnails. The photo grid is decorative category artwork, not a claim that the depicted people or courts are actual listings.

Validation:

- All 54 test files passed. Added bilingual rendering checks for category destinations, sport links, QR anchors, game price/capacity/details/booking state and bottom-navigation active state.
- TypeScript, lint with zero warnings, production build and whitespace checks passed.
- Firefox rendered local component fixtures at 390 px width in English/light, English/dark discovery and Arabic/dark. Each fixture reported no horizontal document overflow. Visual inspection caught and fixed photo-caption contrast and the missing beach-volleyball icon.
- Browser previews used fixture data and server-rendered components, not a logged-in production account. They do not certify real payment submission, native sharing permissions or all authenticated interactions.

Follow-up: the Play your sport buttons now control a local dashboard selection, including Archery, instead of navigating to sport pages. The results immediately below are filtered in place, remove the previous twelve-card recommendation cap in this mode, and retain realtime invalidation plus the existing 15-second refresh/focus fallback. Filters (area/court, level and date) use a native disclosure collapsed by default; the full discovery page's existing filters are also collapsed initially. The separate photo category tiles retain their destination links. Added regression checks for local selection callbacks, selected states, archery results/empty states, more than twelve matches, refreshed query data and collapsed filters.
