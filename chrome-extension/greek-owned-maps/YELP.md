# Yelp integration — Chrome extension

This document describes the Yelp integration added to the Google Maps extension in version 0.3.0.

## Data mapping
- Source URL pattern: https://www.yelp.com/biz/{yelp_id} (also supports https://yelp.com/biz/{yelp_id}).
- The value immediately after /biz/ is the TGD identifier. Query strings and tracking parameters are ignored.
- The identifier is matched against public.listings.yelp_id.
- Only rows with visible = true are returned.
- The separate internal Yelp identifier used in review links is not used.

## User interface behavior

### Yelp search results
- Scans Yelp result cards marked data-testid="serp-ia-card" or data-traffic-crawl-id="OrganicBusinessResult" / "AdBusinessResult".
- Reads the business slug from its business-name /biz/ link.
- Adds a compact Yelp-styled Greek-owned · TGD badge for a match.
- Does not add a suggestion button to search results.

### Yelp business detail page
- Reuses the top TGD Greek-owned badge and top suggestion button styling/wording from the Google Maps integration.
- For a listed business, adds a separate Yelp-styled row in the business information sidebar, immediately before Yelp's lower Suggest an edit control. The row includes View listing and Copy link actions.
- For an unlisted business, clones Yelp's lower Suggest an edit button, replaces its pencil icon with the Greek flag, and changes its label to Suggest to The Greek Directory. Yelp's original control is preserved.
- The suggestion modal is the same modal used by Google Maps, with the same text, relationship choices, optional note, and submission feedback.

## Browser files
- manifest.json: injects yelp-content.js and yelp.css on Yelp domains.
- yelp-content.js: extracts Yelp slugs, scans search cards and detail pages, injects badges/actions, and opens the shared-style suggestion modal.
- yelp.css: Yelp-specific styling with Helvetica/Arial typography, neutral borders, and Yelp-red accents.
- background.js: separate Yelp lookup and submission message handlers and cache namespace y1:.
- config.js: shared Supabase URL and public publishable key.
- popup.html / popup.js: shared popup; status recognizes Google Maps and Yelp.

## Supabase objects
- public.listings.yelp_id: existing listing identifier.
- public.greek_owned_yelp_extension_suggestions: separate suggestion/review queue with RLS enabled and direct privileges revoked from public/anon/authenticated.
- public.listings_visible_yelp_id_idx: partial lookup index for visible listings.
- greek-owned-yelp-lookup: returns visible Yelp matches and TGD slugs.
- greek-owned-yelp-suggest: checks existing listings, enforces suggestion limits, and inserts a pending submission.
- greek-owned-yelp-admin: lists and reviews the Yelp queue using a GitHub PAT with write access to thegreekdirectory/platform.

The Yelp functions use the existing consume_greek_owned_extension_quota database function. Yelp suggestion submissions use a deterministic installation UUID scoped with :yelp-suggestions, keeping the five-per-hour suggestion counter separate from Google Maps suggestions.

## Review API

List pending Yelp suggestions:

    curl -X POST "https://luetekzqrrgdxtopzvqw.supabase.co/functions/v1/greek-owned-yelp-admin" \
      -H "Content-Type: application/json" -H "x-github-token: $GITHUB_TOKEN" \
      -d '{"action":"list"}'

Approve or deny after checking evidence:

    curl -X POST "https://luetekzqrrgdxtopzvqw.supabase.co/functions/v1/greek-owned-yelp-admin" \
      -H "Content-Type: application/json" -H "x-github-token: $GITHUB_TOKEN" \
      -d '{"action":"review","id":"SUGGESTION_UUID","status":"approved","reviewNotes":"Reviewed and verified"}'

Approval changes only the suggestion status. It does not create a listing automatically.

## Testing notes

The supplied Yelp samples showed:
- Search business cards with data-testid="serp-ia-card" and business links nested below data-traffic-crawl-id="SearchResultBizName".
- Detail pages with data-testid="photoHeader" containing the business h1.
- A sidebar data-testid="cookbook-island" containing website, phone, directions, and the lower Yelp Suggest an edit button.

Yelp is a React application and its class names/DOM may change. The extension uses test IDs and semantic link paths where available, but the search-card and sidebar insertion points still need live Chrome validation against Yelp pages.
