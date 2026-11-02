/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed
without written permission from The Greek Directory. Unauthorized use, copying, modification,
or distribution of this code can result in legal action to the fullest extent permitted by law.
*/

import { EVENTS_APP_SHELL_HTML } from './_app-shell.js';

// functions/events/index.js
//
// Cloudflare Pages Function. Route: GET /events (exact match only).
// Regional pages (e.g. /events/chicago) are handled by the sibling
// functions/events/[region].js — a SINGLE required path segment, not a
// catch-all — and individual event pages live under a completely
// separate top-level directory, functions/event/[slug].js (singular).
//
// ROUTING CORRECTNESS NOTE: an earlier version of this comment claimed
// this file and a sibling [[slug]].js (an OPTIONAL catch-all) "coexist
// without conflict by design" based on Cloudflare's documented route-
// specificity rules favoring fewer wildcards. That claim was never
// actually verified against real deployed behavior, and in practice it
// did not hold — requests to bare /events were handled by the catch-all
// instead of this file, 404ing through its own not-found branch. This
// has since been restructured so the question cannot come up at all:
// [region].js matches exactly one path segment and NOTHING else, so it
// structurally cannot match zero segments (bare /events) — there is no
// route overlap for Cloudflare to have to resolve one way or the other,
// regardless of how any given deploy's precedence resolution behaves.
// See functions/event/[slug].js and functions/events/[region].js's own
// header comments for the full reasoning.
//
// WHY THIS FILE EXISTS AT ALL, given events.html already contains this
// exact markup: the spec calls for /events itself to be served by "a
// cloudflare server-side function," not a static file — unlike
// listings.html (a plain static file with client-side Supabase reads).
// The homepage's actual interactivity (calendar grid, map, live
// filtering) still has to run in the browser regardless of who serves
// the initial HTML; nothing about a calendar/map UI can meaningfully run
// server-side. So this function's job is narrow but real: own the
// route, set the cache policy, and return the shell that js/events.js
// then hydrates. events.html itself is kept in the repo as the
// human-readable source of truth for the page's OUTER markup (head
// metadata, hero, script tags) — the INNER interactive shell (controls,
// filter panel, Map/Calendar panels, grid/list) is imported from
// _app-shell.js rather than duplicated inline here, and is shared with
// _render-region-page.js for the exact same reason — see that shared
// file's own header comment. If events.html's outer markup is ever
// hand-edited, mirror the edit in the two template-literal pieces below;
// if the inner shell is ever edited, only _app-shell.js needs touching,
// and both this file and every regional page pick up the change
// automatically.
//
// This function does NOT touch Supabase — it has nothing to fetch for
// the shell itself; all data loading happens client-side in
// js/events.js via the anon key, exactly like listings.html already
// does for listings. That split (server owns routing/caching of the
// shell, browser owns the live data) is deliberate: it keeps this
// function trivially cheap to run (no origin round-trip to Supabase on
// every single pageview) while still satisfying "server-side function"
// for the route itself, and keeps the interactive data-loading code in
// ONE place (js/events.js) shared identically by events.html-the-file
// (if ever served directly) and this Worker's copy of it, rather than
// forking data-fetching logic between a server context and a browser
// context.

const SUPABASE_URL = 'https://luetekzqrrgdxtopzvqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZXRla3pxcnJnZHh0b3B6dnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc2NDcsImV4cCI6MjA4MzkyMzY0N30.TIrNG8VGumEJc_9JvNHW-Q-UWfUGpPxR0v8POjWZJYg';

