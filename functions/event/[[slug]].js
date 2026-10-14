/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed
without written permission from The Greek Directory. Unauthorized use, copying, modification,
or distribution of this code can result in legal action to the fullest extent permitted by law.
*/

// functions/event/[[slug]].js
//
// Cloudflare Pages Function. Route: GET /event/* — a catch-all
// ([[slug]].js), not a single required segment. Event slugs are
// two-part: city-state/event-name, or online/event-name for events with
// no physical address, matching listings.slug's own format exactly (see
// generateSlugFromName() in js/admin.js, reused directly by
// js/admin-events.js). A two-part slug means two path segments after
// /event/, which a single-bracket [slug].js cannot match.
//
// This does not reintroduce the original /events routing bug: that bug
// required two sibling files in the SAME directory both able to claim
// the same zero-segment route (functions/events/ had both index.js and
// [[slug]].js). functions/event/ (this directory) has no index.js and
// never will — bare /event is not a page and 404s via the empty-slug
// guard below. Direct precedent already exists in this codebase:
// functions/print/listing/[[slug]].js reconstructs a multi-segment slug
// the same way and has no sibling index.js either.
//
// SERVICE ROLE: SUPABASE_SERVICE_ROLE_KEY, a Pages Secret — needed to
// resolve organizer_listing_id / venue_listing_id into the organizer/
// venue info sections and the event's shortlink in server-side round
// trips, mirroring functions/print/listing/[[slug]].js's own reasoning.
//
// A SIBLING NESTED ROUTE EXISTS: functions/event/ics/[[slug]].js serves
// GET /event/ics/* (the single-event .ics download used by this page's
// own Add to Calendar dropdown, see buildAddToCalendarButton below).
// This does NOT recreate the historical /events routing conflict
// described above — that conflict was two files at the SAME directory
// level both able to claim the same zero-segment route. Here,
// /event/ics/* (functions/event/ics/[[slug]].js) and /event/*
// (this file) are DIFFERENT routes matching different URL prefixes;
// Cloudflare's own documented routing precedence ("more specific routes
// — those with fewer wildcards — take precedence over less specific
// routes") means a request to /event/ics/anything resolves to the
// nested file, never to this one, regardless of file/declaration order.
// Confirmed via Cloudflare's Workers routing docs' own worked example
// of the identical shape: "example.com/hello/* would take precedence
// over example.com/*".

const SUPABASE_URL = 'https://luetekzqrrgdxtopzvqw.supabase.co';

export async function onRequestGet(context) {
    const { params, env, request } = context;
    const slugSegments = Array.isArray(params.slug) ? params.slug : params.slug ? [params.slug] : [];
    const slug = slugSegments.map((segment) => decodeURIComponent(segment)).join('/');

    // ?shareimg=<n> — set by the gallery share button (js/event-page.js)
    // so the native share sheet's link preview shows whichever gallery
    // image the visitor was actually looking at, rather than always the
    // event poster. 1-indexed to match how the button numbers images
    // for the person (matching the request's own example: "shareimg=19
    // when there's only 16 images" implies counting from 1, not 0 — a
    // 0-indexed scheme would call that same 16-image gallery's last
    // valid index 15, not 16, and the request's phrasing treats 16 as
    // the valid ceiling). Parsed here, right at the request boundary,
    // rather than deep inside renderEventPage()/buildEventHead() — those
    // functions already take a lot of parameters, and validating a raw
    // query string value is a concern of handling the REQUEST, not of
    // building the page from already-clean event data.
    const requestUrl = new URL(request.url);
    const shareImgParam = requestUrl.searchParams.get('shareimg');
    const shareImgIndex = shareImgParam !== null ? parseInt(shareImgParam, 10) : null;

    if (!slug) {
        return htmlErrorResponse(renderErrorPage('Event not found.', 'This event does not exist or is not published.'), 404);
    }

    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is not configured for this Pages project.');
        return htmlErrorResponse(
            renderErrorPage(
                'Event unavailable.',
                'Missing configuration: SUPABASE_SERVICE_ROLE_KEY is not set for this Pages project (Settings \u2192 Environment variables, as a Secret).'
            ),
            500
        );
    }

    let event;
    try {
        event = await fetchEventBySlug(slug, serviceRoleKey);
    } catch (err) {
        console.error('Supabase event fetch failed:', err);
        return htmlErrorResponse(renderErrorPage('Event unavailable.', 'We could not load this event right now. Please try again later.'), 502);
    }

    if (!event || event.visible !== true) {
        return htmlErrorResponse(renderErrorPage('Event not found.', 'This event does not exist or is not published.'), 404);
    }

    let organizerListing = null;
    let venueListing = null;
    let shortlinkPath = null;
    try {
        [organizerListing, venueListing, shortlinkPath] = await Promise.all([
            event.organizer_listing_id ? fetchListingById(event.organizer_listing_id, serviceRoleKey) : Promise.resolve(null),
            event.venue_listing_id ? fetchListingById(event.venue_listing_id, serviceRoleKey) : Promise.resolve(null),
            fetchEventShortlinkPath(event.id, serviceRoleKey),
        ]);
    } catch (err) {
        console.error('Supabase organizer/venue/shortlink fetch failed:', err);
    }

    const html = renderEventPage(event, organizerListing, venueListing, shortlinkPath, shareImgIndex);

    return new Response(html, {
        status: 200,
        headers: buildCacheHeaders(event),
    });
}

function buildCacheHeaders(event) {
    const now = Date.now();
    const startMs = new Date(event.start_at).getTime();
    const msUntilStart = startMs - now;
    const isImminentOrLive = Number.isFinite(msUntilStart) && msUntilStart >= -24 * 60 * 60 * 1000 && msUntilStart < 24 * 60 * 60 * 1000;
    const isUnstableStatus = event.status === 'cancelled' || event.status === 'postponed' || event.status === 'sold_out';

    const cacheControl = isImminentOrLive || isUnstableStatus
        ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=120'
        : 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

    return {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': cacheControl,
    };
}

function htmlErrorResponse(html, status) {
    return new Response(html, {
        status,
        headers: {
            'Content-Type': 'text/html; charset=UTF-8',
            'X-Robots-Tag': 'noindex, nofollow',
            'Cache-Control': 'no-store',
        },
    });
}

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

async function fetchEventBySlug(slug, serviceRoleKey) {
    const encodedSlug = encodeURIComponent(slug);
    const rows = await supabaseRestGet(`events?slug=eq.${encodedSlug}&limit=1`, serviceRoleKey);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function fetchListingById(id, serviceRoleKey) {
    const encodedId = encodeURIComponent(id);
    const rows = await supabaseRestGet(
        `listings?id=eq.${encodedId}&select=id,slug,business_name,logo,address,city,state,zip_code,country,phone,website,hours,tier,category&limit=1`,
        serviceRoleKey
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function fetchEventShortlinkPath(eventId, serviceRoleKey) {
    const encodedId = encodeURIComponent(eventId);
    const rows = await supabaseRestGet(
        `shortlinks?event_refer_id=eq.${encodedId}&select=path&limit=1`,
        serviceRoleKey
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0].path : null;
}

function escapeHtml(text) {
    if (text === null || text === undefined || text === '') return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
        return str.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\').replace(/\\n/g, '\n');
    }
}

const DESCRIPTION_CONTENT_STRIP_TAGS = new Set(['script', 'style']);

function sanitizeEventDescription(value) {
    const raw = decodeEscapedText(value || '');
    if (!raw) return '';
    let result = '';
    let i = 0;
    while (i < raw.length) {
        const char = raw[i];
        if (char === '<') {
            const brMatch = /^<br\s*\/?>/i.exec(raw.slice(i));
            if (brMatch) {
                result += '<br>';
                i += brMatch[0].length;
                continue;
            }
            const closeIdx = raw.indexOf('>', i);
            if (closeIdx === -1) { i += 1; continue; }
            const tagContent = raw.slice(i + 1, closeIdx);
            const tagNameMatch = /^\/?\s*([a-zA-Z0-9]+)/.exec(tagContent);
            const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : '';
            if (DESCRIPTION_CONTENT_STRIP_TAGS.has(tagName) && !tagContent.trim().startsWith('/')) {
                const closingTag = `</${tagName}>`;
                const closingIdx = raw.toLowerCase().indexOf(closingTag, closeIdx);
                i = closingIdx === -1 ? raw.length : closingIdx + closingTag.length;
                continue;
            }
            i = closeIdx + 1;
            continue;
        }
        result += escapeHtml(char);
        i += 1;
    }
    return result;
}

function formatEventDateTime(startAt, endAt, timezone, allDay) {
    if (!startAt) return { dateLabel: '', timeLabel: '', isoStart: '', isoEnd: '' };
    const start = new Date(startAt);
    const end = endAt ? new Date(endAt) : null;
    const tz = timezone || 'America/Chicago';

    const dateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: tz });
    const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: tz });

    const sameDay = end
        ? new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).format(start)
            === new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).format(end)
        : true;

    let dateLabel = dateFormatter.format(start);
    if (end && !sameDay) dateLabel += ` \u2013 ${dateFormatter.format(end)}`;

    let timeLabel = '';
    if (!allDay) {
        timeLabel = end && sameDay
            ? `${timeFormatter.format(start).replace(/\s[A-Z]{2,4}$/, '')} \u2013 ${timeFormatter.format(end)}`
            : timeFormatter.format(start);
    } else {
        timeLabel = 'All day';
    }

    return { dateLabel, timeLabel, isoStart: start.toISOString(), isoEnd: end ? end.toISOString() : '' };
}

