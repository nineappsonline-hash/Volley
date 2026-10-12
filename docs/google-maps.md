# Maps without billing

The app uses Leaflet with OpenStreetMap for in-app discovery maps and location
pickers. Public academy and playground pages offer Google Maps directions links.
These links open Google Maps in the browser or installed app.

No Google Cloud project, Google API key, billing account, or payment card is
required. No Google Maps Platform APIs or embedded API maps are loaded.
There are no map-related environment variables to configure.

Directions use only the playground's saved Google Maps location link. Names
and separately recorded coordinates are never used to generate a destination.
Buttons are hidden when the saved link is missing or invalid. Training groups
look up the link on their assigned venue record.

Shared short links are resolved using only trusted Google Maps hosts. If Google
blocks resolution, the original saved link opens instead. No name fallback is
used. Keep each playground's location link up to date in its settings.

Google Maps URL documentation:
https://developers.google.com/maps/documentation/urls/get-started
