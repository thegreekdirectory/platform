/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed
without written permission from The Greek Directory. Unauthorized use, copying, modification,
or distribution of this code can result in legal action to the fullest extent permitted by law.
*/

// functions/print/listing/[[slug]].js
// 
// Cloudflare Pages Function. Route: GET /print/listing/*
//
// Lives under /print/listing/ rather than directly under /print/ so that
// future print features (for other content types) can sit alongside this
// one as separate siblings — e.g. /print/event/*, /print/coupon/* — without
// colliding with or being captured by this listing-specific catch-all.
//
// IMPORTANT — why this is [[slug]].js (catch-all) and not [slug].js:
// Every real listing slug in this system is TWO path segments, not one —
// confirmed directly from all three example listing pages provided
// (canonical URLs like /listing/niles-il/kouklas-greek-eatery) and from
// admin.js's generateSlugFromName(), which builds the slug as
// "{city}-{state}/{business-name}". A single dynamic segment ([slug].js)
// would only capture the FIRST segment and 404 or mis-parse the rest.
// [[slug]].js is Cloudflare's catch-all convention: params.slug arrives as
// an ARRAY of segments (e.g. ['niles-il', 'kouklas-greek-eatery']), which
// this function rejoins with '/' before querying Supabase — because that's
// exactly the string stored in the listings.slug column.
//
// DEVICE-INDEPENDENT RENDERING — this document is print/PDF output, never
// a real webpage a person browses or interacts with, so it must render
// pixel-identical regardless of what opens it (phone, laptop, headless
// print engine). Two things make that true, both load-bearing:
//   1. The viewport meta tag below is a FIXED width ("width=816", matching
//      the page's own authored 8.5in width at 96px/in) — never
//      "width=device-width". device-width is exactly what makes a page
//      adapt per-device, which is the opposite of what's needed here.
//   2. The stylesheet has zero viewport-relative units (vw/vh) and zero
//      max-width media-query breakpoints on the main document. A prior
//      version had a max-width:700px breakpoint that reflowed the sidebar
//      below the main content on narrow (phone-width) viewports — that's
//      the actual mechanism that caused phone vs. desktop divergence, and
//      it's been removed rather than patched, since a responsive
//      breakpoint has no place in a fixed-size printable document.
// Verified directly (not just by inspection): the same rendered listing
// was loaded under simulated iPhone SE (375px), iPad (768px), and a 1440px
// desktop viewport, and produced an identical 816px-wide document with
// identical computed layout in all three.
//
// Server-side only. Fetches the listing (+ owner rows) from Supabase using the
// SERVICE ROLE key, applies the exact same owner-visibility gating that
// js/admin.js uses when generating the static listing/*.html pages, renders
// the print template server-side, converts that HTML to a real PDF using
// Cloudflare Browser Run's /pdf Quick Action, and returns the finished PDF
// bytes. The browser never sees Supabase URLs, keys, raw JSON, or even the
// intermediate HTML — only the final PDF file.
//
// WHY A REAL PDF, NOT HTML-FOR-THE-BROWSER-TO-PRINT:
// The original version returned HTML and relied on the VISITOR'S OWN
// browser (via window.print() / "Save as PDF") to paginate it correctly.
// That works on some devices and not others — confirmed directly: on an
// iPhone 15 Plus, certain listings rendered everything up through the
// tagline on page 1, dumped the rest of the main content onto page 2+ at
// the wrong break point, and the dedicated one-photo-per-page gallery
// pages didn't happen at all. The root cause is that different browsers'
// PRINT engines (a separate code path from normal on-screen rendering) can
// disagree about how to honor the same @page / page-break CSS — no amount
// of additional CSS tuning can fully guarantee that every browser's print
// engine interprets the same rules identically.
//
// Generating the PDF once, server-side, with Cloudflare's own headless
// Chromium removes that entire class of bug: there is no client-side print
// engine left to disagree with, because the pagination is already baked
// into the file before it ever reaches any device. The pdfOptions used
// below (format, printBackground, preferCSSPageSize) are the exact same
// options already hand-verified locally (via Puppeteer, a close relative
// of the Chromium build Browser Run uses) to produce correct multi-page
// overflow margins and gallery-image centering.
//
// REQUIRED SETUP:
//
// 1. Browser Run REST API token — NOT a Wrangler binding. Cloudflare Pages
//    Functions do not support a `browser` binding at all (confirmed
//    directly against Cloudflare's own Pages Functions bindings reference,
//    which lists every supported binding type and does not include
//    `browser` — that binding type exists only for plain, standalone
//    Cloudflare Workers, not Pages Functions). An earlier version of this
//    file assumed the binding would work here; it does not, and a
//    wrangler.json declaring one will fail to build on Pages.
//
//    Instead, this calls Browser Run's /pdf REST endpoint directly over
//    fetch(), authenticated with a bearer token:
//
//      a. Cloudflare dashboard -> My Profile -> API Tokens -> Create Token
//         -> Custom Token -> permission "Browser Rendering - Edit".
//      b. Add that token as a Pages Secret named CLOUDFLARE_API_TOKEN.
//      c. Add your Cloudflare Account ID (dashboard sidebar, or
//         Workers & Pages overview page) as CLOUDFLARE_ACCOUNT_ID — this
//         doesn't strictly need to be a Secret (it isn't credential
//         material by itself), but storing it as one costs nothing and
//         keeps both values in the same place.
//
//    No wrangler.json, no compatibility_date, no [browser] block needed
//    anywhere — this is a plain authenticated HTTPS call, same shape as
//    the Supabase REST calls already used below.
//
// 2. SUPABASE_SERVICE_ROLE_KEY — unchanged from before, still required as
//    a Secret-type environment variable (see below).
//
// Cost note: Browser Run bills per browser-minute and per concurrent
// browser, on top of the Workers Paid plan — this is a genuinely new cost
// line that the pure-HTML version didn't have. Check current Browser Run
// pricing before relying on this at high volume.
//
// Required Cloudflare Pages environment variables (Settings -> Environment
// variables -> Production/Preview), all set as SECRETS, not plaintext:
//   SUPABASE_SERVICE_ROLE_KEY
//   CLOUDFLARE_API_TOKEN
//   CLOUDFLARE_ACCOUNT_ID
//
// The Supabase project URL is not secret (it's already public in every
// listing page's client-side script), so it's inlined below as a constant
// rather than requiring a second env var. If you'd rather keep it as an env
// var too, add SUPABASE_URL to context.env and swap the constant below.

const SUPABASE_URL = 'https://luetekzqrrgdxtopzvqw.supabase.co';

// Browser Run's REST API base — the account ID is inserted into this URL
// at request time from env.CLOUDFLARE_ACCOUNT_ID, since it varies per
// Cloudflare account and isn't safe to hardcode into a shared file.
const BROWSER_RENDERING_PDF_URL_TEMPLATE = 'https://api.cloudflare.com/client/v4/accounts/{accountId}/browser-rendering/pdf';

// Page dimensions this template is authored against: 8.5in x 11in (US
// Letter) at the standard 96px/in CSS reference = 816 x 1056 px. Passed
// explicitly to Browser Run's /pdf viewport option (in addition to the
// HTML's own fixed-width <meta viewport> tag) so Chromium's actual
// rendering viewport starts from the exact dimensions this template was
// designed and tested against, rather than whatever Browser Run's own
// default happens to be.
const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1056;