// Fetches a bounded set of upcoming, visible events for the ItemList
// schema below — the anon key, same privilege level js/events.js
// already uses client-side for this exact same public data (this
// function is NOT the source of the live event list the visitor sees;
// js/events.js still owns that, hydrating in the browser exactly as
// before — this fetch exists purely to give crawlers that don't execute
// JS a real structured signal of what's on the page, since previously
// the static HTML had none at all).
async function fetchUpcomingEventsForSchema() {
    try {
        const nowIso = new Date().toISOString();
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/events?visible=eq.true&status=neq.cancelled&start_at=gte.${encodeURIComponent(nowIso)}&order=start_at.asc&limit=20&select=slug,title,start_at`,
            { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, Accept: 'application/json' } }
        );
        if (!response.ok) return [];
        const rows = await response.json();
        return Array.isArray(rows) ? rows : [];
    } catch {
        // A schema fetch failing should never take the whole page down —
        // the page still renders correctly, just without this one
        // enhancement, and js/events.js's own client-side load is
        // entirely unaffected either way.
        return [];
    }
}

function buildEventsItemListSchema(events) {
    if (!events.length) return null;
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: events.map((event, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `https://thegreekdirectory.org/event/${event.slug}`,
            name: event.title,
        })),
    };
}

function buildEventsPageHeadAndHero(upcomingEvents) {
    const itemListSchema = buildEventsItemListSchema(upcomingEvents);
    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://thegreekdirectory.org/' },
            { '@type': 'ListItem', position: 2, name: 'Events', item: 'https://thegreekdirectory.org/events' },
        ],
    };
    const websiteSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'The Greek Directory',
        url: 'https://thegreekdirectory.org',
        potentialAction: {
            '@type': 'SearchAction',
            target: 'https://thegreekdirectory.org/search?q={search_term_string}',
            'query-input': 'required name=search_term_string',
        },
    };
    const organizationSchema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'The Greek Directory',
        url: 'https://thegreekdirectory.org',
        logo: 'https://static.thegreekdirectory.org/img/logo/blue.svg',
    };

    return `<!-- events.html -->
<!-- Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. For more information, visit https://thegreekdirectory.org/legal. -->

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Events | Greek Festivals, Church Events & Gatherings | The Greek Directory</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

    <link rel="manifest" href="/manifest.json">

    <!-- Copyright (C) The Greek Directory, 2025-present. All rights reserved. -->

    <meta name="apple-mobile-web-app-title" content="Greek Directory">
    <link rel="apple-touch-startup-image" href="https://static.thegreekdirectory.org/img/logo/blue.svg">
    <link rel="apple-touch-icon" href="https://static.thegreekdirectory.org/img/logo/blue.svg" type="image/x-icon">

    <meta name="description" content="Find upcoming Greek festivals, church events, fundraisers, and gatherings across Chicago, Chicagoland, and Illinois — updated daily.">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="https://thegreekdirectory.org/events">
    <meta property="og:title" content="Events | Greek Festivals, Church Events & Gatherings">
    <meta property="og:description" content="Browse upcoming Greek events across Chicago and Chicagoland — festivals, church events, fundraisers, and more.">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="The Greek Directory">
    <meta property="og:locale" content="en_US">
    <meta property="og:url" content="https://thegreekdirectory.org/events">
    <meta property="og:image" content="https://thegreekdirectory.org/images/chicago.jpeg">
    <meta property="og:image:secure_url" content="https://thegreekdirectory.org/images/chicago.jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:alt" content="Chicago skyline for Greek directory events page">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@greekdirectory">
    <meta name="twitter:title" content="Events | Greek Festivals, Church Events & Gatherings">
    <meta name="twitter:description" content="Find upcoming Greek events across Chicago, Chicagoland, and Illinois.">
    <meta name="twitter:image" content="https://thegreekdirectory.org/images/chicago.jpeg">
    <link rel="icon" href="https://static.thegreekdirectory.org/img/logo/bluefavicon.png" media="(prefers-color-scheme: light)">
    <link rel="icon" href="https://static.thegreekdirectory.org/img/logo/whitefavicon.png" media="(prefers-color-scheme: dark)">
    <link rel="apple-touch-icon" href="https://static.thegreekdirectory.org/img/logo/blue.svg">

    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

    <link rel="stylesheet" href="/src/output.css">
    <link rel="stylesheet" href="css/listings.css">
    <link rel="stylesheet" href="css/events.css">
    <link rel="stylesheet" href="css/index.css">
    <script>
        // Only load PWA CSS when running as a PWA — same gate as listings.html
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/pwa.css';
            document.head.appendChild(link);
        }
    </script>

    <!-- Copyright (C) The Greek Directory, 2025-present. All rights reserved. -->

    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Greek Events",
        "url": "https://thegreekdirectory.org/events",
        "isPartOf": { "@type": "WebSite", "name": "The Greek Directory", "url": "https://thegreekdirectory.org" }
    }
    </script>
    ${itemListSchema ? `<script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>` : ''}
    <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
    <script type="application/ld+json">${JSON.stringify(websiteSchema)}</script>
    <script type="application/ld+json">${JSON.stringify(organizationSchema)}</script>
<script src="/js/translation-load.js"></script></head>
<body class="bg-gray-50">

<div data-partial="header"></div>

<main>
    <div class="max-w-7xl mx-auto px-4 pt-4">
        <section class="events-hero" aria-label="Events hero">
            <div class="events-hero-content">
                <h1>Events</h1>
                <h2>Discover upcoming Greek events across Chicago and Chicagoland!</h2>
            </div>
        </section>

        <div class="relative mb-4 max-w-2xl mx-auto">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
            <input type="text" id="eventSearchInput" placeholder="Search events, categories, or cities..."
                class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2"
                style="color: #045093; --tw-ring-color: #045093;">
        </div>
    </div>

`;
}

