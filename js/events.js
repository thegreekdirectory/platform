/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed
without written permission from The Greek Directory. Unauthorized use, copying, modification,
or distribution of this code can result in legal action to the fullest extent permitted by law.
*/

// js/events.js
//
// Powers events.html AND functions/events/_render-region-page.js's
// output (e.g. /events/chicago) — both mount the same #eventsApp-style
// DOM structure and load this one script, so every filter/sort/view
// interaction is implemented exactly once. See _render-region-page.js's
// own header comment for the reasoning behind sharing this file instead
// of forking a second copy for regional pages.
//
// Data loading is client-side, straight from Supabase using the public
// anon key + RLS (tgd_events_select — visible rows only), the same
// architecture js/listings.js already uses for the public directory.
// The Cloudflare Functions in functions/events/ own routing + the
// initial HTML shell + edge caching; this file owns everything that
// happens after the page has loaded in a real visitor's browser.

(function () {
    'use strict';

    // Same Supabase project + anon key already public in js/listings.js —
    // intentionally the identical constant, not a new credential.
    const SUPABASE_URL = 'https://luetekzqrrgdxtopzvqw.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZXRla3pxcnJnZHh0b3B6dnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc2NDcsImV4cCI6MjA4MzkyMzY0N30.TIrNG8VGumEJc_9JvNHW-Q-UWfUGpPxR0v8POjWZJYg';

    let eventsSupabase = null;
    let allEvents = [];           // full fetched set for the current query scope
    let filteredEvents = [];      // after search/category/date/free-only filters
    // Grid/List — the ONLY thing the wordless toggle controls, same as
    // Listings' own currentView. Map and Calendar are no longer "views"
    // that replace the grid/list: they are panels that open ABOVE it (see
    // activePanel below), so the grid/list is always underneath either way
    // — per "Calendar/map should appear like the map in listings, with
    // either grid or list view events below."
    let currentView = readStoredLayout();
    // Which panel is open above the grid/list: null | 'map' | 'calendar'.
    // Mutually exclusive — both open in the same slot, the way Listings
    // has one #mapContainer in that slot.
    let activePanel = null;
    let currentSort = 'soonest';
    let calendarCursor = new Date();  // month currently shown in the calendar panel
    let map = null;
    let markerClusterGroup = null;
    let loadMoreOffset = 0;
    const PAGE_SIZE = 24;
    // True after a failed events fetch. applyFiltersAndRender() runs right
    // after loadEvents() even on failure and would otherwise replace the
    // error text with the generic "no events" one.
    let loadFailed = false;
    const EVENTS_LOAD_ERROR_MESSAGE = 'We could not load events right now. Please try again shortly.';
    const EMPTY_STATE_DEFAULT_MESSAGE = 'Try adjusting your filters or check back soon.';

    // Split View state — mirrors js/listings.js's own module-level
    // variables of the same names/purpose (splitViewActive, userLocation,
    // estimatedUserLocation, locationButtonActive, mapMoved,
    // selectedSplitEventId — the events-domain equivalent of Listings'
    // selectedSplitListingId). window.splitEventsMap /
    // window.splitEventsMarkerClusterGroup are intentionally NOT
    // pre-declared here, same as Listings' own window.splitMap /
    // window.splitMarkerClusterGroup — both are created lazily, once,
    // the first time initSplitEventsMap() runs, not before.
    let splitViewActive = false;
    let userLocation = null;
    let estimatedUserLocation = null;
    let locationButtonActive = false;
    let mapMoved = false;
    let selectedSplitEventId = null;
    let userLocationMarker = null;
    let splitUserLocationMarker = null;

    // Whether the ONE filter panel is showing — hidden by default, like
    // Listings' filterPosition === 'top' (a "Filters" button shows when
    // hidden; the sidebar's own swap control hides it again). A single
    // flag no matter which home the panel currently has (sidebar vs.
    // top-bar) — see updateFilterPanelPosition().
    let filtersPanelVisible = false;

    // Starred events — the same cookie-backed system as js/listings.js's
    // starredListings, under its OWN cookie/sync names: listings and
    // events both use UUID ids, but they are different tables, so one
    // shared cookie would let an event star light up an unrelated listing
    // (and vice versa).
    const STARRED_EVENTS_COOKIE = 'starredEvents';
    const STARRED_EVENTS_SYNC_KEY = 'tgd_starred_events_sync';
    let starredEvents = [];
    let viewingStarredOnly = false;

    // Regional-page mode — set as a global by _render-region-page.js
    // before this script loads. See that file's header comment.
    const REGION = window.TGD_EVENTS_REGION || null;

    const state = {
        search: '',
        categories: new Set(),
        dateRange: 'all',
        customDateStart: '',
        customDateEnd: '',
        freeOnly: false,
        hideUnavailable: false,
    };

    // -------------------------------------------------------------------
    // Init
    // -------------------------------------------------------------------

    document.addEventListener('DOMContentLoaded', init);

    // -------------------------------------------------------------------
    // Query parameters — filters, view, and sort all round-trip through
    // the URL so a filtered view can be refreshed, shared, or reached via
    // the back button. Uses replaceState (not pushState): every filter
    // tweak replacing the current history entry, rather than creating a
    // new one per click, keeps the back button meaningful (leaves the
    // page, doesn't step through 15 individual filter toggles first).
    // -------------------------------------------------------------------

    const QUERY_PARAM_KEYS = ['q', 'cat', 'when', 'from', 'to', 'free', 'avail', 'view', 'layout', 'sort', 'starred'];

    function syncQueryParams() {
        const params = new URLSearchParams(window.location.search);
        QUERY_PARAM_KEYS.forEach((key) => params.delete(key));

        if (state.search) params.set('q', state.search);
        if (state.categories.size > 0) params.set('cat', [...state.categories].join(','));
        if (state.dateRange !== 'all') params.set('when', state.dateRange);
        if (state.dateRange === 'custom' && state.customDateStart) params.set('from', state.customDateStart);
        if (state.dateRange === 'custom' && state.customDateEnd) params.set('to', state.customDateEnd);
        if (state.freeOnly) params.set('free', '1');
        if (state.hideUnavailable) params.set('avail', '1');
        // ?view= keeps its original meaning for old links: the open panel
        // when there is one (map/calendar), otherwise the layout when it
        // isn't the default. ?layout= only exists to remember a List
        // layout ALONGSIDE an open panel, which ?view= can't also carry.
        if (activePanel) {
            params.set('view', activePanel);
            if (currentView !== 'grid') params.set('layout', currentView);
        } else if (currentView !== 'grid') {
            params.set('view', currentView);
        }
        if (currentSort !== 'soonest') params.set('sort', currentSort);
        if (viewingStarredOnly) params.set('starred', '1');

        const query = params.toString();
        const newUrl = window.location.pathname + (query ? `?${query}` : '');
        history.replaceState(null, '', newUrl);
    }

    // Restores state{}/currentView/currentSort from the URL. Returns the
    // restored category list separately (rather than touching DOM
    // buttons directly) because the category filter buttons don't exist
    // yet at this point — renderCategoryFilters() builds them
    // asynchronously later in init(), after an RPC round-trip.
    function readQueryParamsIntoState() {
        const params = new URLSearchParams(window.location.search);
        const restoredCategories = params.get('cat') ? params.get('cat').split(',').filter(Boolean) : [];

        state.search = params.get('q') || '';
        state.categories = new Set(restoredCategories);
        state.dateRange = params.get('when') || 'all';
        state.customDateStart = params.get('from') || '';
        state.customDateEnd = params.get('to') || '';
        state.freeOnly = params.get('free') === '1';
        state.hideUnavailable = params.get('avail') === '1';

        const view = params.get('view');
        const layout = params.get('layout');
        if (view === 'grid' || view === 'list') currentView = view;
        else if (view === 'map' || view === 'calendar') activePanel = view;
        if (layout === 'grid' || layout === 'list') currentView = layout;

        // Tentative: init() clears this again if nothing is actually
        // starred (see the same step in js/listings.js's
        // loadFiltersFromURL(), which passes suppressEmptyAlert).
        viewingStarredOnly = params.get('starred') === '1';

        const sort = params.get('sort');
        if (sort && ['soonest', 'az', 'furthest'].includes(sort)) currentSort = sort;

        return restoredCategories;
    }

    // Applies everything restoreable immediately (search box, date
    // toggle, custom date inputs, checkboxes, sort select) — anything
    // that already exists in the DOM at init() time. Category buttons
    // are handled separately in renderCategoryFilters() itself.
    function restoreDomControlsFromState() {
        const searchInput = document.getElementById('eventSearchInput');
        if (searchInput && state.search) searchInput.value = state.search;

        document.querySelectorAll('#eventDateFilters .toggle-option').forEach((b) => {
            b.classList.toggle('active', b.dataset.range === state.dateRange);
        });
        if (state.dateRange === 'custom') {
            document.getElementById('eventCustomDateRow')?.classList.remove('hidden');
            const startInput = document.getElementById('eventCustomDateStart');
            const endInput = document.getElementById('eventCustomDateEnd');
            if (startInput) startInput.value = state.customDateStart;
            if (endInput) endInput.value = state.customDateEnd;
        }

        const freeCheckbox = document.getElementById('eventFreeOnlyFilter');
        if (freeCheckbox) freeCheckbox.checked = state.freeOnly;
        const hideUnavailableCheckbox = document.getElementById('eventHideUnavailableFilter');
        if (hideUnavailableCheckbox) hideUnavailableCheckbox.checked = state.hideUnavailable;

        const sortSelect = document.getElementById('eventSortSelect');
        if (sortSelect) sortSelect.value = currentSort;
    }

    async function init() {
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            console.error('Supabase client library not loaded.');
            return;
        }
        eventsSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        if (REGION) {
            applyRegionalPageMode();
        }

        const restoredCategories = readQueryParamsIntoState();
        restoreDomControlsFromState();

        // Starred ids must be known BEFORE the first render so cards come
        // out already starred. ?starred=1 with nothing starred (cookie
        // cleared, or a shared link) falls back to the full list rather
        // than an empty "starred" page.
        loadStarredEvents();
        if (viewingStarredOnly && starredEvents.length === 0) viewingStarredOnly = false;

        bindToolbarEvents();
        bindFilterPanelEvents();
        bindStarredEventSync();
        applyLayoutAndPanelState();

        await loadEvents();
        renderCategoryFilters(restoredCategories);
        applyFiltersAndRender();

        // Same sequence as js/listings.js's own DOMContentLoaded handler:
        // the IP estimate always runs (no permission needed for it), and
        // separately, precise browser geolocation only auto-requests if
        // the shared tgd_location_permission cookie (or the browser's own
        // Permissions API) says it was already granted — never asks for
        // permission out of the blue on a first-ever visit.
        estimateEventsLocationByIP();

        let shouldAutoRequestPreciseLocation = getStoredLocationPermission() === true;
        const browserPermission = await syncEventsLocationPermissionFromBrowser();
        if (!shouldAutoRequestPreciseLocation) {
            shouldAutoRequestPreciseLocation = browserPermission === true || getStoredLocationPermission() === true;
        }
        if (shouldAutoRequestPreciseLocation) {
            requestEventsPreciseLocation();
        }
    }

    // Hides the location-search filter (redundant on a page already
    // confined to one region's cities) and swaps in region-specific
    // empty-state / results-count copy.
    function applyRegionalPageMode() {
        document.querySelectorAll('.event-regional-hide').forEach((el) => el.classList.add('hidden'));
    }

    // -------------------------------------------------------------------
    // Data loading
    // -------------------------------------------------------------------

    async function loadEvents() {
        try {
            let data, error;
            if (REGION) {
                ({ data, error } = await eventsSupabase.rpc('get_events_by_cities', {
                    p_cities: REGION.cities,
                    p_state: REGION.state,
                    limit_count: 500,
                    offset_count: 0,
                }));
            } else {
                ({ data, error } = await eventsSupabase.rpc('get_upcoming_events', { limit_count: 500 }));
            }

            if (error) throw error;
            allEvents = Array.isArray(data) ? data : [];
            loadFailed = false;
        } catch (err) {
            console.error('Failed to load events:', err);
            allEvents = [];
            loadFailed = true;
            showEmptyState(true, EVENTS_LOAD_ERROR_MESSAGE);
        }
    }

    // -------------------------------------------------------------------
    // Controls: filters, grid/list toggle, Map/Calendar panel buttons,
    // starred toggle, sort (the markup lives in _app-shell.js)
    // -------------------------------------------------------------------

    function bindToolbarEvents() {
        // Filters: the mobile controls row's button toggles, the desktop
        // button beside the results count only ever shows the (hidden)
        // sidebar, and the panel's own close (✕, top-bar home) / swap
        // (⇄, sidebar home) controls hide it. All of them go through one
        // setFiltersVisible() since a single flag drives .hidden no
        // matter which home the panel is in right now (see
        // updateFilterPanelPosition()).
        document.getElementById('eventFilterBtn')?.addEventListener('click', () => setFiltersVisible(!filtersPanelVisible));
        document.getElementById('eventDesktopFilterToggleBtn')?.addEventListener('click', () => setFiltersVisible(true));
        document.getElementById('eventCloseFilterBtn')?.addEventListener('click', () => setFiltersVisible(false));
        document.getElementById('eventHideFiltersBtn')?.addEventListener('click', () => setFiltersVisible(false));
        document.getElementById('eventClearFiltersBtn')?.addEventListener('click', clearAllFilters);
        document.getElementById('eventClearFiltersBtn2')?.addEventListener('click', clearAllFilters);

        // Grid/List — each button exists twice (mobile controls row +
        // desktop controls row), kept in sync by syncControlStates(),
        // exactly like Listings' gridViewBtn/gridViewBtn2 pairs.
        ['eventGridViewBtn', 'eventGridViewBtn2'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => setLayout('grid'));
        });
        ['eventListViewBtn', 'eventListViewBtn2'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => setLayout('list'));
        });

        // Map / Calendar panels.
        ['eventMapBtn', 'eventMapBtnDesktop'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => togglePanel('map'));
        });
        ['eventCalendarBtn', 'eventCalendarBtnDesktop'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => togglePanel('calendar'));
        });

        // Starred-events toggle (mobile + desktop copies).
        ['eventStarToggleBtnMobile', 'eventStarToggleBtnDesktop'].forEach((id) => {
            document.getElementById(id)?.addEventListener('click', () => toggleStarredEventsView());
        });

        // The panel changes homes at the 1024px breakpoint (sidebar at
        // >=1024px, top-bar below), so crossing it live — rotating a
        // tablet, resizing a desktop window — has to re-place it.
        const desktopQuery = window.matchMedia('(min-width: 1024px)');
        if (desktopQuery.addEventListener) desktopQuery.addEventListener('change', () => updateFilterPanelPosition());
        else if (desktopQuery.addListener) desktopQuery.addListener(() => updateFilterPanelPosition());

        // Map controls — same three buttons/behaviors as
        // js/listings.js's own locateBtn/resetMapBtn/splitViewBtn.
        document.getElementById('eventLocateBtn')?.addEventListener('click', requestEventsPreciseLocation);
        document.getElementById('eventResetMapBtn')?.addEventListener('click', () => {
            if (map) map.setView([41.8781, -87.6298], 9);
        });
        document.getElementById('eventSplitViewBtn')?.addEventListener('click', toggleSplitEventsView);

        const sortSelect = document.getElementById('eventSortSelect');
        sortSelect?.addEventListener('change', () => {
            currentSort = sortSelect.value;
            applyFiltersAndRender();
        });

        const searchInput = document.getElementById('eventSearchInput');
        let searchDebounce;
        searchInput?.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                state.search = searchInput.value.trim().toLowerCase();
                applyFiltersAndRender();
            }, 200);
        });

        document.getElementById('eventLoadMoreBtn')?.addEventListener('click', () => renderGrid({ append: true }));
        document.getElementById('eventListLoadMoreBtn')?.addEventListener('click', () => renderList({ append: true }));

        document.getElementById('calendarPrevBtn')?.addEventListener('click', () => {
            calendarCursor.setMonth(calendarCursor.getMonth() - 1);
            renderCalendar();
        });
        document.getElementById('calendarNextBtn')?.addEventListener('click', () => {
            calendarCursor.setMonth(calendarCursor.getMonth() + 1);
            renderCalendar();
        });
    }

    function bindFilterPanelEvents() {
        document.getElementById('eventFreeOnlyFilter')?.addEventListener('change', (e) => {
            state.freeOnly = e.target.checked;
            applyFiltersAndRender();
        });

        document.getElementById('eventHideUnavailableFilter')?.addEventListener('change', (e) => {
            state.hideUnavailable = e.target.checked;
            applyFiltersAndRender();
        });

        document.querySelectorAll('#eventDateFilters .toggle-option').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#eventDateFilters .toggle-option').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                state.dateRange = btn.dataset.range;
                document.getElementById('eventCustomDateRow')?.classList.toggle('hidden', btn.dataset.range !== 'custom');
                applyFiltersAndRender();
            });
        });

        const customDateStart = document.getElementById('eventCustomDateStart');
        const customDateEnd = document.getElementById('eventCustomDateEnd');
        customDateStart?.addEventListener('change', () => {
            state.customDateStart = customDateStart.value;
            applyFiltersAndRender();
        });
        customDateEnd?.addEventListener('change', () => {
            state.customDateEnd = customDateEnd.value;
            applyFiltersAndRender();
        });

        const locationInput = document.getElementById('eventLocationSearch');
        let locDebounce;
        locationInput?.addEventListener('input', () => {
            clearTimeout(locDebounce);
            locDebounce = setTimeout(async () => {
                const query = locationInput.value.trim();
                if (!query) {
                    // Cleared the field — reload the original unfiltered-by-location
                    // set rather than leaving whatever the last city search left behind.
                    await loadEvents();
                    applyFiltersAndRender();
                    return;
                }
                const { data, error } = await eventsSupabase.rpc('get_events_by_location', {
                    p_city: query,
                    limit_count: 200,
                    offset_count: 0,
                });
                if (!error && Array.isArray(data)) {
                    allEvents = data;
                    loadFailed = false;
                    applyFiltersAndRender();
                }
            }, 300);
        });
    }

    function clearAllFilters() {
        state.search = '';
        state.categories.clear();
        state.dateRange = 'all';
        state.customDateStart = '';
        state.customDateEnd = '';
        state.freeOnly = false;
        state.hideUnavailable = false;

        const searchInput = document.getElementById('eventSearchInput');
        if (searchInput) searchInput.value = '';
        const freeCheckbox = document.getElementById('eventFreeOnlyFilter');
        if (freeCheckbox) freeCheckbox.checked = false;
        const hideUnavailableCheckbox = document.getElementById('eventHideUnavailableFilter');
        if (hideUnavailableCheckbox) hideUnavailableCheckbox.checked = false;
        const customStartInput = document.getElementById('eventCustomDateStart');
        if (customStartInput) customStartInput.value = '';
        const customEndInput = document.getElementById('eventCustomDateEnd');
        if (customEndInput) customEndInput.value = '';
        document.getElementById('eventCustomDateRow')?.classList.add('hidden');
        document.querySelectorAll('#eventDateFilters .toggle-option').forEach((b) => b.classList.remove('active'));
        document.querySelector('#eventDateFilters .toggle-option[data-range="all"]')?.classList.add('active');
        document.querySelectorAll('#eventCategoryFilters .toggle-option').forEach((b) => b.classList.remove('active'));

        applyFiltersAndRender();
    }

    // -------------------------------------------------------------------
    // Subscribe menu (toolbar "Subscribe" button -> calendar feed)
    // -------------------------------------------------------------------

    const FEED_URL = 'https://thegreekdirectory.org/events/feed.ics';

    function toggleFeedSubscribeMenu() {
        const menu = document.getElementById('feedSubscribeMenu');
        if (!menu) return;
        const isOpening = !menu.classList.contains('active');
        menu.classList.toggle('active', isOpening);

        // Viewport-aware open direction — measured fresh on every open
        // (not cached), since the button's position relative to the
        // viewport can change between opens from page scroll or a
        // resize, same reasoning as js/event-page.js's own
        // toggleAddToCalendarMenu(). offsetWidth/offsetHeight are read
        // AFTER toggling .active above (display:block) — an element
        // with display:none reports 0 for both, which would make this
        // always think the menu fits regardless of its real size.
        if (isOpening) {
            const wrap = menu.closest('.add-to-calendar-wrap');
            const anchor = wrap ? wrap.querySelector('button') : null;
            if (anchor) {
                const anchorRect = anchor.getBoundingClientRect();
                const menuWidth = menu.offsetWidth;
                const menuHeight = menu.offsetHeight;

                // Horizontal: the menu's default right:0 anchors its
                // RIGHT edge to the button's right edge and extends
                // LEFTWARD — so the projected left edge is the button's
                // own right edge minus the menu's width. If that would
                // land left of the viewport (x < 0), flip to opens-left
                // (anchor the button's LEFT edge instead, extending
                // rightward).
                const projectedLeftEdge = anchorRect.right - menuWidth;
                menu.classList.toggle('opens-left', projectedLeftEdge < 0);

                // Vertical: same up/down space check as the individual
                // event page's version.
                const spaceBelow = window.innerHeight - anchorRect.bottom;
                menu.classList.toggle('opens-up', spaceBelow < menuHeight + 12);
            }
        } else {
            menu.classList.remove('opens-left');
            menu.classList.remove('opens-up');
        }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('.add-to-calendar-wrap')) return;
        document.getElementById('feedSubscribeMenu')?.classList.remove('active');
    });

    function copyFeedLink() {
        const button = document.querySelector('#feedSubscribeMenu button');
        const flash = (text) => {
            if (!button) return;
            const original = button.textContent;
            button.textContent = text;
            setTimeout(() => { button.textContent = original; }, 1800);
        };
        navigator.clipboard.writeText(FEED_URL).then(() => {
            flash('Copied!');
        }).catch(() => {
            // Fallback for older browsers / non-HTTPS contexts, matching
            // js/event-page.js's own copyShareLink pattern — there's no
            // visible <input> here to .select(), so a temporary
            // off-screen one is created just for the copy operation.
            const tempInput = document.createElement('input');
            tempInput.value = FEED_URL;
            tempInput.style.position = 'fixed';
            tempInput.style.left = '-9999px';
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            flash('Copied!');
        });
    }

    // -------------------------------------------------------------------
    // Layout (grid/list) + panels (map/calendar) + filter panel
    //
    // Modeled on js/listings.js, which has exactly this shape: setView()
    // for the wordless grid/list toggle, toggleMap() for the one panel
    // that opens above the results, toggleFilters() / checkFilterPosition()
    // for the filters. Events has TWO panels (Map and Calendar) where
    // Listings has one, so the panel is a small state machine
    // (activePanel) rather than a boolean.
    // -------------------------------------------------------------------

    const LAYOUT_CONTAINERS = {
        grid: 'eventGridView',
        list: 'eventListView',
    };

    const PANEL_CONTAINERS = {
        map: 'eventMapContainer',
        calendar: 'eventCalendarContainer',
    };

    // 'grid' | 'list' from localStorage. Anything else — including the
    // 'calendar' / 'map' values the earlier four-button toggle also saved
    // under this same key — falls back to grid: those two are panels now,
    // not layouts, and must never be restored as one. Wrapped in
    // try/catch because storage access can throw (private modes, blocked
    // storage) and this runs while the script is still initialising.
    function readStoredLayout() {
        try {
            return localStorage.getItem('tgd_events_layout') === 'list' ? 'list' : 'grid';
        } catch (e) {
            return 'grid';
        }
    }

    // Same 1024px breakpoint as Tailwind's lg: and css/listings.css's
    // desktop block, i.e. where Listings' own mobile controls row hands
    // over to its desktop controls row.
    function isDesktopWidth() {
        return window.matchMedia('(min-width: 1024px)').matches;
    }

    // Grid <-> List. Only touches the layout; whatever panel is open stays
    // open above it.
    function setLayout(view, opts) {
        opts = opts || {};
        currentView = view === 'list' ? 'list' : 'grid';
        if (!opts.skipSave) {
            try { localStorage.setItem('tgd_events_layout', currentView); } catch (e) { /* storage unavailable — layout simply isn't remembered */ }
        }

        applyLayoutState();
        if (currentView === 'grid') renderGrid();
        else renderList();

        if (!opts.skipSave) syncQueryParams();
    }

    function applyLayoutState() {
        Object.entries(LAYOUT_CONTAINERS).forEach(([key, id]) => {
            document.getElementById(id)?.classList.toggle('hidden', key !== currentView);
        });
        syncControlStates();
    }

    // Map / Calendar buttons: press once to open, press again to close.
    // Pressing the OTHER panel's button switches straight over.
    function togglePanel(panel) {
        setActivePanel(activePanel === panel ? null : panel);
    }

    function setActivePanel(panel, opts) {
        opts = opts || {};
        if (panel !== 'map' && panel !== 'calendar') panel = null;

        // Split View is a sub-mode of the Map panel (its toggle lives in
        // the map's own controls, same as Listings' splitViewBtn).
        // Anything that leaves the map — closing it, or switching to
        // Calendar — has to close Split View first: Split View hides the
        // grid/list layout and the map panel's container, and nothing
        // below knows how to bring them back on its own. Same safeguard as
        // js/listings.js's toggleMap() calling toggleSplitView() when
        // splitViewActive is true. Re-selecting 'map' while Split View is
        // already open is left alone — it shouldn't kick the visitor out.
        if (splitViewActive && panel !== 'map') setSplitView(false, { restoreMapPanel: false });

        activePanel = panel;
        Object.entries(PANEL_CONTAINERS).forEach(([key, id]) => {
            const el = document.getElementById(id);
            if (!el) return;
            // The map's own container stays hidden while Split View is
            // showing its own map instead.
            const show = key === panel && !(key === 'map' && splitViewActive);
            el.classList.toggle('hidden', !show);
        });

        // Below 1024px the filter panel's home (the top-bar slot) is the
        // very same strip Map/Calendar open into, so the two can't both
        // be open — Listings' toggleFilters() closes the map for the same
        // reason (and toggleMap() closes the filter panel). At >=1024px
        // the panel is a sidebar BESIDE the results, and during Split View
        // it sits above the split container, so neither collides.
        if (panel && !isDesktopWidth() && !splitViewActive && filtersPanelVisible) {
            filtersPanelVisible = false;
        }
        updateFilterPanelPosition();

        // Rendered only after the container is un-hidden above: Leaflet
        // must initialise against a visible, sized element.
        if (panel === 'map' && !splitViewActive) renderMap();
        if (panel === 'calendar') renderCalendar();

        if (!opts.skipSave) syncQueryParams();
    }

    // First paint: put every container/button into the state the URL and
    // localStorage asked for. Nothing is rendered here (no events are
    // loaded yet) — init()'s applyFiltersAndRender() renders layout and
    // open panel once the data arrives.
    function applyLayoutAndPanelState() {
        applyLayoutState();
        setActivePanel(activePanel, { skipSave: true });
    }

    // Moves the single #eventFilterPanel between its two DOM slots and
    // owns everything that follows from where it is and whether it's
    // showing. See _app-shell.js's FILTER PANEL comment for why this is
    // ONE panel moved between slots rather than two synced copies.
    //
    //   >=1024px, not Split View -> #eventDesktopFiltersSlot: the left
    //     sidebar beside the results (Listings' #desktopFilterPanel).
    //   otherwise                -> #eventFilterPanelOverlaySlot: the
    //     full-width top-bar strip (Listings' #filterPanel), which is the
    //     only place that still exists while Split View has hidden the
    //     whole grid/list layout (sidebar slot included).
    //
    // Re-parenting (not a CSS-only flip) is what makes one panel work for
    // both homes; appendChild on a node already in the target slot is
    // skipped so a no-op call never detaches the panel (which would lose
    // scroll position and input focus).
    //
    // Also OWNS the panel's .hidden class on every call, driven by the ONE
    // filtersPanelVisible flag — never trusting .hidden state left over
    // from a different code path. (The earlier version tracked visibility
    // separately per view, which is what produced the reported "filters
    // disappear but the big space won't go away" bug.) One flag also means
    // "filters stay as you left them" when switching layout or panel.
    function updateFilterPanelPosition() {
        const panel = document.getElementById('eventFilterPanel');
        const sidebarSlot = document.getElementById('eventDesktopFiltersSlot');
        const overlaySlot = document.getElementById('eventFilterPanelOverlaySlot');
        if (!panel || !sidebarSlot || !overlaySlot) return;

        const inSidebar = isDesktopWidth() && !splitViewActive;
        const targetSlot = inSidebar ? sidebarSlot : overlaySlot;
        if (panel.parentElement !== targetSlot) {
            targetSlot.appendChild(panel);
        }

        panel.classList.toggle('hidden', !filtersPanelVisible);

        // The sidebar column only exists while it actually holds a visible
        // panel — an empty-but-present 300px column was the old "big space
        // that won't go away". These three classes are exactly what
        // Listings' checkFilterPosition() toggles for its own sidebar:
        // .hidden on the column, .with-left-filters on the layout (turns
        // on the flex row in css/listings.css), and the 2-column result
        // grid that fits the narrower content column.
        const sidebarShowing = inSidebar && filtersPanelVisible;
        sidebarSlot.classList.toggle('hidden', !sidebarShowing);
        document.getElementById('eventDesktopLayout')?.classList.toggle('with-left-filters', sidebarShowing);
        document.getElementById('eventsContainer')?.classList.toggle('listings-2-col', sidebarShowing);
        // css/events.css hides the desktop Filters button while this is set.
        document.body.classList.toggle('events-sidebar-mode', sidebarShowing);

        syncControlStates();
    }

    function setFiltersVisible(visible) {
        // Below 1024px opening the filters closes Map/Calendar — they
        // share the strip (see setActivePanel()). Not during Split View,
        // where the panel sits above the split container.
        if (visible && !isDesktopWidth() && !splitViewActive && activePanel) {
            setActivePanel(null);
        }
        filtersPanelVisible = visible;
        updateFilterPanelPosition();
    }

    // Reflects state onto every control that shows it. Each toggle exists
    // twice (mobile row + desktop row), so this is the one place that keeps
    // the pairs identical, the way Listings' setView() and
    // syncStarredButtonsVisualState() do for theirs.
    function syncControlStates() {
        [['eventGridViewBtn', 'eventGridViewBtn2', 'grid'], ['eventListViewBtn', 'eventListViewBtn2', 'list']].forEach(([mobileId, desktopId, view]) => {
            const on = currentView === view;
            [mobileId, desktopId].forEach((id) => {
                const btn = document.getElementById(id);
                if (!btn) return;
                // Same className strings js/listings.js's setView() writes.
                btn.className = on ? 'p-2 rounded bg-white shadow-sm active' : 'p-2 rounded';
                btn.setAttribute('aria-pressed', String(on));
            });
        });

        [['map', 'eventMapBtn', 'eventMapBtnDesktop'], ['calendar', 'eventCalendarBtn', 'eventCalendarBtnDesktop']].forEach(([panel, mobileId, desktopId]) => {
            const on = activePanel === panel;
            [mobileId, desktopId].forEach((id) => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.classList.toggle('active', on);
                btn.setAttribute('aria-pressed', String(on));
            });
        });

        ['eventStarToggleBtnMobile', 'eventStarToggleBtnDesktop'].forEach((id) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.classList.toggle('starred', viewingStarredOnly);
            btn.setAttribute('aria-pressed', String(viewingStarredOnly));
        });

        document.getElementById('eventFilterBtn')?.setAttribute('aria-expanded', String(filtersPanelVisible));
    }

    // -------------------------------------------------------------------
    // Filtering + sorting
    // -------------------------------------------------------------------

    function matchesDateRange(event, range) {
        if (range === 'all') return true;
        const start = new Date(event.start_at);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

        if (range === 'today') return start >= startOfToday && start < endOfToday;

        if (range === 'weekend') {
            const day = now.getDay();
            const daysUntilSat = (6 - day + 7) % 7;
            const satStart = new Date(startOfToday.getTime() + daysUntilSat * 86400000);
            const sunEnd = new Date(satStart.getTime() + 2 * 86400000);
            return start >= satStart && start < sunEnd;
        }

        if (range === 'week') {
            const weekEnd = new Date(startOfToday.getTime() + 7 * 86400000);
            return start >= startOfToday && start < weekEnd;
        }

        if (range === 'month') {
            return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
        }

        if (range === 'custom') {
            if (state.customDateStart) {
                const rangeStart = new Date(state.customDateStart + 'T00:00:00');
                if (start < rangeStart) return false;
            }
            if (state.customDateEnd) {
                // Inclusive of the whole end day, not just up to midnight.
                const rangeEnd = new Date(state.customDateEnd + 'T23:59:59.999');
                if (start > rangeEnd) return false;
            }
            return true;
        }

        return true;
    }

    function applyFiltersAndRender() {
        const starredSet = new Set(starredEvents);
        filteredEvents = allEvents.filter((event) => {
            // The starred toggle narrows whatever the other filters allow
            // (an AND, same as js/listings.js's matchesStarred).
            if (viewingStarredOnly && !starredSet.has(String(event.id))) return false;
            if (state.search) {
                const haystack = [event.title, event.tagline, event.category, event.city]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                if (!haystack.includes(state.search)) return false;
            }
            if (state.categories.size > 0 && !state.categories.has(event.category)) return false;
            if (state.freeOnly && !event.is_free) return false;
            if (state.hideUnavailable && ['cancelled', 'postponed', 'sold_out'].includes(event.status)) return false;
            if (!matchesDateRange(event, state.dateRange)) return false;
            return true;
        });

        filteredEvents.sort((a, b) => {
            if (currentSort === 'az') return (a.title || '').localeCompare(b.title || '');
            if (currentSort === 'furthest') return new Date(b.start_at) - new Date(a.start_at);
            return new Date(a.start_at) - new Date(b.start_at); // soonest (default)
        });

        loadMoreOffset = 0;
        updateFilterCount();
        updateResultsCount();
        showEmptyState(
            filteredEvents.length === 0,
            loadFailed ? EVENTS_LOAD_ERROR_MESSAGE
                : viewingStarredOnly ? 'No starred events match your current filters.'
                : undefined
        );

        // The grid/list always renders — the open panel sits ABOVE it,
        // never instead of it. Split View hides the grid/list and the plain
        // map panel and shows its own list + map, so those get refreshed
        // instead (they were previously left stale when a filter changed
        // while Split View was open).
        if (currentView === 'grid') renderGrid();
        else renderList();
        if (activePanel === 'calendar') renderCalendar();
        if (activePanel === 'map' && !splitViewActive) renderMap();
        if (splitViewActive) {
            renderSplitEventsListings();
            updateSplitEventsMapMarkers();
        }

        syncControlStates();
        syncQueryParams();
    }

    function updateFilterCount() {
        const count = state.categories.size
            + (state.freeOnly ? 1 : 0)
            + (state.hideUnavailable ? 1 : 0)
            + (state.dateRange !== 'all' ? 1 : 0);
        // One badge on the mobile Filters button, one on the desktop one.
        document.querySelectorAll('.event-filter-count').forEach((badge) => {
            badge.textContent = String(count);
            badge.classList.toggle('hidden', count === 0);
        });
    }

    // Same wording as js/listings.js's updateResultsCount(): "N listings
    // found" / "N starred listings", here with events (and, on a regional
    // page, the region in the spot Listings puts the selected category).
    function updateResultsCount() {
        const n = filteredEvents.length;
        const noun = n === 1 ? 'event' : 'events';
        const label = viewingStarredOnly
            ? `${n} starred ${noun}`
            : `${n} ${noun} found${REGION ? ` in ${REGION.label}` : ''}`;
        const el = document.getElementById('eventResultsCount');
        if (el) el.textContent = label;
    }

    function showEmptyState(show, customMessage) {
        const empty = document.getElementById('eventsEmptyState');
        if (!empty) return;
        empty.classList.toggle('hidden', !show);
        if (!show) return;
        // Always (re)set the sub-message: with no custom text it goes back
        // to the default, so a message set for one situation (starred
        // view, load failure) can't linger into the next.
        const msgEl = empty.querySelector('p:last-child');
        if (msgEl) msgEl.textContent = customMessage || EMPTY_STATE_DEFAULT_MESSAGE;
    }

    // -------------------------------------------------------------------
    // Category filter chips — built dynamically from get_event_category_counts()
    // -------------------------------------------------------------------

    async function renderCategoryFilters(restoredCategories) {
        const container = document.getElementById('eventCategoryFilters');
        if (!container) return;

        const { data, error } = await eventsSupabase.rpc('get_event_category_counts');
        if (error || !Array.isArray(data)) return;

        container.innerHTML = data
            .filter((row) => row.category)
            .map((row) => `<button class="toggle-option" data-category="${escapeAttr(row.category)}">${escapeHtml(row.category)} (${row.count})</button>`)
            .join('');

        const restoredSet = new Set(restoredCategories || []);
        container.querySelectorAll('button[data-category]').forEach((btn) => {
            // state.categories was already populated by readQueryParamsIntoState()
            // earlier in init() — this only needs to reflect that in the
            // buttons themselves, which didn't exist yet at that point.
            if (restoredSet.has(btn.dataset.category)) btn.classList.add('active');

            btn.addEventListener('click', () => {
                const cat = btn.dataset.category;
                if (state.categories.has(cat)) {
                    state.categories.delete(cat);
                    btn.classList.remove('active');
                } else {
                    state.categories.add(cat);
                    btn.classList.add('active');
                }
                applyFiltersAndRender();
            });
        });
    }

    // -------------------------------------------------------------------
    // Grid view
    // -------------------------------------------------------------------

    function renderGrid(opts) {
        opts = opts || {};
        const container = document.getElementById('eventsContainer');
        const loadMoreBtn = document.getElementById('eventLoadMoreBtn');
        if (!container) return;

        if (!opts.append) {
            container.innerHTML = '';
            loadMoreOffset = 0;
        }

        const slice = filteredEvents.slice(loadMoreOffset, loadMoreOffset + PAGE_SIZE);
        container.insertAdjacentHTML('beforeend', slice.map(buildEventCardHtml).join(''));
        loadMoreOffset += slice.length;

        if (loadMoreBtn) loadMoreBtn.classList.toggle('hidden', loadMoreOffset >= filteredEvents.length);
    }

    // Tier/status badges — factored out of buildEventCardHtml (which
    // used to inline this same logic) so buildEventMapPopupContent
    // below can reuse it too, rather than a third copy-paste of the
    // same tier/status checks. Mirrors js/listings.js's buildBadges()
    // shape (build an array, join it), minus the hours-based
    // open/closed/opening-soon/closing-soon badges, which don't apply
    // to events — status/cancelled/postponed/sold_out already covers
    // events' equivalent "is this actually happening" concern.
    function buildEventBadges(event) {
        const badges = [];
        if (event.tier === 'PREMIUM') badges.push('<span class="event-badge event-badge-premium">Premium</span>');
        else if (event.tier === 'FEATURED') badges.push('<span class="event-badge event-badge-featured">Featured</span>');
        if (event.status === 'cancelled') badges.push('<span class="event-badge event-badge-cancelled">Cancelled</span>');
        else if (event.status === 'postponed') badges.push('<span class="event-badge event-badge-postponed">Postponed</span>');
        else if (event.status === 'sold_out') badges.push('<span class="event-badge event-badge-soldout">Sold Out</span>');
        // Price/free badge — free events always get a "Free" badge; paid
        // events only get a badge if a price_range was actually entered
        // (matching the request precisely: "If there is no price range,
        // don't show it at all" — a paid event with no price_range value
        // gets no price badge whatsoever, not an empty or placeholder
        // one). Separate from the .event-price-chip already used
        // elsewhere in this file (buildEventListRowHtml) — that's a
        // differently-styled inline chip, not part of the .event-badge
        // family used by Grid/List/map-popup/split-view; the request
        // specifically asked for "another events badge," i.e. one more
        // member of that same badge family, not reusing the chip style.
        if (event.is_free) badges.push('<span class="event-badge event-badge-free">Free</span>');
        else if (event.price_range) badges.push(`<span class="event-badge event-badge-price">${escapeHtml(event.price_range)}</span>`);
        return badges;
    }

    // The per-event star — same markup as js/listings.js's .star-button
    // (the circle/blur/hover/starred styling in css/listings.css, already
    // loaded here), keyed on data-event-id instead of data-listing-id.
    // Always emitted as a SIBLING of the card's link, never inside it: a
    // <button> nested in an <a> is invalid HTML, and the click would also
    // navigate. The one delegated click handler in bindStarredEventSync()
    // handles every instance (grid card, list row, split item, calendar
    // day detail), so nothing here carries an inline onclick. aria-pressed
    // (not a changing label) carries the on/off state for screen readers.
    function buildEventStarButtonHtml(eventId, extraStyle, iconPx) {
        const on = starredEvents.includes(String(eventId));
        const iconStyle = iconPx ? ` style="width: ${iconPx}px; height: ${iconPx}px;"` : '';
        return `<button type="button" class="star-button${on ? ' starred' : ''}" data-event-id="${escapeAttr(eventId)}" aria-label="Star event" aria-pressed="${on}"${extraStyle ? ` style="${extraStyle}"` : ''}>` +
            `<svg class="star-icon"${iconStyle} viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>` +
            `</button>`;
    }

    function buildEventCardHtml(event) {
        const { dateLabel, timeLabel } = formatCardDateTime(event);
        const badges = buildEventBadges(event);

        const locationLabel = [event.city, event.state].filter(Boolean).join(', ');

        // Rebuilt to match js/listings.js's generateListingCardHtml grid-
        // view structure/classes exactly (per request: "the event tiles
        // should be exactly the same size as how they are in listings"),
        // not just similar. Concrete mismatches this replaces: a fixed
        // h-48 (192px) image area instead of aspect-ratio:4/3 (Listings'
        // own image height never changes as column count/card width
        // changes; the old aspect-ratio approach did, meaning cards were
        // never actually the same height as Listings' at a given column
        // count even when width matched), rounded-lg (8px, matching
        // Listings' own corner radius) instead of the old .event-card's
        // 10px, p-4 (16px all around, matching Listings' listing body
        // padding) instead of 12px 14px 14px, and the real "shadow
        // hover:shadow-lg transition-shadow" Tailwind utilities Listings
        // actually uses instead of "card-shadow" — a class that turned
        // out to be undefined anywhere in this codebase's CSS, so it was
        // rendering with NO shadow at all previously. Badges still live
        // inside the <a> (not as an outside sibling) for the same
        // stacking-context reason as before — that fix stays, just
        // applied to the new markup shape. The star button is the one
        // addition since: Listings' card carries it as a sibling placed
        // before the link (position:absolute, top-right of the card, which
        // is the image's top-right corner), so this does too — and the
        // badge row is capped 56px short of the right edge (a 36px star +
        // its 10px inset + a 10px gap) so a card with several badges can
        // never run underneath it.
        return `
        <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden block relative hover-bounce listing-card-hover">
            ${buildEventStarButtonHtml(event.id)}
            <a href="/event/${escapeAttr(event.slug || '')}" class="block">
                <div class="h-48 bg-gray-200 relative">
                    ${event.poster_image
                        ? `<img src="${escapeAttr(event.poster_image)}" alt="${escapeAttr(event.title || '')}" class="w-full h-full object-cover" loading="lazy">`
                        : `<div class="w-full h-full flex items-center justify-center text-gray-400 event-card-poster-placeholder"><span>${escapeHtml(event.category || 'Event')}</span></div>`}
                    ${badges.length ? `<div class="absolute top-2 left-2 flex gap-2 flex-wrap" style="right: 56px;">${badges.join('')}</div>` : ''}
                </div>
                <div class="p-4">
                    <span class="event-card-date">${escapeHtml(dateLabel)}${timeLabel ? ` \u00b7 ${escapeHtml(timeLabel)}` : ''}</span>
                    <h3 class="text-lg font-bold text-gray-900 mb-1">${escapeHtml(event.title || '')}</h3>
                    ${locationLabel ? `<p class="text-sm text-gray-600 truncate">${escapeHtml(event.custom_venue_name || locationLabel)}</p>` : ''}
                </div>
            </a>
        </div>`;
    }

    // -------------------------------------------------------------------
    // List view
    // -------------------------------------------------------------------

    function renderList(opts) {
        opts = opts || {};
        const container = document.getElementById('eventsListContainer');
        const loadMoreBtn = document.getElementById('eventListLoadMoreBtn');
        if (!container) return;

        if (!opts.append) {
            container.innerHTML = '';
            loadMoreOffset = 0;
        }

        const slice = filteredEvents.slice(loadMoreOffset, loadMoreOffset + PAGE_SIZE);
        container.insertAdjacentHTML('beforeend', slice.map(buildEventListRowHtml).join(''));
        loadMoreOffset += slice.length;

        if (loadMoreBtn) loadMoreBtn.classList.toggle('hidden', loadMoreOffset >= filteredEvents.length);
    }

    // The row used to BE the link (<a class="... event-list-row">); it is
    // now a wrapper <div> with the link inside, because the star button has
    // to be a sibling of the link rather than inside it (see
    // buildEventStarButtonHtml). Same classes on the wrapper, plus
    // relative + pr-12 so the star (top-right, same 12px inset as
    // Listings' own list-card star) sits in reserved padding instead of on
    // top of the Free chip.
    function buildEventListRowHtml(event) {
        const { dateLabel, timeLabel } = formatCardDateTime(event);
        const locationLabel = [event.city, event.state].filter(Boolean).join(', ');
        return `
        <div class="relative flex items-center gap-4 bg-white rounded-lg p-3 pr-12 card-shadow hover-bounce event-list-row">
            ${buildEventStarButtonHtml(event.id, 'top: 12px; right: 12px;')}
            <a class="flex items-center gap-4 min-w-0 flex-1" href="/event/${escapeAttr(event.slug || '')}">
                ${event.poster_image
                    ? `<img src="${escapeAttr(event.poster_image)}" alt="${escapeAttr(event.title || '')}" class="w-16 h-16 rounded-lg object-cover flex-shrink-0" loading="lazy">`
                    : `<div class="w-16 h-16 rounded-lg flex-shrink-0" style="background:linear-gradient(135deg,#045093,#0a6bc2);"></div>`}
                <div class="min-w-0 flex-1">
                    <div class="text-xs font-bold" style="color:#045093;">${escapeHtml(dateLabel)}${timeLabel ? ` \u00b7 ${escapeHtml(timeLabel)}` : ''}</div>
                    <div class="text-sm font-bold text-gray-900 truncate">${escapeHtml(event.title || '')}</div>
                    ${locationLabel ? `<div class="text-xs text-gray-500 truncate">${escapeHtml(event.custom_venue_name || locationLabel)}</div>` : ''}
                </div>
                ${event.is_free ? '<span class="event-price-chip event-price-free flex-shrink-0">Free</span>' : ''}
            </a>
        </div>`;
    }

    // -------------------------------------------------------------------
    // Calendar view
    // -------------------------------------------------------------------

    function renderCalendar() {
        const grid = document.getElementById('eventCalendarGrid');
        const label = document.getElementById('calendarMonthLabel');
        if (!grid || !label) return;

        const year = calendarCursor.getFullYear();
        const month = calendarCursor.getMonth();
        label.textContent = calendarCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const firstOfMonth = new Date(year, month, 1);
        const startOffset = firstOfMonth.getDay(); // 0 = Sunday
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();

        // Group this month's filtered events by day-of-month for O(1) lookup while building cells.
        const eventsByDay = {};
        filteredEvents.forEach((event) => {
            const d = new Date(event.start_at);
            if (d.getFullYear() === year && d.getMonth() === month) {
                const day = d.getDate();
                (eventsByDay[day] = eventsByDay[day] || []).push(event);
            }
        });

        const weekdayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            .map((d) => `<div class="event-calendar-weekday">${d}</div>`)
            .join('');

        const emptyCells = Array.from({ length: startOffset }, () => '<div class="event-calendar-day is-empty"></div>').join('');

        const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            const dayEvents = eventsByDay[day] || [];
            const dots = dayEvents
                .slice(0, 4)
                .map((e) => {
                    const tierClass = e.tier === 'PREMIUM' ? 'tier-premium' : e.tier === 'FEATURED' ? 'tier-featured' : '';
                    return `<span class="event-calendar-dot ${tierClass}" data-slug="${escapeAttr(e.slug || '')}" title="${escapeAttr(e.title || '')}"></span>`;
                })
                .join('');
            const more = dayEvents.length > 4 ? `<span class="event-calendar-more">+${dayEvents.length - 4}</span>` : '';

            return `<div class="event-calendar-day${isToday ? ' is-today' : ''}" data-day="${day}">
                <span class="event-calendar-day-num">${day}</span>
                <div class="event-calendar-dot-row">${dots}${more}</div>
            </div>`;
        }).join('');

        grid.innerHTML = weekdayHeaders + emptyCells + dayCells;

        grid.querySelectorAll('.event-calendar-day[data-day]').forEach((cell) => {
            cell.addEventListener('click', () => {
                const day = parseInt(cell.dataset.day, 10);
                showCalendarDayDetail(year, month, day, eventsByDay[day] || []);
            });
        });
    }

    function showCalendarDayDetail(year, month, day, dayEvents) {
        const detail = document.getElementById('calendarDayDetail');
        if (!detail) return;

        if (dayEvents.length === 0) {
            detail.classList.add('hidden');
            return;
        }

        const dateLabel = new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        detail.innerHTML = `<h4 class="font-semibold text-gray-900 mb-3">${escapeHtml(dateLabel)}</h4>` +
            `<div class="space-y-2">${dayEvents.map(buildEventListRowHtml).join('')}</div>`;
        detail.classList.remove('hidden');
    }

    // -------------------------------------------------------------------
    // Map view — mirrors js/listings.js's Leaflet + markercluster setup,
    // using events' coordinates jsonb field instead of listings.coordinates.
    // -------------------------------------------------------------------

    // "Current Location" / approximate-location system — full port of
    // js/listings.js's own requestPreciseLocation() / estimateLocationByIP()
    // / getPreferredMapCenter() / updateEstimatedLocationCircle() /
    // storeLocationPermission() pairing. An earlier pass on this file
    // deliberately left out estimateLocationByIP()/the estimated-location
    // circle, reasoning it existed only to feed Listings' distance-based
    // sort/radius filter (which events has no equivalent of) — a
    // follow-up request made clear the approximate-location bubble is
    // wanted as its own thing here too ("the first thing that pops up...
    // should be current location (if given) or the approximate location
    // bubble exactly like in listings"), so this now ports that half of
    // the system as well.
    //
    // Uses the SAME cookie name Listings uses (tgd_location_permission),
    // not a separate events-only key — per "using the same cookie", so a
    // permission grant on one page carries over to the other rather than
    // asking twice for what is, from the visitor's perspective, one
    // permission for one site.
    const LOCATION_PERMISSION_COOKIE = 'tgd_location_permission';
    const LOCATION_PERMISSION_STORAGE_KEY = 'tgd_location_permission';

    function setSharedCookie(name, value, days) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    }

    function getSharedCookie(name) {
        const nameEQ = `${name}=`;
        const cookies = document.cookie.split('; ');
        for (let i = 0; i < cookies.length; i++) {
            if (cookies[i].indexOf(nameEQ) === 0) return decodeURIComponent(cookies[i].substring(nameEQ.length));
        }
        return '';
    }

    function getStoredLocationPermission() {
        const stored = getSharedCookie(LOCATION_PERMISSION_COOKIE);
        if (stored === 'true') return true;
        if (stored === 'false') return false;
        try {
            const localStored = localStorage.getItem(LOCATION_PERMISSION_STORAGE_KEY);
            if (localStored === 'true') return true;
            if (localStored === 'false') return false;
        } catch (_) {
            // no-op — private browsing / storage disabled
        }
        return null;
    }

    function storeEventsLocationPermission(granted) {
        setSharedCookie(LOCATION_PERMISSION_COOKIE, granted ? 'true' : 'false', 365);
        try {
            localStorage.setItem(LOCATION_PERMISSION_STORAGE_KEY, granted ? 'true' : 'false');
        } catch (_) {
            // no-op
        }
    }

    async function syncEventsLocationPermissionFromBrowser() {
        if (!navigator.permissions || typeof navigator.permissions.query !== 'function') return null;
        try {
            const status = await navigator.permissions.query({ name: 'geolocation' });
            if (status.state === 'granted') { storeEventsLocationPermission(true); return true; }
            if (status.state === 'denied') { storeEventsLocationPermission(false); return false; }
        } catch (_) {
            return null;
        }
        return null;
    }

    let estimatedLocationCircle = null;
    let splitEstimatedLocationCircle = null;

    function getPreferredEventsMapCenter() {
        const location = userLocation || estimatedUserLocation;
        if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
            return { lat: location.lat, lng: location.lng, estimated: location.estimated };
        }
        return null;
    }

    function centerEventsMapOnPreferredLocation(mapInstance, zoomLevel) {
        if (!mapInstance) return;
        const preferred = getPreferredEventsMapCenter();
        if (preferred) mapInstance.setView([preferred.lat, preferred.lng], zoomLevel || 13);
        else mapInstance.setView([41.8781, -87.6298], 9);
    }

    function updateEstimatedEventsLocationCircle(mapInstance, existingCircle) {
        if (!mapInstance || userLocation || !estimatedUserLocation) return existingCircle;
        if (existingCircle) return existingCircle;
        return window.L.circle([estimatedUserLocation.lat, estimatedUserLocation.lng], {
            radius: 10000,
            color: '#045093',
            fillColor: '#045093',
            fillOpacity: 0.15,
            weight: 2,
        }).addTo(mapInstance);
    }

    function clearEstimatedEventsLocationCircle(mapInstance, existingCircle) {
        if (mapInstance && existingCircle) mapInstance.removeLayer(existingCircle);
        return null;
    }

    // Runs unconditionally on page load (no permission needed — a plain
    // IP lookup, not device geolocation), same as Listings' own
    // estimateLocationByIP() call in its DOMContentLoaded handler. Gives
    // the approximate-location bubble when precise location isn't (yet,
    // or ever) granted.
    async function estimateEventsLocationByIP() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            if (data.latitude && data.longitude) {
                estimatedUserLocation = {
                    lat: data.latitude,
                    lng: data.longitude,
                    city: data.city,
                    state: data.region_code,
                    country: data.country_code,
                    estimated: true,
                };
                if (!userLocation) {
                    if (map) {
                        estimatedLocationCircle = updateEstimatedEventsLocationCircle(map, estimatedLocationCircle);
                        centerEventsMapOnPreferredLocation(map, 11);
                    }
                    if (window.splitEventsMap) {
                        splitEstimatedLocationCircle = updateEstimatedEventsLocationCircle(window.splitEventsMap, splitEstimatedLocationCircle);
                        centerEventsMapOnPreferredLocation(window.splitEventsMap, 11);
                    }
                }
                return estimatedUserLocation;
            }
        } catch (e) {
            console.error('IP location estimation failed:', e);
        }
        return null;
    }

    function requestEventsPreciseLocation() {
        if (!navigator.geolocation) {
            console.error('Geolocation not supported by this browser');
            return;
        }

        const onSuccess = (position) => {
            storeEventsLocationPermission(true);
            userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            locationButtonActive = true;
            updateLocateButtonActiveState();
            if (map) {
                estimatedLocationCircle = clearEstimatedEventsLocationCircle(map, estimatedLocationCircle);
                centerEventsMapOnPreferredLocation(map, 13);
                addEventsUserLocationMarker(map, false);
            }
            if (window.splitEventsMap) {
                splitEstimatedLocationCircle = clearEstimatedEventsLocationCircle(window.splitEventsMap, splitEstimatedLocationCircle);
                centerEventsMapOnPreferredLocation(window.splitEventsMap, 13);
                addEventsUserLocationMarker(window.splitEventsMap, true);
            }
        };

        const onError = (error) => {
            locationButtonActive = false;
            updateLocateButtonActiveState();
            if (error.code === 1) {
                console.log('Geolocation permission denied');
                storeEventsLocationPermission(false);
            } else if (error.code === 3) {
                console.log('Geolocation timeout');
            } else {
                console.log('Location error:', error.message);
            }
        };

        navigator.geolocation.getCurrentPosition(
            onSuccess,
            onError,
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
    }

    function updateLocateButtonActiveState() {
        document.querySelectorAll('#eventLocateBtn, #splitEventLocateBtn').forEach((btn) => {
            btn.classList.toggle('locate-active', locationButtonActive);
        });
    }

    // isSplit picks which of the two marker-holding variables
    // (userLocationMarker for the plain map, splitUserLocationMarker for
    // the split-view map) gets updated — same two-marker split
    // js/listings.js keeps for the same reason: the plain map and the
    // split map are two independent Leaflet instances that can both be
    // alive if a visitor opens Split View without first closing the
    // plain map panel (closing the panel hides its container but doesn't
    // tear down the Leaflet instance itself — see renderMap()'s own
    // "already initialized" guard below).
    function addEventsUserLocationMarker(mapInstance, isSplit) {
        if (!mapInstance || !userLocation) return;
        const existing = isSplit ? splitUserLocationMarker : userLocationMarker;
        if (existing) mapInstance.removeLayer(existing);
        if (isSplit) splitEstimatedLocationCircle = clearEstimatedEventsLocationCircle(mapInstance, splitEstimatedLocationCircle);
        else estimatedLocationCircle = clearEstimatedEventsLocationCircle(mapInstance, estimatedLocationCircle);
        const userIcon = window.L.divIcon({
            html: '<div style="width: 16px; height: 16px; background: #4285F4; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.3);"></div>',
            className: '', iconSize: [22, 22], iconAnchor: [11, 11],
        });
        const marker = window.L.marker([userLocation.lat, userLocation.lng], {
            icon: userIcon, zIndexOffset: 1000,
        }).addTo(mapInstance);
        marker.bindPopup('<strong>Your Location</strong>');
        if (isSplit) splitUserLocationMarker = marker;
        else userLocationMarker = marker;
    }

    // Builds one event marker and adds it to the given cluster group —
    // factored out of renderMap() so updateSplitEventsMapMarkers() below
    // can build identical markers for the split-view map's own cluster
    // group without a second copy of this same tier-class/icon/popup
    // logic. Returns the marker's [lat, lng] pair (for bounds-fitting by
    // the caller) or null if the event has no usable coordinates.
    function addEventMarkerToCluster(event, clusterGroup) {
        const coords = event.coordinates;
        if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return null;

        const tierClass = event.tier === 'PREMIUM' ? 'tier-premium' : event.tier === 'FEATURED' ? 'tier-featured' : 'tier-free';
        const icon = window.L.divIcon({
            className: `custom-marker event-marker ${tierClass}`,
            html: '<div></div>',
            iconSize: [28, 28],
        });

        const marker = window.L.marker([coords.lat, coords.lng], { icon, eventId: event.id });
        marker.bindPopup(buildEventMapPopupContent(event), { maxWidth: 320, className: 'custom-popup' });
        marker.on('popupopen', () => {
            const closeBtn = document.querySelector('.leaflet-popup-close-button');
            if (closeBtn) closeBtn.textContent = '\u00d7';
        });
        clusterGroup.addLayer(marker);
        return [coords.lat, coords.lng];
    }

    // On first-ever init (map is null), the map centers on the visitor's
    // preferred location (precise if granted, IP-estimate otherwise, per
    // getPreferredEventsMapCenter()) rather than unconditionally jumping
    // to a Chicago default — confirmed reported bug/request: "the first
    // thing that pops up when switching to map view should be current
    // location (if given) or the approximate location bubble exactly
    // like in listings." Every render after that first init still fits
    // bounds to the actual filtered events (unchanged from before) —
    // this only changes what the map shows in the instant before that
    // fit-bounds call resolves, which matters because fitBounds animates
    // from wherever the map currently is, so starting from the user's
    // own area produces a shorter, more relevant pan than starting from
    // a fixed Chicago point every time regardless of who's looking or
    // where.
    function renderMap() {
        const container = document.getElementById('eventsMap');
        const loading = document.getElementById('eventMapLoading');
        if (!container || !window.L) return;

        if (!map) {
            const preferred = getPreferredEventsMapCenter();
            map = window.L.map(container, { scrollWheelZoom: true }).setView(
                preferred ? [preferred.lat, preferred.lng] : [41.8781, -87.6298],
                preferred ? 13 : 9
            );
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
            }).addTo(map);
            markerClusterGroup = window.L.markerClusterGroup();
            map.addLayer(markerClusterGroup);

            if (userLocation) addEventsUserLocationMarker(map, false);
            else estimatedLocationCircle = updateEstimatedEventsLocationCircle(map, estimatedLocationCircle);
        }

        markerClusterGroup.clearLayers();

        const bounds = [];
        filteredEvents.forEach((event) => {
            const pos = addEventMarkerToCluster(event, markerClusterGroup);
            if (pos) bounds.push(pos);
        });

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        }

        if (loading) loading.style.display = 'none';
        setTimeout(() => map.invalidateSize(), 100);
    }

    // -------------------------------------------------------------------
    // Split View — mirrors js/listings.js's toggleSplitView() /
    // renderSplitViewListings() / updateSplitMapMarkers() / initSplitMap().
    //
    // The star button IS ported (see buildEventStarButtonHtml and the
    // starred-events section below), as is the split header's own
    // Filters button + sort select. Deliberately still NOT ported: the
    // distance/radius-based map filtering (selectedRadius /
    // mapVisibleRadiusMiles / calculateDistance — events have no radius
    // filter, confirmed earlier, so there is nothing for that filtering
    // to be driven by), and the "closest to me" sort option's automatic
    // requestPreciseLocation('closest-sort') trigger (same reason — no
    // distance-based sort exists for events to wire that into). Every
    // event within the current filtered set is always shown on the
    // split map, same as the plain map view already does.
    //
    // Split View hides the same trio Listings' toggleSplitView() hides —
    // the controls row, the grid/list, and the plain map panel — and shows
    // its own list + map in their place. Because that takes the whole
    // grid/list layout (the sidebar column included) off screen, the
    // filter panel falls back to its top-bar home above the split
    // container (see updateFilterPanelPosition()), reached through the
    // split header's own Filters button.
    // -------------------------------------------------------------------

    // Split View's own state machine. toggleSplitEventsView() below is the
    // button-facing toggle; setActivePanel() calls this directly with
    // restoreMapPanel:false when something is LEAVING the map (closing it
    // or switching to Calendar), since in that case the plain map panel
    // must stay hidden rather than be shown for an instant first.
    //
    // Entering closes the filter panel and remembers whether it was open
    // (Listings does the same: its split view closes the top panel, and
    // its sidebar reappears afterwards on its own), so leaving restores it
    // exactly as it was.
    let filtersVisibleBeforeSplit = false;

    function setSplitView(active, opts) {
        opts = opts || {};
        const restoreMapPanel = opts.restoreMapPanel !== false;
        if (active === splitViewActive) return;

        const splitContainer = document.getElementById('eventSplitViewContainer');
        if (active && !splitContainer) return;

        splitViewActive = active;
        const normalViewIds = ['eventNormalViewControls', 'eventNormalViewListings'];

        if (splitViewActive) {
            filtersVisibleBeforeSplit = filtersPanelVisible;
            filtersPanelVisible = false;

            document.getElementById('eventMapContainer')?.classList.add('hidden');
            normalViewIds.forEach((id) => document.getElementById(id)?.classList.add('hidden'));
            splitContainer.classList.remove('hidden');
            splitContainer.className = 'split-view-container';
            splitContainer.style.position = 'relative';
            splitContainer.style.zIndex = '10';
            splitContainer.innerHTML = `
                <div class="split-view-listings">
                    <div class="mb-3 flex items-center justify-between px-2">
                        <div class="flex items-center gap-2">
                            <p class="text-sm text-gray-600" id="splitEventResultsCount"></p>
                            <button id="eventSplitFiltersBtn" class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                                <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> Filters
                            </button>
                        </div>
                        <select id="splitEventSortSelect" class="text-sm border border-gray-300 rounded-lg px-3 py-2">
                            <option value="soonest">Soonest</option>
                            <option value="az">A-Z</option>
                            <option value="furthest">Furthest Out</option>
                        </select>
                    </div>
                    <div id="splitEventsListContainer"></div>
                </div>
                <div class="split-view-map" style="position: relative; z-index: 10;">
                    <div id="splitEventsMap"></div>
                    <div class="map-controls">
                        <button class="map-control-btn" id="splitEventViewToggleBtn" title="Exit split view">
                            <svg width="16" height="16" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="#045093"><rect x="15" y="4" width="2" height="24"/><path d="M10,7V25H4V7h6m0-2H4A2,2,0,0,0,2,7V25a2,2,0,0,0,2,2h6a2,2,0,0,0,2-2V7a2,2,0,0,0-2-2Z"/><path d="M28,7V25H22V7h6m0-2H22a2,2,0,0,0-2,2V25a2,2,0,0,0,2,2h6a2,2,0,0,0,2-2V7a2,2,0,0,0-2-2Z"/></svg>
                            <span class="desktop-only">Exit Split View</span>
                        </button>
                        <button class="map-control-btn" id="splitEventLocateBtn" title="Find my location">
                            <svg id="splitEventLocateBtnIcon" width="16" height="16" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="#045093">
                                <polygon points="0,9.28 9.894,9.99 10.78,20 20,0"/>
                            </svg>
                            <span class="desktop-only">Current Location</span>
                        </button>
                        <button class="map-control-btn" id="splitEventResetMapBtn" title="Reset map view">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                            <span class="desktop-only">Reload</span>
                        </button>
                    </div>
                </div>
            `;

            document.getElementById('splitEventViewToggleBtn')?.addEventListener('click', toggleSplitEventsView);
            document.getElementById('splitEventLocateBtn')?.addEventListener('click', requestEventsPreciseLocation);
            document.getElementById('splitEventResetMapBtn')?.addEventListener('click', () => {
                if (window.splitEventsMap) window.splitEventsMap.setView([41.8781, -87.6298], 9);
            });
            document.getElementById('eventSplitFiltersBtn')?.addEventListener('click', () => setFiltersVisible(!filtersPanelVisible));

            // The split header's sort select mirrors the main one (Listings'
            // #splitSortSelect <-> #sortSelect pairing): changing it updates
            // the shared sort and re-runs the filters.
            const splitSort = document.getElementById('splitEventSortSelect');
            if (splitSort) {
                splitSort.value = currentSort;
                splitSort.addEventListener('change', () => {
                    currentSort = splitSort.value;
                    const mainSort = document.getElementById('eventSortSelect');
                    if (mainSort) mainSort.value = currentSort;
                    applyFiltersAndRender();
                });
            }

            updateFilterPanelPosition();
            renderSplitEventsListings();
            initSplitEventsMap();
        } else {
            if (splitContainer) {
                // Reset to the container's ORIGINAL class list (just "hidden"),
                // not merely add "hidden" on top of what's there:
                // css/listings.css gives .split-view-container
                // "display:flex; height:calc(100vh - 200px)", and as it loads
                // after src/output.css it out-ranks .hidden (same
                // specificity, later wins) — so "split-view-container hidden"
                // stays on screen as an empty ~700px block between the
                // panels and the results. js/listings.js's own exit path has
                // exactly that latent bug, and so did this file's.
                splitContainer.className = 'hidden';
                splitContainer.innerHTML = '';
            }
            normalViewIds.forEach((id) => document.getElementById(id)?.classList.remove('hidden'));
            filtersPanelVisible = filtersVisibleBeforeSplit;
            updateFilterPanelPosition();

            if (restoreMapPanel) {
                document.getElementById('eventMapContainer')?.classList.remove('hidden');
                // The plain map sat out Split View, so its markers may be
                // stale (filters can change while the split map is up).
                renderMap();
                setTimeout(() => {
                    if (map) {
                        map.invalidateSize();
                    }
                }, 100);
            }
        }
    }

    function toggleSplitEventsView() {
        setSplitView(!splitViewActive);
    }

    function renderSplitEventsListings() {
        const container = document.getElementById('splitEventsListContainer');
        if (!container) return;

        const splitEvents = filteredEvents;
        const resultsCount = document.getElementById('splitEventResultsCount');

        // Same wording as the main count (see updateResultsCount()), minus the
        // regional " in <region>" suffix: this header is a narrow column that
        // also holds the Filters button and the sort select.
        const splitCountLabel = (n) => viewingStarredOnly
            ? `${n} starred ${n === 1 ? 'event' : 'events'}`
            : `${n} ${n === 1 ? 'event' : 'events'} found`;

        if (splitEvents.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-600 py-12">No events found.</p>';
            if (resultsCount) resultsCount.textContent = splitCountLabel(0);
            return;
        }

        if (resultsCount) {
            resultsCount.textContent = splitCountLabel(splitEvents.length);
        }

        container.className = 'space-y-3';
        container.innerHTML = splitEvents.map((event) => {
            const { dateLabel, timeLabel } = formatCardDateTime(event);
            const badges = buildEventBadges(event);
            const locationLabel = [event.city, event.state].filter(Boolean).join(', ');
            const hasCoordinates = event.coordinates && typeof event.coordinates.lat === 'number' && typeof event.coordinates.lng === 'number';
            const isSelected = String(selectedSplitEventId) === String(event.id);
            const eventUrl = `/event/${escapeAttr(event.slug || '')}`;
            const posterImage = event.poster_image || '';
            const posterHtml = posterImage
                ? `<img src="${escapeAttr(posterImage)}" alt="${escapeAttr(event.title || '')}" class="w-16 h-16 rounded-lg object-cover flex-shrink-0">`
                : '<div class="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">No image</div>';

            const innerContent = `
                <div class="flex gap-1 mb-1 flex-wrap">${badges.join('')}</div>
                <h3 class="text-base font-bold text-gray-900 mb-1 truncate">${escapeHtml(event.title || '')}</h3>
                <p class="text-xs text-gray-600 mb-1 truncate">${escapeHtml(dateLabel)}${timeLabel ? ` \u00b7 ${escapeHtml(timeLabel)}` : ''}</p>
                ${locationLabel ? `
                    <div class="text-xs text-gray-600">
                        <div class="flex items-center gap-1 truncate">
                            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                            <span class="truncate">${escapeHtml(event.custom_venue_name || locationLabel)}</span>
                        </div>
                    </div>
                ` : ''}
            `;

            return `
                <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-3 relative split-listing-item event-split-item ${isSelected ? 'selected-listing' : ''}" style="margin-right: 8px; display: flex; gap: 12px;">
                    ${buildEventStarButtonHtml(event.id, 'top: 8px; right: 8px; width: 32px; height: 32px;', 16)}
                    ${hasCoordinates ? `
                        <button type="button" class="split-listing-content" onclick="if(typeof selectSplitEvent === 'function') selectSplitEvent('${escapeAttr(event.id)}', ${event.coordinates.lat}, ${event.coordinates.lng});">
                            ${posterHtml}
                            <div class="flex-1 min-w-0 overflow-hidden ${isSelected ? 'pr-2' : 'pr-8'}">${innerContent}</div>
                        </button>
                        ${isSelected ? `<a href="${escapeAttr(eventUrl)}" class="split-listing-visit-btn">Visit</a>` : ''}
                    ` : `
                        <a href="${escapeAttr(eventUrl)}" class="flex gap-3 flex-1 min-w-0">
                            ${posterHtml}
                            <div class="flex-1 min-w-0 overflow-hidden pr-8">${innerContent}</div>
                        </a>
                    `}
                </div>
            `;
        }).join('');
    }

    function updateSplitEventsMapMarkers() {
        if (!window.splitEventsMap || !window.splitEventsMarkerClusterGroup) return;
        window.splitEventsMarkerClusterGroup.clearLayers();

        const bounds = [];
        filteredEvents.forEach((event) => {
            const pos = addEventMarkerToCluster(event, window.splitEventsMarkerClusterGroup);
            if (pos) bounds.push(pos);
        });

        if (bounds.length > 0) {
            window.splitEventsMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }

        setTimeout(() => window.splitEventsMap.invalidateSize(), 250);
    }

    function initSplitEventsMap() {
        const splitMapDiv = document.getElementById('splitEventsMap');
        if (!splitMapDiv || !window.L) return;

        const preferred = getPreferredEventsMapCenter();
        window.splitEventsMap = window.L.map('splitEventsMap', {
            preferCanvas: true,
            center: preferred ? [preferred.lat, preferred.lng] : [41.8781, -87.6298],
            zoom: preferred ? 13 : 9,
            zoomControl: true,
            scrollWheelZoom: false,
            touchZoom: true,
            doubleClickZoom: true,
        });

        window.splitEventsMap.on('click', () => window.splitEventsMap.scrollWheelZoom.enable());
        window.splitEventsMap.on('mouseout', () => window.splitEventsMap.scrollWheelZoom.disable());

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19,
            updateWhenIdle: true,
            updateWhenZooming: false,
            keepBuffer: 1,
            reuseTiles: true,
        }).addTo(window.splitEventsMap);

        window.splitEventsMarkerClusterGroup = window.L.markerClusterGroup({
            maxClusterRadius: 50,
            disableClusteringAtZoom: 18,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            animate: true,
            animateAddingMarkers: false,
            chunkedLoading: true,
            chunkInterval: 300,
            chunkDelay: 0,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                const size = count >= 50 ? 'large' : count >= 10 ? 'medium' : 'small';
                return window.L.divIcon({
                    html: `<div class="marker-cluster marker-cluster-${size}">${count}</div>`,
                    className: '', iconSize: size === 'small' ? [40, 40] : size === 'medium' ? [50, 50] : [60, 60],
                });
            },
        });
        window.splitEventsMap.addLayer(window.splitEventsMarkerClusterGroup);

        if (userLocation) addEventsUserLocationMarker(window.splitEventsMap, true);
        else splitEstimatedLocationCircle = updateEstimatedEventsLocationCircle(window.splitEventsMap, splitEstimatedLocationCircle);
        updateSplitEventsMapMarkers();
    }

    // Called from each split-list-item's onclick (see
    // renderSplitEventsListings() above) — pans/zooms the split map to
    // that event's marker and opens its popup, same interaction as
    // Listings' own window.selectSplitListing.
    window.selectSplitEvent = function selectSplitEvent(eventId, lat, lng) {
        selectedSplitEventId = eventId;
        if (window.splitEventsMap) {
            window.splitEventsMap.setView([lat, lng], 15);
            window.splitEventsMarkerClusterGroup?.eachLayer((marker) => {
                const markerLatLng = marker.getLatLng();
                if (Math.abs(markerLatLng.lat - lat) < 0.0001 && Math.abs(markerLatLng.lng - lng) < 0.0001) {
                    window.splitEventsMarkerClusterGroup.zoomToShowLayer(marker, () => marker.openPopup());
                }
            });
        }
        renderSplitEventsListings();
    };

    // -------------------------------------------------------------------
    // Starred events — mirrors js/listings.js's starred-listings system:
    // the same cookie-backed list of ids (so it survives reloads and
    // works with no account), the same star button on every card, the
    // same toolbar toggle that narrows the results to the starred ones,
    // the same ?starred=1 URL form, and the same "You haven't starred any
    // ... yet!" alert. The individual event page (js/event-page.js) reads
    // and writes the SAME cookie, so a star set there shows up here and
    // vice versa.
    //
    // Deliberately NOT ported: Listings' mirroring of its stars into the
    // PWA's IndexedDB store (js/pwa/storage.js's starredListings object
    // store, which backs the offline starred.html page). That store is
    // listing-shaped and versioned (DB_VERSION 1), so adding an events
    // store means a schema migration of an existing production database —
    // a separate piece of work from this feature.
    // -------------------------------------------------------------------

    // Browsers silently drop a cookie that is too large (~4096 bytes in
    // total per cookie, name and attributes included) — document.cookie
    // simply doesn't change — so without a limit the 90th star would look
    // like it worked and be gone on the next page load. Event ids are
    // UUIDs, ~45 characters each once URL-encoded in the JSON array, so
    // this budget keeps roughly the 80 most recent stars with comfortable
    // headroom under the browser limit.
    const MAX_STARRED_COOKIE_CHARS = 3600;

    // The WHOLE read sits inside the try, getSharedCookie() included: it
    // runs decodeURIComponent(), which throws on a malformed percent
    // sequence (a hand-edited or truncated cookie). This is called from
    // init() before any button is bound, so an uncaught throw here would
    // leave the entire page without working controls — a bad cookie must
    // just mean "nothing starred".
    function loadStarredEvents() {
        try {
            const raw = getSharedCookie(STARRED_EVENTS_COOKIE);
            const parsed = raw ? JSON.parse(raw) : [];
            starredEvents = Array.isArray(parsed) ? parsed.map(String) : [];
        } catch (e) {
            starredEvents = [];
        }
    }

    // When over budget the OLDEST stars are dropped first (new ones are
    // appended): past events fall off the upcoming-events lists, so they
    // can't be seen to be un-starred, and a hard "limit reached" error
    // would leave a long-time user permanently unable to star anything new.
    function trimStarredEventsToFit() {
        while (starredEvents.length > 0 &&
               encodeURIComponent(JSON.stringify(starredEvents)).length > MAX_STARRED_COOKIE_CHARS) {
            starredEvents.shift();
        }
    }

    // Returns false when the browser refused the cookie (cookies disabled,
    // cookie jar full) — verified by reading it straight back, since a
    // rejected write throws nothing.
    function saveStarredEvents() {
        trimStarredEventsToFit();
        const json = JSON.stringify(starredEvents);
        setSharedCookie(STARRED_EVENTS_COOKIE, json, 365);
        return getSharedCookie(STARRED_EVENTS_COOKIE) === json;
    }

    function emitStarredEventsSyncEvent(action, eventId) {
        const detail = { action, eventId, starredEvents: [...starredEvents], at: Date.now() };
        // The localStorage write is what fires the 'storage' event in
        // OTHER tabs/pages of this site (it never fires in the tab that
        // wrote it); the CustomEvent is the same-page equivalent.
        try { localStorage.setItem(STARRED_EVENTS_SYNC_KEY, JSON.stringify(detail)); } catch (e) { /* storage unavailable — cross-tab sync only */ }
        window.dispatchEvent(new CustomEvent('tgd:starred-events-changed', { detail }));
    }

    // Sets every star button on the page (and the toolbar toggles) from
    // starredEvents — rather than flipping only the clicked button — so an
    // oldest-first eviction, or a change made in another tab, is reflected
    // everywhere at once.
    function syncAllEventStarButtons() {
        const starredSet = new Set(starredEvents);
        document.querySelectorAll('.star-button[data-event-id]').forEach((btn) => {
            const on = starredSet.has(String(btn.dataset.eventId));
            btn.classList.toggle('starred', on);
            btn.setAttribute('aria-pressed', String(on));
        });
        syncControlStates();
    }

    function toggleEventStar(eventId, domEvent) {
        if (domEvent) {
            domEvent.preventDefault();
            domEvent.stopPropagation();
        }

        // Re-read first: another tab or the event page may have changed the
        // cookie since this page loaded, and writing from a stale in-memory
        // list would silently undo that change.
        loadStarredEvents();

        const id = String(eventId);
        const index = starredEvents.indexOf(id);
        const nowStarred = index === -1;
        if (nowStarred) starredEvents.push(id);
        else starredEvents.splice(index, 1);

        if (!saveStarredEvents()) {
            loadStarredEvents();
            syncAllEventStarButtons();
            alert('Unable to save starred events. Please check that cookies are enabled in your browser.');
            return;
        }

        emitStarredEventsSyncEvent(nowStarred ? 'add' : 'remove', id);
        syncAllEventStarButtons();

        // In the starred-only view an un-starred event has to leave the
        // results immediately (same as Listings).
        if (viewingStarredOnly) applyFiltersAndRender();
    }

    // The toolbar ★: switch between all events and only the starred ones.
    function toggleStarredEventsView(forceState, options) {
        options = options || {};
        loadStarredEvents();
        const nextState = typeof forceState === 'boolean' ? forceState : !viewingStarredOnly;

        if (nextState && starredEvents.length === 0) {
            if (!options.suppressEmptyAlert) alert("You haven't starred any events yet!");
            viewingStarredOnly = false;
            syncControlStates();
            return;
        }

        viewingStarredOnly = nextState;
        syncControlStates();
        applyFiltersAndRender();
    }

    function refreshStarredEventsFromCookie() {
        loadStarredEvents();
        // Remember whether the starred-only list is on screen BEFORE the
        // flag can be cleared below: if the last star was just removed
        // elsewhere, the flag drops back to false, but the list on screen
        // is still the old starred one and has to be re-rendered either way.
        const wasViewingStarred = viewingStarredOnly;
        if (viewingStarredOnly && starredEvents.length === 0) viewingStarredOnly = false;
        syncAllEventStarButtons();
        if (wasViewingStarred) applyFiltersAndRender();
    }

    function bindStarredEventSync() {
        // ONE delegated, capture-phase listener for every star button on
        // the page — grid cards, list rows, split items, the calendar's
        // day detail — including ones rendered later (same approach as
        // js/listings.js; capture phase so it runs before anything else on
        // the way down can swallow the click).
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.star-button[data-event-id]');
            if (!btn) return;
            toggleEventStar(btn.dataset.eventId, e);
        }, true);

        // Starred on the event page (or in another tab) -> pick it up.
        window.addEventListener('storage', (e) => {
            if (e.key === STARRED_EVENTS_SYNC_KEY) refreshStarredEventsFromCookie();
        });

        // Back/forward cache: the browser restores the page exactly as it
        // was left, stars and all — which is stale if the visitor starred
        // something on the event page they just came back from.
        window.addEventListener('pageshow', (e) => {
            if (e.persisted) refreshStarredEventsFromCookie();
        });
    }

    // -------------------------------------------------------------------
    // Shared formatting / escaping helpers
    // -------------------------------------------------------------------

    function formatCardDateTime(event) {
        const start = new Date(event.start_at);
        if (Number.isNaN(start.getTime())) return { dateLabel: '', timeLabel: '' };
        const dateLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeLabel = event.all_day ? '' : start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        return { dateLabel, timeLabel };
    }

    // Condensed date(s)+time formatter for the map popup specifically —
    // same underlying logic as functions/event/[[slug]].js's
    // formatEventDateTime (multi-day range detection via a same-day
    // string comparison in the event's own timezone, all-day handling,
    // same-day start–end shown as a single time range rather than two
    // full timestamps) but abbreviated month/no-year/no-weekday output,
    // since that function's full "Saturday, September 6, 2026" format
    // was written for a full-width detail-page header and would wrap
    // awkwardly in a 280px popup. Can't literally reuse that function
    // here even if a shorter format were fine — it lives in a Cloudflare
    // Function file (server-side execution context), this runs in the
    // browser — so this mirrors its logic rather than importing it.
    function formatPopupDateTime(event) {
        const start = new Date(event.start_at);
        if (Number.isNaN(start.getTime())) return '';
        const end = event.end_at ? new Date(event.end_at) : null;
        const tz = event.timezone || 'America/Chicago';

        const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: tz });
        const dayKeyFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' });
        const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz });

        const sameDay = end ? dayKeyFmt.format(start) === dayKeyFmt.format(end) : true;

        let dateLabel = dateFmt.format(start);
        if (end && !sameDay) dateLabel += ` \u2013 ${dateFmt.format(end)}`;

        if (event.all_day) return `${dateLabel} \u00b7 All day`;

        const timeLabel = (end && sameDay)
            ? `${timeFmt.format(start)} \u2013 ${timeFmt.format(end)}`
            : timeFmt.format(start);

        return `${dateLabel} \u00b7 ${timeLabel}`;
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(text) {
        return escapeHtml(text);
    }

    // -------------------------------------------------------------------
    // Map popup — address/phone/directions helpers.
    //
    // js/listings.js already has getFullAddress/getDirectionsUrl/
    // formatPhoneDisplay, but that file is never loaded on any events
    // page (events.html, functions/events/index.js, and
    // _render-region-page.js all load ONLY js/events.js) — so those
    // globals genuinely don't exist in this page's scope, not just
    // "aren't called yet." Same reasoning for window.TGDDirections
    // (defined in js/pwa/directions.js, listings.js's preferred path
    // for getDirectionsUrl when present): that script isn't loaded here
    // either, so the plain Google Maps URL fallback listings.js falls
    // back to when TGDDirections is absent is actually the ONLY path
    // that applies on this page — written directly rather than
    // including a dead conditional branch that can never take the
    // other path in this file's context.
    // -------------------------------------------------------------------

    function getFullEventAddress(event) {
        if (event.city && event.state) {
            if (event.address) {
                return `${event.address}, ${event.city}, ${event.state} ${event.zip_code || ''}`.trim();
            }
            return `${event.city}, ${event.state}`.trim();
        }
        return event.address || '';
    }

    function getEventDirectionsUrl(event) {
        const fullAddr = getFullEventAddress(event);
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddr)}`;
    }

    function formatPhoneDisplay(phone) {
        if (!phone) return '';
        const digits = phone.replace(/\D/g, '');
        if (phone.startsWith('+1') && digits.length === 11) {
            return `(${digits.substr(1, 3)}) ${digits.substr(4, 3)}-${digits.substr(7, 4)}`;
        }
        return phone;
    }

    // Full-parity map popup — mirrors js/listings.js's
    // buildMapPopupContent() structure and class names exactly (same
    // .map-popup/.map-popup-content/.map-popup-title/.map-popup-badges/
    // .map-popup-details classes, which is what actually makes this
    // look identical to the Listings popup: several of the *!important*
    // rules in css/listings.css — e.g. ".map-popup-title { display:
    // inline-flex !important }" and ".map-popup-details svg { stroke:
    // #045093 !important }" — only apply to elements carrying those
    // exact class names, not to a differently-classed lookalike, so
    // reusing the real class names is what makes the !important-layered
    // styling actually kick in here too, not just copying visible pixel
    // values by hand into a parallel set of classes). Differences from
    // the listing version, per what the reported gap actually asked
    // for: poster image instead of a business hero+logo pair (events
    // don't have a separate logo field), address+phone+date(s)/time
    // instead of tagline+hours-based Call button (events have no
    // weekly-hours schedule to check — generateCallButton's ONLY
    // condition is listing.phone, so the event version keeps that exact
    // same unconditional-on-phone-alone behavior), tier/status badges
    // via the already-existing buildEventBadges() instead of
    // hours-based open/closed badges.
    function buildEventMapPopupContent(event) {
        const badges = buildEventBadges(event);
        const posterImage = event.poster_image || '';
        const fullAddr = getFullEventAddress(event);
        const directionsUrl = getEventDirectionsUrl(event);
        const dateTimeLabel = formatPopupDateTime(event);

        const callButtonHtml = event.contact_phone ? `
            <a href="tel:${escapeAttr(event.contact_phone)}"
               onclick="event.stopPropagation();"
               style="position:absolute;bottom:8px;right:116px;display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:#10b981;color:white;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;box-shadow:0 2px 4px rgba(0,0,0,0.1);transition:background 0.2s;z-index:10;"
               onmouseover="this.style.background='#059669'"
               onmouseout="this.style.background='#10b981'">
                <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                Call
            </a>` : '';

        return `
            <div class="map-popup" style="width: 280px;">
                ${posterImage ? `
                    <img src="${escapeAttr(posterImage)}"
                         alt="${escapeAttr(event.title || '')}"
                         style="width:100%;height:140px;object-fit:cover;border-radius:12px 12px 0 0;">
                ` : `
                    <div style="width:100%;height:140px;background:linear-gradient(135deg, #045093 0%, #0369a1 100%);border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;">
                        <svg style="width:48px;height:48px;color:rgba(255,255,255,0.5);" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><path stroke-linecap="round" d="M16 2v4M8 2v4M3 10h18"/>
                        </svg>
                    </div>
                `}

                <div class="map-popup-content" style="padding: 12px; padding-bottom: 50px; position: relative;">
                    <div class="map-popup-info">
                        <div class="map-popup-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
                            ${badges.join('')}
                        </div>

                        <a href="/event/${escapeAttr(event.slug || '')}"
                           class="map-popup-title"
                           style="font-size:16px;font-weight:700;color:#1f2937;text-decoration:none;display:flex;align-items:center;gap:4px;margin-bottom:6px;line-height:1.3;">
                            ${escapeHtml(event.title || '')}
                        </a>

                        ${dateTimeLabel ? `
                            <div class="map-popup-tagline" style="font-size:13px;color:#6b7280;margin-bottom:8px;line-height:1.4;">
                                ${escapeHtml(dateTimeLabel)}
                            </div>
                        ` : ''}

                        <div class="map-popup-details" style="font-size:12px;color:#6b7280;margin-bottom:4px;">
                            ${fullAddr ? `
                                <div style="display:flex;align-items:start;gap:6px;margin-bottom:4px;">
                                    <svg style="width:14px;height:14px;margin-top:2px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    </svg>
                                    <span style="line-height:1.4;">${escapeHtml(fullAddr)}</span>
                                </div>
                            ` : ''}

                            ${event.contact_phone ? `
                                <div style="display:flex;align-items:center;gap:6px;">
                                    <svg style="width:14px;height:14px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                    </svg>
                                    <span>${escapeHtml(formatPhoneDisplay(event.contact_phone))}</span>
                                </div>
                            ` : ''}
                        </div>

                        ${callButtonHtml}

                        ${fullAddr ? `
                            <a href="${escapeAttr(directionsUrl)}"
                               target="_blank"
                               rel="noopener noreferrer"
                               onclick="event.stopPropagation();"
                               style="position:absolute;bottom:8px;right:8px;display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:#045093;color:white;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;box-shadow:0 2px 4px rgba(0,0,0,0.1);transition:background 0.2s;"
                               onmouseover="this.style.background='#033d7a'"
                               onmouseout="this.style.background='#045093'">
                                <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                                </svg>
                                Directions
                            </a>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    window.toggleFeedSubscribeMenu = toggleFeedSubscribeMenu;
    window.copyFeedLink = copyFeedLink;
})();