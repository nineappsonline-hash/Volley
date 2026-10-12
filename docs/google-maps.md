# Maps without billing

The app uses Leaflet with OpenStreetMap for in-app discovery maps and location
pickers. Public academy and playground pages offer Google Maps directions links.
These links open Google Maps in the browser or installed app.

No Google Cloud project, Google API key, billing account, or payment card is
required. No Google Maps Platform APIs or embedded API maps are loaded.
There are no map-related environment variables to configure.

Directions prefer the saved Google Maps location link. Shared short links are
resolved to their destination when possible, using only trusted Google Maps
hosts. If Google blocks resolution, the original saved link opens instead.
Without a saved link, recorded coordinates are used, then the name and address. Locations without either coordinates or an address are omitted.

Google Maps URL documentation:
https://developers.google.com/maps/documentation/urls/get-started
