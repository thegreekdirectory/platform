# The Greek Directory — Google Maps Extension

Chrome Manifest V3 prototype, version 0.2.4.

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
Google Maps does not consistently expose Google Place IDs as explicit URL parameters. The extension now supports three paths: explicit `query_place_id` / `place_id` parameters, a direct `ChIJ...` token, and the Maps MID/CID pair format `0x...:0x...`. For the pair format, it uses the final pair in the URL and converts the two hexadecimal 64-bit values into the 21-byte protobuf payload used to construct the Place ID. The Base64 output is normalized to Base64URL (`+` → `-`, `/` → `_`) before the final trailing `A` is removed, matching the alphabet used by TGD's stored Google Place IDs. The extension intentionally does not return the raw CID pair as an ID.

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


## Google Maps detail-page styling (v0.2.4)
- The lower Greek-owned information row is cloned from Google's Plus Code row, then its visible text and SVG glyph are changed. Native Google Maps text/icon sizing, classes and colors are retained. The clone is inserted as a separate full-width sibling row under Plus Code.
- The adjacent suggestion action is cloned from Google's native “Suggest an edit” control, so it inherits the current Maps button design. The original TGD-styled top button and top badge remain unchanged.


## Copy and open listing actions (v0.2.4)
- The Greek-owned detail row under Plus Code copies the corresponding TGD listing URL when clicked.
- Hovering or focusing the row reveals **Open listing** and **Copy TGD link** actions.
- Copy actions show a Google Maps-style “Copied to clipboard” snackbar.
- The suggestion CTA wording is **Suggest to The Greek Directory**. The lower CTA reuses the native Google Maps “Suggest an edit” button styling and replaces its pencil icon with the Greek flag.
- The extension popup is unchanged.


## Native Google Maps row and clipboard behavior (v0.2.4)
- The Greek-owned row is built from the current Google Maps website information row, retaining its native row hover treatment and its original action-icon components.
- The cloned actions are labeled **Open listing** and **Copy TGD link**. The open action opens the matched listing in a new tab.
- The copy action arms a narrow MAIN-world clipboard bridge and triggers a real Google Maps copy action; the bridge substitutes the TGD URL only for that next clipboard write. Google Maps handles its own “Copied to clipboard” snackbar. The extension no longer draws its own snackbar.
- The bottom **Suggest to The Greek Directory** action now keeps Google's native Suggest an edit button markup and styling while replacing only its pencil graphic and label.
- Popup files are unchanged.


## Row and suggestion correction (v0.2.4)
- The Plus Code follow-up is now a genuine **Greek-owned** row, not duplicated website content. It reuses the native Maps row shell and only clones the website action controls.
- The trailing open action opens the matching TGD listing in a new tab; the copy action uses the native Maps copy control.
- The bottom suggestion button is newly constructed using the Google Maps button's computed appearance. It does not inherit the Google pencil SVG or pseudo-element.
