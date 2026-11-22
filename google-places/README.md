# Optional Google Places integration — deployment checklist

The Deen One web app uses OpenStreetMap by default. To enable Google Places first with automatic OpenStreetMap fallback, deploy this Cloudflare Worker and set the **public worker endpoint** in `mosques.js` (`GOOGLE_PLACES_ENDPOINT`). Never put the Google key in frontend code.

1. Create a Google Cloud project with Places API (New) enabled, a billing account, and a key restricted to **Places API (New)**. Google Cloud billing is separate from the worker quota: set budget alerts and API-side quota restrictions too. A budget alert is NOT a spending cap.
2. Set up a Cloudflare account and deploy `wrangler.toml` and `worker.js` from this directory. Configure secret `GOOGLE_PLACES_API_KEY` via Wrangler secrets or the Cloudflare dashboard.
3. Configure `GOOGLE_PLACES_ENDPOINT` in `mosques.js` with the deployed HTTPS worker URL. Do not deploy until tested.
4. Worker allows up to **1,000 Google calls globally per UTC month** and **10 per anonymous browser ID per UTC month**. Every attempted Google call consumes quota. A user can reset their browser ID; this is a best-effort per-user limit, not secure account-based identity. The global counter is atomic within the Durable Object.
5. On quota exhaustion, provider error or missing worker configuration, the client falls back to OpenStreetMap. Quota protects only traffic through this worker; lock down the Google key and configure Google Cloud quotas.
6. Google Places data is transient and not added to the OSM persistent cache. Display Google attribution, comply with Maps Platform Terms and any applicable Google Maps display requirements. Review whether Google Places data can be displayed in a standalone list without a Google Map for your use case before production deployment.
7. Check Cloudflare plan/limits and billing before deploying; do not assume Durable Objects are free on your account.

**Status:** Worker and fallback client logic prepared; no live Google Places calls until the endpoint and secret are configured.