// Running page header: "PAGE #/#", right-aligned, repeated by the print
// engine into the top-margin gap of every physical page — this is a fixed,
// listing-independent constant (unlike footerTemplate below, which is
// built per-request inside renderPrintPage because it needs that listing's
// own URL and print date).
//
// pageNumber/totalPages are placeholder classes Browser Run's /pdf
// endpoint (Puppeteer's underlying page.pdf() header/footer mechanism)
// substitutes automatically at render time — confirmed directly against
// Cloudflare's own /pdf endpoint docs, whose own footer example writes
// "Page <span class="pageNumber"></span> of <span class="totalPages">
// </span>" with no adjustment, implying pageNumber already starts at 1 on
// the first page rather than 0. Worth a quick visual check on the first
// real render to be certain, since that specific detail isn't spelled out
// in the docs, only implied by the unadjusted example.
//
// Styling here matches footerTemplate on color and font-family (see that
// constant's own comment in renderPrintPage for where those come from:
// color from .gallery-page-footer, font-family inherited from html/body in
// PRINT_STYLES). font-size is a deliberate 9px on BOTH header and footer —
// smaller than .gallery-page-footer's own 10px on purpose, per explicit
// request to shrink the running header/footer text specifically. Keep
// this in sync with footerTemplate's font-size below if either changes.
// Alignment differs from the footer (right, not space-between) and so
// does the content (page numbering, not the listing URL/date), since this
// is a header, not the footer.
const HEADER_TEMPLATE = `<div style="width: 100%; font-size: 9px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 0 0.65in; text-align: right; box-sizing: border-box;">PAGE <span class="pageNumber"></span>/<span class="totalPages"></span></div>`;

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function onRequestGet(context) {
    const { params, env } = context;

    // With [[slug]].js, params.slug is an ARRAY of path segments for a
    // catch-all route (e.g. ['niles-il', 'kouklas-greek-eatery']), not a
    // single string. Rejoin with '/' to match the exact value stored in
    // Supabase's listings.slug column.
    const slugSegments = Array.isArray(params.slug) ? params.slug : params.slug ? [params.slug] : [];
    const slug = slugSegments.map((segment) => decodeURIComponent(segment)).join('/');

    if (!slug || typeof slug !== 'string') {
        return htmlErrorResponse(renderErrorPage('Missing listing.', 'No listing slug was provided.'), 400);
    }

    // LOADING SCREEN — two-request pattern within this same route/URL.
    //
    // The Print button links straight at this route with no query string
    // (href="/print/listing/{{SLUG}}"), and stays that way — nothing about
    // the button changes. A single HTTP response can't start as an HTML
    // loading page and later become the PDF; the two have to be genuinely
    // separate requests to this same URL.
    //
    // So: the FIRST hit (no ?render=1) returns an instant, tiny loading
    // page and stops — none of the slow Supabase/Browser-Run work below
    // has started yet. That page's own script immediately re-requests this
    // exact URL with ?render=1 appended. THAT second request has the
    // param present, skips this block, and falls through to every line of
    // logic below completely unchanged — same slug parsing already done
    // above, same Supabase calls, same PDF generation, same response.
    //
    // Net effect from the visitor's side: click Print -> loading screen
    // paints instantly -> swaps to the finished PDF a few seconds later,
    // same tab, same URL, same button.
    const requestUrl = new URL(context.request.url);
    const isRenderPass = requestUrl.searchParams.get('render') === '1';

    if (!isRenderPass) {
        return htmlLoadingResponse(renderLoadingPage(requestUrl));
    }

    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        // Fail loudly in a way that's obvious to the site operator (missing
        // secret) without leaking anything to the visitor.
        console.error('SUPABASE_SERVICE_ROLE_KEY is not configured for this Pages project.');
        return htmlErrorResponse(
            renderErrorPage(
                'Print view unavailable.',
                'Missing configuration: SUPABASE_SERVICE_ROLE_KEY is not set for this Pages project (Settings \u2192 Environment variables, as a Secret).'
            ),
            500
        );
    }

    if (!env.CLOUDFLARE_API_TOKEN) {
        // Fail loudly and specifically — same pattern as the Supabase key
        // check above — rather than a generic message that leaves the
        // operator guessing which of several possible secrets is missing.
        console.error('CLOUDFLARE_API_TOKEN is not configured for this Pages project.');
        return htmlErrorResponse(
            renderErrorPage(
                'Print view unavailable.',
                'Missing configuration: CLOUDFLARE_API_TOKEN is not set for this Pages project (Settings \u2192 Environment variables, as a Secret). This token needs "Browser Rendering - Edit" permission.'
            ),
            500
        );
    }

    if (!env.CLOUDFLARE_ACCOUNT_ID) {
        console.error('CLOUDFLARE_ACCOUNT_ID is not configured for this Pages project.');
        return htmlErrorResponse(
            renderErrorPage(
                'Print view unavailable.',
                'Missing configuration: CLOUDFLARE_ACCOUNT_ID is not set for this Pages project (Settings \u2192 Environment variables).'
            ),
            500
        );
    }

    let listing;
    try {
        listing = await fetchListingBySlug(slug, serviceRoleKey);
    } catch (err) {
        console.error('Supabase listing fetch failed:', err);
        return htmlErrorResponse(
            renderErrorPage('Print view unavailable.', 'We could not load this listing right now. Please try again later.'),
            502
        );
    }

    if (!listing) {
        return htmlErrorResponse(renderErrorPage('Listing not found.', 'This listing does not exist or is not published.'), 404);
    }

    // Listings that are not publicly visible should not be printable, even
    // though the service-role key COULD read them. Admins/owners previewing
    // an unpublished listing should use the admin/business portal, not this
    // public print path.
    if (listing.visible !== true) {
        return htmlErrorResponse(renderErrorPage('Listing not found.', 'This listing is not currently published.'), 404);
    }

    let owners = [];
    try {
        owners = await fetchOwnersByListingId(listing.id, serviceRoleKey);
    } catch (err) {
        // Owner info is a nice-to-have on the printed profile, not a
        // required field. Log it, but still render the rest of the page.
        console.error('Supabase owner fetch failed:', err);
        owners = [];
    }

    const { html, footerTemplate } = renderPrintPage(listing, owners);

    let pdfResponse;
    try {
        const pdfEndpointUrl = BROWSER_RENDERING_PDF_URL_TEMPLATE.replace('{accountId}', env.CLOUDFLARE_ACCOUNT_ID);
        pdfResponse = await fetch(pdfEndpointUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                html,
                viewport: { width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX },
                pdfOptions: {
                    format: 'letter',
                    printBackground: true,
                    // Honor the HTML's own @page size/margin rules (already
                    // tuned and verified for correct multi-page overflow
                    // margins and centered gallery images) rather than
                    // Chromium's print defaults.
                    preferCSSPageSize: true,
                    // Running page header ("PAGE #/#", top-right) and
                    // footer (listing URL / printed date / TGD name), both
                    // rendered by the print engine itself into the true
                    // margin gap of EVERY physical page — the same
                    // mechanism Word/Google Docs use for document-wide
                    // running headers/footers, and the reason page numbers
                    // can't drift or repeat wrong the way in-flow content
                    // could if it depended on this document's own layout.
                    // See HEADER_TEMPLATE's own comment above for the
                    // pageNumber/totalPages placeholder details, and the
                    // footerTemplate comment in renderPrintPage for the
                    // footer's rationale.
                    //
                    // Both headerTemplate and footerTemplate must be set
                    // together here: displayHeaderFooter is a single flag
                    // governing BOTH slots — leaving either template unset
                    // doesn't render nothing for that slot, it falls back
                    // to Chromium's OWN default (title + URL for the
                    // header, date + page number for the footer), which is
                    // not what either slot is meant to show here.
                    displayHeaderFooter: true,
                    headerTemplate: HEADER_TEMPLATE,
                    footerTemplate,
                    // This margin.bottom is passed for the footer template's
                    // own box height, NOT to re-define page geometry —
                    // preferCSSPageSize above already keeps @page's
                    // margin: 0.6in 0.65in (see PRINT_STYLES) as the source
                    // of truth for layout. The values are kept identical to
                    // @page's on purpose: whichever one Chromium actually
                    // honors for the physical margin, the two never
                    // disagree, so there's no visible seam either way.
                    margin: { top: '0.6in', bottom: '0.6in', left: '0.65in', right: '0.65in' },
                },
            }),
        });
    } catch (err) {
        // A network-level failure reaching Cloudflare's API at all (rare,
        // but distinct from the API responding with an error status below).
        console.error('Browser Run PDF request failed to send:', err);
        return htmlErrorResponse(
            renderErrorPage('Print view unavailable.', 'We could not generate this listing\u2019s printable profile right now. Please try again later.'),
            502
        );
    }

    if (!pdfResponse.ok) {
        // A REST API failure (bad token, bad account ID, malformed
        // request, rate limit, etc.) returns a JSON error body, NOT PDF
        // bytes — check status explicitly rather than assume success and
        // hand the visitor a broken "PDF" that's actually a JSON error
        // blob with no useful message.
        const errorBody = await pdfResponse.text().catch(() => '(could not read error body)');
        console.error(`Browser Run PDF endpoint returned ${pdfResponse.status}:`, errorBody.slice(0, 500));
        return htmlErrorResponse(
            renderErrorPage('Print view unavailable.', 'We could not generate this listing\u2019s printable profile right now. Please try again later.'),
            502
        );
    }

    // On success, the /pdf endpoint's response body IS the PDF file itself
    // (confirmed directly against Cloudflare's own docs, whose curl
    // examples pipe this same response straight to --output file.pdf).
    // Re-wrap only to set the filename and caching/indexing headers this
    // route needs, rather than assuming Cloudflare's default headers are
    // exactly what's wanted here.
    const pdfBytes = await pdfResponse.arrayBuffer();
    const fileNameSafeSlug = slug.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/\//g, '-');
    return new Response(pdfBytes, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            // "inline" lets the browser's own built-in PDF viewer display
            // it immediately (closest to the original "opens ready to
            // print or save" experience); the person can still use their
            // PDF viewer's own print/save/share controls from there.
            'Content-Disposition': `inline; filename="${fileNameSafeSlug || 'listing'}.pdf"`,
            'X-Robots-Tag': 'noindex, nofollow',
            // This route's entire purpose is "generate fresh, then
            // view/print/save" — no reason for an intermediary cache to
            // hold a stale rendition of business data.
            'Cache-Control': 'no-store',
        },
    });
}