function getEventTimingState(event) {
    const now = Date.now();
    const start = new Date(event.start_at).getTime();
    // Same fix, same reasoning as currentEventDataScript's endAtMs below —
    // this is the server-rendered counterpart, seen on first paint by
    // every visitor (and by crawlers, who never run the client-side
    // updateLiveStatusBadge() at all) before any client JS executes. Kept
    // consistent with that fix's 3-hour default so the two never disagree.
    const end = event.end_at ? new Date(event.end_at).getTime() : start + 3 * 60 * 60 * 1000;

    if (event.status === 'cancelled') return 'cancelled';
    if (event.status === 'postponed') return 'postponed';
    if (event.status === 'sold_out') return 'sold_out';
    if (now >= start && now <= end) return 'happening_now';
    if (now > end) return 'past';
    return 'upcoming';
}

const TIMING_BADGE_HTML = {
    happening_now: '<span class="badge badge-open">HAPPENING NOW</span>',
    cancelled: '<span class="badge badge-closed">CANCELLED</span>',
    postponed: '<span class="badge badge-postponed">POSTPONED</span>',
    sold_out: '<span class="badge badge-soldout">SOLD OUT</span>',
    past: '<span class="badge badge-past">PAST EVENT</span>',
    upcoming: '',
};

const WEEKDAY_LABELS = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' };

function describeRecurrence(recurrence) {
    if (!recurrence || typeof recurrence !== 'object' || !recurrence.freq) return '';
    const interval = recurrence.interval && recurrence.interval > 1 ? recurrence.interval : 1;
    let phrase = '';
    if (recurrence.freq === 'daily') {
        phrase = interval > 1 ? `Every ${interval} days` : 'Daily';
    } else if (recurrence.freq === 'weekly') {
        const days = Array.isArray(recurrence.by_day) && recurrence.by_day.length
            ? recurrence.by_day.map((d) => WEEKDAY_LABELS[d] || d).join(', ')
            : '';
        phrase = interval > 1 ? `Every ${interval} weeks${days ? ` on ${days}` : ''}` : `Weekly${days ? ` on ${days}` : ''}`;
    } else if (recurrence.freq === 'monthly') {
        phrase = interval > 1 ? `Every ${interval} months` : 'Monthly';
    } else {
        return '';
    }
    if (recurrence.until) {
        const untilDate = new Date(recurrence.until);
        if (!Number.isNaN(untilDate.getTime())) {
            phrase += ` until ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(untilDate)}`;
        }
    }
    return phrase;
}

function formatPhoneNumber(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
    if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    return phone;
}

function buildAddressSection(event) {
    const hasStreetAddress = typeof event.address === 'string' && event.address.trim().length > 0;
    if (!hasStreetAddress && !(event.city && event.state)) return '';

    const addressParts = [];
    if (hasStreetAddress) addressParts.push(escapeHtml(event.address));
    if (event.city && event.state) addressParts.push(`${escapeHtml(event.city)}, ${escapeHtml(event.state)}${event.zip_code ? ' ' + escapeHtml(event.zip_code) : ''}`);
    if (!addressParts.length) return '';

    let linkOpen = '';
    let linkClose = '';
    if (event.address) {
        const dest = encodeURIComponent([event.address, event.city, event.state, event.zip_code].filter(Boolean).join(', '));
        linkOpen = `<a href="https://www.google.com/maps/dir/?api=1&destination=${dest}" target="_blank" rel="noopener noreferrer">`;
        linkClose = '</a>';
    }

    return `
        <div class="flex items-start gap-2">
            <svg class="w-5 h-5 text-gray-600 mt-0.5" fill="none" stroke="#045093" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            ${linkOpen}${addressParts.join(', ')}${linkClose}
        </div>`;
}

function buildPhoneSection(event) {
    if (!event.contact_phone) return '';
    return `
        <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="#045093" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
            </svg>
            <a href="tel:${escapeHtml(event.contact_phone)}">${escapeHtml(formatPhoneNumber(event.contact_phone))}</a>
        </div>`;
}

function buildEmailSection(event) {
    if (!event.contact_email) return '';
    return `
        <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="#045093" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
            <a href="mailto:${escapeHtml(event.contact_email)}" target="_blank">${escapeHtml(event.contact_email)}</a>
        </div>`;
}

function buildWebsiteSection(event) {
    if (!event.website) return '';
    const displayUrl = decodeEscapedText(event.website).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    return `
        <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-gray-600" fill="none" stroke="#045093" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
            </svg>
            <a href="${escapeHtml(event.website)}" target="_blank">${escapeHtml(displayUrl)}</a>
        </div>`;
}

function buildDateTimeSidebarBlock(event) {
    const { dateLabel, timeLabel } = formatEventDateTime(event.start_at, event.end_at, event.timezone, event.all_day);
    const recurrenceLabel = describeRecurrence(event.recurrence);
    return `
        <div class="event-datetime-block">
            <svg class="event-datetime-icon w-5 h-5" fill="none" stroke="#045093" viewBox="0 0 24 24" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path stroke-linecap="round" d="M16 2v4M8 2v4M3 10h18"/></svg>
            <div>
                <div class="event-date-label">${escapeHtml(dateLabel)}</div>
                ${timeLabel ? `<div class="event-time-label">${escapeHtml(timeLabel)}</div>` : ''}
                ${recurrenceLabel ? `<div class="event-recurrence-label">${escapeHtml(recurrenceLabel)}</div>` : ''}
            </div>
        </div>`;
}

function buildTicketRsvpButtons(event, mobile) {
    const buttons = [];
    const btnClass = mobile
        ? 'mobile-cta-button hover-bounce'
        : 'flex items-center justify-center gap-2 px-6 py-3 text-white rounded-lg font-medium hover-bounce';
    const iconClass = mobile ? 'w-4 h-4' : 'w-5 h-5';
    const ticketIcon = `<svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;
    const rsvpIcon = `<svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

    if (event.ticket_url && event.status !== 'sold_out') {
        const style = mobile ? ' style="background:#16a34a;"' : ' class="' + btnClass + ' bg-green-600 hover:bg-green-700"';
        buttons.push(`<a href="${escapeHtml(event.ticket_url)}" target="_blank" rel="noopener noreferrer" ${mobile ? `class="${btnClass}"${style}` : style}>${ticketIcon}<span>Get Tickets</span></a>`);
    }
    if (event.rsvp_url) {
        const style = mobile ? ' style="background:#2563eb;"' : ' class="' + btnClass + ' bg-blue-600 hover:bg-blue-700"';
        buttons.push(`<a href="${escapeHtml(event.rsvp_url)}" target="_blank" rel="noopener noreferrer" ${mobile ? `class="${btnClass}"${style}` : style}>${rsvpIcon}<span>RSVP</span></a>`);
    }
    return buttons.join('\n');
}

// Call / Email / Website CTA buttons — colors/icons re-verified directly
// against js/admin.js's own phoneButton/emailButton/websiteButton rather
// than reconstructed from memory: Call is bg-green-600, Email is
// bg-gray-500 (not 600), Website is bg-blue-600.
function buildCallCtaButton(event, mobile) {
    if (!event.contact_phone) return '';
    const iconClass = mobile ? 'w-4 h-4' : 'w-5 h-5';
    const icon = `<svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>`;
    if (mobile) {
        return `<a href="tel:${escapeHtml(event.contact_phone)}" class="mobile-cta-button hover-bounce" style="background:#16a34a;">${icon}<span>Call</span></a>`;
    }
    return `<a href="tel:${escapeHtml(event.contact_phone)}" class="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium hover-bounce">${icon}Call</a>`;
}

function buildEmailCtaButton(event, mobile) {
    if (!event.contact_email) return '';
    const iconClass = mobile ? 'w-4 h-4' : 'w-5 h-5';
    const icon = `<svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`;
    if (mobile) {
        return `<a href="mailto:${escapeHtml(event.contact_email)}" target="_blank" class="mobile-cta-button hover-bounce" style="background:#6b7280;">${icon}<span>Email</span></a>`;
    }
    return `<a href="mailto:${escapeHtml(event.contact_email)}" target="_blank" class="flex items-center justify-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-700 font-medium hover-bounce">${icon}Email</a>`;
}

function buildWebsiteCtaButton(event, mobile) {
    if (!event.website) return '';
    const iconClass = mobile ? 'w-4 h-4' : 'w-5 h-5';
    const icon = `<svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>`;
    if (mobile) {
        return `<a href="${escapeHtml(event.website)}" target="_blank" class="mobile-cta-button hover-bounce" style="background:#2563eb;">${icon}<span>Website</span></a>`;
    }
    return `<a href="${escapeHtml(event.website)}" target="_blank" class="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium hover-bounce">${icon}Website</a>`;
}

function buildDirectionsButton(event, mobile) {
    const hasStreetAddress = typeof event.address === 'string' && event.address.trim().length > 0;
    if (!hasStreetAddress && !event.city) return '';
    const dest = encodeURIComponent([event.address, event.city, event.state, event.zip_code].filter(Boolean).join(', '));
    const href = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    const iconClass = mobile ? 'w-4 h-4' : 'w-5 h-5';
    const icon = `<svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>`;
    if (mobile) {
        return `<a href="${href}" class="mobile-cta-button hover-bounce" style="background:#111827;" onclick="openDirections(event);">${icon}<span>Directions</span></a>`;
    }
    return `<a href="${href}" class="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium hover-bounce" onclick="openDirections(event);">${icon}Directions</a>`;
}

