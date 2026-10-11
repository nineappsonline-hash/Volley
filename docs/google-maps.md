# Maps without billing

The app uses Leaflet with OpenStreetMap for in-app discovery maps and location
pickers. Public academy and playground pages offer Google Maps directions links.
These links open Google Maps in the browser or installed app.

No Google Cloud project, Google API key, billing account, or payment card is
required. No Google Maps Platform APIs or embedded API maps are loaded.
There are no map-related environment variables to configure.

Directions prefer recorded coordinates; otherwise they use the recorded name
and address. Locations without either coordinates or an address are omitted.

Google Maps URL documentation:
https://developers.google.com/maps/documentation/urls/get-started