// Used only for the small set of human-facing error/status pages (missing
// slug, listing not found, service unavailable) — these are NOT run
// through Browser Run, since a plain HTML status message doesn't need
// PDF conversion and should stay fast and simple to read directly in a
// browser tab if this route is ever hit without going through Browser Run
// (e.g. hitting the URL directly while debugging).
function htmlErrorResponse(html, status, extraHeaders) {
    return new Response(html, {
        status,
        headers: Object.assign(
            {
                'Content-Type': 'text/html; charset=UTF-8',
                'X-Robots-Tag': 'noindex, nofollow',
            },
            extraHeaders || {}
        ),
    });
}

// ---------------------------------------------------------------------------
// Supabase REST access (service role) — plain fetch, no SDK needed in a Worker
// ---------------------------------------------------------------------------

async function supabaseRestGet(path, serviceRoleKey) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Supabase REST ${response.status}: ${body.slice(0, 300)}`);
    }

    return response.json();
}

async function fetchListingBySlug(slug, serviceRoleKey) {
    const encodedSlug = encodeURIComponent(slug);
    const rows = await supabaseRestGet(`listings?slug=eq.${encodedSlug}&limit=1`, serviceRoleKey);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function fetchOwnersByListingId(listingId, serviceRoleKey) {
    const encodedId = encodeURIComponent(listingId);
    const rows = await supabaseRestGet(`business_owners?listing_id=eq.${encodedId}`, serviceRoleKey);
    return Array.isArray(rows) ? rows : [];
}

// ---------------------------------------------------------------------------
// HTML escaping / text helpers
// Worker-safe equivalents of admin.js's browser-only escapeHtml (which used
// document.createElement) and decodeEscapedText. Same behavior, no DOM.
// ---------------------------------------------------------------------------

function escapeHtml(text) {
    if (text === null || text === undefined || text === '') return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Mirrors admin.js's decodeEscapedText: some stored fields contain literal
// backslash-escape sequences (e.g. from CSV import) that need unescaping
// before display. Same implementation, ported 1:1.
function decodeEscapedText(value) {
    if (value === undefined || value === null) return '';
    const str = String(value);
    if (!/\\[\\'"nrtbf]/.test(str)) return str;
    try {
        return JSON.parse(
            `"${str
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\r/g, '\\r')
                .replace(/\n/g, '\\n')
                .replace(/\t/g, '\\t')}"`
        );
    } catch (_) {
        return str
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, '\n');
    }
}

// admin.js's sanitizeListingDescription depends on window.RichTextEditor,
// a browser-only global, so it cannot be ported.
//
// Descriptions are stored as a mix of plain text and rich-text tags from
// whatever editor produced them (<div>, <p>, <strong>, <a>, <br>, etc).
// Per explicit requirement: NO tag should render as visible markup OR as
// visible literal text (e.g. a stray "<div>" showing up in the printed
// description) — every tag is removed outright. The one exception is
// <br> (and its self-closing forms <br/>, <br />), which is the one case
// that should still produce an actual line break in the output, since a
// line break is meaningful content, not markup noise.
//
// This is a stricter rule than a typical allow-list sanitizer (which lets
// some tags survive as real elements) — here NOTHING survives as an
// element except the literal <br> break tag itself, and every other tag,
// safe or not, contributes nothing to the output.
//
// Tags whose CONTENT is not prose either (<script>...</script>,
// <style>...</style>) get their entire span discarded, tag and inner text
// together — otherwise removing just the tags would leave code/CSS text
// sitting visibly in the middle of an otherwise-clean description.
const DESCRIPTION_CONTENT_STRIP_TAGS = new Set(['script', 'style']);

function sanitizeListingDescription(value) {
    const raw = decodeEscapedText(value || '');
    if (!raw) return '';

    // Walk the string. Any well-formed tag is removed entirely and
    // contributes nothing to the output, EXCEPT <br> (any of its written
    // forms), which is emitted as a real <br> so the line break actually
    // shows. Plain text and entities are preserved and escaped normally.
    let result = '';
    let i = 0;
    while (i < raw.length) {
        const char = raw[i];
        if (char === '<') {
            // Check first for the specific "</div><br><div>" sequence —
            // this is a PARAGRAPH break, not a line break. Only matches
            // the literal, non-self-closing <br> per your data (never
            // <br/> or <br />), and allows attributes on the following
            // <div ...> plus any whitespace the editor may have inserted.
            // This is checked before the shorter "<br><div>" pattern below
            // since it's the more specific match — "</div><br><div>"
            // contains "<br><div>" as a substring, so trying the shorter
            // pattern first would consume only part of this sequence and
            // leave a dangling "</div>" to fall through to the plain
            // new-line handling instead of being absorbed into the break.
            const paraMatchWithLeadingDiv = raw.slice(i).match(/^<\/div>\s*<br>\s*<div[^>]*>/i);
            if (paraMatchWithLeadingDiv) {
                result += '<br><br>';
                i += paraMatchWithLeadingDiv[0].length;
                continue;
            }

            // Second paragraph-break case: "<br><div>" with no preceding
            // "</div>". Same PARAGRAPH semantics as above (not a line
            // break) — just missing the closing tag on the prior line
            // that the pattern above requires. Same allowances as above:
            // attributes on the following <div ...>, and whitespace the
            // editor may have inserted between the tags.
            const paraMatchNoLeadingDiv = raw.slice(i).match(/^<br>\s*<div[^>]*>/i);
            if (paraMatchNoLeadingDiv) {
                result += '<br><br>';
                i += paraMatchNoLeadingDiv[0].length;
                continue;
            }

            const tagMatch = raw.slice(i).match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)\s*[^>]*?\/?>/);
            if (tagMatch) {
                const tagName = tagMatch[1].toLowerCase();
                const isClosing = tagMatch[0].startsWith('</');

                if (tagName === 'br') {
                    result += '<br>';
                    i += tagMatch[0].length;
                    continue;
                }

                // A lone closing </div> — not already consumed by the
                // paragraph pattern above — is a plain new LINE.
                if (isClosing && tagName === 'div') {
                    result += '<br>';
                    i += tagMatch[0].length;
                    continue;
                }

                // An opening <div> — not already consumed by either
                // paragraph pattern above, meaning there was no <br>
                // immediately before it — is also a plain new LINE, same
                // as the lone closing </div> case just above. Only reached
                // when neither "</div><br><div>" nor "<br><div>" matched
                // at this position, so this <div> is guaranteed to NOT be
                // preceded by a <br> here.
                if (!isClosing && tagName === 'div') {
                    result += '<br>';
                    i += tagMatch[0].length;
                    continue;
                }

                if (!isClosing && DESCRIPTION_CONTENT_STRIP_TAGS.has(tagName)) {
                    // <script ...> or <style ...>: discard everything up to
                    // and including the matching closing tag, since the
                    // text in between is code/CSS, not prose, and showing
                    // it would look like garbled leftover text rather than
                    // a clean description.
                    const closeMatch = raw.slice(i).match(new RegExp(`<\\/${tagName}\\s*>`, 'i'));
                    if (closeMatch) {
                        i += closeMatch.index + closeMatch[0].length;
                    } else {
                        // No closing tag found at all (malformed/truncated
                        // input) — discard from here to the end rather than
                        // risk leaking unclosed script/style content.
                        i = raw.length;
                    }
                    continue;
                }

                // Every other recognized tag — <p>, <strong>, <a>, <img>,
                // a stray </script> with no matching open, whatever — is
                // removed completely, but its surrounding text (if any) is
                // untouched. Nothing from the tag itself (not even its
                // escaped text) is added to the output. (<div>, in both
                // its opening and closing forms, is handled explicitly
                // above and never reaches this branch.)
                i += tagMatch[0].length;
                continue;
            }
            // A bare '<' that isn't the start of a recognizable tag at all
            // (e.g. "3 < 5" or a stray character in ordinary prose) is
            // real text content, not markup — escape and keep it.
            result += '&lt;';
            i += 1;
            continue;
        }
        if (char === '&') {
            const entityMatch = raw.slice(i).match(/^&amp;/i);
            if (entityMatch) {
                result += entityMatch[0];
                i += entityMatch[0].length;
                continue;
            }
            result += '&amp;';
            i += 1;
            continue;
        }
        result += char;
        i += 1;
    }
    // The final </div> (and, symmetrically, a leading one) has no
    // following/preceding content to justify a break — trim it so we
    // don't leave a stray blank line at the start or end of the section.
    return result.replace(/(<br>)+$/, '').replace(/^(<br>)+/, '');
}