function buildAddToCalendarButton(event, mobile, isoStart, isoEnd, locationLabel, decodedTitle, decodedTagline, eventUrl) {
    const iconClass = mobile ? 'w-4 h-4' : 'w-5 h-5';
    const icon = `<svg class="${iconClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
    // Explicit width/height attributes, NOT a "w-3 h-3" Tailwind class
    // pair — those utilities are never emitted into the compiled
    // src/output.css because Tailwind only generates classes it detects
    // scanning the codebase, and no other component anywhere on the site
    // happens to use w-3/h-3. Confirmed by checking output.css directly:
    // w-4/w-5/h-4/h-5 (used by every OTHER cta icon on this page) are
    // present, w-3/h-3 are not. With the class absent, the browser falls
    // back to an SVG element's un-sized replaced-element default (~300x150
    // CSS px per the SVG2/CSS spec) — a chevron rendered at that size next
    // to a real button is the exact "svg is huge" bug reported. 12px
    // matches what w-3/h-3 (0.75rem = 12px at the default 16px root) would
    // have produced had the class actually compiled, so this looks
    // identical to what was intended, just via attributes that don't
    // depend on the Tailwind build's content-scanning at all. Every other
    // hand-attributed icon in this same file (see buildShareTriggerButton,
    // the Suggest Edit icon below) already uses this exact
    // width/height-attribute pattern rather than a class for the same
    // reason — kept consistent with that precedent rather than
    // reintroducing a class-based size that silently depends on what
    // Tailwind happened to scan elsewhere.
    const chevronIcon = `<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3" style="display:block;flex-shrink:0;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path></svg>`;

    // Google's dates param wants basic UTC form with no punctuation
    // (matches _ics.js's own toIcsUtcDate exactly, but this page doesn't
    // load that module — it's a tiny inline transform, not worth an
    // import for one call site).
    const toGoogleDate = (iso) => (iso ? iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '') : '');
    const googleStart = toGoogleDate(isoStart);
    const googleEnd = toGoogleDate(isoEnd) || googleStart; // Google requires both ends of the dates= param
    const googleDetails = [decodedTagline, `Details: ${eventUrl}`].filter(Boolean).join('\n\n');
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(decodedTitle)}&dates=${googleStart}/${googleEnd}&details=${encodeURIComponent(googleDetails)}&location=${encodeURIComponent(locationLabel)}`;

    // Outlook's deeplink/compose endpoint — real, documented instability
    // found while researching this (some sources report the "0/"
    // segment was removed at some point; the majority, including the
    // most recent working examples found, still show it present). Kept
    // as one of five options here, not a single point of failure for
    // the whole feature if Microsoft changes this again.
    const outlookUrl = `https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${encodeURIComponent(decodedTitle)}&startdt=${encodeURIComponent(isoStart)}&enddt=${encodeURIComponent(isoEnd || isoStart)}&body=${encodeURIComponent(decodedTagline || '')}&location=${encodeURIComponent(locationLabel)}`;

    // Yahoo's format, confirmed via multiple cross-corroborated sources
    // including a production PHP library's implementation.
    const yahooUrl = `https://calendar.yahoo.com/?v=60&title=${encodeURIComponent(decodedTitle)}&st=${googleStart}&et=${googleEnd}&desc=${encodeURIComponent(decodedTagline || '')}&in_loc=${encodeURIComponent(locationLabel)}`;

    // Apple Calendar has no URL-based event-creation format at all
    // (confirmed via research) — both this and "Other/Generic iCal" need
    // an actual downloaded .ics file, so they share the same endpoint.
    const icsDownloadUrl = `/event/ics/${escapeHtml(event.slug || '')}`;

    const menuId = mobile ? 'addToCalendarMenuMobile' : 'addToCalendarMenuDesktop';
    const menuHtml = `
        <div class="add-to-calendar-menu hidden" id="${menuId}">
            <a href="${googleUrl}" target="_blank" rel="noopener">Google Calendar</a>
            <a href="${icsDownloadUrl}">Apple Calendar</a>
            <a href="${outlookUrl}" target="_blank" rel="noopener">Outlook</a>
            <a href="${yahooUrl}" target="_blank" rel="noopener">Yahoo Calendar</a>
            <a href="${icsDownloadUrl}">Other (.ics file)</a>
        </div>`;

    if (mobile) {
        return `<div class="add-to-calendar-wrap">
            <button type="button" class="mobile-cta-button hover-bounce" style="background:#7c3aed; width:100%;" onclick="toggleAddToCalendarMenu('${menuId}')">${icon}<span>Add to Calendar</span>${chevronIcon}</button>
            ${menuHtml}
        </div>`;
    }
    return `<div class="add-to-calendar-wrap">
        <button type="button" class="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium hover-bounce" onclick="toggleAddToCalendarMenu('${menuId}')">${icon}Add to Calendar${chevronIcon}</button>
        ${menuHtml}
    </div>`;
}

function buildShareTriggerButton() {
    return `<a class="flex items-center justify-center gap-2 px-6 py-3 text-white rounded-lg font-medium hover-bounce" onclick="openShareModal()" style="background-color:#045093; cursor: pointer;" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block;flex-shrink:0;"><path fill-rule="evenodd" clip-rule="evenodd" d="M19.6495 0.799565C18.4834 -0.72981 16.0093 0.081426 16.0093 1.99313V3.91272C12.2371 3.86807 9.65665 5.16473 7.9378 6.97554C6.10034 8.9113 5.34458 11.3314 5.02788 12.9862C4.86954 13.8135 5.41223 14.4138 5.98257 14.6211C6.52743 14.8191 7.25549 14.7343 7.74136 14.1789C9.12036 12.6027 11.7995 10.4028 16.0093 10.5464V13.0069C16.0093 14.9186 18.4834 15.7298 19.6495 14.2004L23.3933 9.29034C24.2022 8.2294 24.2022 6.7706 23.3933 5.70966L19.6495 0.799565ZM7.48201 11.6095C9.28721 10.0341 11.8785 8.55568 16.0093 8.55568H17.0207C17.5792 8.55568 18.0319 9.00103 18.0319 9.55037L18.0317 13.0069L21.7754 8.09678C22.0451 7.74313 22.0451 7.25687 21.7754 6.90322L18.0317 1.99313V4.90738C18.0317 5.4567 17.579 5.90201 17.0205 5.90201H16.0093C11.4593 5.90201 9.41596 8.33314 9.41596 8.33314C8.47524 9.32418 7.86984 10.502 7.48201 11.6095Z" fill="#FFFFFF"/><path d="M7 1.00391H4C2.34315 1.00391 1 2.34705 1 4.00391V20.0039C1 21.6608 2.34315 23.0039 4 23.0039H20C21.6569 23.0039 23 21.6608 23 20.0039V17.0039C23 16.4516 22.5523 16.0039 22 16.0039C21.4477 16.0039 21 16.4516 21 17.0039V20.0039C21 20.5562 20.5523 21.0039 20 21.0039H4C3.44772 21.0039 3 20.5562 3 20.0039V4.00391C3 3.45162 3.44772 3.00391 4 3.00391H7C7.55228 3.00391 8 2.55619 8 2.00391C8 1.45162 7.55228 1.00391 7 1.00391Z" fill="#FFFFFF"/></svg><span>Share</span></a>`;
}

function buildShareButtonsHiddenSection(event, eventUrl) {
    const encodedTitle = encodeURIComponent(decodeEscapedText(event.title || ''));
    const encodedUrl = encodeURIComponent(eventUrl);
    return `
        <div class="share-section hidden" id="shareButtonsSection">
            <div class="flex flex-wrap gap-2">
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer" class="share-button social-facebook" title="Share on Facebook">
                    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}" target="_blank" rel="noopener noreferrer" class="share-button social-twitter" title="Share on X">
                    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}" target="_blank" rel="noopener noreferrer" class="share-button social-linkedin" title="Share on LinkedIn">
                    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a href="sms:?&body=${encodedTitle}%20-%20${encodedUrl}" class="share-button share-sms" title="Share via SMS">
                    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
                </a>
                <a href="mailto:?subject=${encodedTitle}&body=${encodedUrl}" class="share-button share-email" title="Share via Email">
                    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                </a>
                <button onclick="shareNative()" class="share-button social-other" title="Share">
                    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                </button>
            </div>
        </div>`;
}

function getListingHoursBadge(listing) {
    if (!listing || !listing.hours || typeof listing.hours !== 'object') return '';
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const day = dayKeys[new Date().getDay()];
    const todayHours = String(listing.hours[day] || '').toLowerCase();
    if (!todayHours) return '';
    return todayHours.includes('closed') ? '<span class="badge badge-closed">CLOSED</span>' : '<span class="badge badge-open">OPEN</span>';
}

function getListingTierBadge(listing) {
    if (!listing) return '';
    if (listing.tier === 'PREMIUM') return '<span class="badge badge-premium">Premium</span>';
    if (listing.tier === 'FEATURED') return '<span class="badge badge-featured">Featured</span>';
    return '';
}

