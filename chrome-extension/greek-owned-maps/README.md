# The Greek Directory — Google Maps Extension

Chrome Manifest V3 prototype.

## Install
1. Set the Supabase publishable key in `config.js`.
2. Open `chrome://extensions`.
3. Enable Developer mode and choose **Load unpacked**.
4. Select this folder, then open Google Maps.

## What it does
- Checks supported Google Place IDs against visible TGD listings.
- Adds a Greek-owned badge to matched result cards.
- Provides a form to suggest a business for human review.
- Uses a random local installation ID for rate limiting.
- Caches lookup results in Chrome session storage for up to 3 hours.

## Important Place ID limitation
Google Maps does not consistently expose Google Place IDs in page URLs or markup. This version recognizes Place IDs when a `ChIJ...` token or `query_place_id` is present. It intentionally does not treat internal `0x...:0x...` CID values as Place IDs. Some results will therefore not be recognized until a more reliable supported Place ID source is available.

## Backend
Deploy the Edge Functions in `supabase/functions/` with JWT verification disabled and configure them with the project's standard Supabase environment variables. The extension must contain only a public publishable key, never a server secret.

This is an initial prototype and should be tested against real Maps page variations before public distribution.