const EVENTS_PAGE_FOOTER_AND_SCRIPTS_HTML = `</main>

<!-- Copyright (C) The Greek Directory, 2025-present. All rights reserved. -->

<div data-partial="footer"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script src="js/pwa/storage.js"></script>
<script src="js/events.js"></script>
<script src="js/pwa/app.js"></script>
<script src="js/pwa/dock.js"></script>

<!-- Copyright (C) The Greek Directory, 2025-present. All rights reserved. -->

<script defer src="https://static.cloudflareinsights.com/beacon.min.js/v8c78df7c7c0f484497ecbca7046644da1771523124516" integrity="sha512-8DS7rgIrAmghBFwoOTujcf6D9rXvH8xm8JQ1Ja01h9QX8EzXldiszufYa4IFfKdLUKTTrnSFXLDkUEOTrZQ8Qg==" data-cf-beacon='{"version":"2024.11.0","token":"c3e4a403e74b4e23b33164a17c46af38","r":1,"server_timing":{"name":{"cfCacheStatus":true,"cfEdge":true,"cfExtPri":true,"cfL4":true,"cfOrigin":true,"cfSpeedBrain":true},"location_startswith":null}}' crossorigin="anonymous"></script>
<script>window.gtranslateSettings = {"default_language":"en","native_language_names":true,"detect_browser_language":true,"languages":["en","el"],"globe_color":"#66aaff","wrapper_selector":".gtranslate_wrapper","alt_flags":{"en":"usa"}}</script>
<script src="https://cdn.gtranslate.net/widgets/latest/globe.js" defer></script>
</body>
</html>
`;

export async function onRequestGet() {
    const upcomingEvents = await fetchUpcomingEventsForSchema();
    const html = buildEventsPageHeadAndHero(upcomingEvents) + EVENTS_APP_SHELL_HTML + EVENTS_PAGE_FOOTER_AND_SCRIPTS_HTML;

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            // The shell markup itself changes only when the site owner
            // edits it (a deploy), never in response to Supabase data
            // changing (that happens client-side after load) — so this
            // can be cached hard: 1 hour at the edge, background
            // revalidation for up to a day. Any actual content change
            // (new event added, status flipped) reaches visitors through
            // js/events.js's live Supabase read on every pageview
            // regardless of how long this shell is cached for. The
            // ItemList schema embedded in the shell is fetched fresh on
            // each cache-miss/revalidation, same cadence as the rest of
            // this response — a brief staleness there is an acceptable
            // tradeoff for a component whose job is giving crawlers a
            // structural signal, not being the visitor-facing source of
            // truth.
            'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        },
    });
}