function formatPhoneNumber(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    return String(phone);
}

// ---------------------------------------------------------------------------
// Hours — ported from js/listing-hours.js (a Pages Function can't load that browser
// script). Each day is { status: 'open' | 'closed' | '24_hours' | 'unknown',
// ranges: [{ open: 'HH:MM', close: 'HH:MM' }] }. Rows written before that model
// stored one string per day ("09:00-17:00", "Closed", ...), which normalizeHoursDay()
// still understands so this page works before and after the data migration.
// ---------------------------------------------------------------------------

const HOURS_DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function hoursPad2(n) { return String(n).padStart(2, '0'); }
function hoursMinutesToHHMM(minutes) { return `${hoursPad2(Math.floor(minutes / 60))}:${hoursPad2(minutes % 60)}`; }

function parseHoursTimeToken(token) {
    const t = String(token === null || token === undefined ? '' : token).trim().toUpperCase().replace(/\./g, '');
    const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
    if (!m) return null;
    let hour = parseInt(m[1], 10);
    const minute = m[2] === undefined ? 0 : parseInt(m[2], 10);
    const meridiem = m[3] || null;
    if (minute > 59) return null;
    if (meridiem) {
        if (hour < 1 || hour > 12) return null;
        if (meridiem === 'PM' && hour !== 12) hour += 12;
        if (meridiem === 'AM' && hour === 12) hour = 0;
    } else {
        if (m[2] === undefined) return null;
        if (hour > 23) return null;
    }
    return hour * 60 + minute;
}

function parseHoursRangeText(piece) {
    const parts = String(piece || '').trim().split(/\s*(?:-|\u2013|\u2014|\bto\b)\s*/i);
    if (parts.length !== 2) return null;
    const open = parseHoursTimeToken(parts[0]);
    const close = parseHoursTimeToken(parts[1]);
    if (open === null || close === null) return null;
    return { open: hoursMinutesToHHMM(open), close: hoursMinutesToHHMM(close) };
}

function normalizeHoursRanges(list) {
    const sorted = (list || []).slice().sort((a, b) =>
        (parseHoursTimeToken(a.open) - parseHoursTimeToken(b.open)) || (parseHoursTimeToken(a.close) - parseHoursTimeToken(b.close)));
    const unique = sorted.filter((r, i) => i === 0 || r.open !== sorted[i - 1].open || r.close !== sorted[i - 1].close);
    if (!unique.length) return { status: 'unknown', ranges: [] };
    if (unique.length === 1 && unique[0].open === '00:00' && unique[0].close === '23:59') return { status: '24_hours', ranges: [] };
    return { status: 'open', ranges: unique };
}

function parseHoursText(text) {
    const raw = String(text === null || text === undefined ? '' : text).trim();
    if (!raw) return { status: 'unknown', ranges: [] };
    if (/^closed$/i.test(raw)) return { status: 'closed', ranges: [] };
    if (/24\s*hours?|open\s*24|^(?:open\s+)?all\s*day$/i.test(raw)) return { status: '24_hours', ranges: [] };
    const ranges = [];
    for (const piece of raw.split(/\s*(?:,|;|\||\n|&|\band\b)\s*/i).filter(Boolean)) {
        const range = parseHoursRangeText(piece);
        if (!range) return null;
        ranges.push(range);
    }
    return normalizeHoursRanges(ranges);
}

function normalizeHoursDay(value) {
    if (value === null || value === undefined) return { status: 'unknown', ranges: [] };
    if (typeof value === 'string') return parseHoursText(value) || { status: 'unknown', ranges: [] };
    if (typeof value !== 'object' || Array.isArray(value)) return { status: 'unknown', ranges: [] };
    const status = String(value.status || '').trim().toLowerCase();
    if (status === 'closed') return { status: 'closed', ranges: [] };
    if (status === '24_hours') return { status: '24_hours', ranges: [] };
    const ranges = (Array.isArray(value.ranges) ? value.ranges : []).map((r) => {
        if (!r || typeof r !== 'object') return null;
        const open = parseHoursTimeToken(r.open);
        const close = parseHoursTimeToken(r.close);
        return open === null || close === null ? null : { open: hoursMinutesToHHMM(open), close: hoursMinutesToHHMM(close) };
    }).filter(Boolean);
    return normalizeHoursRanges(ranges);
}

function hasAnyHours(hours) {
    if (!hours || typeof hours !== 'object') return false;
    return HOURS_DAY_KEYS.some((key) => normalizeHoursDay(hours[key]).status !== 'unknown');
}