function buildEntityInfoCard(listing) {
    if (!listing) return '';
    const location = [listing.city, listing.state].filter(Boolean).join(', ');
    const badges = `${getListingHoursBadge(listing)}${getListingTierBadge(listing)}`;
    return `
        <a class="entity-info-card hover-bounce" href="/listing/${escapeHtml(listing.slug || '')}">
            ${listing.logo
                ? `<img class="entity-info-card-logo" src="${escapeHtml(listing.logo)}" alt="${escapeHtml(listing.business_name || '')}">`
                : `<div class="entity-info-card-logo" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#045093,#0a6bc2);color:white;font-weight:700;font-size:20px;">${escapeHtml((listing.business_name || '?').charAt(0))}</div>`}
            <div class="entity-info-card-body">
                ${badges ? `<div class="entity-info-card-badges">${badges}</div>` : ''}
                <div class="entity-info-card-name">${escapeHtml(listing.business_name || '')}</div>
                ${listing.category ? `<div class="entity-info-card-line">${escapeHtml(listing.category)}</div>` : ''}
                ${location ? `<div class="entity-info-card-line"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#045093" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg><span>${escapeHtml(location)}</span></div>` : ''}
                ${listing.phone ? `<div class="entity-info-card-line"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#045093" stroke-width="2"><path d="M3 5a2 2 0 012-2h3.3a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21L8 10.5a11 11 0 005.5 5.5l1.1-2.25a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.7.95V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z"/></svg><span>${escapeHtml(formatPhoneNumber(listing.phone))}</span></div>` : ''}
            </div>
        </a>`;
}

function buildCustomVenueCard(event) {
    if (!event.custom_venue_name && !event.address) return '';
    const cityStateZip = [event.city, [event.state, event.zip_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    const fullAddressLine = [event.address, cityStateZip].filter(Boolean).join(', ');
    return `
        <div class="entity-info-card entity-info-card-static">
            <div class="entity-info-card-logo" style="display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#045093,#0a6bc2);color:white;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l8-4v18M13 21V11l6 3v7"/></svg>
            </div>
            <div class="entity-info-card-body">
                <div class="entity-info-card-name">${escapeHtml(event.custom_venue_name || 'Venue')}</div>
                ${fullAddressLine ? `<div class="entity-info-card-line"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#045093" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg><span>${escapeHtml(fullAddressLine)}</span></div>` : ''}
            </div>
        </div>`;
}

function buildOrganizerVenueSection(event, organizerListing, venueListing) {
    const organizerCard = buildEntityInfoCard(organizerListing);
    const venueCard = venueListing ? buildEntityInfoCard(venueListing) : buildCustomVenueCard(event);
    const sameEntity = organizerListing && venueListing && organizerListing.id === venueListing.id;

    if (!organizerCard && !venueCard) return '';

    if (sameEntity) {
        return `
            <div class="entity-info-section" id="organizerVenueSection">
                <h3>Hosted At</h3>
                ${organizerCard}
            </div>`;
    }

    const parts = [];
    if (organizerCard) parts.push(`<div class="entity-info-section"><h3>Organized By</h3>${organizerCard}</div>`);
    if (venueCard) parts.push(`<div class="entity-info-section"><h3>Venue</h3>${venueCard}</div>`);
    return `<div id="organizerVenueSection">${parts.join('')}</div>`;
}

function buildAdditionalInfoSection(event) {
    const info = Array.isArray(event.additional_info) ? event.additional_info : [];
    const rows = info
        .filter((item) => item && item.label && item.value)
        .map((item) => `<div class="additional-info-row"><span class="font-medium text-gray-900">${escapeHtml(decodeEscapedText(item.label))}</span><span class="text-gray-700">${escapeHtml(decodeEscapedText(item.value))}</span></div>`)
        .join('');
    if (!rows) return '';
    return `<div class="mb-6" id="additionalInfoSectionWrap"><h3 class="font-semibold text-gray-900 mb-2">Additional Information</h3><div class="additional-info-table">${rows}</div></div>`;
}

function buildMapSection(event) {
    const hasStreetAddress = typeof event.address === 'string' && event.address.trim().length > 0;
    if (!hasStreetAddress && !(event.city && event.state)) return '';
    return `
        <div id="locationSection" class="location-section mt-6">
            <h2 class="text-xl font-bold text-gray-900 mb-3">Location</h2>
            <div id="eventMap"></div>
            <div id="mapFallback" class="map-fallback" role="status" aria-live="polite"></div>
        </div>`;
}

function renderEventPage(event, organizerListing, venueListing, shortlinkPath, shareImgIndex) {
    const decodedTitle = decodeEscapedText(event.title || '');
    const decodedTagline = decodeEscapedText(event.tagline || '');
    const description = sanitizeEventDescription(event.description || '');
    const { isoStart, isoEnd } = formatEventDateTime(event.start_at, event.end_at, event.timezone, event.all_day);
    const timingState = getEventTimingState(event);
    const timingBadge = TIMING_BADGE_HTML[timingState] || '';
    const eventUrl = `https://thegreekdirectory.org/event/${escapeHtml(event.slug || '')}`;
    const posterImage = event.poster_image || '';
    // og:image override for the gallery share button (js/event-page.js) —
    // ?shareimg=<n> picks gallery[n-1].url instead of the poster for the
    // OG tags specifically, so a native share sheet's link preview shows
    // whichever image the visitor was actually looking at. Every
    // invalid case falls through to the plain poster, per spec: absent
    // param (shareImgIndex is null from the caller), NaN (a non-numeric
    // value like "shareimg=abc" — parseInt there already produced NaN
    // before this function ever saw it), zero or negative (not a valid
    // 1-indexed position), and out-of-range high (e.g. shareimg=19 on a
    // 16-image gallery — Number.isInteger + the upper-bound check below
    // together cover all of these without special-casing each one).
    const gallery = Array.isArray(event.gallery) ? event.gallery : [];
    const ogImage = (
        shareImgIndex !== null
        && Number.isInteger(shareImgIndex)
        && shareImgIndex >= 1
        && shareImgIndex <= gallery.length
        && gallery[shareImgIndex - 1]
        && gallery[shareImgIndex - 1].url
    ) ? gallery[shareImgIndex - 1].url : posterImage;
    const locationLabel = [event.city, event.state].filter(Boolean).join(', ');
    const hasStreetAddress = typeof event.address === 'string' && event.address.trim().length > 0;
    // Deduped, escaped subcategory tags for the category-pill toggle
    // (item #6) — matches js/admin.js's subcategoriesTags pattern for
    // listings, minus the primary-subcategory-first sort, since events
    // has no primary_subcategory column.
    const subcategoryTagsHtml = Array.isArray(event.subcategories)
        ? [...new Set(event.subcategories.filter(Boolean))].map((sub) => `<span class="subcategory-tag">${escapeHtml(sub)}</span>`).join('')
        : '';

    const tierBadge = event.tier === 'PREMIUM'
        ? '<span class="badge badge-premium">Premium</span>'
        : event.tier === 'FEATURED'
            ? '<span class="badge badge-featured">Featured</span>'
            : '';

    const priceRow = [];
    if (event.is_free) priceRow.push('<span class="event-price-chip event-price-free">Free</span>');
    else if (event.price_range) priceRow.push(`<span class="event-price-chip">${escapeHtml(event.price_range)}</span>`);
    if (event.rsvp_required) priceRow.push('<span class="event-price-chip event-price-rsvp">RSVP Required</span>');

    let capacityNote = '';
    if (event.capacity && event.registered_count != null) {
        const remaining = Math.max(event.capacity - event.registered_count, 0);
        capacityNote = `<div class="event-capacity-note">${remaining} of ${event.capacity} spots remaining</div>`;
    }

    const addressSection = buildAddressSection(event);
    const phoneSection = buildPhoneSection(event);
    const emailSection = buildEmailSection(event);
    const websiteSection = buildWebsiteSection(event);
    const dateTimeBlock = buildDateTimeSidebarBlock(event);
    const organizerVenueSection = buildOrganizerVenueSection(event, organizerListing, venueListing);
    const additionalInfoSection = buildAdditionalInfoSection(event);
    const mapSection = buildMapSection(event);
    const shareTriggerButton = buildShareTriggerButton();
    const shareButtonsHidden = buildShareButtonsHiddenSection(event, eventUrl);
    const ticketRsvpDesktop = buildTicketRsvpButtons(event, false);
    const ticketRsvpMobile = buildTicketRsvpButtons(event, true);
    const directionsDesktop = buildDirectionsButton(event, false);
    const directionsMobile = buildDirectionsButton(event, true);
    const addToCalendarDesktop = buildAddToCalendarButton(event, false, isoStart, isoEnd, locationLabel, decodedTitle, decodedTagline, eventUrl);
    const addToCalendarMobile = buildAddToCalendarButton(event, true, isoStart, isoEnd, locationLabel, decodedTitle, decodedTagline, eventUrl);

    const hasSidebarContact = Boolean(addressSection || phoneSection || emailSection || websiteSection);

    const schemaStatusMap = {
        scheduled: 'https://schema.org/EventScheduled',
        cancelled: 'https://schema.org/EventCancelled',
        postponed: 'https://schema.org/EventPostponed',
        sold_out: 'https://schema.org/EventScheduled',
    };

    // No default-duration convention exists anywhere else in this
    // codebase for a missing end_at (a genuinely common, optional field
    // per the admin form — see js/admin-events.js's ev_end_at input,
    // which has no "required" attribute). Falling back to startAtMs
    // itself would make the "happening now" window a zero-duration
    // instant, and js/event-page.js's updateLiveStatusBadge() would then
    // show "PAST EVENT" the moment the event started, for its entire
    // actual remaining real-world duration. A 3-hour assumed default is
    // a reasonable stand-in for a typical community/social event with
    // no specified end time.
    //
    // IMPORTANT: this comment lives HERE, outside the template literal
    // below, rather than inline next to the endAtMs line itself. This
    // whole block is emitted verbatim into a real <script> tag on the
    // rendered page (see currentEventDataScript's usage further down) —
    // a comment placed inside that string is not just unnecessary
    // payload shipped to every visitor, a stray backtick in prose text
    // (as an earlier version of this exact comment had, in the word
    // `required`) will prematurely close the template literal and break
    // the build. That exact mistake shipped once already: esbuild's
    // build-time parser caught it ("Expected ';' but found 'required'"),
    // but `node --check` did not, since the OUTER file was syntactically
    // valid — the break only surfaces once the string's own contents get
    // parsed as JS again, which is exactly what happens when this
    // literal is emitted as a real <script> tag.
    const currentEventDataScript = `
        window.currentEventData = {
            id: ${JSON.stringify(event.id)},
            slug: ${JSON.stringify(event.slug)},
            title: ${JSON.stringify(decodedTitle)},
            address: ${JSON.stringify(event.address || '')},
            city: ${JSON.stringify(event.city || '')},
            state: ${JSON.stringify(event.state || '')},
            zip_code: ${JSON.stringify(event.zip_code || '')},
            full_address: ${JSON.stringify([event.address, event.city, event.state, event.zip_code].filter(Boolean).join(', '))},
            coordinates: ${JSON.stringify(event.coordinates && event.coordinates.lat ? `${event.coordinates.lat},${event.coordinates.lng}` : '')},
            shortlink: ${JSON.stringify(shortlinkPath ? `https://tgd.gr${shortlinkPath}` : `https://thegreekdirectory.org/event/${event.slug}`)},
            startAtMs: ${JSON.stringify(new Date(event.start_at).getTime())},
            endAtMs: ${JSON.stringify(event.end_at ? new Date(event.end_at).getTime() : new Date(event.start_at).getTime() + 3 * 60 * 60 * 1000)},
            gallery: ${JSON.stringify(Array.isArray(event.gallery) ? event.gallery : [])}
        };
    `;

    // Builds the Event JSON-LD as a real object with true conditional key
    // omission — a field with no data is never added, not set to an
    // empty string — then serializes with JSON.stringify, which also
    // handles all escaping correctly (safer than the hand-templated
    // string interpolation this replaces, which had no escaping at all
    // for several fields and no properties at all for phone/email).
    function buildEventJsonLd() {
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: decodedTitle,
            description: event.meta_description || decodedTagline || decodedTitle,
            startDate: isoStart,
            eventStatus: schemaStatusMap[event.status] || schemaStatusMap.scheduled,
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            url: eventUrl,
        };

        if (isoEnd) {
            schema.endDate = isoEnd;
            // ISO 8601 duration (e.g. "PT2H30M") — only when both ends
            // are known and end is genuinely after start.
            const durationMs = new Date(isoEnd).getTime() - new Date(isoStart).getTime();
            if (durationMs > 0) {
                const totalMinutes = Math.round(durationMs / 60000);
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                schema.duration = `PT${hours > 0 ? hours + 'H' : ''}${minutes > 0 ? minutes + 'M' : ''}` || 'PT0M';
            }
        }

        // Venue — a real Place with a real address whether the venue is
        // a directory listing or a custom (non-listing) venue, mirroring
        // buildCustomVenueCard's own field set for the latter case.
        const venueName = venueListing?.business_name || event.custom_venue_name;
        const venueAddress = venueListing
            ? { streetAddress: venueListing.address, addressLocality: venueListing.city, addressRegion: venueListing.state, postalCode: venueListing.zip_code }
            : { streetAddress: event.address, addressLocality: event.city, addressRegion: event.state, postalCode: event.zip_code };
        const hasVenueAddress = Object.values(venueAddress).some(Boolean);
        if (venueName || hasVenueAddress) {
            schema.location = {
                '@type': 'Place',
                name: venueName || locationLabel || 'Venue',
            };
            if (hasVenueAddress) {
                // addressCountry is schema.org's own ISO 3166-1 alpha-2
                // code field (https://schema.org/addressCountry). The
                // venue listing's own country (once one is linked) takes
                // precedence over the event's own, same fallback
                // direction the rest of this block already uses for
                // every other address field — BUT venueListing.country
                // comes from listings.country, a plain legacy text
                // column (e.g. "USA" — not a real ISO code and not the
                // { name, code } shape events.country stores), while
                // event.country IS that { name, code } shape. Only a
                // recognized ISO code is usable for schema.org's own
                // addressCountry field, so a plain-text listings.country
                // value that isn't already a 2-letter code is treated as
                // unusable here rather than passed through as-is (schema.org
                // validators expect ISO 3166-1 alpha-2, not a free-text
                // country name or abbreviation like "USA"). 'US' is kept
                // as the final fallback for events/listings recorded
                // before events.country existed, so their JSON-LD doesn't
                // regress to no country at all.
                const listingCountryRaw = venueListing?.country;
                const listingCountryCode = (typeof listingCountryRaw === 'string' && /^[A-Za-z]{2}$/.test(listingCountryRaw.trim()))
                    ? listingCountryRaw.trim().toUpperCase()
                    : null;
                const countryCode = listingCountryCode || event.country?.code || 'US';
                schema.location.address = {
                    '@type': 'PostalAddress',
                    addressCountry: countryCode,
                    ...Object.fromEntries(Object.entries(venueAddress).filter(([, v]) => v)),
                };
            }
        }

        const allImages = [posterImage, ...(Array.isArray(event.gallery) ? event.gallery.map((g) => g.url) : [])].filter(Boolean);
        if (allImages.length) schema.image = allImages;

        if (event.is_free) {
            schema.isAccessibleForFree = true;
            schema.offers = { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: eventUrl };
        } else if (event.ticket_url) {
            schema.isAccessibleForFree = false;
            schema.offers = {
                '@type': 'Offer',
                url: event.ticket_url,
                availability: event.status === 'sold_out' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
            };
            if (event.price_range) schema.offers.priceSpecification = { '@type': 'PriceSpecification', price: event.price_range };
        }

        if (organizerListing) {
            schema.organizer = {
                '@type': 'Organization',
                name: organizerListing.business_name,
                url: `https://thegreekdirectory.org/listing/${organizerListing.slug}`,
            };
            // No separate concept of a "performer" exists in this schema
            // (events don't have a distinct headliner field) — when the
            // organizer IS effectively presenting the event themselves
            // (no distinct venue-as-performer scenario applies here),
            // schema.org allows reusing the organizing Organization as
            // performer too, which is the closest accurate mapping
            // available from the current data model.
            schema.performer = schema.organizer;
        }

        if (event.contact_phone) schema.telephone = event.contact_phone;
        if (event.contact_email) schema.email = event.contact_email;
        if (event.capacity) {
            schema.maximumAttendeeCapacity = event.capacity;
            if (event.registered_count != null) {
                schema.remainingAttendeeCapacity = Math.max(event.capacity - event.registered_count, 0);
            }
        }

        schema.inLanguage = 'en-US';

        return JSON.stringify(schema);
    }

    return `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${escapeHtml(decodedTitle)} | Events | The Greek Directory</title>
<meta name="description" content="${escapeHtml(event.meta_description || decodedTagline || decodedTitle)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${eventUrl}">
<link rel="icon" href="https://static.thegreekdirectory.org/img/logo/bluefavicon.png" media="(prefers-color-scheme: light)">
<link rel="icon" href="https://static.thegreekdirectory.org/img/logo/whitefavicon.png" media="(prefers-color-scheme: dark)">
<link rel="apple-touch-icon" href="https://static.thegreekdirectory.org/img/logo/blue.svg">

<meta property="og:title" content="${escapeHtml(decodedTitle)} | The Greek Directory">
<meta property="og:description" content="${escapeHtml(event.meta_description || decodedTagline || decodedTitle)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="The Greek Directory">
<meta property="og:url" content="${eventUrl}">
<meta property="og:locale" content="en_US">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:image:secure_url" content="${escapeHtml(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${escapeHtml(decodedTitle)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@greekdirectory">
<meta name="twitter:title" content="${escapeHtml(decodedTitle)} | The Greek Directory">
<meta name="twitter:description" content="${escapeHtml(event.meta_description || decodedTagline || decodedTitle)}">
${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ''}

<link rel="stylesheet" href="/css/pwa.css">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<link rel="manifest" href="/manifest.json">
<link rel="stylesheet" href="/css/index.css">
<link rel="stylesheet" href="/src/output.css">

<script type="application/ld+json">${buildEventJsonLd()}</script>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://thegreekdirectory.org/' },
        { '@type': 'ListItem', position: 2, name: 'Events', item: 'https://thegreekdirectory.org/events' },
        { '@type': 'ListItem', position: 3, name: decodedTitle, item: eventUrl },
    ],
})}</script>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'The Greek Directory',
    url: 'https://thegreekdirectory.org',
    potentialAction: {
        '@type': 'SearchAction',
        target: 'https://thegreekdirectory.org/search?q={search_term_string}',
        'query-input': 'required name=search_term_string',
    },
})}</script>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'The Greek Directory',
    url: 'https://thegreekdirectory.org',
    logo: 'https://static.thegreekdirectory.org/img/logo/blue.svg',
})}</script>

<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.card-shadow { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); }
.category-pill { cursor: pointer; position: relative; transition: opacity 0.2s; }
.category-pill:hover { opacity: 0.8; }
.badge { font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: 600; display: inline-block; }
.badge-open { background: #10b981; color: white; }
.badge-closed { background: #ef4444; color: white; }
.badge-opening-soon { background: #fbbf24; color: #78350f; }
.badge-featured { background: #fbbf24; color: #78350f; }
.badge-premium { background: #6b21a8; color: #ede9fe; }
.badge-postponed { background: #f97316; color: white; }
.badge-soldout { background: #6b7280; color: white; }
.badge-past { background: #e5e7eb; color: #4b5563; }
.hover-bounce:hover { transform: scale(1.04); }
.action-cta-btn.hover-bounce:hover { transform: scale(1.04); }
a.hover-bounce:hover, button.hover-bounce:hover { transform: scale(1.03); }

/* Poster — positioned in the main column, between the Organizer/Venue
   section and the Map (not the sidebar, and not a page-width hero above
   the content — both tried in earlier rounds). Posters can be any
   aspect ratio, vertical flyers or horizontal banners, so this
   deliberately does NOT force a fixed aspect-ratio/crop; height stays
   natural, width is capped and centered. */
.event-main-poster-wrap { text-align: center; margin: 20px 0; }
/* width/height both explicitly "auto" (not just width) plus object-fit:
   contain, belt-and-suspenders against the reported warp-on-resize bug:
   width:auto alone should already preserve ratio against a max-height
   cap, but leaving height at its browser-default value rather than
   stating "auto" ourselves risks inheriting a stretched box size from
   any ancestor rule that sets width/height together (as this same file's
   own .desktop-main-column > * { width:100% } mobile rule does one
   breakpoint away) — object-fit:contain is the actual guarantee: even if
   something upstream forces this element's box to a size that doesn't
   match the image's intrinsic ratio, contain scales the image to fit
   inside that box without distorting it, which auto/auto sizing alone
   does not defend against once a box size is externally forced. */
.event-main-poster-wrap img { max-width: 100%; width: auto; height: auto; max-height: 640px; object-fit: contain; border-radius: 10px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
@media (max-width: 767px) { .event-main-poster-wrap img { max-height: 480px; width: 100%; height: auto; object-fit: contain; } }

.subcategories-display { display: none; margin-top: 8px; }
.subcategories-display.active { display: block; }
.subcategory-tag { display: inline-block; background: #e5e7eb; color: #374151; padding: 4px 10px; border-radius: 12px; font-size: 12px; margin: 4px 4px 4px 0; }

.listing-description ul, .listing-description ol { margin-left: 1.5rem; padding-left: 1rem; }
.listing-description ul { list-style-type: disc; }
.listing-description ol { list-style-type: decimal; }
.listing-description li { margin: 0.25rem 0; }
.listing-description-wrap { margin: 0 0 1.5rem; }
.listing-description { margin: 0; padding: 1.25rem; border: 1px solid #d1d5db; border-bottom: 0; border-radius: 10px 10px 0 0; background: #fff; line-height: 1.8; color: #1f2937; }
.listing-description p { margin-bottom: 1rem; }
.listing-description.collapsed { max-height: 280px; overflow: hidden; position: relative; }
.listing-description.collapsed::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 80px; background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,1)); }
.description-divider { display: flex; align-items: center; border: 1px solid #d1d5db; border-top: 0; border-radius: 0 0 10px 10px; padding: 10px; background: #ffffff; }
.description-divider-line { flex: 1; border-top: 1px solid #d1d5db; min-width: 0; }
.read-more-btn { margin: 0 12px; border: 1px solid #d1d5db; background: #f9fafb; color: #1f2937; border-radius: 8px; padding: 8px 14px; font-size: 14px; font-weight: 600; cursor: pointer; }

.entity-info-section { margin-top: 24px; }
.entity-info-section h3 { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 10px; }
/* transition includes "transform", not just "box-shadow" — this card
   also carries the shared .hover-bounce class (transition: all 0.3s;
   transform: scale(1.1) on hover), but CSS transition is a single
   shorthand property: this rule and .hover-bounce's rule have equal
   specificity (one class each), so whichever is later in the cascade
   REPLACES the other's transition entirely rather than merging with
   it — this <style> block is inline in <head>, after every external
   stylesheet including css/index.css (where .hover-bounce lives), so
   this rule was winning outright and .hover-bounce's transform was
   left with no transition definition at all: it still applied on
   hover (transform: scale(1.1) is a normal, unrelated declaration),
   just instantly rather than eased — confirmed reported bug ("jumps to
   the final state instead of being fluid"). Matching hover-bounce's
   own timing (0.3s, default ease) rather than inventing a different
   duration keeps this card feeling identical to every other bouncy
   element on the page, per the request. */
.entity-info-card { display: flex; gap: 14px; align-items: flex-start; border: 2px solid #045093; border-radius: 10px; padding: 14px; text-decoration: none; color: inherit; transition: box-shadow 0.15s ease, transform 0.3s; }
.entity-info-card:hover { box-shadow: 0 4px 10px rgba(0,0,0,0.08); }
.entity-info-card-logo { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #f3f4f6; }
.entity-info-card-body { min-width: 0; flex: 1; }
.entity-info-card-badges { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px; }
.entity-info-card-name { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 2px; }
.entity-info-card-line { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #4b5563; margin-top: 2px; }
.entity-info-card-static { border-color: #e5e7eb; cursor: default; }
.entity-info-card-static:hover { box-shadow: none; }

.additional-info-table { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
.additional-info-row { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(0, 2fr); gap: 16px; padding: 10px 14px; border-bottom: 1px solid #f3f4f6; }
.additional-info-row:last-child { border-bottom: none; }
.additional-info-row:nth-child(even) { background: #f9fafb; }

.map-fallback { display: none; margin-top: 12px; padding: 12px; border-radius: 8px; background: #f9fafb; border: 1px solid #e5e7eb; color: #4b5563; font-size: 14px; }
.map-fallback.visible { display: block; }
.location-section.map-unavailable #eventMap { display: none; }
#eventMap { width: 100%; height: 400px; border-radius: 8px; pointer-events: none; }
#eventMap.active { pointer-events: auto; }
#eventMap, #eventMap .leaflet-pane, #eventMap .leaflet-top, #eventMap .leaflet-bottom, #eventMap .leaflet-control { z-index: 1 !important; }

.event-datetime-block { display: flex; align-items: flex-start; gap: 10px; background: #f9fafb; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
.event-datetime-icon { flex-shrink: 0; margin-top: 2px; }
.event-date-label { font-weight: 700; color: #111827; font-size: 15px; }
.event-time-label { color: #4b5563; font-size: 14px; margin-top: 2px; }
.event-recurrence-label { color: #6b7280; font-size: 13px; margin-top: 4px; font-style: italic; }
.event-price-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.event-price-chip { font-size: 13px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; background: white; color: #045093; border: 1px solid #bfdbfe; }
.event-price-free { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
.event-price-rsvp { background: #fef3c7; color: #92400e; border-color: #fde68a; }
.event-capacity-note { font-size: 13px; color: #6b7280; margin-top: 6px; }

.mobile-cta-bar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0 0 24px; }
.add-to-calendar-wrap { position: relative; }
.add-to-calendar-menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: white; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 20; overflow: hidden; min-width: 200px; }
/* Applied by toggleAddToCalendarMenu() in js/event-page.js when there
   isn't enough room below the button to show the whole menu before the
   viewport bottom — confirmed reported bug: on the sticky desktop
   sidebar specifically, a button positioned low in the viewport opens a
   5-item menu downward past the fold, and since the sidebar is
   position:sticky, scrolling the page doesn't reliably bring the menu's
   own tail into view the way it would for a plain in-flow element.
   Flipping the menu to open upward (anchored to the button's top edge
   instead of its bottom) keeps the whole thing on-screen without
   needing the page to scroll at all. */
.add-to-calendar-menu.opens-up { top: auto; bottom: calc(100% + 6px); }
.add-to-calendar-menu.active { display: block; }
.add-to-calendar-menu a { display: block; padding: 10px 14px; font-size: 14px; color: #111827; text-decoration: none; border-bottom: 1px solid #f3f4f6; }
.add-to-calendar-menu a:last-child { border-bottom: none; }
.add-to-calendar-menu a:hover { background: #f3f4f6; }
/* Hidden by default (not inside any media query) — mobile visibility is
   the single exception, applied inside @media (max-width: 767px) below.
   An earlier version used two separate conditional rules (one hiding at
   >=768px, one showing at <=767px) — logically equivalent on paper, but
   simpler is safer here: one unconditional "off" state plus one
   mobile-scoped override leaves no second rule that could fail to apply
   and no cascade order between two conditionals to reason about. */
.mobile-cta-wrap { display: none; }
.mobile-cta-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 12px; border-radius: 8px; color: #fff; font-size: 14px; font-weight: 600; text-decoration: none; }

.desktop-listing-layout { display: block; }
.desktop-main-column, .desktop-side-column { min-width: 0; }
.desktop-contact-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px; }

/* Matches listing-template.html's own .action-cta-row/.action-cta-slot
   exactly — the Suggest-Edit/Claim/Share row pattern near the BOTTOM of
   real listing pages, used here only for the bottom Share section. The
   sidebar's own Call/Email/Website/Directions buttons use a plain
   flex flex-wrap gap-3 instead (see .desktop-contact-card usage below),
   matching the real sidebar pattern rather than an earlier invented
   min-width+stretch combination that could crowd/overlap with more than
   2-3 buttons in a narrow column. */
.action-cta-row { display: flex; gap: 0.5rem; }
.action-cta-slot { flex: 1 1 0; display: flex; }
.action-cta-slot > * { width: 100%; min-height: 44px; }
.action-cta-slot-wide { max-width: 620px; margin: 0 auto; }
@media (max-width: 767px) {
    .action-cta-row { flex-direction: column; }
    .action-cta-slot-wide { max-width: none; margin: 0; }
}

/* Bottom Share section — matches where listing pages actually put their
   own Share button (near the page bottom, outside the main content
   card — confirmed directly in listing-template.html's
   #shareBottomSection). Sits after the gallery, outside the white card. */
.event-share-bottom-section { max-width: 900px; margin: 24px auto 0; padding: 0 16px; }

.share-button { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; transition: all 0.3s; text-decoration: none; cursor: pointer; border: none; outline: none; box-shadow: none; }
.share-button:hover { transform: scale(1.1); }
.social-facebook { background: #1877F2; color: white; }
.social-twitter { background: #000000; color: white; }
.social-linkedin { background: #0077B5; color: white; }
.social-other { background: #045093; color: white; }
.share-sms { background: #10b981; color: white; }
.share-email { background: #ea580c; color: white; }

.claim-listing-section { margin-top: 1.5rem; }
#shareModal { opacity: 0; transition: opacity 0.2s ease; }
#shareModal .share-modal-panel { transform: scale(0.96); transition: transform 0.2s ease; border-radius: 1rem; overflow: hidden; }
#shareModal.active { opacity: 1; }
#shareModal.active .share-modal-panel { transform: scale(1); }
#shareModalButtons { margin-top: -4px; }

/* Hero banner — same background image + gradient overlay treatment as
   listings.html's .listings-hero, but with no text — the page already
   has its own <h1> further down. */
.event-hero-banner {
    position: relative;
    height: 180px;
    background-image: linear-gradient(rgba(4,80,147,0.55), rgba(4,80,147,0.75)), url('https://raw.githubusercontent.com/thegreekdirectory/platform/refs/heads/main/images/chicago.jpeg');
    background-size: cover;
    background-position: center 65%;
}
@media (max-width: 767px) { .event-hero-banner { height: 120px; } }

/* Gallery grid + lightbox */
.event-gallery-section { max-width: 100%; }
.event-gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
}
.event-gallery-thumb {
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid #e5e7eb;
    background: #f3f4f6;
}
.event-gallery-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.2s ease; }
.event-gallery-thumb:hover img { transform: scale(1.05); }
.event-gallery-load-more-wrap { display: flex; gap: 10px; justify-content: center; margin-top: 16px; }
.event-gallery-load-more-wrap button {
    border: 1px solid #d1d5db; background: #f9fafb; color: #1f2937; border-radius: 8px;
    padding: 8px 18px; font-size: 14px; font-weight: 600; cursor: pointer;
}
.event-gallery-load-more-wrap button:hover { background: #f3f4f6; }

#eventLightbox { display: none; }
#eventLightbox.active { display: flex; }
.event-lightbox-image { max-width: 88vw; max-height: 82vh; object-fit: contain; border-radius: 4px; }
.event-lightbox-close { position: absolute; top: 16px; right: 20px; color: white; font-size: 32px; background: none; border: none; cursor: pointer; line-height: 1; }
.event-lightbox-close { 
  position: absolute; 
  top: 16px; 
  right: 20px; 
  color: white; 
  font-size: 32px; 
  background: none; 
  border: none; 
  cursor: pointer; 
  line-height: 1; 
  transition: none;
  transform: none;
  animation: none;
}

.event-lightbox-close:hover {
  transform: none;
  animation: none;
}

/* Gallery share button — sits to the left of the existing close button
   (both top:16px, right offset staggered so they don't overlap: close
   is right:20px at ~32px wide including its click area, share needs to
   clear that plus a gap). Sized/styled identically to .event-lightbox-
   nav's circular icon-button treatment (44px, translucent white
   background, no hover-bounce) rather than matching .event-lightbox-
   close's bare "×" glyph styling — a share icon needs a visible tap
   target the way the prev/next arrows do, unlike the close "×" which
   is legible as a large glyph on its own with no background needed. */
.event-lightbox-share {
  position: absolute;
  top: 16px;
  right: 72px;
  color: white;
  background: rgba(255,255,255,0.12);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s ease;
  animation: none;
}

.event-lightbox-share:hover {
  background: rgba(255,255,255,0.25);
  transform: none;
  animation: none;
}

@media (max-width: 767px) {
  .event-lightbox-share { top: 10px; right: 62px; width: 36px; height: 36px; }
}

.event-lightbox-nav { 
  position: absolute; 
  top: 50%; 
  transform: translateY(-50%); 
  color: white; 
  font-size: 22px; 
  background: rgba(255,255,255,0.12); 
  border: none; 
  border-radius: 50%; 
  width: 44px; 
  height: 44px; 
  cursor: pointer; 
  transition: background-color 0.2s ease;
  animation: none;
}

/* Invisible hit-area buffer around the visible 44px circle. The lightbox
   closes on any click whose e.target is the outer #eventLightbox
   backdrop itself (see bindLightboxControls in js/event-page.js) — a
   click that lands just outside the button's own 44px circle but still
   visually "on the button" (a near-miss, e.g. clicking the button's own
   drop-shadow/glow area) has e.target === the backdrop, not the button,
   and closes the lightbox instead of navigating. This pseudo-element
   extends the BUTTON's own hit area outward by 12px on every side
   without changing what the button looks like — it's transparent and
   sits behind the button's own background/icon (z-index below the
   button's normal stacking), so it only affects click/tap targeting,
   not appearance. Kept as a buffer around the button rather than, say,
   shrinking the backdrop's close-sensitive area globally, since the
   ask was specifically about the buttons' own margin of error. */
.event-lightbox-nav::before {
  content: '';
  position: absolute;
  top: -12px;
  right: -12px;
  bottom: -12px;
  left: -12px;
  border-radius: 50%;
}

.event-lightbox-nav:hover { 
  background: rgba(255,255,255,0.25); 
  transform: translateY(-50%);
  animation: none;
}

.event-lightbox-prev { left: 16px; }
.event-lightbox-next { right: 16px; }
.event-lightbox-caption { position: absolute; bottom: 24px; left: 0; right: 0; text-align: center; color: rgba(255,255,255,0.85); font-size: 14px; padding: 0 16px; }
@media (max-width: 767px) {
    .event-lightbox-nav { width: 38px; height: 38px; font-size: 18px; }
    .event-lightbox-close { top: 10px; right: 14px; }
}

@media (min-width: 1024px) {
    .desktop-listing-layout { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(320px, 1fr); gap: 24px; align-items: start; }
    .desktop-side-column { position: sticky; top: 72px; margin-top: 0; }
}
@media (max-width: 1023px) { .desktop-side-column { margin-top: 24px; } }
@media (max-width: 767px) {
    .desktop-listing-layout { display: flex; flex-direction: column; }
    .desktop-main-column { display: flex; flex-direction: column; }
    .desktop-main-column > * { width: 100%; }
    .listing-main-header { order: 1; }
    .mobile-cta-wrap { order: 2; display: block; }
    .listing-description-wrap { order: 3; }
    #locationSection { order: 4; }
    .desktop-side-column { position: static; order: 5; margin-top: 0; }
    #additionalInfoSectionWrap { order: 6; }
    #organizerVenueSection { order: 7; }
    .event-main-poster-wrap { order: 7; }
    .claim-listing-section { order: 8; }
}

@media (prefers-color-scheme: dark) {
    /* Declares to the browser that this page has ITS OWN dark styling,
       so it stops silently auto-dark-styling native form controls
       (inputs, selects, scrollbars) with its own heuristics on top of
       ours — the root cause of the white-on-white #shareLinkInput bug
       fixed below. Scoped to this media query (not a page-wide :root
       rule) so it only takes effect exactly when our own dark rules do. */
    :root { color-scheme: dark; }
    body { background: #1a1a1a; color: #e5e7eb; }
    header { background: #2a2a2a !important; border-color: #3a3a3a; }
    .bg-white { background: #2a2a2a !important; }
    .bg-gray-50 { background: #1a1a1a !important; }
    .text-gray-900 { color: #e5e7eb !important; }
    .text-gray-700 { color: #b0b0b0 !important; }
    .text-gray-600 { color: #999 !important; }
    .border-gray-300 { border-color: #404040 !important; }
    .shadow-sm, .shadow, .shadow-lg, .card-shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.5) !important; }
    img { pointer-events: none; user-select: none; -webkit-user-drag: none; }
    .leaflet-container { background: #1a1a1a; }
    /* OpenStreetMap tiles are raster images — no CSS property changes
       their own pixel colors, so the .leaflet-container background
       above only shows through in gaps/while tiles are loading; the map
       itself stayed visually light-mode regardless. The standard fix
       for this is a CSS filter on just the tile pane: invert(1) flips
       every tile's colors (light roads/water become dark, dark text
       becomes light) and hue-rotate(180deg) corrects the resulting
       color-wheel shift so blues stay blue instead of becoming orange
       (invert alone would turn a blue lake orange). Scoped to
       .leaflet-tile-pane specifically, NOT the whole map/container —
       markers and popups live in separate Leaflet panes
       (.leaflet-marker-pane, .leaflet-popup-pane) that this filter
       never touches, so the custom pin icon and popup content keep
       their real colors instead of also being inverted. brightness/
       contrast tuned down slightly from the raw invert so the result
       reads as a dark map rather than a jarring photo-negative. */
    .leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.85) contrast(0.9); }
    .leaflet-popup-content-wrapper { background: #2a2a2a !important; color: #e5e5e5 !important; }
    .leaflet-popup-tip { background: #2a2a2a !important; }
    /* color explicitly set (not just background) — this element's
       light-mode rule sets color:#1f2937 directly on itself, so it does
       NOT fall back to inherit body's dark color:#e5e7eb the way plain
       text without its own color declaration would. Confirmed reported
       bug: description rendered as near-black text on a dark card. */
    .listing-description { background: #2a2a2a; border-color: #404040; color: #e5e7eb; }
    .listing-description.collapsed::after { background: linear-gradient(to bottom, rgba(42,42,42,0), rgba(42,42,42,1)); }
    .description-divider-line, .additional-info-table, .additional-info-row { border-color: #404040; }
    .description-divider { background: #2a2a2a !important; border-color: #404040 !important; }
    .additional-info-row:nth-child(even), .map-fallback, .read-more-btn, .desktop-contact-card, .event-datetime-block { background: #1f1f1f; color: #e5e7eb; border-color: #404040; }
    .entity-info-card-static { border-color: #404040; }
    /* Subcategory tag — exact match of listing-page.css's own dark-mode
       fix for the same component, kept in sync intentionally. */
    .subcategory-tag { background: #404040; color: #e5e5e5; }
    /* entity-info-card itself uses color:inherit (already covered by
       body/.bg-white above) — only its two children set an explicit
       color and need their own override. */
    .entity-info-card-name { color: #e5e7eb; }
    .entity-info-card-line { color: #9ca3af; }
    /* "Organized By" / "Venue" (and "Hosted At") section headings —
       .entity-info-section h3 sets color:#111827 directly in light
       mode, same non-inheriting situation as .listing-description
       above. Confirmed reported bug: these titles stayed near-black. */
    .entity-info-section h3 { color: #e5e7eb; }
    /* Hardcoded literal white background (not a Tailwind .bg-white
       utility, so the generic rule above doesn't reach it). */
    .event-price-chip { background: #1f1f1f; color: #7ab8f5; border-color: #045093; }
    /* These three sit inside .event-datetime-block, but each sets its
       own explicit color — CSS inheritance never overrides an element's
       own explicit color property, so the parent's dark override above
       doesn't reach them without these. */
    .event-date-label { color: #e5e7eb; }
    .event-time-label { color: #b0b0b0; }
    .event-recurrence-label { color: #9ca3af; }
    /* No existing dark-mode precedent for this badge anywhere else in
       the codebase (listings don't have a "past" concept) — designed
       to match the established pattern used for other muted/neutral
       surfaces in this same block. */
    .badge-past { background: #404040; color: #b0b0b0; }
    .entity-info-card-logo { background: #333; }
    .event-capacity-note { color: #9ca3af; }
    .add-to-calendar-menu { background: #2a2a2a; border-color: #404040; }
    .add-to-calendar-menu a { color: #e5e7eb; border-bottom-color: #404040; }
    .add-to-calendar-menu a:hover { background: #333; }
    /* Share modal's "Copy link" field. The modal panel itself picks up
       the generic ".bg-white { background:#2a2a2a !important }" rule
       above, but #shareLinkInput is a plain <input> with no bg-white
       class of its own, and browsers do not inherit form-control
       color/background from ancestors by default — instead, when the
       OS/browser is in dark mode and the page never declares
       color-scheme, Chromium-based browsers auto-invert native <input>
       TEXT color to a light shade while leaving the box's own
       (unset/white) background alone, producing literal white-on-white:
       confirmed reported bug ("background is white and text is
       white"). Setting both explicitly, rather than only one, is what
       actually fixes it — leaving background alone and only fixing
       color would still auto-invert differently across browsers. */
    #shareLinkInput { background: #1f1f1f; color: #e5e7eb; border-color: #404040; }
}

</style>
<script src="/js/translation-load.js"></script></head>
<body class="bg-gray-50">

<div data-partial="header"></div>

<section class="event-hero-banner" aria-hidden="true"></section>

<main class="max-w-6xl mx-auto px-4 py-8">
    <div class="bg-white rounded-lg p-6 card-shadow">
        <div class="desktop-listing-layout">
            <div class="desktop-main-column">
                <div class="listing-main-header">
                    <div class="flex items-center gap-2 mb-3 flex-wrap">
                        ${event.category ? `<span class="text-sm font-semibold px-3 py-1 rounded-full text-white category-pill" style="background-color:#045093;${subcategoryTagsHtml ? '' : 'cursor:default;'}" ${subcategoryTagsHtml ? 'onclick="toggleSubcategories()"' : ''}>${escapeHtml(event.category)}</span>` : ''}
                        ${subcategoryTagsHtml ? `<div class="subcategories-display" id="eventSubcategoriesDisplay">${subcategoryTagsHtml}</div>` : ''}
                        ${tierBadge}
                        ${timingBadge}
                    </div>
                    <h1 class="text-3xl font-bold text-gray-900 mb-2">${escapeHtml(decodedTitle)}</h1>
                    ${decodedTagline ? `<h2 class="text-gray-600 italic text-xl font-semibold mb-2">${escapeHtml(decodedTagline)}</h2>` : ''}
                </div>

                <div class="mobile-cta-wrap">
                    <div class="mobile-cta-bar">
                        ${ticketRsvpMobile}
                        ${buildCallCtaButton(event, true)}
                        ${buildEmailCtaButton(event, true)}
                        ${buildWebsiteCtaButton(event, true)}
                        ${directionsMobile}
                        ${addToCalendarMobile}
                    </div>
                </div>

                ${description ? `
                <div class="listing-description-wrap">
                    <div class="listing-description" id="eventDescription">${description}</div>
                    <div class="description-divider">
                        <span class="description-divider-line"></span>
                        <button type="button" id="eventReadMoreBtn" class="read-more-btn hidden">Read more</button>
                        <span class="description-divider-line"></span>
                    </div>
                </div>` : ''}

                ${organizerVenueSection}

                ${posterImage ? `
                <div class="event-main-poster-wrap">
                    <img src="${escapeHtml(posterImage)}" alt="${escapeHtml(decodedTitle)}">
                </div>` : ''}

                ${mapSection}
                ${additionalInfoSection}
                ${shareButtonsHidden}
            </div>

            <div class="desktop-side-column">
                <div class="desktop-contact-card">
                    ${dateTimeBlock}
                    ${priceRow.length ? `<div class="event-price-row">${priceRow.join('')}</div>${capacityNote}` : capacityNote}

                    ${hasSidebarContact ? `<div class="space-y-3 mb-6 mt-4">${addressSection}${phoneSection}${emailSection}${websiteSection}</div>` : ''}

                    <div class="flex flex-wrap gap-3 mb-2">
                        ${ticketRsvpDesktop}
                        ${buildCallCtaButton(event, false)}
                        ${buildEmailCtaButton(event, false)}
                        ${buildWebsiteCtaButton(event, false)}
                        ${directionsDesktop}
                        ${addToCalendarDesktop}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <section id="eventGallerySection" class="event-gallery-section hidden">
        <h2 class="text-xl font-bold text-gray-900 mb-3 mt-8">Gallery</h2>
        <div id="eventGalleryGrid" class="event-gallery-grid"></div>
        <div id="eventGalleryLoadMoreWrap" class="event-gallery-load-more-wrap"></div>
    </section>

    <div class="claim-listing-section">
        <div class="action-cta-row">
            <div class="action-cta-slot action-cta-slot-wide">
                <a href="/edit/event?id=${escapeHtml(event.id)}" class="action-cta-btn inline-flex items-center justify-center gap-2 px-6 py-3 text-white rounded-lg font-semibold hover-bounce" style="background-color:#045093;" target="_blank"><svg width="1em" height="1em" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true" style="display:block;flex-shrink:0;"><path d="m104.175 90.97-4.252 38.384 38.383-4.252L247.923 15.427V2.497L226.78-18.646h-12.93zm98.164-96.96 31.671 31.67" style="fill:none;stroke:#FFFFFF;stroke-width:12;stroke-linecap:round;stroke-linejoin:round;" transform="translate(-77.923 40.646)"/><path d="m195.656 33.271-52.882 52.882" style="fill:none;stroke:#FFFFFF;stroke-width:12;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:5;" transform="translate(-77.923 40.646)"/></svg><span>Suggest Edit</span></a>
            </div>
        </div>
    </div>

    <div class="event-share-bottom-section">
        <div class="action-cta-row">
            <div class="action-cta-slot action-cta-slot-wide">${shareTriggerButton}</div>
        </div>
    </div>
</main>

<!-- Gallery Lightbox -->
<div id="eventLightbox" class="hidden fixed inset-0 bg-black bg-opacity-90 items-center justify-center z-50" role="dialog" aria-modal="true" aria-label="Image viewer">
    <button id="eventLightboxClose" class="event-lightbox-close" aria-label="Close">&times;</button>
    <button id="eventLightboxShare" class="event-lightbox-share" aria-label="Share this image" title="Share">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342a3 3 0 100-2.684m0 2.684a3 3 0 100 2.684m0-2.684l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 5.658a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
    </button>
    <button id="eventLightboxPrev" class="event-lightbox-nav event-lightbox-prev" aria-label="Previous image">&#10094;</button>
    <img id="eventLightboxImage" class="event-lightbox-image" src="" alt="">
    <button id="eventLightboxNext" class="event-lightbox-nav event-lightbox-next" aria-label="Next image">&#10095;</button>
    <div id="eventLightboxCaption" class="event-lightbox-caption"></div>
</div>

<!-- Share Modal -->
<div id="shareModal" class="hidden fixed inset-0 z-50 items-center justify-center p-4" style="background:rgba(0,0,0,0.45);" onclick="closeShareModal()">
    <div class="bg-white rounded-2xl p-6 w-full max-w-md share-modal-panel" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-gray-900">Share</h3>
            <a onclick="closeShareModal()" style="cursor: pointer">✕</a>
        </div>
        <div id="shareModalButtons" class="flex flex-wrap gap-2 mb-3"></div>
        <div class="mb-4">
            <label id="shareCopyLabel" class="block text-sm font-medium text-gray-700 mb-2">Copy link</label>
            <div class="flex gap-2">
                <input id="shareLinkInput" readonly class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" value="${eventUrl}">
                <a id="copyShareLinkBtn" type="button" class="px-4 py-2 rounded-lg text-white font-semibold hover-bounce" style="background:#045093; cursor: pointer;" onclick="copyShareLink()">Copy Link</a>
            </div>
        </div>
        <label class="flex items-center gap-2 text-sm text-gray-700">
            <input id="shortenUrlToggle" type="checkbox">
            <span>Shorten URL</span>
        </label>
    </div>
</div>



<div data-partial="footer"></div>

<script>${currentEventDataScript}</script>

<script src="/js/pwa/directions.js"></script>
<script src="/js/pwa/storage.js"></script>
<script src="/js/pwa/offline-translation.js"></script>
<script src="/js/pwa/app.js"></script>
<script src="/js/pwa/dock.js"></script>
<script src="/js/pwa/starred.js"></script>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="/js/event-page.js"></script>
</body>
</html>`;
}

function renderErrorPage(title, message) {
    return `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} | The Greek Directory</title>
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
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <a href="/events">Browse all events</a>
    </div>
</body>
</html>`;
}
