# Deen One — Mosques directory data strategy (2026-11-22)

## Decision
Do not connect a paid Foursquare Places API from the browser or Android WebView. Never expose a provider key in vision.html, JavaScript, Android assets, or a public repository. The current OpenStreetMap lookup stays as a temporary best-effort source, not a guaranteed complete directory.

## Foursquare evaluation
- Official pricing as of November 2026: 500 free Pro API calls, followed by metered usage (published tier $15/1,000 calls for 501–100,000).
- API use requires visual attribution ("Powered by Foursquare"), respect for caching and rate limits, and limits on redistribution and systematic extraction. Consult the exact agreement before any integration.
- Foursquare Places API source: https://foursquare.com/pricing/
- Terms: https://foursquare.com/legal/terms/apilicenseagreement/
- API docs: https://docs.foursquare.com/fsq-developers-places/reference/places-api-overview

## Recommended implementation
1. Stabilize the existing list: query OpenStreetMap once per area, preserve successful results locally, use a controlled request rate, and show a meaningful error if the first request fails. No fabricated addresses.
2. Create a curated, versioned, openly licensed mosque directory, initially populated from OpenStreetMap with ODbL attribution and license compliance. Keep source identifiers, coordinates, provenance, last-verified date and optional street address.
3. Accept suggested missing mosques or corrections from users through a moderated process. Avoid duplicate listings by proximity + normalized names and addresses, but do not merge distinct congregations sharing a building without review.
4. Deliver small regional JSON files from GitHub Pages so the web app can display cached lists without third-party API calls at every open. A scheduled, rate-limited refresh must use a provider-compliant data pipeline, not unrestricted public Overpass requests.
5. Display the distance (straight-line, labeled accurately), address when sourced, and a Google Maps directions URL per entry.
6. Test with known Mulhouse examples and other countries; include zero results, provider downtime, GPS denial, different radii, mobile caching and language settings.
7. Only evaluate Foursquare as an optional server-side licensed provider if a budget and a compliant license are explicitly approved.

## Status
Architecture decision documented; this file alone does not implement the regional dataset or solve live lookup outages.