function formatHoursTime12(hhmm) {
    const minutes = parseHoursTimeToken(hhmm);
    if (minutes === null) return '';
    const hour24 = Math.floor(minutes / 60);
    return `${hour24 % 12 || 12}:${hoursPad2(minutes % 60)} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

// One entry per set of hours: ["9:00 AM - 10:00 AM", "3:00 PM - 8:00 PM"], ["Closed"],
// ["Open All Day"], or [] when the day has no hours entered.
function formatHoursDayLines(value) {
    const day = normalizeHoursDay(value);
    if (day.status === 'closed') return ['Closed'];
    if (day.status === '24_hours') return ['Open All Day'];
    return day.ranges.map((r) => `${formatHoursTime12(r.open)} - ${formatHoursTime12(r.close)}`);
}

function pricingToSymbols(value) {
    if (value === null || value === undefined || value === '') return '';
    const symbolMap = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };
    const numeric = parseInt(value, 10);
    if (!Number.isNaN(numeric) && symbolMap[numeric]) return symbolMap[numeric];
    return '';
}

// ---------------------------------------------------------------------------
// Owner info — ported from admin.js generateTemplateReplacementsPart2, with
// the exact same visibility gating (name_title_visible / email_visible /
// phone_visible) so this print path can never surface more than the public
// listing page already would.
// ---------------------------------------------------------------------------

function buildOwnerCardsHtml(owners) {
    const cards = (Array.isArray(owners) ? owners : [])
        .map((owner) => {
            let details = '';

            if (owner.name_title_visible !== false && owner.full_name) {
                const safeFullName = decodeEscapedText(owner.full_name);
                const safeTitle = decodeEscapedText(owner.title || '');
                details += safeTitle
                    ? `<p><strong>${escapeHtml(safeTitle)}:</strong> ${escapeHtml(safeFullName)}</p>`
                    : `<p><strong>Owner:</strong> ${escapeHtml(safeFullName)}</p>`;
            }

            if (owner.from_greece) {
                const fromGreeceLower = String(owner.from_greece).toLowerCase();
                const alreadyMentionsRegion =
                    fromGreeceLower.includes('cyprus') ||
                    fromGreeceLower.includes('pontus') ||
                    fromGreeceLower.includes('greece') ||
                    fromGreeceLower.includes('constantinople');
                const decodedFromGreece = decodeEscapedText(owner.from_greece);
                details += alreadyMentionsRegion
                    ? `<p><strong>From:</strong> ${escapeHtml(decodedFromGreece)}</p>`
                    : `<p><strong>From:</strong> ${escapeHtml(decodedFromGreece)}, Greece</p>`;
            }

            if (owner.email_visible && owner.owner_email) {
                details += `<p><strong>Email:</strong> ${escapeHtml(owner.owner_email)}</p>`;
            }
            if (owner.phone_visible && owner.owner_phone) {
                details += `<p><strong>Phone:</strong> ${escapeHtml(formatPhoneNumber(owner.owner_phone))}</p>`;
            }

            return details ? `<div class="owner-card">${details}</div>` : '';
        })
        .filter(Boolean)
        .join('');

    if (!cards) return '';

    return `
        <section class="print-section owner-info-section">
            <h3>Leadership</h3>
            ${cards}
        </section>
    `;
}

// ---------------------------------------------------------------------------
// Address / contact / hours / additional info — mirrors the markup and
// gating rules from admin.js generateTemplateReplacements, adapted for a
// static, non-interactive print document (no tel:/mailto: styling needed,
// no map, no CTA buttons — this is a profile sheet, not a live page).
// ---------------------------------------------------------------------------

function buildAddressLine(listing) {
    const decodedAddress = decodeEscapedText(listing.address || '');
    const decodedCity = decodeEscapedText(listing.city || '');
    const decodedState = decodeEscapedText(listing.state || '');
    const hasStreetAddress = typeof listing.address === 'string' && listing.address.trim().length > 0;

    if (!hasStreetAddress && !(listing.city && listing.state)) return '';

    const parts = [];
    if (hasStreetAddress) parts.push(escapeHtml(decodedAddress));
    if (listing.city && listing.state) {
        parts.push(`${escapeHtml(decodedCity)}, ${escapeHtml(decodedState)}${listing.zip_code ? ' ' + escapeHtml(listing.zip_code) : ''}`);
    }
    if (!parts.length) return '';

    return `
        <div class="contact-row">
            <span class="contact-label">Address</span>
            <span class="contact-value">${parts.join(', ')}</span>
        </div>
    `;
}

function buildPhoneLine(listing) {
    if (!listing.phone) return '';
    return `
        <div class="contact-row">
            <span class="contact-label">Phone</span>
            <span class="contact-value">${escapeHtml(formatPhoneNumber(listing.phone))}</span>
        </div>
    `;
}

function buildEmailLine(listing) {
    if (!listing.email) return '';
    return `
        <div class="contact-row">
            <span class="contact-label">Email</span>
            <span class="contact-value">${escapeHtml(listing.email)}</span>
        </div>
    `;
}

function buildWebsiteLine(listing) {
    if (!listing.website) return '';
    const decoded = decodeEscapedText(listing.website);
    const displayUrl = decoded.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    return `
        <div class="contact-row">
            <span class="contact-label">Website</span>
            <span class="contact-value">${escapeHtml(displayUrl)}</span>
        </div>
    `;
}

function buildHoursSection(listing) {
    if (!hasAnyHours(listing.hours)) return '';

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    const rows = dayKeys
        .map((key, index) => {
            // The day appears once; each set of hours gets its own line. Days with no hours read "Closed".
            const lines = formatHoursDayLines(listing.hours[key]);
            const hoursText = (lines.length ? lines : ['Closed']).map((line) => escapeHtml(line)).join('<br>');
            return `<div class="hours-row"><span class="hours-day">${days[index]}</span><span class="hours-value">${hoursText}</span></div>`;
        })
        .join('');

    const label = listing.hours_label_custom || 'Hours';
    const disclaimer = listing.hours_disclaimer_custom || 'Hours may vary — call to confirm.';

    return `
        <section class="print-section hours-section">
            <h3>${escapeHtml(label)}</h3>
            <div class="hours-grid">${rows}</div>
            <p class="hours-disclaimer">${escapeHtml(disclaimer)}</p>
        </section>
    `;
}

function buildAdditionalInfoSection(listing) {
    if (!Array.isArray(listing.additional_info) || listing.additional_info.length === 0) return '';

    const rows = listing.additional_info
        .filter((info) => info && info.label && info.value)
        .map(
            (info) => `
                <div class="additional-info-row">
                    <span class="additional-info-label">${escapeHtml(decodeEscapedText(info.label))}</span>
                    <span class="additional-info-value">${escapeHtml(decodeEscapedText(info.value))}</span>
                </div>
            `
        )
        .join('');

    if (!rows) return '';

    return `
        <section class="print-section additional-info-section">
            <h3>Additional Information</h3>
            <div class="additional-info-table">${rows}</div>
        </section>
    `;
}

function buildSubcategoryTags(listing) {
    if (!Array.isArray(listing.subcategories) || listing.subcategories.length === 0) return '';
    const uniqueSubs = [...new Set(listing.subcategories.filter(Boolean))];
    const primary = listing.primary_subcategory && uniqueSubs.includes(listing.primary_subcategory) ? listing.primary_subcategory : null;
    const ordered = [...(primary ? [primary] : []), ...uniqueSubs.filter((s) => s !== primary).sort((a, b) => a.localeCompare(b))];
    return ordered.map((sub) => `<span class="subcategory-tag">${escapeHtml(sub)}</span>`).join('');
}

// ---------------------------------------------------------------------------
// Social media + reviews — same jsonb shape and same platform set as
// admin.js generateSocialMediaSection / generateReviewSection, rendered as
// plain printed link lines (no onclick analytics — this document isn't
// interactive, and analytics tracking wouldn't fire from a printed page or
// PDF anyway).
// ---------------------------------------------------------------------------

const SOCIAL_URL_BUILDERS = {
    facebook: (handle) => `facebook.com/${handle}`,
    instagram: (handle) => `instagram.com/${handle}`,
    twitter: (handle) => `x.com/${handle}`,
    youtube: (handle) => `youtube.com/@${handle}`,
    tiktok: (handle) => `tiktok.com/@${handle}`,
};

const SOCIAL_LABELS = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    twitter: 'X / Twitter',
    youtube: 'YouTube',
    tiktok: 'TikTok',
    linkedin: 'LinkedIn',
};

function buildSocialSection(listing) {
    const socialMedia = listing.social_media || {};
    const lines = [];

    ['facebook', 'instagram', 'twitter', 'youtube', 'tiktok'].forEach((key) => {
        if (socialMedia[key]) {
            lines.push(
                `<div class="link-row"><span class="link-label">${SOCIAL_LABELS[key]}</span><span class="link-value">${escapeHtml(SOCIAL_URL_BUILDERS[key](socialMedia[key]))}</span></div>`
            );
        }
    });

    if (socialMedia.linkedin) {
        const decoded = decodeEscapedText(socialMedia.linkedin).replace(/^https?:\/\/(www\.)?/, '');
        lines.push(`<div class="link-row"><span class="link-label">LinkedIn</span><span class="link-value">${escapeHtml(decoded)}</span></div>`);
    }

    [1, 2, 3].forEach((n) => {
        const url = socialMedia[`other${n}`];
        const name = socialMedia[`other${n}_name`];
        if (url && name) {
            const decoded = decodeEscapedText(url).replace(/^https?:\/\/(www\.)?/, '');
            lines.push(`<div class="link-row"><span class="link-label">${escapeHtml(name)}</span><span class="link-value">${escapeHtml(decoded)}</span></div>`);
        }
    });

    if (!lines.length) return '';

    return `
        <section class="print-section social-section">
            <h3>Social Media</h3>
            <div class="link-list">${lines.join('')}</div>
        </section>
    `;
}

function buildReviewsSection(listing) {
    const reviews = listing.reviews || {};
    const lines = [];

    if (reviews.google) lines.push(`<div class="link-row"><span class="link-label">Google Reviews</span><span class="link-value">${escapeHtml(decodeEscapedText(reviews.google).replace(/^https?:\/\/(www\.)?/, ''))}</span></div>`);
    if (reviews.yelp) lines.push(`<div class="link-row"><span class="link-label">Yelp</span><span class="link-value">${escapeHtml(decodeEscapedText(reviews.yelp).replace(/^https?:\/\/(www\.)?/, ''))}</span></div>`);
    if (reviews.tripadvisor) lines.push(`<div class="link-row"><span class="link-label">TripAdvisor</span><span class="link-value">${escapeHtml(decodeEscapedText(reviews.tripadvisor).replace(/^https?:\/\/(www\.)?/, ''))}</span></div>`);

    [1, 2, 3].forEach((n) => {
        const url = reviews[`other${n}`];
        const name = reviews[`other${n}_name`];
        if (url && name) {
            const decoded = decodeEscapedText(url).replace(/^https?:\/\/(www\.)?/, '');
            lines.push(`<div class="link-row"><span class="link-label">${escapeHtml(name)}</span><span class="link-value">${escapeHtml(decoded)}</span></div>`);
        }
    });

    if (!lines.length) return '';

    return `
        <section class="print-section reviews-section">
            <h3>Reviews</h3>
            <div class="link-list">${lines.join('')}</div>
        </section>
    `;
}

// A listing's photoList[0] doubles as the hero-banner image (cropped via
// object-fit: cover in .hero-photo-frame — see renderPrintPage below).
// Separately, isUnsplashPhotoUrl decides whether that SAME photo also gets
// its own full, uncropped gallery page, the same as every other photo.
//
// Checked via new URL(...).origin rather than a raw string prefix check,
// consistent with how the rest of this file parses URLs (see requestUrl /
// renderUrl above) — this correctly matches regardless of a trailing
// slash or path after the host, and won't be fooled by the substring
// "images.unsplash.com" appearing somewhere unrelated in a totally
// different URL (e.g. inside a query parameter), the way a naive
// .includes() check could be.
//
// Photo URLs come from listing data (photoList), not from a source this
// file controls, so they aren't guaranteed to be well-formed — new URL()
// throws on a malformed string. On a throw, this returns false (treat as
// NOT Unsplash), which is the safer default: an unparseable URL still
// gets its own gallery page rather than being silently dropped because
// origin-checking it failed.
function isUnsplashPhotoUrl(photoUrl) {
    try {
        return new URL(photoUrl).origin === 'https://images.unsplash.com';
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Gallery pages — photoList[0] always appears cropped in the hero banner
// (see heroImage in renderPrintPage). It ALSO gets its own dedicated,
// uncropped gallery page here, the same as every other photo — UNLESS its
// URL is hosted on https://images.unsplash.com (see isUnsplashPhotoUrl),
// in which case it's assumed to be a generic stock/placeholder image
// rather than a real photo of the business, and stays banner-only. Every
// photo from index 1 onward always gets its own page, with no such
// exception. Because gallery images can be any aspect ratio (unlike the
// logo, which is always square), each gallery page sizes an <img>
// naturally (max-width/max-height within the page's print area) instead
// of forcing object-fit: cover like the on-screen carousel — and like the
// hero banner crop — does.
// ---------------------------------------------------------------------------

function buildAdditionalGalleryPages(photoList, businessName, city, state) {
    // Every photo from index 1 onward gets a page unconditionally; index 0
    // gets one too, except when it's an Unsplash URL (see comment above).
    // The true original index (photoList.indexOf-equivalent — just `i`
    // from the source map below) is carried alongside each included photo
    // so captioning ("Photo N of Total") reflects its REAL position in
    // photoList, not just its position in this filtered-down list — those
    // two differ whenever photo 0 is excluded, since photo 1 (index 1)
    // would otherwise be miscounted as photo 1 instead of photo 2.
    const galleryPhotos = photoList
        .map((photoUrl, i) => ({ photoUrl, originalIndex: i }))
        .filter(({ photoUrl, originalIndex }) => originalIndex > 0 || !isUnsplashPhotoUrl(photoUrl));

    if (!galleryPhotos.length) return '';

    const altBase = `${escapeHtml(businessName)}${city ? ` in ${escapeHtml(city)}${state ? ', ' + escapeHtml(state) : ''}` : ''}`;

    return galleryPhotos
        .map(
            ({ photoUrl, originalIndex }) => `
        <section class="print-page gallery-page">
            <div class="gallery-page-frame">
                <img src="${escapeHtml(photoUrl)}" alt="${altBase} — photo ${originalIndex + 1}" class="gallery-page-image" />
            </div>
            <div class="gallery-page-footer">${escapeHtml(businessName)} — Photo ${originalIndex + 1} of ${photoList.length}</div>
        </section>
    `
        )
        .join('');
}

// ---------------------------------------------------------------------------
// Top-level page assembly
// ---------------------------------------------------------------------------

function renderPrintPage(listing, owners) {
    const decodedBusinessName = decodeEscapedText(listing.business_name || '');
    const decodedTagline = decodeEscapedText(listing.tagline || '');
    const decodedCity = decodeEscapedText(listing.city || '');
    const decodedState = decodeEscapedText(listing.state || '');

    const photos = Array.isArray(listing.photos) ? listing.photos.filter(Boolean) : [];
    const logo = listing.logo || '';
    // Same fallback order as admin.js: use the photos array if present,
    // otherwise fall back to the logo as the only "photo".
    const photoList = photos.length > 0 ? photos : logo ? [logo] : [];
    const heroImage = photoList[0] || logo || '';

    const pricingSymbols = pricingToSymbols(listing.pricing);
    const subcategoryTags = buildSubcategoryTags(listing);

    const badges = [];
    if (listing.tier === 'PREMIUM') badges.push('<span class="print-badge badge-premium">Premium</span>');
    else if (listing.tier === 'FEATURED') badges.push('<span class="print-badge badge-featured">Featured</span>');
    if (listing.coming_soon === true) badges.push('<span class="print-badge badge-coming-soon">Coming Soon</span>');
    if (listing.temporarily_closed === true) badges.push('<span class="print-badge badge-closed">Temporarily Closed</span>');
    if (listing.permanently_closed === true) badges.push('<span class="print-badge badge-closed">Permanently Closed</span>');

    const isClaimed = Boolean(listing.is_claimed) || owners.some((o) => o.owner_user_id);
    const claimedBadge = isClaimed
        ? '<div class="verified-checkmark-btn" title="Verified: this listing has been claimed by its owner(s)"><svg style="width:20px;height:20px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#045093"></circle><path d="M7 12.5l3.5 3.5L17 9" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg></div>'
        : '';

    const contactLines = [buildAddressLine(listing), buildPhoneLine(listing), buildEmailLine(listing), buildWebsiteLine(listing)]
        .filter(Boolean)
        .join('');

    const description = sanitizeListingDescription(listing.description || '');
    const hoursSection = buildHoursSection(listing);
    const additionalInfoSection = buildAdditionalInfoSection(listing);
    const ownerSection = buildOwnerCardsHtml(owners);
    const socialSection = buildSocialSection(listing);
    const reviewsSection = buildReviewsSection(listing);
    const galleryPages = buildAdditionalGalleryPages(photoList, decodedBusinessName, decodedCity, decodedState);

    const listingUrl = `https://thegreekdirectory.org/listing/${escapeHtml(listing.slug || '')}`;
    const generatedAt = new Date().toISOString().slice(0, 10);

    const html = `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<!-- Fixed-width viewport: this document must render identically on every device (see file header notes). -->
<meta name="viewport" content="width=816">
<title>${escapeHtml(decodedBusinessName)} — Printable Profile | The Greek Directory</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="https://static.thegreekdirectory.org/img/logo/bluefavicon.png">
${PRINT_STYLES}
<script src="/js/translation-load.js"></script></head>
<body>

    <main class="print-page hero-page">
        <header class="hero-header">
            <div class="hero-header-top">
                <img class="brand-mark" src="https://raw.githubusercontent.com/thegreekdirectory/static/refs/heads/main/img/logo/keynoback.png" alt="The Greek Directory">
                <span class="hero-header-label">Listing Profile</span>
            </div>
            ${heroImage ? `<div class="hero-photo-frame"><img class="hero-photo" src="${escapeHtml(heroImage)}" alt="${escapeHtml(decodedBusinessName)}"></div>` : ''}
        </header>

        <section class="identity-block">
            <div class="identity-text">
                <div class="identity-tags">
                    <span class="category-pill">${escapeHtml(listing.category || '')}</span>
                    ${subcategoryTags}
                    ${badges.join('')}
                </div>
                <h1 class="business-name">${escapeHtml(decodedBusinessName)}${claimedBadge}</h1>
                ${decodedTagline ? `<p class="tagline">${escapeHtml(decodedTagline)}</p>` : ''}
                ${pricingSymbols ? `<span class="pricing-chip">${pricingSymbols}</span>` : ''}
            </div>
            ${logo ? `<img class="logo-mark" src="${escapeHtml(logo)}" alt="${escapeHtml(decodedBusinessName)} logo">` : ''}
        </section>

        <div class="content-columns">
            <div class="content-main">
                ${description ? `<section class="print-section description-section"><h3>About</h3><div class="description-body">${description}</div></section>` : ''}
                ${additionalInfoSection}
                ${ownerSection}
                ${socialSection}
                ${reviewsSection}
            </div>
            <aside class="content-side">
                <section class="print-section contact-card">
                    <h3>Contact</h3>
                    ${contactLines}
                </section>
                ${hoursSection}
            </aside>
        </div>
    </main>

    ${galleryPages}
</body>
</html>`;

    // The listing URL / printed-date / TGD-name footer is deliberately NOT
    // in-flow body content (it used to be a <footer class="hero-footer">
    // sitting at the bottom of the .print-page div above). An in-flow
    // footer only ever renders once, wherever the end of that div's own
    // content happens to land — for a long listing whose content spills
    // past one physical sheet (a case this file's own print-stylesheet
    // comments already call out as expected: "if a listing's content is
    // long enough to spill from one .print-page div onto a 2nd or 3rd
    // physical printed sheet"), that means the footer would either get
    // dragged onto whatever page the overflow lands on, or simply never
    // repeat on the additional pages at all. Neither is "in the bottom
    // margin gap of every page" the way Word or Google Docs handles a
    // running page footer.
    //
    // Browser Run's /pdf endpoint (the same endpoint this Worker already
    // calls below) exposes exactly the right primitive for this instead:
    // pdfOptions.footerTemplate, gated by pdfOptions.displayHeaderFooter.
    // This is genuinely independent of this document's own DOM — the
    // print engine renders it fresh into the margin box of EVERY physical
    // page, driven by its own pagination, which is what actually
    // guarantees it can never be pushed onto the wrong page by overflow.
    // (Confirmed directly against Cloudflare's own /pdf endpoint docs,
    // which document this exact footerTemplate/displayHeaderFooter pair
    // for repeating a footer across every generated page.)
    //
    // Because the print engine evaluates this template completely
    // separately from the page HTML above, the listing URL / date /
    // business name values have to be baked into this string directly —
    // escaped the same way every other piece of listing data in this file
    // is escaped, since footerTemplate is still HTML the print engine
    // parses, not plain text.
    //
    // The inline style values below match .gallery-page-footer (the
    // "<Business> — Photo X of Y" caption shown on each additional gallery
    // page) on color and font-family — this template is evaluated by the
    // print engine completely outside PRINT_STYLES, so nothing there
    // (including var(--text-light)) reaches it; every value has to be
    // repeated here literally:
    //   font-size: 9px            <- deliberately 1px smaller than
    //                                .gallery-page-footer's own 10px, per
    //                                explicit request to shrink the
    //                                running header/footer text. Kept in
    //                                sync with HEADER_TEMPLATE's font-size
    //                                above — update both together.
    //   color: #6b7280            <- var(--text-light), which PRINT_STYLES
    //                                defines as exactly #6b7280 — also what
    //                                .gallery-page-footer uses
    //   font-family: -apple-system, ... <- inherited from html/body in
    //                                PRINT_STYLES, since .gallery-page-footer
    //                                never set its own font-family
    const footerTemplate = `<div style="width: 100%; font-size: 9px; color: #6b7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 0 0.65in; display: flex; justify-content: space-between; box-sizing: border-box;"><span>${listingUrl}</span><span>Printed ${escapeHtml(generatedAt)} — The Greek Directory</span></div>`;

    return { html, footerTemplate };
}

