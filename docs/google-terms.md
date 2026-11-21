# Google Maps Platform Usage & Caching Policy (`docs/google-terms.md`)

Per Part B5.5 and Google Maps Platform Terms of Service:

1. **Permanent Storage**:
   - Only `google_place_id` values may be persisted indefinitely in Firestore (`places` and `saved_places` collections).
   - Curated local notes, permit rules, best months, and regional specialities authored by the NE Mate team are stored permanently in Firestore.

2. **Temporary Caching**:
   - Live Places API (New) details (hours, ratings, photo references) and Routes API responses are cached in Redis with a short TTL (`<= 24 hours` for places metadata, `<= 15 minutes` for route traffic estimates).
   - Do not persist raw Google Places descriptions or bulk scraped Places payloads permanently in Firestore.

3. **Offline Maps & Vector Tiles**:
   - Google Maps tiles are NEVER bulk-downloaded or cached offline.
   - Online maps render via `@googlemaps/js-api-loader` (Google Maps JavaScript API) with required Google attribution.
   - Offline state packs use open coordinate geometry + OpenStreetMap-compatible / MapLibre vector data with proper OpenStreetMap attribution.

4. **Key Security**:
   - `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is restricted to Maps JavaScript API and allowed HTTP referrers.
   - `GOOGLE_MAPS_SERVER_KEY` stays exclusively on the Python FastAPI backend (`services/api`), restricted by server IP and scoped to Places API (New), Routes API, and Geocoding API, always passing strict `X-Goog-FieldMask` headers to control cost.
