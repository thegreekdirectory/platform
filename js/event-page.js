/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed
without written permission from The Greek Directory. Unauthorized use, copying, modification,
or distribution of this code can result in legal action to the fullest extent permitted by law.
*/

// js/event-page.js
//
// Client-side companion to functions/event/[slug].js, mirroring
// js/listing-page.js function-for-function wherever the behavior is the
// same: read-more toggle, share modal (open/close/native share/copy
// link/shorten-url toggle), and the map (same Leaflet setup, same
// teardrop pin SVG, same click-to-enable-scroll-zoom interaction,
// same Nominatim geocoding fallback for the rare case coordinates
// weren't stored). Reads window.currentEventData instead of
// window.currentListingData, and adds one thing listing pages don't
// need: a live status-badge updater, since "happening now" is a
// function of the current moment in a way a listing's weekly hours
// schedule already handles through its own separate system.

(function () {
    'use strict';

    // Strip ?shareimg=<n> from the visible URL as early as possible —
    // it exists only to tell the SERVER (functions/event/[[slug]].js)
    // which gallery image to use for og:image/twitter:image on THIS
    // load; once the page has rendered with those tags already baked
    // in, the param has done its job and leaving it in the address bar
    // would be confusing (a visitor copying the URL from their own
    // browser bar would unknowingly re-share a specific old photo
    // instead of the event itself). history.replaceState doesn't
    // require the DOM to be ready, so this runs immediately at script
    // execution rather than waiting for DOMContentLoaded — the goal is
    // to close the window where the param is visible in the address bar
    // as much as possible, not just "before the user notices."
    // replaceState (not pushState) since this is a correction to the
    // current entry, not a new navigation the back button should stop
    // at.
    if (new URLSearchParams(window.location.search).has('shareimg')) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState(null, '', cleanUrl);
    }

    // Gallery labels are free-text admin input rendered into HTML
    // attributes (alt, aria-label) below — this file had no local escaping
    // helper before the gallery feature was added, unlike every other file
    // in this system that touches admin-entered text. Added here rather
    // than left unescaped.
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Mirrors js/listing-page.js's toggleSubcategories() exactly, just
    // targeting this page's own element ID.
    function toggleSubcategories() {
        const el = document.getElementById('eventSubcategoriesDisplay');
        if (el) el.classList.toggle('active');
    }

    // Toggles the Add to Calendar dropdown (mobile and desktop each have
    // their own menu instance, addToCalendarMenuMobile/Desktop, since
    // both CTA rows render simultaneously and only one is visible at a
    // given viewport width — see buildAddToCalendarButton in
    // functions/event/[[slug]].js). Closes on an outside click, unlike
    // toggleSubcategories' plain toggle, since a dropdown menu that only
    // closes via its own trigger is a common, annoying UI papercut.
    function toggleAddToCalendarMenu(menuId) {
        const menu = document.getElementById(menuId);
        if (!menu) return;
        const isOpening = !menu.classList.contains('active');
        // Close the OTHER instance too (mobile/desktop) if it happened
        // to be open — shouldn't normally both be open at once given
        // only one CTA row is visible per viewport width, but a resize
        // between opening and clicking could leave a stale one open.
        document.querySelectorAll('.add-to-calendar-menu.active').forEach((el) => {
            if (el.id !== menuId) { el.classList.remove('active'); el.classList.remove('opens-up'); }
        });
        menu.classList.toggle('active', isOpening);

        // Smart flip: measure whether the menu actually fits between the
        // button and the viewport bottom BEFORE deciding which way it
        // opens. Done on every open (not just once) since the button's
        // position relative to the viewport can change between opens —
        // most relevantly, the desktop CTA card sits in a position:sticky
        // sidebar, so the same button can be near the top of the viewport
        // on one open and near the bottom on another, purely from page
        // scroll position, with nothing about the button itself changing.
        // offsetHeight is read with the menu already toggled to .active
        // above (display:block) — an element with display:none reports
        // offsetHeight 0, which would make this always think the menu
        // fits regardless of its real size.
        if (isOpening) {
            const wrap = menu.closest('.add-to-calendar-wrap');
            const anchor = wrap ? wrap.querySelector('button, a') : null;
            if (anchor) {
                const anchorRect = anchor.getBoundingClientRect();
                const spaceBelow = window.innerHeight - anchorRect.bottom;
                const menuHeight = menu.offsetHeight;
                menu.classList.toggle('opens-up', spaceBelow < menuHeight + 12);
            }
        } else {
            menu.classList.remove('opens-up');
        }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('.add-to-calendar-wrap')) return;
        document.querySelectorAll('.add-to-calendar-menu.active').forEach((el) => el.classList.remove('active'));
    });

    function initializeReadMore() {
        const description = document.getElementById('eventDescription');
        const readMoreButton = document.getElementById('eventReadMoreBtn');
        if (!description || !readMoreButton) return;
        if (description.scrollHeight <= 300) return;

        let expanded = false;
        description.classList.add('collapsed');
        readMoreButton.classList.remove('hidden');

        readMoreButton.addEventListener('click', () => {
            expanded = !expanded;
            description.classList.toggle('collapsed', !expanded);
            readMoreButton.textContent = expanded ? 'Read less' : 'Read more';
        });
    }

    // ---------------------------------------------------------------
    // Share modal — identical technique to js/listing-page.js:
    // openShareModal() copies the hidden #shareButtonsSection's button
    // row into #shareModalButtons rather than duplicating the icon
    // markup twice in the page.
    // ---------------------------------------------------------------

    function shareNative() {
        const data = window.currentEventData || {};
        if (navigator.share) {
            navigator.share({
                title: data.title + ' | The Greek Directory',
                text: 'Check out ' + data.title + ' on The Greek Directory!',
                url: window.location.href.split('?')[0],
            }).catch((err) => {
                if (err.name !== 'AbortError') console.log('Share failed:', err);
            });
        } else {
            navigator.clipboard.writeText(window.location.href).then(() => {
                flashCopyLabel('Link copied to clipboard!');
            }).catch(() => {
                console.log('Unable to share. Please copy the URL from your browser.');
            });
        }
    }

    // Gallery lightbox's own share button — same navigator.share/
    // clipboard-fallback pattern as shareNative() above, but the shared
    // URL carries ?shareimg=<1-indexed position> so the server
    // (functions/event/[[slug]].js) picks that specific gallery image
    // for the page's og:image/twitter:image instead of the event
    // poster — see that file's own comment on the shareImgIndex
    // parameter for the full validation rules this URL needs to satisfy
    // (1-indexed, integer, within gallery.length) to actually take
    // effect; an out-of-range or malformed value there just falls back
    // to the poster same as no param at all, so there's no failure mode
    // here worth guarding against client-side beyond what's already
    // naturally true (lightboxIndex is always a valid array index into
    // galleryImages by construction — see showLightboxImage()).
    function shareGalleryImage() {
        const data = window.currentEventData || {};
        const baseUrl = window.location.href.split('?')[0];
        const shareUrl = `${baseUrl}?shareimg=${lightboxIndex + 1}`;

        if (navigator.share) {
            navigator.share({
                title: data.title + ' | The Greek Directory',
                text: 'Check out this photo from ' + data.title + ' on The Greek Directory!',
                url: shareUrl,
            }).catch((err) => {
                if (err.name !== 'AbortError') console.log('Share failed:', err);
            });
        } else {
            navigator.clipboard.writeText(shareUrl).then(() => {
                flashCopyLabel('Link copied to clipboard!');
            }).catch(() => {
                console.log('Unable to share. Please copy the URL from your browser.');
            });
        }
    }

    function openShareModal() {
        const modal = document.getElementById('shareModal');
        const source = document.getElementById('shareButtonsSection');
        const target = document.getElementById('shareModalButtons');
        if (!modal || !source || !target) return;
        target.innerHTML = source.querySelector('.flex') ? source.querySelector('.flex').innerHTML : '';
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        requestAnimationFrame(() => modal.classList.add('active'));
    }

    function closeShareModal() {
        const modal = document.getElementById('shareModal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function flashCopyLabel(text) {
        const label = document.getElementById('shareCopyLabel');
        if (!label) return;
        const original = label.textContent;
        label.textContent = text;
        setTimeout(() => { label.textContent = original; }, 1800);
    }

    function copyShareLink() {
        const input = document.getElementById('shareLinkInput');
        if (!input) return;
        navigator.clipboard.writeText(input.value).then(() => {
            flashCopyLabel('Link copied to clipboard!');
        }).catch(() => {
            input.select();
            document.execCommand('copy');
            flashCopyLabel('Link copied to clipboard!');
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const shareModal = document.getElementById('shareModal');
        if (shareModal && shareModal.classList.contains('active')) closeShareModal();
    });

    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById('shareLinkInput');
        const toggle = document.getElementById('shortenUrlToggle');
        if (toggle && input) {
            toggle.addEventListener('change', (event) => {
                const data = window.currentEventData || {};
                input.value = event.target.checked
                    ? data.shortlink
                    : `https://thegreekdirectory.org/event/${data.slug}`;
            });
        }
    });

    // ---------------------------------------------------------------
    // Map — identical Leaflet setup, teardrop pin SVG, and
    // click-to-enable-scroll-zoom interaction as
    // js/listing-page.js's initializeMap(), copied verbatim (same
    // path data, same #045093 fill, same iconSize/anchor) so an event's
    // map pin is visually identical to a listing's, not just similar.
    // ---------------------------------------------------------------

    async function geocodeAddress(address) {
        try {
            const endpoint = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
            const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
            if (!response.ok) return null;
            const data = await response.json();
            if (!Array.isArray(data) || !data.length) return null;
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        } catch (_) {
            return null;
        }
    }

    async function initializeMap() {
        const mapFallback = document.getElementById('mapFallback');
        const showMapFallback = (message) => {
            if (mapFallback) {
                mapFallback.textContent = message || 'Map is currently unavailable for this event.';
                mapFallback.classList.add('visible');
            }
            const locationSection = document.getElementById('locationSection');
            if (locationSection) locationSection.classList.add('map-unavailable');
        };

        const locationSection = document.getElementById('locationSection');
        if (!locationSection) return;

        const data = window.currentEventData || {};
        if (!data.full_address || data.full_address === '') {
            locationSection.remove();
            return;
        }

        const mapElement = document.getElementById('eventMap');
        if (!mapElement) return;

        try {
            let lat;
            let lng;

            if (data.coordinates && data.coordinates.includes(',')) {
                const coords = data.coordinates.split(',');
                lat = parseFloat(coords[0].trim());
                lng = parseFloat(coords[1].trim());
            }

            if (Number.isNaN(lat) || Number.isNaN(lng)) {
                const geocoded = await geocodeAddress(data.full_address);
                if (!geocoded) {
                    showMapFallback('We could not load this map right now. Please use Directions for navigation.');
                    return;
                }
                [lat, lng] = geocoded;
            }

            if (typeof L === 'undefined') {
                setTimeout(initializeMap, 500);
                return;
            }

            const map = L.map('eventMap', {
                center: [lat, lng],
                zoom: 15,
                zoomControl: true,
                scrollWheelZoom: false,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '',
                maxZoom: 19,
            }).addTo(map);

            const eventMapPinIcon = L.divIcon({
                className: 'event-map-pin',
                html: '<div style="width:25px;height:41px;display:flex;align-items:flex-end;justify-content:center;"><svg xmlns="http://www.w3.org/2000/svg" width="800px" height="800px" viewBox="0 0 24 24" fill="none" style="width:25px;height:41px;display:block;"><path fill-rule="evenodd" clip-rule="evenodd" d="M11.3856 23.789L11.3831 23.7871L11.3769 23.7822L11.355 23.765C11.3362 23.7501 11.3091 23.7287 11.2742 23.7008C11.2046 23.6451 11.1039 23.5637 10.9767 23.4587C10.7224 23.2488 10.3615 22.944 9.92939 22.5599C9.06662 21.793 7.91329 20.7041 6.75671 19.419C5.60303 18.1371 4.42693 16.639 3.53467 15.0528C2.64762 13.4758 2 11.7393 2 10C2 7.34784 3.05357 4.8043 4.92893 2.92893C6.8043 1.05357 9.34784 0 12 0C14.6522 0 17.1957 1.05357 19.0711 2.92893C20.9464 4.8043 22 7.34784 22 10C22 11.7393 21.3524 13.4758 20.4653 15.0528C19.5731 16.639 18.397 18.1371 17.2433 19.419C16.0867 20.7041 14.9334 21.793 14.0706 22.5599C13.6385 22.944 13.2776 23.2488 13.0233 23.4587C12.8961 23.5637 12.7954 23.6451 12.7258 23.7008C12.6909 23.7287 12.6638 23.7501 12.645 23.765L12.6231 23.7822L12.6169 23.7871L12.615 23.7885C12.615 23.7885 12.6139 23.7894 12 23L12.6139 23.7894C12.2528 24.0702 11.7467 24.0699 11.3856 23.789ZM12 23L11.3856 23.789C11.3856 23.789 11.3861 23.7894 12 23ZM15 10C15 11.6569 13.6569 13 12 13C10.3431 13 9 11.6569 9 10C9 8.34315 10.3431 7 12 7C13.6569 7 15 8.34315 15 10Z" fill="#045093"/></svg></div>',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
            });
            L.marker([lat, lng], { icon: eventMapPinIcon }).addTo(map)
                .bindPopup(`<strong>${data.title}</strong><br>${data.full_address}`)
                .openPopup();

            setTimeout(() => { map.invalidateSize(); }, 250);

            mapElement.addEventListener('click', function () {
                this.classList.add('active');
                map.scrollWheelZoom.enable();
            });
            mapElement.addEventListener('mouseleave', function () {
                this.classList.remove('active');
                map.scrollWheelZoom.disable();
            });
        } catch (e) {
            console.error('Map error:', e);
            showMapFallback('Map failed to load. Please try again later.');
        }
    }

    // ---------------------------------------------------------------
    // Live status badge — the event-specific equivalent of listing
    // pages' open/closed hours ticker. A single start/end-datetime
    // comparison is simple enough not to need the shared server-time
    // module listings use for weekly-hours accuracy (window.TGDListingHours);
    // client-clock skew of a few minutes around an event boundary is
    // low-stakes here, so this reads the browser's own clock directly.
    // ---------------------------------------------------------------

    function updateLiveStatusBadge() {
        const badgeContainer = document.querySelector('.listing-main-header .flex.items-center.gap-2');
        const data = window.currentEventData;
        if (!badgeContainer || !data || !data.startAtMs) return;

        const now = Date.now();
        const existingLive = badgeContainer.querySelector('.badge-open');
        const existingPast = badgeContainer.querySelector('.badge-past');
        // Only toggle between "happening now" <-> nothing <-> "past" for
        // events that were rendered as plain "upcoming" (no cancelled/
        // postponed/sold-out badge already present) — a status set by
        // the admin always wins over a time-based recomputation.
        const hasOverrideStatus = badgeContainer.querySelector('.badge-closed, .badge-postponed, .badge-soldout');
        if (hasOverrideStatus) return;

        const isLive = now >= data.startAtMs && now <= data.endAtMs;
        const isPast = now > data.endAtMs;

        if (isLive && !existingLive) {
            badgeContainer.insertAdjacentHTML('beforeend', '<span class="badge badge-open">HAPPENING NOW</span>');
        } else if (!isLive && existingLive) {
            existingLive.remove();
        }
        if (isPast && !existingPast) {
            badgeContainer.insertAdjacentHTML('beforeend', '<span class="badge badge-past">PAST EVENT</span>');
        }
    }

    // ---------------------------------------------------------------
    // Organizer / host card: open-or-closed badge for the linked listing.
    // This page is cached, so the status can't be baked into the HTML. The
    // server leaves a hidden placeholder carrying the listing's weekly hours
    // and timezone; the status is worked out here for the current moment, in
    // the listing's own timezone, with the same shared hours module listing
    // pages use (js/listing-hours.js). If that module is unavailable, or the
    // listing has no hours at all, the badge stays hidden rather than guess.
    // ---------------------------------------------------------------

    function updateListingHoursBadges() {
        const hoursModule = window.TGDListingHours;
        document.querySelectorAll('[data-listing-hours-badge]').forEach((badge) => {
            let status = null;
            try {
                const hours = JSON.parse(badge.getAttribute('data-hours') || 'null');
                if (hoursModule && hours) {
                    const timezone = badge.getAttribute('data-timezone') || 'America/Chicago';
                    status = hoursModule.computeOpenStatus(hours, hoursModule.getListingLocalParts(new Date(), timezone));
                }
            } catch (e) {
                status = null;
            }
            if (!status) {
                badge.style.display = 'none';
                return;
            }
            const isClosed = status === 'CLOSED' || status === 'OPENING_SOON';
            badge.className = isClosed ? 'badge badge-closed' : 'badge badge-open';
            badge.textContent = isClosed ? 'CLOSED' : 'OPEN';
            badge.style.display = '';
        });
    }

    // ---------------------------------------------------------------
    // Gallery + lightbox — no listing-page equivalent (listings use a
    // full carousel gallery via a different, already-existing component;
    // this is new). Desktop shows every image at once; mobile paginates
    // 6-at-a-time via Load More / Load All, matching the same visual
    // language as the Read More button elsewhere on this page.
    // ---------------------------------------------------------------

    const GALLERY_PAGE_SIZE = 6;
    const LIGHTBOX_AUTO_ADVANCE_MS = 5000;

    let galleryImages = [];
    let galleryVisibleCount = 0;
    let galleryHasClickedLoadMore = false;
    let lightboxIndex = 0;
    let lightboxTimer = null;

    function isMobileViewport() {
        return window.matchMedia('(max-width: 767px)').matches;
    }

    function initializeGallery() {
        const data = window.currentEventData || {};
        galleryImages = Array.isArray(data.gallery) ? data.gallery : [];
        const section = document.getElementById('eventGallerySection');
        if (!section) return;

        if (!galleryImages.length) {
            section.classList.add('hidden');
            return;
        }
        section.classList.remove('hidden');

        // Desktop shows everything at once — pagination is explicitly a
        // mobile-only behavior. isMobileViewport() is read once here
        // rather than reactively on resize: an admin resizing their
        // browser mid-scroll re-paginating already-visible images out
        // from under them would be a worse experience than a viewport
        // check that's accurate at load time and stays fixed for the
        // rest of the visit.
        galleryVisibleCount = isMobileViewport() ? Math.min(GALLERY_PAGE_SIZE, galleryImages.length) : galleryImages.length;
        galleryHasClickedLoadMore = false;

        renderGalleryGrid();
        renderGalleryLoadMoreButtons();
    }

    function renderGalleryGrid() {
        const grid = document.getElementById('eventGalleryGrid');
        if (!grid) return;
        grid.innerHTML = galleryImages.slice(0, galleryVisibleCount).map((item, idx) => `
            <div class="event-gallery-thumb" data-gallery-index="${idx}" role="button" tabindex="0" aria-label="${escapeHtml(item.label || 'View image')}">
                <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label || '')}" loading="lazy">
            </div>`).join('');

        grid.querySelectorAll('.event-gallery-thumb').forEach((thumb) => {
            const openThis = () => openLightbox(parseInt(thumb.dataset.galleryIndex, 10));
            thumb.addEventListener('click', openThis);
            thumb.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openThis(); }
            });
        });
    }

    // Button visibility rule: whenever what's LEFT to load is 6 or fewer,
    // show only "Load All" (Load More would do the same thing at that
    // point, so showing both would be redundant/confusing). Otherwise,
    // show just "Load More" on the first reveal, and both buttons once
    // the admin has already clicked Load More at least once.
    function renderGalleryLoadMoreButtons() {
        const wrap = document.getElementById('eventGalleryLoadMoreWrap');
        if (!wrap) return;

        const remaining = galleryImages.length - galleryVisibleCount;
        if (remaining <= 0) {
            wrap.innerHTML = '';
            return;
        }

        const buttons = [];
        if (remaining <= GALLERY_PAGE_SIZE) {
            buttons.push('<button type="button" id="eventGalleryLoadAllBtn">Load All</button>');
        } else if (!galleryHasClickedLoadMore) {
            buttons.push('<button type="button" id="eventGalleryLoadMoreBtn">Load More</button>');
        } else {
            buttons.push('<button type="button" id="eventGalleryLoadMoreBtn">Load More</button>');
            buttons.push('<button type="button" id="eventGalleryLoadAllBtn">Load All</button>');
        }
        wrap.innerHTML = buttons.join('');

        document.getElementById('eventGalleryLoadMoreBtn')?.addEventListener('click', () => {
            galleryHasClickedLoadMore = true;
            galleryVisibleCount = Math.min(galleryVisibleCount + GALLERY_PAGE_SIZE, galleryImages.length);
            renderGalleryGrid();
            renderGalleryLoadMoreButtons();
        });
        document.getElementById('eventGalleryLoadAllBtn')?.addEventListener('click', () => {
            galleryVisibleCount = galleryImages.length;
            renderGalleryGrid();
            renderGalleryLoadMoreButtons();
        });
    }

    function openLightbox(index) {
        lightboxIndex = index;
        const lightbox = document.getElementById('eventLightbox');
        if (!lightbox) return;
        lightbox.classList.remove('hidden');
        lightbox.classList.add('active');
        showLightboxImage();
        startLightboxTimer();
    }

    function closeLightbox() {
        const lightbox = document.getElementById('eventLightbox');
        if (lightbox) {
            lightbox.classList.remove('active');
            lightbox.classList.add('hidden');
        }
        stopLightboxTimer();
    }

    function showLightboxImage() {
        const img = document.getElementById('eventLightboxImage');
        const caption = document.getElementById('eventLightboxCaption');
        const current = galleryImages[lightboxIndex];
        if (!current || !img) return;
        img.src = current.url;
        img.alt = current.label || '';
        if (caption) caption.textContent = current.label || '';
    }

    // Wraparound via modulo naturally makes a single-image gallery a
    // no-op on both directions (index stays 0 either way) without any
    // special-casing — (0 + 1) % 1 === 0 and (0 - 1 + 1) % 1 === 0.
    function lightboxNext(resetTimer) {
        lightboxIndex = (lightboxIndex + 1) % galleryImages.length;
        showLightboxImage();
        if (resetTimer !== false) startLightboxTimer();
    }

    function lightboxPrev(resetTimer) {
        lightboxIndex = (lightboxIndex - 1 + galleryImages.length) % galleryImages.length;
        showLightboxImage();
        if (resetTimer !== false) startLightboxTimer();
    }

    function startLightboxTimer() {
        stopLightboxTimer();
        lightboxTimer = setInterval(() => lightboxNext(false), LIGHTBOX_AUTO_ADVANCE_MS);
    }

    function stopLightboxTimer() {
        if (lightboxTimer) {
            clearInterval(lightboxTimer);
            lightboxTimer = null;
        }
    }

    function bindLightboxControls() {
        document.getElementById('eventLightboxClose')?.addEventListener('click', closeLightbox);
        document.getElementById('eventLightboxShare')?.addEventListener('click', shareGalleryImage);
        document.getElementById('eventLightboxNext')?.addEventListener('click', () => lightboxNext(true));
        document.getElementById('eventLightboxPrev')?.addEventListener('click', () => lightboxPrev(true));

        const lightbox = document.getElementById('eventLightbox');
        lightbox?.addEventListener('click', (e) => {
            if (e.target === lightbox) closeLightbox();
        });

        document.addEventListener('keydown', (e) => {
            const lb = document.getElementById('eventLightbox');
            if (!lb || !lb.classList.contains('active')) return;
            if (e.key === 'Escape') closeLightbox();
            else if (e.key === 'ArrowRight') lightboxNext(true);
            else if (e.key === 'ArrowLeft') lightboxPrev(true);
        });
    }

    // ---------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------

    window.openShareModal = openShareModal;
    window.closeShareModal = closeShareModal;
    window.shareNative = shareNative;
    window.copyShareLink = copyShareLink;
    window.toggleSubcategories = toggleSubcategories;
    window.toggleAddToCalendarMenu = toggleAddToCalendarMenu;

    document.addEventListener('DOMContentLoaded', () => {
        initializeReadMore();
        initializeGallery();
        bindLightboxControls();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(initializeMap, 1000));
    } else {
        setTimeout(initializeMap, 1000);
    }

    updateLiveStatusBadge();
    setInterval(updateLiveStatusBadge, 60000);

    updateListingHoursBadges();
    setInterval(updateListingHoursBadges, 60000);
})();
