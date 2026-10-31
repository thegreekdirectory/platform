# The Greek Directory — Google Maps Extension

Chrome Manifest V3 prototype, version 0.1.2.

## Install for local testing
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this `greek-owned-maps` folder.
5. Open Google Maps and navigate to a business.

The Supabase project URL and public publishable key are configured in `config.js`. Only a public publishable key is included; no service-role key is stored in the extension.

## Features
- Checks supported Google Place IDs against visible records in `public.listings`.
- Adds a TGD Greek-owned badge to matching search result cards and supported business detail pages.
- Provides a suggestion form with owner, family/friend, and knows-it-is-Greek-owned choices plus an optional note.
- Suggestions enter a separate queue and require human review before any listing is added.
- A random local installation UUID is used for request limiting.
- Lookup cache is held in `chrome.storage.session` for up to three hours and clears when the browser session ends.

## Known Google Maps limitation
Google Maps does not consistently expose Google Place IDs as explicit URL parameters. The extension now supports three paths: explicit `query_place_id` / `place_id` parameters, a direct `ChIJ...` token, and the Maps MID/CID pair format `0x...:0x...`. For the pair format, it uses the final pair in the URL and converts the two hexadecimal 64-bit values into the 21-byte protobuf payload used to construct the Place ID. The extension intentionally does not return the raw CID pair as an ID.

## Backend functions
The following Supabase Edge Functions are deployed to the TGD project:
- `greek-owned-maps-lookup`
- `greek-owned-maps-suggest`
- `greek-owned-maps-admin`

Source is in `supabase/functions/`. The database migration is in `supabase/migrations/20261031054358_google_maps_extension.sql`.

### Admin review API
The admin endpoint requires a GitHub personal access token for a collaborator with write access to `thegreekdirectory/platform`. Do not embed this token in the extension or commit it.

List pending submissions:
```bash
curl -X POST "https://luetekzqrrgdxtopzvqw.supabase.co/functions/v1/greek-owned-maps-admin" \
  -H "Content-Type: application/json" -H "x-github-token: $GITHUB_TOKEN" \
  -d '{"action":"list"}'
```

Approve or deny a suggestion after checking its evidence:
```bash
curl -X POST "https://luetekzqrrgdxtopzvqw.supabase.co/functions/v1/greek-owned-maps-admin" \
  -H "Content-Type: application/json" -H "x-github-token: $GITHUB_TOKEN" \
  -d '{"action":"review","id":"SUGGESTION_UUID","status":"approved","reviewNotes":"Reviewed and verified"}'
```

Approving a suggestion marks it approved in the queue; it does not automatically create a public directory listing. A separate normal TGD listing-entry process is still required.

## Privacy
- Runs only on the Google Maps URL patterns listed in `manifest.json`.
- Does not send search terms, browsing history, account identity, name, email, or location.
- Lookup requests send Place IDs only; lookup results are not stored server-side.
- Suggestion submissions send the business name, Place ID, optional address, relationship choice, and optional note for review.
- No analytics or advertising code is included.
