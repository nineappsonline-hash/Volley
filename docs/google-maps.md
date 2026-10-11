# Google Maps for academy and playground locations

Individual public academy and playground pages use the Google Maps Embed API
when `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` is configured. The multi-game discovery
map and interactive location pickers continue using Leaflet/OpenStreetMap.
Google Maps directions remain available without an API key.

## Activate the embeds

1. Create or select a Google Cloud project with billing configured.
2. Enable **Maps Embed API** and create a browser API key.
3. Restrict the key to **Maps Embed API** and **Websites**. Allow
   `https://playza.nineapps.online/*` and any other domains serving the app.
   Add `http://localhost:3000/*` only when needed for local development.
4. Set `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` in the hosting environment, and
   optionally `.env.local`. Redeploy/rebuild; Next.js embeds public variables
   at build time.
5. Open a public academy or playground page with a recorded location and
   verify the map and directions pin.

No key is committed to the repository. Without a key, the location card shows
its address and Google Maps directions without loading a broken iframe.
Coordinates take priority; otherwise the recorded name/address is used for
Google's location lookup. Review pins for locations without coordinates.

Google currently lists Embed API usage as unlimited and free. This integration
does not load Maps JavaScript API or call Places, Geocoding or Routes APIs.

Official setup: https://developers.google.com/maps/documentation/embed/quickstart
Pricing: https://developers.google.com/maps/documentation/embed/usage-and-billing
Embedding: https://developers.google.com/maps/documentation/embed/embedding-map