function renderErrorPage(title, message) {
    return `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} | The Greek Directory</title>
<meta name="robots" content="noindex, nofollow">
<style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #1a1a1a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
    .box { max-width: 420px; text-align: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px 32px; }
    h1 { font-size: 20px; color: #045093; margin: 0 0 8px; }
    p { color: #4b5563; margin: 0; line-height: 1.5; }
</style>
<script src="/js/translation-load.js"></script></head>
<body>
    <div class="box">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
    </div>
</body>
</html>`;
}

// The instant first-paint screen shown while the real PDF (Supabase fetch +
// Browser Run render, ~3-5s) is generated on the follow-up request. Same
// visual language as renderErrorPage on purpose (same font stack, card,
// brand blue) so it reads as part of the same product, not a bolted-on
// interstitial. Deliberately plain per "a very simple loading screen" —
// a spinner and one line of text, nothing more.
function renderLoadingPage(currentUrl) {
    // Build the exact same URL the visitor is already on, plus ?render=1,
    // preserving any other existing query params rather than assuming
    // there are none.
    const renderUrl = new URL(currentUrl.toString());
    renderUrl.searchParams.set('render', '1');

    return `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Generating your PDF\u2026 | The Greek Directory</title>
<meta name="robots" content="noindex, nofollow">
<style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; color: #1a1a1a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
    .box { max-width: 420px; text-align: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px 32px; }
    .spinner { width: 32px; height: 32px; margin: 0 auto 16px; border: 3px solid #e5e7eb; border-top-color: #045093; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 16px; font-weight: 600; color: #045093; margin: 0; }
</style>
<script src="/js/translation-load.js"></script></head>
<body>
    <div class="box">
        <div class="spinner"></div>
        <h1>Generating your PDF\u2026</h1>
    </div>
    <script>
        // replace(), not href/assign — the loading page shouldn't leave a
        // history entry a visitor could land back on with the Back button
        // after the PDF has already loaded.
        window.location.replace(${JSON.stringify(renderUrl.toString())});
    </script>
</body>
</html>`;
}

