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


## Google Maps detail-page behavior (v0.2.4)

### Lower Greek-owned row (listed businesses)
- The row is a deep clone of Google's own Plus Code row, inserted directly beneath it. Google's CSS therefore supplies the layout, hover background and the hover-revealed trailing actions; the extension does not draw its own row chrome. Google's `jsaction`, `id`, `data-*` and `aria-labelledby` attributes are stripped from the clone so Maps' delegated handlers never act on it.
- Only the icon (Greek flag), text (`Greek-owned` / `Listed in The Greek Directory`), trailing action targets and click behavior are ours. Icon size is taken from Google's original icon.
- Hovering shows exactly two trailing actions, in the same order as Maps' website row: **Open listing** (opens the TGD listing in a new tab) and **Copy TGD link**. Google's own trailing copy button and icon are reused; the open glyph is added by cloning that button. Every other control cloned from the Plus Code row (for example its info button) is removed, along with any wrapper left empty.
- Tooltips: Maps' own tooltip code does not fire on a cloned node, so the extension draws one that matches Maps' in look and behaviour (both measured from screenshots and a screen recording of Maps). Look: `#303030` box, 24 px tall, 4 px radius, white 13 px text, no shadow, ~100 ms ease-out fade-in. Behaviour: it appears the moment the pointer enters a control, disappears at once on leaving or clicking, does not follow the pointer (it stays put while the pointer moves inside the control), and moving to another control swaps it in place with no gap. Position: on the row it sits just under the row, 11 px in from its left edge (like Maps' `Copy phone number`); on the icon buttons it is centred 2 px under the icon (like `Copy plus code` / `Open website`). Text: `Copy TGD link` on the row and the copy button, `Open listing` on the open button. It also shows on keyboard focus, stays inside the window, and is removed together with the row. No native `title` or Maps hook is added, so tooltips never double up.
- Clicking the row (or Enter/Space), or **Copy TGD link**, copies `https://thegreekdirectory.org/listing/{slug}` through Google's own copy control, so Maps shows its native "Copied to clipboard" snackbar. The extension never draws a toast of its own.

### How the copy reaches Google's snackbar
`main-world.js` is registered in `manifest.json` as a `world: "MAIN"` content script. When the row is clicked, `content.js` posts an `ARM` message (token + TGD URL). The bridge temporarily wraps `navigator.clipboard.writeText` and `document.execCommand("copy")`, replies `ARMED`, and `content.js` then clicks Google's real Plus Code copy control. Google's handler runs normally and shows its snackbar; the bridge substitutes the TGD URL for the Plus Code in that one write, reports `COPIED`/`FAILED`, and restores the originals (also after 1.8 s if nothing was copied). The bridge only accepts `https://thegreekdirectory.org/listing/...` URLs.

Fallbacks, so a click never silently does nothing: if the bridge does not answer within 900 ms, or Maps reports a failed write, or no write is reported within about 2.2 s of the click, the link is written directly to the clipboard (without Maps' snackbar) and a console warning is logged where applicable. If the cloned row has no trailing action to reuse, plain Open/Copy buttons are added instead (console warning). If a listing has no slug, the row is shown without actions.

### Suggestion buttons (businesses not in TGD)
- Top button: unchanged TGD styling; label is now **Suggest to The Greek Directory**.
- Bottom button: a clone of Google's **Suggest an edit** button with the pencil replaced by the Greek flag and the label **Suggest to The Greek Directory**. Maps styles this button (padding, height, icon gap) with rules that depend on its parent, so the clone is placed inside a copy of the same ancestor chain (other branches dropped) rather than inside a wrapper of ours, and sits on its own centered line beneath Google's button. If Google's button cannot be found, a TGD-styled button is used instead.
- Neither button is shown for a business already listed as Greek-owned.

### Verification status
The extension scripts and stylesheet were executed in headless Chromium against a mock Maps panel that imitates the DOM shape the project's earlier code relied on (`RcCsl` rows, `data-item-id`, trailing copy buttons, delegated handlers, black snackbar). That confirms the logic, the clipboard hand-off and the CSS cascade, but it is **not** live Google Maps. Check hover, the tooltips, the snackbar and the bottom buttons in Chrome on real place pages after loading the unpacked extension. The bottom button's ancestor chain depends on Maps' live markup, and the tooltip look and behaviour were matched from screenshots and a recording (the mock cannot load Google Sans); if either looks off, the `outerHTML` of the Plus Code row and of the Suggest an edit button (from DevTools) shows exactly what to match.
