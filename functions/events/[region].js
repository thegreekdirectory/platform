/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed
without written permission from The Greek Directory. Unauthorized use, copying, modification,
or distribution of this code can result in legal action to the fullest extent permitted by law.
*/

// functions/events/[region].js
//
// Cloudflare Pages Function. Route: GET /events/:region — exactly one
// required path segment (single brackets, not [[region]].js). Handles
// regional listing pages only (currently /events/chicago); individual
// event pages have moved to their own top-level directory,
// functions/event/[slug].js (see that file's header comment for the
// full reasoning).
//
// REPLACES an earlier functions/events/[[slug]].js that used an
// OPTIONAL catch-all ([[slug]].js) to handle regional pages, individual
// events, AND (via an empty-slug guard) tried to also not interfere with
// bare /events. That shape put this file in a real routing-precedence
// contest with the sibling functions/events/index.js for the exact
// /events path — Cloudflare's own routing docs confirm route
// specificity should favor index.js (fewer wildcards), but in practice
// the deployed behavior did not resolve that way, and bare /events
// ended up 404ing through this file's own not-found branch instead of
// reaching index.js.
//
// This version removes that contest structurally rather than trying to
// out-guess precedence rules: [region].js (single bracket) matches
// EXACTLY one path segment and nothing else — it cannot match zero
// segments (bare /events), so it cannot overlap with index.js's route at
// all. No ambiguity is possible between this file and index.js, by
// construction, regardless of how any given Cloudflare deploy resolves
// edge cases.
//
// params.region here is a plain STRING (single-bracket dynamic segments
// give a string; only [[double-bracket]] catch-alls give an array) —
// that's a real, meaningful difference from the old file's
// params.slug-as-array handling, not just a rename.

import { CHICAGOLAND_SUBURBS } from './_chicagoland-suburbs.js';
import { renderRegionPage } from './_render-region-page.js';

const REGION_SLUGS = {
    chicago: { label: 'Chicagoland', cities: CHICAGOLAND_SUBURBS, state: 'IL' },
};

export async function onRequestGet(context) {
    const { params } = context;
    const regionSlug = typeof params.region === 'string' ? decodeURIComponent(params.region).toLowerCase() : '';

    const region = REGION_SLUGS[regionSlug];
    if (!region) {
        // Not a known region. Individual events now live at /event/<slug>
        // (a completely different top-level path), so there is no
        // "maybe this is actually an event slug" fallback to attempt
        // here anymore — an unrecognized /events/<anything> is simply a
        // 404, cleanly and unambiguously.
        return new Response(renderNotFoundPage(), {
            status: 404,
            headers: {
                'Content-Type': 'text/html; charset=UTF-8',
                'X-Robots-Tag': 'noindex, nofollow',
                'Cache-Control': 'no-store',
            },
        });
    }

    return renderRegionPage({ region, regionSlug, env: context.env, request: context.request });
}

function renderNotFoundPage() {
    return `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Not found. | The Greek Directory</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="https://static.thegreekdirectory.org/img/logo/bluefavicon.png">
<style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; padding: 24px; }
    .wrap { max-width: 480px; }
    h1 { color: #111827; font-size: 24px; margin-bottom: 8px; }
    p { color: #6b7280; margin-bottom: 24px; }
    a { display: inline-block; background: #045093; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    @media (prefers-color-scheme: dark) {
        body { background: #1a1a1a; }
        h1 { color: #e5e7eb; }
        p { color: #9ca3af; }
    }
</style>
<script src="/js/translation-load.js"></script></head>
<body>
    <div class="wrap">
        <h1>Not found.</h1>
        <p>This page does not exist.</p>
        <a href="/events">Browse all events</a>
    </div>
</body>
</html>`;
}