// Distinct from htmlErrorResponse only in intent (loading vs. error), not
// mechanics — same content type, same noindex, same no-store, since this
// page is exactly as transient and non-cacheable as the error pages.
function htmlLoadingResponse(html) {
    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'X-Robots-Tag': 'noindex, nofollow',
            'Cache-Control': 'no-store',
        },
    });
}

// ---------------------------------------------------------------------------
// Print stylesheet
//
// Deliberately extends the existing brand system (--primary-blue: #045093,
// --secondary-gold: #D4AF37, same font stack) from listings.css / index.css
// rather than introducing a new visual language — this should read as the
// same business listing, just laid out for paper. @page + print-color-adjust
// rules keep colors and page breaks correct across Chrome/Edge/Firefox/Safari
// print-to-PDF, which is what "Save as PDF" actually uses under the hood.
// ---------------------------------------------------------------------------

const PRINT_STYLES = `<style>
    :root {
        --primary-blue: #045093;
        --secondary-gold: #D4AF37;
        --text-dark: #1a1a1a;
        --text-light: #6b7280;
        --border-color: #e5e7eb;
        --bg-light: #f9fafb;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: var(--text-dark);
        background: #fff;
        line-height: 1.5;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    img { max-width: 100%; display: block; }

    /* ---------------- Page shell ---------------- */
    /*
        Margins live on @page, not on .print-page's own padding. This
        matters specifically for overflow: if a listing's content is long
        enough to spill from one .print-page div onto a 2nd or 3rd physical
        printed sheet, padding on the div only ever applies once, at the
        div's own absolute top and bottom — the physical page break in the
        middle of that overflow gets NO margin from div padding, since
        padding is a property of the element's box, not of each sheet the
        element happens to span. @page's margin, by contrast, is applied by
        the print engine to every physical page independently, however many
        pages the content spans, which is exactly the "good top and bottom
        margins on every page, including where content continues" behavior
        needed here.
    */

    @page {
        size: letter;
        margin: 0.6in 0.65in;
    }

    .print-page {
        /* Sized to the page's CONTENT area (letter size minus the @page
           margin above: 8.5in - 2*0.65in = 7.2in), not the full sheet —
           @page's margin already provides the inset on every page, so no
           additional padding is added here (that would stack two margins
           and over-inset the content). */
        width: 7.2in;
        min-height: 9.8in;
        margin: 0 auto;
        page-break-after: always;
        position: relative;
    }

    .print-page:last-of-type { page-break-after: auto; }

    /* ---------------- Hero page header ---------------- */

    .hero-header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
    }

    .brand-mark { height: 28px; width: auto; }

    .hero-header-label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-light);
    }

    .hero-photo-frame {
        width: 100%;
        height: 2.4in;
        border-radius: 10px;
        overflow: hidden;
        background: var(--bg-light);
        border: 1px solid var(--border-color);
        margin-bottom: 20px;
    }

    .hero-photo {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    /* ---------------- Identity block ---------------- */

    .identity-block {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding-bottom: 16px;
        border-bottom: 2px solid var(--primary-blue);
        margin-bottom: 20px;
    }

    .identity-tags {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 10px;
    }

    .category-pill {
        display: inline-block;
        background: var(--primary-blue);
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 12px;
        border-radius: 999px;
    }

    .subcategory-tag {
        display: inline-block;
        background: #e5e7eb;
        color: #374151;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 999px;
    }

    .print-badge {
        display: inline-block;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        padding: 4px 10px;
        border-radius: 4px;
    }

    .badge-featured { background: #fbbf24; color: #78350f; }
    .badge-premium { background: #6b21a8; color: #ede9fe; }
    .badge-coming-soon { background: #f97316; color: #fff; }
    .badge-closed { background: #ef4444; color: #fff; }

    .business-name {
        font-size: 28px;
        font-weight: 700;
        color: var(--text-dark);
        margin-bottom: 4px;
    }

    .verified-checkmark-btn {
        border: 0;
        background: transparent;
        padding: 0;
        margin-left: 8px;
        position: relative;
        display: inline-flex;
        align-items: center;
    }

    .tagline {
        font-size: 15px;
        font-style: italic;
        color: var(--text-light);
        font-weight: 600;
        margin-bottom: 6px;
    }

    .pricing-chip {
        display: inline-flex;
        align-items: center;
        padding: 2px 10px;
        border-radius: 999px;
        background: #eff6ff;
        color: var(--primary-blue);
        font-weight: 700;
        font-size: 12px;
    }

    .logo-mark {
        width: 72px;
        height: 72px;
        object-fit: cover;
        border-radius: 10px;
        border: 1px solid var(--border-color);
        flex-shrink: 0;
    }

    /* ---------------- Two-column content ---------------- */

    .content-columns {
        display: flex;
        gap: 24px;
    }

    .content-main {
        flex: 1 1 auto;
        min-width: 0;
    }

    .content-side {
        flex: 0 0 2.4in;
        min-width: 0;
    }

    .print-section {
        margin-bottom: 18px;
    }

    .print-section h3 {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--primary-blue);
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--border-color);
        /* Glue the title to whatever content immediately follows it. If a
           page break would otherwise land right after this h3 (i.e. the
           title would be the last thing on the page, with the section's
           actual content starting fresh on the next page), the print
           engine moves the break earlier instead — before the h3 — so
           the title and at least the start of its content begin together
           on the next page.

           This is deliberately NOT break-inside:avoid on the whole
           .print-section (that was tried first and measured wrong: it
           moved the ENTIRE section, however long, the moment ANY part of
           it would spill — so a 14-row Additional Information section
           with room for 10+ rows left on the current page got shoved
           whole onto the next page anyway, wasting most of a page).
           break-after:avoid here only prevents the title from being
           stranded alone; once the section has genuinely started (title
           + its first row placed), the remaining rows are free to
           continue splitting across pages exactly like any other long
           content, unaffected by this rule. */
        break-after: avoid;
        page-break-after: avoid;
    }

    .description-body {
        font-size: 12.5px;
        color: #374151;
        line-height: 1.6;
    }

    .description-body p { margin-bottom: 8px; }
    .description-body ul, .description-body ol { margin-left: 1.2em; margin-bottom: 8px; }

    /* Additional info table */

    .additional-info-table { border: 1px solid var(--border-color); border-radius: 6px; overflow: hidden; }

    .additional-info-row {
        display: grid;
        grid-template-columns: minmax(90px, 1fr) minmax(0, 2fr);
        gap: 12px;
        padding: 6px 10px;
        font-size: 11.5px;
        border-bottom: 1px solid #f3f4f6;
    }

    .additional-info-row:last-child { border-bottom: none; }
    .additional-info-row:nth-child(even) { background: var(--bg-light); }
    .additional-info-label { font-weight: 600; color: var(--text-dark); }
    .additional-info-value { color: #374151; }

    /* Owner / leadership */

    .owner-card {
        background: var(--bg-light);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 10px 12px;
        margin-bottom: 8px;
        font-size: 12px;
    }

    .owner-card p { margin-bottom: 3px; }
    .owner-card p:last-child { margin-bottom: 0; }

    /* Social / reviews link lists */

    .link-list { font-size: 11.5px; }

    .link-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 4px 0;
        border-bottom: 1px solid #f3f4f6;
    }

    .link-row:last-child { border-bottom: none; }
    .link-label { font-weight: 600; color: var(--text-dark); flex-shrink: 0; }
    .link-value { color: var(--text-light); text-align: right; word-break: break-word; }

    /* Contact card (sidebar) */

    .contact-card {
        background: var(--bg-light);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 14px;
    }

    .contact-row { margin-bottom: 8px; font-size: 11.5px; }
    .contact-row:last-child { margin-bottom: 0; }
    .contact-label { display: block; font-weight: 600; color: var(--text-light); font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 1px; }
    .contact-value { display: block; color: var(--text-dark); word-break: break-word; }

    /* Hours */

    .hours-section {
        background: var(--bg-light);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 14px;
        margin-top: 16px;
    }

    .hours-grid { font-size: 11.5px; }

    .hours-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        padding: 2px 0;
    }

    .hours-day { font-weight: 600; }
    .hours-value { color: #374151; text-align: right; }

    .hours-disclaimer {
        margin-top: 8px;
        padding: 6px 8px;
        background: #fef3c7;
        border: 1px solid #fbbf24;
        color: #78350f;
        border-radius: 6px;
        font-size: 10.5px;
    }

    /* The former "Hero footer" rule (.hero-footer) was removed here along
       with its <footer> element — the listing URL / printed date / TGD
       name now render as a genuine running page footer via
       pdfOptions.footerTemplate (see renderPrintPage and the /pdf fetch
       call above), not as in-flow content on this specific page. */

    /* ---------------- Additional gallery pages ---------------- */
    /* Gallery photos may be any aspect ratio, so they're sized to fit within
       the page rather than cropped — unlike the hero photo and on-screen
       carousel, which use object-fit: cover deliberately.

       CENTERING HISTORY (why this specific technique, not an earlier one):

       Attempt 1 — flex:1 on the frame, footer as a normal flex sibling.
       Measured wrong: two test images of very different aspect ratios
       (1600x700 and 700x1600) both landed ~24px off true page-center, by
       the same amount regardless of aspect ratio — proof the footer's
       reserved space was uniformly skewing the centering point.

       Attempt 2 — position:absolute + transform:translate(-50%,-50%) on
       the frame, footer separately pinned to the bottom. This measured as
       PERFECT in the live DOM (offset ~0.008px) and in a direct Puppeteer
       element screenshot — but when the exact same page was run through
       Chromium's actual PDF-export pipeline (page.pdf(), the API this
       Worker's PDF generation is built on), the wide test image rendered
       nowhere near center — proof that transform-based positioning is not
       reliably honored by Chromium's print/pagination engine specifically,
       even though the underlying DOM computes it correctly. This is the
       same category of engine-specific print/PDF discrepancy that caused
       the original iPhone bug — it just took generating and inspecting an
       actual PDF file (not just measuring the live DOM) to catch this one.

       Fix — margin:auto centering on a flex item (this version): the
       frame is a flex child of a fixed-height flex column, with
       margin-top/margin-bottom: auto splitting the free space evenly
       above and below it. This is one of the oldest, most broadly
       print-and-paginator-safe CSS centering idioms — no transform, no
       absolute positioning, nothing that depends on a pagination engine
       correctly reconciling a transformed box against a fixed page size. */

    .gallery-page {
        display: flex;
        flex-direction: column;
        align-items: center;
        /* Fixed (not min-) height, matching .print-page's content-area
           height exactly, so there's one known, unchanging amount of
           free space for the frame's auto margins to split evenly. */
        height: 9.8in;
    }

    .gallery-page-frame {
        margin-top: auto;
        margin-bottom: auto;
        width: 100%;
        max-width: 100%;
        max-height: 8.9in;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .gallery-page-image {
        max-width: 100%;
        max-height: 8.9in;
        width: auto;
        height: auto;
        object-fit: contain;
        border-radius: 8px;
        border: 1px solid var(--border-color);
    }

    .gallery-page-footer {
        flex-shrink: 0;
        font-size: 10px;
        color: var(--text-light);
        text-align: center;
        padding-bottom: 4px;
    }

</style>`;