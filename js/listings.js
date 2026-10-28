/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed 
without written permission from The Greek Directory. Unauthorized use, copying, modification, 
or distribution of this code will result in legal action to the fullest extent permitted by law.
*/

// ============================================
// LISTINGS PAGE JAVASCRIPT - PART 1
// Configuration & State Management
// ============================================

const SUPABASE_URL = 'https://luetekzqrrgdxtopzvqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZXRla3pxcnJnZHh0b3B6dnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc2NDcsImV4cCI6MjA4MzkyMzY0N30.TIrNG8VGumEJc_9JvNHW-Q-UWfUGpPxR0v8POjWZJYg';

const CATEGORIES = [
    'Automotive & Transportation', 'Beauty & Health', 'Church & Religious Organization',
    'Cultural/Fraternal Organization', 'Education & Community', 'Entertainment, Arts & Recreation',
    'Food & Hospitality', 'Grocery & Imports', 'Home & Construction', 'Industrial & Manufacturing',
    'Pets & Veterinary', 'Professional & Business Services', 'Real Estate & Development', 'Retail & Shopping'
];

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

const US_STATES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

let listingsSupabase = null;
let SUBCATEGORIES = {};
let allListings = [], filteredListings = [], currentView = 'grid', selectedCategory = 'All';
let selectedSubcategories = [], subcategoryMode = 'any', selectedCountry = '', selectedState = '', selectedCity = '', selectedZip = '';
let selectedRadius = 0, openNowOnly = false, closedNowOnly = false, openingSoonOnly = false;
let closingSoonOnly = false, hoursUnknownOnly = false, onlineOnly = false, comingSoonOnly = false, selectedPricing = '', userLocation = null;
let map = null, mapOpen = false, splitViewActive = false, filtersOpen = false;
let markerClusterGroup = null, defaultMapCenter = [41.8781, -87.6298], defaultMapZoom = 10;
let userLocationMarker = null, splitUserLocationMarker = null, mapReady = false, allListingsGeocoded = false;
let estimatedLocationCircle = null;
let splitEstimatedLocationCircle = null;
let starredListings = [], viewingStarredOnly = false, mapMoved = false, locationButtonActive = false;
let filterPosition = 'top';
let searchDebounceTimer = null;
let displayedListingsCount = 15;
let estimatedUserLocation = null;
let selectedSplitListingId = null;
let desktopFiltersOverlay = false;

const SERVER_TIME_ENDPOINT = `${SUPABASE_URL}/functions/v1/listing-server-time`;
let authoritativeNowUtc = null;

async function ensureAuthoritativeNowUtc() {
    if (authoritativeNowUtc instanceof Date && !Number.isNaN(authoritativeNowUtc.getTime())) return authoritativeNowUtc;
    try {
        const response = await fetch(SERVER_TIME_ENDPOINT, { cache: 'no-store', headers: { Accept: 'application/json', apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${SUPABASE_ANON_KEY}` } });
        if (!response.ok) throw new Error('server time fetch failed');
        const payload = await response.json();
        authoritativeNowUtc = new Date(payload.nowUtc);
    } catch (error) {
        authoritativeNowUtc = new Date();
    }
    return authoritativeNowUtc;
}

function getListingLocalDate(listingTimezone = 'America/Chicago') {
    const baseNow = authoritativeNowUtc instanceof Date ? authoritativeNowUtc : new Date();
    return new Date(baseNow.toLocaleString('en-US', { timeZone: listingTimezone || 'America/Chicago' }));
}


/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

const CLAIMED_CHECKMARK_SVG = `<svg style="width:20px;height:20px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#045093"></circle><path d="M7 12.5l3.5 3.5L17 9" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

function isPwaMode() {
    return (window.PWAApp && window.PWAApp.isStandalone) ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
}

function getPreferredListingsLayout() {
    if (!isPwaMode()) return 'grid';
    const stored = localStorage.getItem('tgd_listings_layout');
    return stored === 'list' ? 'list' : 'grid';
}

function formatPhoneDisplay(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (phone.startsWith('+1') && digits.length === 11) {
        return `(${digits.substr(1, 3)}) ${digits.substr(4, 3)}-${digits.substr(7, 4)}`;
    }
    return phone;
}

function formatWebsiteDisplay(website) {
    if (!website) return '';
    return website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function getDirectionsUrl(listing) {
    if (window.TGDDirections && typeof window.TGDDirections.getDirectionsUrl === 'function') {
        return window.TGDDirections.getDirectionsUrl(listing);
    }

    const fullAddr = getFullAddress(listing);
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddr)}`;
}

function loadStarredListings() {
    try {
        const stored = getCookie('starredListings');
        if (stored) {
            try {
                starredListings = JSON.parse(stored);
            } catch (e) {
                console.error('[L502] Failed to parse starred listings cookie:', e);
                starredListings = [];
            }
        }
        updateStarredCount();
        if (new URLSearchParams(window.location.search).get('starred') === '1') {
            viewingStarredOnly = true;
        }
    } catch (e) {
        console.error('[L502] Failed to load starred listings:', e);
        starredListings = [];
    }
}

function saveStarredListings() {
    try {
        console.log('Saving starred listings to cookie:', starredListings);
        setCookie('starredListings', JSON.stringify(starredListings), 365);
        updateStarredCount();
        console.log('Cookie saved and count updated');
    } catch (e) {
        console.error('[L501] Failed to save starred listings:', e);
        alert('Unable to save starred listings. Please check that cookies are enabled in your browser.');
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function toggleStar(listingId, event) {
    console.log('toggleStar function called with ID:', listingId);
    
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    listingId = String(listingId);
    
    const index = starredListings.indexOf(listingId);
    console.log('Current starredListings:', starredListings);
    console.log('Index of', listingId, ':', index);
    
    if (index > -1) {
        starredListings.splice(index, 1);
        console.log('Removed from starred. New list:', starredListings);
    } else {
        starredListings.push(listingId);
        console.log('Added to starred. New list:', starredListings);
    }
    saveStarredListings();
    emitStarredSyncEvent(index > -1 ? 'removed' : 'added', listingId);
    console.log('saveStarredListings() called');

    const buttons = document.querySelectorAll('.star-button[data-listing-id="' + listingId + '"]');
    console.log('Found', buttons.length, 'star buttons with ID', listingId);
    
    buttons.forEach(btn => {
        if (starredListings.includes(listingId)) {
            btn.classList.add('starred');
            console.log('Added starred class to button');
        } else {
            btn.classList.remove('starred');
            console.log('Removed starred class from button');
        }
    });

    if (viewingStarredOnly) {
        console.log('Viewing starred only, re-filtering...');
        applyFilters();
    }

    syncStarredListingToPWA(listingId, starredListings.includes(listingId));
}

async function syncStarredListingToPWA(listingId, shouldBeStarred) {
    if (!window.PWAStorage || !isPwaMode()) return;

    try {
        await window.PWAStorage.init();
        if (shouldBeStarred) {
            const alreadyStarred = await window.PWAStorage.isStarred(listingId);
            if (alreadyStarred) return;

            let listingData = allListings.find(l => String(l.id) === String(listingId));
            if (!listingData && listingsSupabase) {
                const { data } = await listingsSupabase
                    .from('listings')
                    .select('*')
                    .eq('id', listingId)
                    .single();
                listingData = data || null;
            }
            if (listingData) {
                await window.PWAStorage.addStarred(listingData);
            }
        } else {
            await window.PWAStorage.removeStarred(listingId);
        }
    } catch (error) {
        console.error('Error syncing starred listing to PWA storage:', error);
    }
}


function emitStarredSyncEvent(action, listingId) {
    const payload = { action, listingId: String(listingId), timestamp: Date.now() };
    try {
        localStorage.setItem('tgd_starred_sync', JSON.stringify(payload));
    } catch (error) {
        console.warn('Unable to write starred sync payload', error);
    }
    window.dispatchEvent(new CustomEvent('tgd:starred-changed', { detail: payload }));
}

function updateStarredCount() {
    const countEl = document.getElementById('starredCount');
    if (countEl) {
        countEl.textContent = starredListings.length;
    }
    const headerCountEl = document.getElementById('headerStarredCount');
    if (headerCountEl) {
        headerCountEl.textContent = starredListings.length;
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function applySortToListings(listings, sortValue) {
    if (sortValue === 'az') {
        listings.sort((a, b) => a.business_name.localeCompare(b.business_name));
    } else if (sortValue === 'closest' && userLocation) {
        listings.sort((a, b) => {
            const distA = (a.lat && a.lng) ? getDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) : Infinity;
            const distB = (b.lat && b.lng) ? getDistance(userLocation.lat, userLocation.lng, b.lat, b.lng) : Infinity;
            return distA - distB;
        });
    } else if (sortValue === 'random') {
        for (let i = listings.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [listings[i], listings[j]] = [listings[j], listings[i]];
        }
    }
}

function syncStarredButtonsVisualState() {
    const headerStarBtn = document.getElementById('headerStarBtn');
    const starToggleBtnDesktop = document.getElementById('starToggleBtnDesktop');
    const starToggleBtnMobile = document.getElementById('starToggleBtnMobile');

    if (headerStarBtn) {
        headerStarBtn.style.backgroundColor = viewingStarredOnly ? '#fbbf24' : '';
        headerStarBtn.style.color = viewingStarredOnly ? '#78350f' : '';
    }

    if (starToggleBtnDesktop) {
        starToggleBtnDesktop.classList.toggle('starred', viewingStarredOnly);
    }

    if (starToggleBtnMobile) {
        starToggleBtnMobile.classList.toggle('starred', viewingStarredOnly);
    }
}

function toggleStarredView(forceState = null, options = {}) {
    const { suppressEmptyAlert = false } = options;

    loadStarredListings();

    const nextState = typeof forceState === 'boolean' ? forceState : !viewingStarredOnly;
    if (nextState && starredListings.length === 0) {
        viewingStarredOnly = false;
        updateURL();
        if (!suppressEmptyAlert) {
            alert('You haven\'t starred any listings yet!');
        }
        return;
    }

    viewingStarredOnly = nextState;

    syncStarredButtonsVisualState();

    displayedListingsCount = viewingStarredOnly ? Math.max(filteredListings.length, starredListings.length) : 15;
    updateURL();
    applyFilters();
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
}

function getCookie(name) {
    const nameEQ = name + '=';
    const cookies = document.cookie.split('; ');
    for (let i = 0; i < cookies.length; i++) {
        if (cookies[i].indexOf(nameEQ) === 0) {
            return decodeURIComponent(cookies[i].substring(nameEQ.length));
        }
    }
    return '';
}

const LOCATION_PERMISSION_COOKIE = 'tgd_location_permission';
const LOCATION_PERMISSION_STORAGE_KEY = 'tgd_location_permission';

function getStoredLocationPermission() {
    const stored = getCookie(LOCATION_PERMISSION_COOKIE);
    if (stored === 'true') return true;
    if (stored === 'false') return false;

    try {
        const localStored = localStorage.getItem(LOCATION_PERMISSION_STORAGE_KEY);
        if (localStored === 'true') return true;
        if (localStored === 'false') return false;
    } catch (_) {
        // no-op
    }

    return null;
}

function storeLocationPermission(granted) {
    setCookie(LOCATION_PERMISSION_COOKIE, granted ? 'true' : 'false', 365);
    try {
        localStorage.setItem(LOCATION_PERMISSION_STORAGE_KEY, granted ? 'true' : 'false');
    } catch (_) {
        // no-op
    }
}

async function syncLocationPermissionFromBrowser() {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') return null;
    try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status.state === 'granted') {
            storeLocationPermission(true);
            return true;
        }
        if (status.state === 'denied') {
            storeLocationPermission(false);
            return false;
        }
    } catch (_) {
        return null;
    }
    return null;
}

function isIOSWebApp() {
    return ('standalone' in window.navigator) && window.navigator.standalone;
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

async function estimateLocationByIP() {
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
                estimated: true
            };
            console.log('Estimated location by IP:', estimatedUserLocation);
            
            if (!viewingStarredOnly) applyFilters();
            if (!userLocation) {
                if (map) {
                    estimatedLocationCircle = updateEstimatedLocationCircle(map, estimatedLocationCircle);
                    map._hasCenteredOnUser = false;
                    centerMapOnPreferredLocation(map, 11);
                }
                if (window.splitMap) {
                    splitEstimatedLocationCircle = updateEstimatedLocationCircle(splitMap, splitEstimatedLocationCircle);
                    centerMapOnPreferredLocation(splitMap, 11);
                }
            }
            return estimatedUserLocation;
        }
    } catch (e) {
        console.error('IP location estimation failed:', e);
    }
    return null;
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function extractSubcategoriesFromListings(listings) {
    const subcatsByCategory = {};
    
    listings.forEach(listing => {
        if (listing.category && listing.subcategories && Array.isArray(listing.subcategories)) {
            if (!subcatsByCategory[listing.category]) {
                subcatsByCategory[listing.category] = new Set();
            }
            listing.subcategories.forEach(sub => {
                subcatsByCategory[listing.category].add(sub);
            });
        }
    });
    
    const result = {};
    Object.keys(subcatsByCategory).forEach(category => {
        result[category] = Array.from(subcatsByCategory[category]).sort();
    });
    
    return result;
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

document.addEventListener('DOMContentLoaded', async () => {
    if (window.TGDLanguage && typeof window.TGDLanguage.applyStoredLanguage === 'function') {
        window.TGDLanguage.applyStoredLanguage();
    }
    if (isIOSWebApp()) {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) refreshBtn.style.display = 'flex';
    }
    loadStarredListings();
    syncStarredButtonsVisualState();
    currentView = getPreferredListingsLayout();
    await ensureAuthoritativeNowUtc();
    loadListings();
    setupEventListeners();
    setView(currentView, { skipRender: true });
    createCategoryButtons();
    estimateLocationByIP();
    loadFiltersFromURL();
    syncFilters();
    checkFilterPosition();
    handleListingsHashRoute();
    window.addEventListener('hashchange', handleListingsHashRoute);

    let shouldAutoRequest = getStoredLocationPermission() === true;
    const browserPermission = await syncLocationPermissionFromBrowser();
    if (!shouldAutoRequest) {
        shouldAutoRequest = browserPermission === true || getStoredLocationPermission() === true;
    }

    if (shouldAutoRequest) {
        requestPreciseLocation('auto-on-load');
    }
});


/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed 
without written permission from The Greek Directory. Unauthorized use, copying, modification, 
or distribution of this code will result in legal action to the fullest extent permitted by law.
*/

// ============================================
// LISTINGS PAGE JAVASCRIPT - PART 2
// Filter Position & URL Management
// ============================================

function checkFilterPosition() {
    const screenWidth = window.innerWidth;
    const toggleBtn = document.getElementById('toggleFilterPosition');
    const desktopLayout = document.getElementById('desktopLayout');
    const desktopFilters = document.getElementById('desktopFiltersContainer');
    const mapBtn = document.getElementById('mapBtnDesktop');
    const listingsContainer = document.getElementById('listingsContainer');
    const desktopFilterToggleBtn = document.getElementById('desktopFilterToggleBtn');
    
    if (screenWidth >= 1024) {
        if (toggleBtn) toggleBtn.style.display = 'block';
        if (mapBtn) mapBtn.classList.remove('hidden');
        
        if (filterPosition === 'left' && !mapOpen) {
            if (desktopLayout) desktopLayout.classList.add('with-left-filters');
            if (desktopFilters) {
                desktopFilters.classList.remove('hidden');
                desktopFilters.classList.remove('desktop-filters-overlay');
            }
            if (desktopFilterToggleBtn) desktopFilterToggleBtn.style.display = 'none';
            if (currentView === 'grid' && listingsContainer) {
                listingsContainer.classList.remove('listings-3-col');
                listingsContainer.classList.add('listings-2-col');
            }
        } else if (filterPosition === 'left' && mapOpen && !splitViewActive) {
            if (desktopLayout) desktopLayout.classList.add('with-left-filters');
            if (desktopFilters) {
                desktopFilters.classList.remove('hidden');
                desktopFilters.classList.remove('desktop-filters-overlay');
            }
            desktopFiltersOverlay = false;
            if (desktopFilterToggleBtn) desktopFilterToggleBtn.style.display = 'none';
            if (currentView === 'grid' && listingsContainer) {
                listingsContainer.classList.remove('listings-3-col');
                listingsContainer.classList.add('listings-2-col');
            }
        } else if (filterPosition === 'left' && mapOpen && splitViewActive) {
            if (desktopLayout) desktopLayout.classList.remove('with-left-filters');
            if (desktopFilters) {
                desktopFilters.classList.add('hidden');
                desktopFilters.classList.remove('desktop-filters-overlay');
            }
            desktopFiltersOverlay = false;
            if (desktopFilterToggleBtn) desktopFilterToggleBtn.style.display = 'none';
            if (currentView === 'grid' && listingsContainer) {
                listingsContainer.classList.remove('listings-2-col');
                listingsContainer.classList.add('listings-3-col');
            }
        } else {
            if (desktopLayout) desktopLayout.classList.remove('with-left-filters');
            if (desktopFilters) {
                desktopFilters.classList.add('hidden');
                desktopFilters.classList.remove('desktop-filters-overlay');
            }
            desktopFiltersOverlay = false;
            if (desktopFilterToggleBtn) desktopFilterToggleBtn.style.display = 'flex';
            if (currentView === 'grid' && listingsContainer) {
                listingsContainer.classList.remove('listings-2-col');
                listingsContainer.classList.add('listings-3-col');
            }
        }
    } else {
        if (toggleBtn) toggleBtn.style.display = 'none';
        if (desktopLayout) desktopLayout.classList.remove('with-left-filters');
        if (desktopFilters) {
            desktopFilters.classList.add('hidden');
            desktopFilters.classList.remove('desktop-filters-overlay');
        }
        desktopFiltersOverlay = false;
        if (desktopFilterToggleBtn) desktopFilterToggleBtn.style.display = 'none';
        if (mapBtn) mapBtn.classList.add('hidden');
        if (currentView === 'grid' && listingsContainer) {
            listingsContainer.classList.remove('listings-2-col', 'listings-3-col');
        }
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function loadFiltersFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    if (searchQuery) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = searchQuery;
    }
    
    const category = urlParams.get('category');
    if (category && CATEGORIES.includes(category)) selectedCategory = category;
    
    const subcategories = urlParams.get('subcategories');
    if (subcategories) selectedSubcategories = subcategories.split(',');
    
    const subMode = urlParams.get('submode');
    if (subMode === 'all' || subMode === 'any') {
        subcategoryMode = subMode;
        setSubcategoryMode(subMode, true);
    }
    
    const country = urlParams.get('country');
    if (country) {
        selectedCountry = country;
        const countryFilter = document.getElementById('countryFilter');
        const countryFilter2 = document.getElementById('countryFilter2');
        if (countryFilter) countryFilter.value = country;
        if (countryFilter2) countryFilter2.value = country;
        
        if (country === 'USA') {
            const stateContainer = document.getElementById('stateFilterContainer');
            const stateContainer2 = document.getElementById('stateFilterContainer2');
            if (stateContainer) stateContainer.classList.remove('hidden');
            if (stateContainer2) stateContainer2.classList.remove('hidden');
            populateStateFilter('USA');
        }
    }
    
    const state = urlParams.get('state');
    if (state) {
        selectedState = state;
        const stateFilter = document.getElementById('stateFilter');
        const stateFilter2 = document.getElementById('stateFilter2');
        if (stateFilter) stateFilter.value = state;
        if (stateFilter2) stateFilter2.value = state;
    }

    const city = urlParams.get('city');
    if (city) {
        selectedCity = city;
    }

    const zip = urlParams.get('zip');
    if (zip) {
        selectedZip = zip;
    }
    
    const radius = urlParams.get('radius');
    if (radius) {
        selectedRadius = parseInt(radius);
        const radiusFilter = document.getElementById('radiusFilter');
        const radiusFilter2 = document.getElementById('radiusFilter2');
        if (radiusFilter) radiusFilter.value = radius;
        if (radiusFilter2) radiusFilter2.value = radius;
        updateRadiusValue();
    }
    
    if (urlParams.get('open') === 'true') {
        openNowOnly = true;
        const openFilter = document.getElementById('openNowFilter');
        const openFilter2 = document.getElementById('openNowFilter2');
        if (openFilter) openFilter.checked = true;
        if (openFilter2) openFilter2.checked = true;
    }
    
    if (urlParams.get('closed') === 'true') {
        closedNowOnly = true;
        const closedFilter = document.getElementById('closedNowFilter');
        const closedFilter2 = document.getElementById('closedNowFilter2');
        if (closedFilter) closedFilter.checked = true;
        if (closedFilter2) closedFilter2.checked = true;
    }
    
    if (urlParams.get('opening') === 'true') {
        openingSoonOnly = true;
        const openingSoonFilter = document.getElementById('openingSoonFilter');
        const openingSoonFilter2 = document.getElementById('openingSoonFilter2');
        if (openingSoonFilter) openingSoonFilter.checked = true;
        if (openingSoonFilter2) openingSoonFilter2.checked = true;
    }
    
    if (urlParams.get('closing') === 'true') {
        closingSoonOnly = true;
        const closingSoonFilter = document.getElementById('closingSoonFilter');
        const closingSoonFilter2 = document.getElementById('closingSoonFilter2');
        if (closingSoonFilter) closingSoonFilter.checked = true;
        if (closingSoonFilter2) closingSoonFilter2.checked = true;
    }
    
    if (urlParams.get('hours') === 'unknown') {
        hoursUnknownOnly = true;
        const hoursUnknownFilter = document.getElementById('hoursUnknownFilter');
        const hoursUnknownFilter2 = document.getElementById('hoursUnknownFilter2');
        if (hoursUnknownFilter) hoursUnknownFilter.checked = true;
        if (hoursUnknownFilter2) hoursUnknownFilter2.checked = true;
    }
    
    if (urlParams.get('online') === 'true') {
        onlineOnly = true;
        const onlineFilter = document.getElementById('onlineOnlyFilter');
        const onlineFilter2 = document.getElementById('onlineOnlyFilter2');
        if (onlineFilter) onlineFilter.checked = true;
        if (onlineFilter2) onlineFilter2.checked = true;
    }

    const pricing = urlParams.get('pricing');
    if (pricing) {
        selectedPricing = pricing;
        const pricingFilter = document.getElementById('pricingFilter');
        const pricingFilter2 = document.getElementById('pricingFilter2');
        if (pricingFilter) pricingFilter.value = pricing;
        if (pricingFilter2) pricingFilter2.value = pricing;
    }

    createCategoryButtons();
    updateSubcategoryDisplay();
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function updateURL() {
    const url = new URL(window.location);
    const searchTerm = document.getElementById('searchInput').value;
    const preserveStarred = viewingStarredOnly;
    url.search = '';
    if (selectedCategory && selectedCategory !== 'All') url.searchParams.set('category', selectedCategory);
    if (selectedSubcategories.length > 0) {
        url.searchParams.set('subcategories', selectedSubcategories.join(','));
        url.searchParams.set('submode', subcategoryMode);
    }
    if (selectedCountry) url.searchParams.set('country', selectedCountry);
    if (selectedState) url.searchParams.set('state', selectedState);
    if (selectedCity) url.searchParams.set('city', selectedCity);
    if (selectedZip) url.searchParams.set('zip', selectedZip);
    if (selectedRadius > 0) url.searchParams.set('radius', selectedRadius);
    if (openNowOnly) url.searchParams.set('open', 'true');
    if (closedNowOnly) url.searchParams.set('closed', 'true');
    if (openingSoonOnly) url.searchParams.set('opening', 'true');
    if (closingSoonOnly) url.searchParams.set('closing', 'true');
    if (hoursUnknownOnly) url.searchParams.set('hours', 'unknown');
    if (onlineOnly) url.searchParams.set('online', 'true');
    if (selectedPricing) url.searchParams.set('pricing', selectedPricing);
    if (searchTerm) url.searchParams.set('q', searchTerm);
    if (preserveStarred) url.searchParams.set('starred', '1');
    window.history.replaceState({}, '', url);
    window.dispatchEvent(new CustomEvent('tgd:starred-state-changed'));
}

function syncStarredViewFromUrl() {
    const shouldShowStarred = new URLSearchParams(window.location.search).get('starred') === '1';
    if (shouldShowStarred !== viewingStarredOnly) {
        toggleStarredView(shouldShowStarred, { suppressEmptyAlert: true });
    } else {
        updateURL();
        applyFilters();
    }
    window.dispatchEvent(new CustomEvent('tgd:starred-state-changed'));
}

window.applyUrlFilters = function applyUrlFilters() {
    syncStarredViewFromUrl();
    if (!viewingStarredOnly) {
        applyFilters();
    }
};

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function requestPreciseLocation(trigger = 'user-action') {
    if (!navigator.geolocation) {
        console.error('[L202] Geolocation not supported by this browser');
        return;
    }
    
    const onSuccess = (position) => {
        storeLocationPermission(true);
        userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
        console.log(`Precise location acquired via ${trigger}:`, userLocation);
        if (!viewingStarredOnly) applyFilters();
        if (map) {
            estimatedLocationCircle = clearEstimatedLocationCircle(map, estimatedLocationCircle);
            map._hasCenteredOnUser = false;
            centerMapOnPreferredLocation(map, 13);
            if (mapOpen) addUserLocationMarker();
        }
        if (window.splitMap) {
            splitEstimatedLocationCircle = clearEstimatedLocationCircle(splitMap, splitEstimatedLocationCircle);
            centerMapOnPreferredLocation(splitMap, 13);
            if (userLocation) addSplitUserLocationMarker();
        }
    };

    const onError = (error) => {
        if ((error.code === 2 || error.code === 3) && trigger === 'radius-filter') {
            navigator.geolocation.getCurrentPosition(onSuccess, () => {}, { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 });
            return;
        }
        if (error.code === 1) {
            console.log('[L201] Geolocation permission denied');
            storeLocationPermission(false);
        } else if (error.code === 3) {
            console.log('[L203] Geolocation timeout');
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

function handleListingsHashRoute() {
    const hash = (window.location.hash || '').toLowerCase();
    if (hash === '#map') {
        if (!mapOpen) toggleMap();
    } else if (hash === '#splitmap') {
        if (!mapOpen) toggleMap();
        if (!splitViewActive) toggleSplitView();
    } else if (hash === '#filters') {
        if (!filtersOpen) toggleFilters();
    }
}

function addUserLocationMarker() {
    if (!map || !userLocation) return;
    estimatedLocationCircle = clearEstimatedLocationCircle(map, estimatedLocationCircle);
    if (userLocationMarker) map.removeLayer(userLocationMarker);
    const userIcon = L.divIcon({
        html: '<div style="width: 16px; height: 16px; background: #4285F4; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.3);"></div>',
        className: '', iconSize: [22, 22], iconAnchor: [11, 11]
    });
    userLocationMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon, zIndexOffset: 1000
    }).addTo(map);
    userLocationMarker.bindPopup('<strong>Your Location</strong>', { minWidth: 150 });
}

function addSplitUserLocationMarker() {
    if (!window.splitMap || !userLocation) return;
    splitEstimatedLocationCircle = clearEstimatedLocationCircle(splitMap, splitEstimatedLocationCircle);
    if (splitUserLocationMarker) splitMap.removeLayer(splitUserLocationMarker);
    const userIcon = L.divIcon({
        html: '<div style="width: 16px; height: 16px; background: #4285F4; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 8px rgba(0,0,0,0.3);"></div>',
        className: '', iconSize: [22, 22], iconAnchor: [11, 11]
    });
    splitUserLocationMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon, zIndexOffset: 1000
    }).addTo(splitMap);
    splitUserLocationMarker.bindPopup('<strong>Your Location</strong>', { minWidth: 150 });
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

window.setSubcategoryMode = function(mode, skipUpdate) {
    subcategoryMode = mode;
    document.querySelectorAll('.toggle-option').forEach(opt => {
        if (opt.dataset.mode === mode) opt.classList.add('active');
        else opt.classList.remove('active');
    });
    if (!skipUpdate) {
        updateURL();
        if (!viewingStarredOnly) applyFilters();
    }
};

window.toggleStar = toggleStar;


/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed 
without written permission from The Greek Directory. Unauthorized use, copying, modification, 
or distribution of this code will result in legal action to the fullest extent permitted by law.
*/

// ============================================
// LISTINGS PAGE JAVASCRIPT - PART 3
// Load Listings & Filtering Logic
// ============================================

async function loadListings() {
    try {
        listingsSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const { data, error } = await listingsSupabase
            .from('listings')
            .select('*')
            .eq('visible', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allListings = data || [];
        filteredListings = [...allListings];

        SUBCATEGORIES = extractSubcategoriesFromListings(allListings);
        console.log('Loaded subcategories:', SUBCATEGORIES);

        await syncStarredListingsToPWA();
        
        populateCountryFilter();
        updateLocationSubtitle();
        applyFilters();
        if (viewingStarredOnly) {
            if (starredListings.length === 0) {
                viewingStarredOnly = false;
            } else {
                filteredListings = allListings.filter(l => starredListings.includes(String(l.id)));
                displayedListingsCount = filteredListings.length;
                console.log('Filtered to starred listings:', filteredListings.length, 'of', starredListings.length, 'starred IDs');
            }
        }
        updateResultsCount();
        renderListings();
        geocodeAllListings();
    } catch (error) {
        console.error('[L101] Error loading listings:', error);
        const listingsContainer = document.getElementById('listingsContainer');
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (listingsContainer) {
            listingsContainer.innerHTML = '<div class="text-center py-12"><p class="text-red-600 font-semibold mb-2">Error Code: L101</p><p class="text-gray-600">Failed to load listings. Please try refreshing the page.</p></div>';
        }
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
    }
}

async function syncStarredListingsToPWA() {
    if (!window.PWAStorage || !isPwaMode() || starredListings.length === 0) return;

    try {
        await window.PWAStorage.init();
        const existing = await window.PWAStorage.getAllStarred();
        const existingIds = new Set(existing.map(item => String(item.id)));
        const missingIds = starredListings.filter(id => !existingIds.has(String(id)));

        if (missingIds.length === 0) return;

        missingIds.forEach(id => {
            const listingData = allListings.find(l => String(l.id) === String(id));
            if (listingData) {
                window.PWAStorage.addStarred(listingData);
            }
        });
    } catch (error) {
        console.error('Error syncing starred listings to PWA storage:', error);
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = normalizeString(searchInput ? searchInput.value : '');
    const rawSearchTerm = searchInput ? searchInput.value.trim() : '';
    const sortSelect = document.getElementById('sortSelect');
    const sortOption = sortSelect ? sortSelect.value : 'default';
    
    filteredListings = allListings.filter(listing => {
        const matchesStarred = !viewingStarredOnly || starredListings.includes(String(listing.id));
        const fullAddress = getFullAddress(listing);
        const normalizedName = normalizeString(listing.business_name);
        const normalizedTagline = normalizeString(listing.tagline || '');
        const normalizedDescription = normalizeString(listing.description);
        const normalizedAddress = normalizeString(fullAddress);
        
        const matchesSearch = !searchTerm || 
            normalizedName.includes(searchTerm) ||
            normalizedTagline.includes(searchTerm) ||
            normalizedDescription.includes(searchTerm) ||
            normalizedAddress.includes(searchTerm);
            
        const matchesCategory = selectedCategory === 'All' || listing.category === selectedCategory;
        
        let matchesSubcategory = true;
        if (selectedSubcategories.length > 0 && listing.subcategories) {
            if (subcategoryMode === 'all') {
                matchesSubcategory = selectedSubcategories.every(sub => listing.subcategories.includes(sub));
            } else {
                matchesSubcategory = selectedSubcategories.some(sub => listing.subcategories.includes(sub));
            }
        } else if (selectedSubcategories.length > 0) {
            matchesSubcategory = false;
        }
        
        const matchesCountry = !selectedCountry || (listing.country || 'USA') === selectedCountry;
        const matchesState = !selectedState || listing.state === selectedState;
        const matchesCity = !selectedCity || (listing.city && listing.city.toLowerCase() === selectedCity.toLowerCase());
        const matchesZip = !selectedZip || (listing.zip_code && listing.zip_code === selectedZip);
        
        let matchesRadius = true;
        const effectiveUserLocation = userLocation || estimatedUserLocation;
        if (selectedRadius > 0) {
            if (!effectiveUserLocation) {
                matchesRadius = true;
            } else if (!listing.coordinates) {
                matchesRadius = false;
            } else {
                const distance = calculateDistance(
                    effectiveUserLocation.lat, effectiveUserLocation.lng,
                    listing.coordinates.lat, listing.coordinates.lng
                );
                matchesRadius = distance <= selectedRadius;
            }
        }
        
        const openStatus = isOpenNow(listing.hours, listing.timezone || 'America/Chicago');
        const matchesOpenNow = !openNowOnly || openStatus === true;
        const matchesClosedNow = !closedNowOnly || openStatus === false;
        const matchesOpeningSoon = !openingSoonOnly || isOpeningSoon(listing.hours, listing.timezone || 'America/Chicago');
        const matchesClosingSoon = !closingSoonOnly || isClosingSoon(listing.hours, listing.timezone || 'America/Chicago');
        const matchesHoursUnknown = !hoursUnknownOnly || hasUnknownHours(listing);
        const matchesOnlineOnly = !onlineOnly || isBasedIn(listing);
        const matchesPricing = !selectedPricing || Number(listing.pricing) === Number(selectedPricing);
        const matchesComingSoon = !comingSoonOnly || listing.coming_soon === true;

        return matchesSearch && matchesCategory && matchesSubcategory && matchesCountry && 
               matchesState && matchesCity && matchesZip && matchesRadius && matchesOpenNow && matchesClosedNow &&
               matchesOpeningSoon && matchesClosingSoon && matchesHoursUnknown && matchesOnlineOnly && matchesPricing &&
               matchesComingSoon && matchesStarred;
    });
    
    /*
    Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    */
    
    const effectiveUserLocation = userLocation || estimatedUserLocation;
    if (effectiveUserLocation) {
        filteredListings.forEach(listing => {
            if (listing.coordinates) {
                listing._distance = calculateDistance(
                    effectiveUserLocation.lat, effectiveUserLocation.lng,
                    listing.coordinates.lat, listing.coordinates.lng
                );
            } else {
                listing._distance = Infinity;
            }
            
            listing._inUserCity = effectiveUserLocation.city && 
                listing.city && 
                listing.city.toLowerCase() === effectiveUserLocation.city.toLowerCase();
            
            listing._inUserState = effectiveUserLocation.state && 
                listing.state && 
                listing.state.toLowerCase() === effectiveUserLocation.state.toLowerCase();
        });
    }
    
    if (!window._sortRandomSeed) {
        window._sortRandomSeed = Math.random() * 1000000;
    }
    
    function seededRandom(seed, id) {
        const x = Math.sin(seed + id) * 10000;
        return x - Math.floor(x);
    }
    
    filteredListings.sort((a, b) => {
        if (sortOption === 'random') {
            return Math.random() - 0.5;
        } else if (sortOption === 'default') {
            const aTier = a.tier || 'FREE';
            const bTier = b.tier || 'FREE';
            const tierPriority = { PREMIUM: 100, FEATURED: 50, FREE: 0 };
            
            const effectiveUserLocation = userLocation || estimatedUserLocation;
            
            let aScore = 0;
            let bScore = 0;
            
            aScore += tierPriority[aTier];
            bScore += tierPriority[bTier];
            
            if (effectiveUserLocation && a.coordinates && b.coordinates) {
                if (a._inUserCity) aScore += 40;
                if (b._inUserCity) bScore += 40;
                
                if (a._inUserState && !a._inUserCity) aScore += 20;
                if (b._inUserState && !b._inUserCity) bScore += 20;
                
                const aDistance = a._distance || 999;
                const bDistance = b._distance || 999;
                if (aDistance < 999) {
                    if (aDistance <= 5) aScore += 30;
                    else if (aDistance <= 10) aScore += 20;
                    else if (aDistance <= 25) aScore += 10;
                    else if (aDistance <= 50) aScore += 5;
                }
                if (bDistance < 999) {
                    if (bDistance <= 5) bScore += 30;
                    else if (bDistance <= 10) bScore += 20;
                    else if (bDistance <= 25) bScore += 10;
                    else if (bDistance <= 50) bScore += 5;
                }
            }
            
            const aRandom = seededRandom(window._sortRandomSeed, parseInt(a.id) || 0);
            const bRandom = seededRandom(window._sortRandomSeed, parseInt(b.id) || 0);
            aScore += aRandom * 40;
            bScore += bRandom * 40;
            
            if (Math.abs(aScore - bScore) > 0.1) {
                return bScore - aScore;
            }
            
            return a.business_name.localeCompare(b.business_name);
        } else if (sortOption === 'az') {
            return a.business_name.localeCompare(b.business_name);
        } else if (sortOption === 'closest') {
            return (a._distance || Infinity) - (b._distance || Infinity);
        }
        return 0;
    });

    updateTypoSuggestion(rawSearchTerm, searchTerm);
    
    /*
    Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    */
    
    displayedListingsCount = 15;
    renderListings();
    updateResultsCount();
    if (map) updateMapMarkers();
    if (splitViewActive) {
        renderSplitViewListings();
        updateSplitMapMarkers();
    }
}

function loadMoreListings() {
    displayedListingsCount += 15;
    renderListings(true); // Forces the function into incremental append mode
}

function normalizeString(str) {
    return str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function updateTypoSuggestion(rawTerm, normalizedTerm) {
    const suggestionEl = document.getElementById('typoSuggestion');
    if (!suggestionEl) return;

    if (!normalizedTerm || filteredListings.length > 0) {
        suggestionEl.classList.add('hidden');
        suggestionEl.innerHTML = '';
        return;
    }

    const suggestion = getClosestListingSuggestion(normalizedTerm);
    if (!suggestion) {
        suggestionEl.classList.add('hidden');
        suggestionEl.innerHTML = '';
        return;
    }

    suggestionEl.innerHTML = `Did you mean <button type="button" class="text-blue-600 hover:text-blue-800 underline" data-suggestion="${suggestion}">${suggestion}</button>?`;
    suggestionEl.classList.remove('hidden');

    const button = suggestionEl.querySelector('button[data-suggestion]');
    if (button) {
        button.addEventListener('click', () => {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = suggestion;
                applyFilters();
            }
        });
    }
}

function getClosestListingSuggestion(searchTerm) {
    let bestMatch = null;
    let bestScore = Infinity;

    allListings.forEach(listing => {
        const name = normalizeString(listing.business_name || '');
        if (!name) return;
        const distance = levenshteinDistance(searchTerm, name);
        if (distance < bestScore) {
            bestScore = distance;
            bestMatch = listing.business_name;
        }
    });

    if (!bestMatch) return null;

    const maxDistance = Math.max(2, Math.ceil(searchTerm.length * 0.4));
    return bestScore <= maxDistance ? bestMatch : null;
}

function levenshteinDistance(a, b) {
    const matrix = Array.from({ length: a.length + 1 }, () => []);
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[a.length][b.length];
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function getCentralTimeNow(listingTimezone = 'America/Chicago') {
    return getListingLocalDate(listingTimezone);
}

// One day's hours -> null (unknown), { closed: true }, { allDay: true, ... } or
// { ranges: [{ startMinutes, endMinutes, overnight }] }. Understands per-day objects
// ({ status, ranges }) and the older one-string-per-day format (see js/listing-hours.js).
function parseBusinessHoursRange(value) {
    const schedule = window.TGDListingHours.dayToSchedule(value);
    if (!schedule || schedule.closed || schedule.allDay) return schedule;
    return {
        closed: false,
        allDay: false,
        ranges: schedule.ranges.map(range => ({
            ...range,
            overnight: range.endMinutes <= range.startMinutes
        }))
    };
}

function getHoursStatus(hours, listingTimezone = 'America/Chicago') {
    if (!hours || typeof hours !== 'object' || Object.keys(hours).length === 0) {
        return { isOpen: null, isOpeningSoon: false, isClosingSoon: false };
    }

    const hasAnyHours = window.TGDListingHours.hasAnyHours(hours);
    if (!hasAnyHours) {
        return { isOpen: null, isOpeningSoon: false, isClosingSoon: false };
    }

    const centralTime = getCentralTimeNow(listingTimezone);
    const currentMinutes = centralTime.getHours() * 60 + centralTime.getMinutes();
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayIndex = centralTime.getDay();
    const yesterdayIndex = (todayIndex + 6) % 7;
    const todaySchedule = parseBusinessHoursRange(hours[days[todayIndex]]);
    const yesterdaySchedule = parseBusinessHoursRange(hours[days[yesterdayIndex]]);

    if (todaySchedule?.allDay) {
        return { isOpen: true, isOpeningSoon: false, isClosingSoon: false };
    }

    // A set of hours that started yesterday and runs past midnight.
    const carryOver = (yesterdaySchedule?.ranges || []).find(range => range.overnight && currentMinutes < range.endMinutes);
    if (carryOver) {
        return {
            isOpen: true,
            isOpeningSoon: false,
            isClosingSoon: carryOver.endMinutes - currentMinutes <= 60
        };
    }

    // A day can hold several sets of hours (e.g. 8-11 AM and 5-8 PM); the listing is open
    // when any of them covers the current time.
    const todayRanges = todaySchedule && !todaySchedule.closed ? todaySchedule.ranges : [];
    if (!todayRanges.length) {
        return { isOpen: false, isOpeningSoon: false, isClosingSoon: false };
    }

    for (const range of todayRanges) {
        if (range.overnight) {
            if (currentMinutes >= range.startMinutes || currentMinutes < range.endMinutes) {
                const remainingMinutes = currentMinutes >= range.startMinutes
                    ? (1440 - currentMinutes) + range.endMinutes
                    : range.endMinutes - currentMinutes;
                return {
                    isOpen: true,
                    isOpeningSoon: false,
                    isClosingSoon: remainingMinutes <= 60
                };
            }
        } else if (currentMinutes >= range.startMinutes && currentMinutes < range.endMinutes) {
            return {
                isOpen: true,
                isOpeningSoon: false,
                isClosingSoon: range.endMinutes - currentMinutes <= 60
            };
        }
    }

    // Closed right now: "opening soon" when the next set of hours starts within the hour.
    const minutesUntilNext = todayRanges.map(range => range.startMinutes - currentMinutes).filter(minutes => minutes > 0);
    const minutesUntilOpen = minutesUntilNext.length ? Math.min(...minutesUntilNext) : Infinity;
    return {
        isOpen: false,
        isOpeningSoon: minutesUntilOpen <= 60,
        isClosingSoon: false
    };
}

function isOpenNow(hours, listingTimezone) {
    return getHoursStatus(hours, listingTimezone).isOpen;
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function isOpeningSoon(hours, listingTimezone) {
    return getHoursStatus(hours, listingTimezone).isOpeningSoon;
}

function isClosingSoon(hours, listingTimezone) {
    return getHoursStatus(hours, listingTimezone).isClosingSoon;
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function hasUnknownHours(listing) {
    if (!listing.address || isBasedIn(listing)) return false;
    if (!listing.hours || typeof listing.hours !== 'object') return true;
    const hasAnyHours = window.TGDListingHours.hasAnyHours(listing.hours);
    if (!hasAnyHours) return true;
    const centralTime = getCentralTimeNow(listing.timezone || 'America/Chicago');
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[centralTime.getDay()];
    return window.TGDListingHours.normalizeDay(listing.hours[today]).status === 'unknown';
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function isBasedIn(listing) {
    return listing.city && listing.state && !listing.address;
}

function getFullAddress(listing) {
    if (listing.city && listing.state) {
        if (listing.address) {
            return `${listing.address}, ${listing.city}, ${listing.state} ${listing.zip_code || ''}`.trim();
        } else {
            return `${listing.city}, ${listing.state}`.trim();
        }
    }
    return listing.address || '';
}

function buildBadges(listing) {
    const badges = [];

    if (listing.permanently_closed === true) {
        badges.push('<span class="badge badge-permanently-closed">Permanently Closed</span>');
    } else if (listing.temporarily_closed === true) {
        badges.push('<span class="badge badge-temporarily-closed">Temporarily Closed</span>');
    } else {
        const openStatus = isOpenNow(listing.hours, listing.timezone || 'America/Chicago');
        const openingSoon = isOpeningSoon(listing.hours, listing.timezone || 'America/Chicago');
        const closingSoon = isClosingSoon(listing.hours, listing.timezone || 'America/Chicago');

        if (openingSoon) {
            badges.push('<span class="badge badge-opening-soon">Opening Soon</span>');
        } else if (closingSoon) {
            badges.push('<span class="badge badge-closing-soon">Closing Soon</span>');
        } else if (openStatus === true) {
            badges.push('<span class="badge badge-open">Open Now</span>');
        } else if (openStatus === false) {
            badges.push('<span class="badge badge-closed">Closed Now</span>');
        }
    }

    if (listing.coming_soon === true) {
        badges.push('<span class="badge badge-coming-soon">Coming Soon!</span>');
    }

    if (listing.tier === 'PREMIUM') {
        badges.push('<span class="badge badge-premium">Premium</span>');
    } else if (listing.tier === 'FEATURED') {
        badges.push('<span class="badge badge-featured">Featured</span>');
    }

    return badges;
}

function showsClaimedCheckmark(listing) {
    const isFeatured = listing.tier === 'FEATURED' || listing.tier === 'PREMIUM';
    return isFeatured || listing.is_claimed || listing.show_claim_button === false;
}


/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed 
without written permission from The Greek Directory. Unauthorized use, copying, modification, 
or distribution of this code will result in legal action to the fullest extent permitted by law.
*/

function generateListingCardHtml(l, view) {
    const fullAddress = getFullAddress(l);
    const listingUrl = `/listing/${l.slug}`;
    const badges = buildBadges(l);
    const isStarred = starredListings.includes(String(l.id));
    const logoImage = l.logo || '';
    const checkmarkHtml = showsClaimedCheckmark(l) ? CLAIMED_CHECKMARK_SVG : '';

    const hasLocation = !!fullAddress;
    const hasPhone = !!l.phone;
    const hasWebsite = !!l.website;
    const hasEmail = !!l.email;
    const showTaglineFallback = !hasLocation && !hasPhone && !hasWebsite && !hasEmail;

    const locationRowHtml = hasLocation ? `
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        <span class="truncate">${fullAddress}</span>
    ` : '';
    const phoneRowHtml = hasPhone ? `
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="#045093" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
        <span class="truncate">${formatPhoneDisplay(l.phone)}</span>
    ` : '';
    const websiteRowHtml = hasWebsite ? `
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="#045093" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
        <span class="truncate">${formatWebsiteDisplay(l.website)}</span>
    ` : '';
    const emailRowHtml = hasEmail ? `
        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="#045093" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
        <span class="truncate">${l.email}</span>
    ` : '';
    const taglineFallbackHtml = showTaglineFallback ? `<span class="truncate">${l.tagline || l.description || ''}</span>` : '';

    const contactCandidates = [
        { has: hasLocation, html: locationRowHtml },
        { has: hasPhone, html: phoneRowHtml },
        { has: hasWebsite, html: websiteRowHtml },
        { has: hasEmail, html: emailRowHtml },
    ];
    const contactRowsToShow = contactCandidates.filter(c => c.has).slice(0, 2).map(c => c.html);

    if (view === 'grid') {
        const firstPhoto = l.photos && l.photos.length > 0 ? l.photos[0] : (l.logo || '');
        return `
            <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden block relative hover-bounce listing-card-hover">
                <button class="star-button ${isStarred ? 'starred' : ''}" data-listing-id="${l.id}">
                    <svg class="star-icon" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </button>
                <a href="${listingUrl}" class="block">
                    <div class="h-48 bg-gray-200 relative">
                        ${firstPhoto ? `<img src="${firstPhoto}" alt="${l.business_name}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-gray-400">No image</div>'}
                        <div class="listing-image-gradient"></div>
                        ${badges.length > 0 ? `<div class="absolute top-2 left-2 flex gap-2 flex-wrap">${badges.join('')}</div>` : ''}
                    </div>
                    <div class="p-4">
                        <div class="flex gap-3 mb-3">
                            ${logoImage ? `<img src="${logoImage}" alt="${l.business_name} logo" class="w-16 h-16 rounded object-cover flex-shrink-0">` : '<div class="w-16 h-16 rounded bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">No logo</div>'}
                            <div class="flex-1 min-w-0">
                                <span class="text-xs font-semibold px-2 py-1 rounded-full text-white block w-fit mb-2" style="background-color:#045093;">${(l.subcategories && l.subcategories.length > 0) ? l.subcategories[0] : l.category}</span>
                                <h3 class="text-lg font-bold text-gray-900 mb-1 flex items-center gap-1.5">${l.business_name}${checkmarkHtml}</h3>
                            </div>
                        </div>
                        <p class="text-sm text-gray-600 mb-3 line-clamp-2">${l.tagline || l.description}</p>
                        <div class="text-sm text-gray-600 space-y-1">
                            ${contactRowsToShow.map(html => `<div class="flex items-center gap-2">${html}</div>`).join('')}
                            ${showTaglineFallback ? `<div class="flex items-center gap-2">${taglineFallbackHtml}</div>` : ''}
                        </div>
                    </div>
                </a>
            </div>
        `;
    } else {
        return `
            <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 flex gap-4 relative hover-bounce listing-card-hover">
                <button class="star-button ${isStarred ? 'starred' : ''}" data-listing-id="${l.id}" style="top: 12px; right: 12px;">
                    <svg class="star-icon" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </button>
                <a href="${listingUrl}" class="flex gap-4 flex-1 min-w-0">
                    ${logoImage ? `<img src="${logoImage}" alt="${l.business_name}" class="w-24 h-24 rounded-lg object-cover flex-shrink-0">` : '<div class="w-24 h-24 rounded-lg bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">No logo</div>'}
                    <div class="flex-1 min-w-0 overflow-hidden pr-12">
                        <div class="flex gap-2 mb-2 flex-wrap">
                            <span class="text-xs font-semibold px-2 py-1 rounded-full text-white" style="background-color:#045093;">${(l.subcategories && l.subcategories.length > 0) ? l.subcategories[0] : l.category}</span>
                            ${badges.join('')}
                        </div>
                        <h3 class="text-lg font-bold text-gray-900 mb-1 truncate flex items-center gap-1.5">${l.business_name}${checkmarkHtml}</h3>
                        <p class="text-sm text-gray-600 mb-2 line-clamp-1">${l.tagline || l.description}</p>
                        <div class="flex flex-col gap-1 text-sm text-gray-600">
                            ${contactRowsToShow.map(html => `<div class="flex items-center gap-1">${html}</div>`).join('')}
                            ${showTaglineFallback ? `<div class="flex items-center gap-1">${taglineFallbackHtml}</div>` : ''}
                        </div>
                    </div>
                </a>
            </div>
        `;
    }
}

// ============================================
// LISTINGS PAGE JAVASCRIPT - PART 4
// Rendering Functions
// ============================================

function renderListings(isAppend = false) {
    const container = document.getElementById('listingsContainer');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    if (!container) return;
    
    if (filteredListings.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-600 py-12">No listings found.</p>';
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        return;
    }

    const hasMore = displayedListingsCount < filteredListings.length;

    if (isAppend) {
        // Find just the new elements added in the most recent increment step
        const startIdx = displayedListingsCount - 15;
        const newDisplayedListings = filteredListings.slice(startIdx, displayedListingsCount);
        const newHtml = newDisplayedListings.map(l => generateListingCardHtml(l, currentView)).join('');
        
        // Inject elements at the bottom of the grid safely
        container.insertAdjacentHTML('beforeend', newHtml);
    } else {
        // Initial build or hard reset from a filter update
        const displayedListings = filteredListings.slice(0, displayedListingsCount);
        
        if (currentView === 'grid') {
            const screenWidth = window.innerWidth;
            let gridClass = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
            if (screenWidth >= 1024 && filterPosition === 'left' && !mapOpen) {
                gridClass = 'grid grid-cols-1 md:grid-cols-2 gap-6 listings-2-col';
            }
            container.className = gridClass;
        } else {
            container.className = 'space-y-4';
        }
        
        container.innerHTML = displayedListings.map(l => generateListingCardHtml(l, currentView)).join('');
    }
    
    if (loadMoreBtn) {
        if (hasMore) {
            loadMoreBtn.classList.remove('hidden');
            loadMoreBtn.textContent = `Load More Listings (${filteredListings.length - displayedListingsCount} remaining)`;
            loadMoreBtn.onclick = loadMoreListings;
        } else {
            loadMoreBtn.classList.add('hidden');
        }
    }

    if (splitViewActive) {
        renderSplitViewListings();
        updateSplitMapMarkers();
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function updateResultsCount() {
    const count = filteredListings.length;
    const resultsCount = document.getElementById('resultsCount');
    if (!resultsCount) return;
    if (viewingStarredOnly) {
        resultsCount.textContent = `${count} starred ${count === 1 ? 'listing' : 'listings'}`;
    } else {
        resultsCount.textContent = `${count} ${count === 1 ? 'listing' : 'listings'} found${selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}`;
    }
}

function updateRadiusValue() {
    ['radiusValue', 'radiusValue2'].forEach(id => {
        const valueSpan = document.getElementById(id);
        if (valueSpan) {
            if (selectedRadius === 0) {
                valueSpan.textContent = 'Any distance';
            } else {
                valueSpan.textContent = `${selectedRadius} ${selectedRadius === 1 ? 'mile' : 'miles'}`;
            }
        }
    });
}

function updateLocationSubtitle() {
    const urlPath = window.location.pathname;
    const pathParts = urlPath.split('/').filter(p => p);
    let subtitle = 'All Listings';
    if (pathParts.length >= 2 && pathParts[0] === 'listings') {
        const country = pathParts[1].toUpperCase();
        if (country === 'USA' && pathParts.length >= 3) {
            const state = pathParts[2].toUpperCase();
            subtitle = `${US_STATES[state] || state}, United States Listings`;
        } else if (country === 'USA') {
            subtitle = 'United States Listings';
        } else {
            subtitle = `${country} Listings`;
        }
    }
    const locationSubtitle = document.getElementById('locationSubtitle');
    if (locationSubtitle) {
        locationSubtitle.textContent = subtitle;
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function populateCountryFilter() {
    const countries = [...new Set(allListings.map(l => l.country || 'USA'))].sort();
    ['pricingFilter', 'pricingFilter2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = selectedPricing || '';
    });

    ['comingSoonFilter', 'comingSoonFilter2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });

    ['countryFilter', 'countryFilter2'].forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '<option value="">All Countries</option>';
            countries.forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country === 'USA' ? 'United States' : country;
                select.appendChild(option);
            });
        }
    });
}

function populateStateFilter(country) {
    if (country === 'USA') {
        const states = [...new Set(allListings.filter(l => (l.country || 'USA') === 'USA').map(l => l.state))].sort();
        ['stateFilter', 'stateFilter2'].forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = '<option value="">All States</option>';
                states.forEach(state => {
                    const option = document.createElement('option');
                    option.value = state;
                    option.textContent = `${US_STATES[state] || state} (${state})`;
                    select.appendChild(option);
                });
            }
        });
    }
}


/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed 
without written permission from The Greek Directory. Unauthorized use, copying, modification, 
or distribution of this code will result in legal action to the fullest extent permitted by law.
*/

// ============================================
// LISTINGS PAGE JAVASCRIPT - PART 5
// Event Listeners & UI Interactions
// ============================================

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            // FIXED: Immediate URL update - no delay
            updateURL(); // Updates ?q= instantly
            
            // Debounce the filtering for performance
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                if (!viewingStarredOnly) {
                    displayedListingsCount = 15;
                    applyFilters();
                }
            }, 100); // 100ms debounce for smooth typing
        });
    }
    
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) filterBtn.addEventListener('click', toggleFilters);
    
    const closeFilterBtn = document.getElementById('closeFilterBtn');
    if (closeFilterBtn) closeFilterBtn.addEventListener('click', toggleFilters);
    
    const mapBtn = document.getElementById('mapBtn');
    if (mapBtn) mapBtn.addEventListener('click', toggleMap);
    
    const mapBtnDesktop = document.getElementById('mapBtnDesktop');
    if (mapBtnDesktop) mapBtnDesktop.addEventListener('click', toggleMap);
    
    const gridViewBtn = document.getElementById('gridViewBtn');
    if (gridViewBtn) gridViewBtn.addEventListener('click', () => setView('grid'));
    
    const listViewBtn = document.getElementById('listViewBtn');
    if (listViewBtn) listViewBtn.addEventListener('click', () => setView('list'));
    
    const gridViewBtn2 = document.getElementById('gridViewBtn2');
    if (gridViewBtn2) gridViewBtn2.addEventListener('click', () => setView('grid'));
    
    const listViewBtn2 = document.getElementById('listViewBtn2');
    if (listViewBtn2) listViewBtn2.addEventListener('click', () => setView('list'));
    
    const splitViewBtn = document.getElementById('splitViewBtn');
    if (splitViewBtn) splitViewBtn.addEventListener('click', toggleSplitView);
    
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearAllFilters);
    
    const clearFiltersBtn2 = document.getElementById('clearFiltersBtn2');
    if (clearFiltersBtn2) clearFiltersBtn2.addEventListener('click', clearAllFilters);
    
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => window.location.reload());
    
    const toggleFilterPosition = document.getElementById('toggleFilterPosition');
    if (toggleFilterPosition) {
        toggleFilterPosition.addEventListener('click', () => {
            if (filterPosition === 'left') {
                filterPosition = 'top';
            } else {
                filterPosition = 'left';
            }
            closeDesktopFiltersOverlay();
            checkFilterPosition();
        });
    }

    const desktopFilterToggleBtn = document.getElementById('desktopFilterToggleBtn');
    if (desktopFilterToggleBtn) {
        desktopFilterToggleBtn.addEventListener('click', () => {
            if (mapOpen) {
                toggleDesktopFiltersOverlay();
            } else {
                filterPosition = 'left';
                checkFilterPosition();
            }
        });
    }

    const desktopFiltersBackdrop = document.getElementById('desktopFiltersBackdrop');
    if (desktopFiltersBackdrop) {
        desktopFiltersBackdrop.addEventListener('click', closeDesktopFiltersOverlay);
    }

    /*
    Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    */

    ['radiusFilter', 'radiusFilter2'].forEach(id => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.addEventListener('input', (e) => {
                selectedRadius = parseInt(e.target.value);
                const radiusFilter = document.getElementById('radiusFilter');
                const radiusFilter2 = document.getElementById('radiusFilter2');
                if (radiusFilter) radiusFilter.value = selectedRadius;
                if (radiusFilter2) radiusFilter2.value = selectedRadius;
                updateRadiusValue();
                updateURL();
                if (selectedRadius > 0 && !userLocation) {
                    requestPreciseLocation('radius-filter');
                }
                if (!viewingStarredOnly) {
                    displayedListingsCount = 15;
                    applyFilters();
                }
            });
        }
    });
    
    ['openNowFilter', 'openNowFilter2'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                openNowOnly = e.target.checked;
                const openFilter = document.getElementById('openNowFilter');
                const openFilter2 = document.getElementById('openNowFilter2');
                if (openFilter) openFilter.checked = openNowOnly;
                if (openFilter2) openFilter2.checked = openNowOnly;
                updateURL();
                if (!viewingStarredOnly) {
                    displayedListingsCount = 15;
                    applyFilters();
                }
            });
        }
    });

    ['closedNowFilter', 'closedNowFilter2'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                closedNowOnly = e.target.checked;
                const closedFilter = document.getElementById('closedNowFilter');
                const closedFilter2 = document.getElementById('closedNowFilter2');
                if (closedFilter) closedFilter.checked = closedNowOnly;
                if (closedFilter2) closedFilter2.checked = closedNowOnly;
                updateURL();
                if (!viewingStarredOnly) {
                    displayedListingsCount = 15;
                    applyFilters();
                }
            });
        }
    });

    ['openingSoonFilter', 'openingSoonFilter2'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                openingSoonOnly = e.target.checked;
                const openingSoonFilter = document.getElementById('openingSoonFilter');
                const openingSoonFilter2 = document.getElementById('openingSoonFilter2');
                if (openingSoonFilter) openingSoonFilter.checked = openingSoonOnly;
                if (openingSoonFilter2) openingSoonFilter2.checked = openingSoonOnly;
                updateURL();
                if (!viewingStarredOnly) {
                    displayedListingsCount = 15;
                    applyFilters();
                }
            });
        }
    });

    ['closingSoonFilter', 'closingSoonFilter2'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                closingSoonOnly = e.target.checked;
                const closingSoonFilter = document.getElementById('closingSoonFilter');
                const closingSoonFilter2 = document.getElementById('closingSoonFilter2');
                if (closingSoonFilter) closingSoonFilter.checked = closingSoonOnly;
                if (closingSoonFilter2) closingSoonFilter2.checked = closingSoonOnly;
                updateURL();
                if (!viewingStarredOnly) {
                    displayedListingsCount = 15;
                    applyFilters();
                }
            });
        }
    });

    ['hoursUnknownFilter', 'hoursUnknownFilter2'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                hoursUnknownOnly = e.target.checked;
                const hoursUnknownFilter = document.getElementById('hoursUnknownFilter');
                const hoursUnknownFilter2 = document.getElementById('hoursUnknownFilter2');
                if (hoursUnknownFilter) hoursUnknownFilter.checked = hoursUnknownOnly;
                if (hoursUnknownFilter2) hoursUnknownFilter2.checked = hoursUnknownOnly;
                updateURL();
                if (!viewingStarredOnly) {
                    displayedListingsCount = 15;
                    applyFilters();
                }
            });
        }
    });
    

    ['comingSoonFilter', 'comingSoonFilter2'].forEach(id => {
        const cb = document.getElementById(id);
        if (cb) {
            cb.addEventListener('change', (e) => {
                comingSoonOnly = e.target.checked;
                const c1 = document.getElementById('comingSoonFilter');
                const c2 = document.getElementById('comingSoonFilter2');
                if (c1) c1.checked = comingSoonOnly;
                if (c2) c2.checked = comingSoonOnly;
                updateURL();
                if (!viewingStarredOnly) applyFilters();
            });
        }
    });

    ['pricingFilter', 'pricingFilter2'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.addEventListener('change', (e) => {
                selectedPricing = e.target.value;
                const p1 = document.getElementById('pricingFilter');
                const p2 = document.getElementById('pricingFilter2');
                if (p1) p1.value = selectedPricing;
                if (p2) p2.value = selectedPricing;
                updateURL();
                if (!viewingStarredOnly) applyFilters();
            });
        }
    });

    ['onlineOnlyFilter', 'onlineOnlyFilter2'].forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                onlineOnly = e.target.checked;
                const onlineFilter = document.getElementById('onlineOnlyFilter');
                const onlineFilter2 = document.getElementById('onlineOnlyFilter2');
                if (onlineFilter) onlineFilter.checked = onlineOnly;
                if (onlineFilter2) onlineFilter2.checked = onlineOnly;
                updateURL();
                if (!viewingStarredOnly) {
                    displayedListingsCount = 15;
                    applyFilters();
                }
            });
        }
    });
    
    /*
    Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    */
    
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            if (sortSelect.value === 'closest' && !userLocation) {
                requestPreciseLocation('closest-sort');
            }
            displayedListingsCount = 15;
            if (!viewingStarredOnly) applyFilters();
            else renderListings();
        });
    }
    
    ['pricingFilter', 'pricingFilter2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = selectedPricing || '';
    });

    ['comingSoonFilter', 'comingSoonFilter2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });

    ['countryFilter', 'countryFilter2'].forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.addEventListener('change', (e) => {
                selectedCountry = e.target.value;
                const countryFilter = document.getElementById('countryFilter');
                const countryFilter2 = document.getElementById('countryFilter2');
                if (countryFilter) countryFilter.value = selectedCountry;
                if (countryFilter2) countryFilter2.value = selectedCountry;
                
                if (selectedCountry === 'USA') {
                    const stateContainer = document.getElementById('stateFilterContainer');
                    const stateContainer2 = document.getElementById('stateFilterContainer2');
                    if (stateContainer) stateContainer.classList.remove('hidden');
                    if (stateContainer2) stateContainer2.classList.remove('hidden');
                    populateStateFilter('USA');
                } else {
                    const stateContainer = document.getElementById('stateFilterContainer');
                    const stateContainer2 = document.getElementById('stateFilterContainer2');
                    if (stateContainer) stateContainer.classList.add('hidden');
                    if (stateContainer2) stateContainer2.classList.add('hidden');
                    selectedState = '';
                }
                updateURL();
                if (!viewingStarredOnly) {
                    displayedListingsCount = 15;
                    applyFilters();
                }
            });
        }
    });
    
    ['stateFilter', 'stateFilter2'].forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.addEventListener('change', (e) => {
                selectedState = e.target.value;
                const stateFilter = document.getElementById('stateFilter');
                const stateFilter2 = document.getElementById('stateFilter2');
                if (stateFilter) stateFilter.value = selectedState;
                if (stateFilter2) stateFilter2.value = selectedState;
                updateURL();
                if (!viewingStarredOnly) {
                    displayedListingsCount = 15;
                    applyFilters();
                }
            });
        }
    });
    
    /*
    Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    */
    
    const locateBtn = document.getElementById('locateBtn');
    if (locateBtn) {
        locateBtn.addEventListener('click', () => {
            if (userLocation) {
                locationButtonActive = true;
                mapMoved = false;
                locateBtn.classList.add('active');
                locateBtn.style.backgroundColor = '#045093';
                locateBtn.style.color = 'white';
                const locateIcon = document.getElementById('locateBtnIcon');
                if (locateIcon) locateIcon.setAttribute('fill', 'white');
                if (map) {
                    map.setView([userLocation.lat, userLocation.lng], 13);
                    addUserLocationMarker();
                }
            } else {
                requestPreciseLocation('current-location-button');
            }
        });
    }
    
    const resetMapBtn = document.getElementById('resetMapBtn');
    if (resetMapBtn) {
        resetMapBtn.addEventListener('click', () => {
            if (map) {
                map.setView(defaultMapCenter, defaultMapZoom);
                if (mapReady && allListingsGeocoded) updateMapMarkers();
            }
        });
    }
    
    ['categorySearch', 'categorySearch2'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', (e) => {
                if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(() => {
                    filterCategoriesAndSubcategories(e.target.value);
                }, 300);
            });
        }
    });

    setupLocationSearch();

    document.addEventListener('click', function(e) {
        const starBtn = e.target.closest('.star-button');
        if (!starBtn) return;
        
        console.log('Star button clicked!', starBtn);
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const id = starBtn.getAttribute('data-listing-id');
        console.log('Listing ID:', id);
        
        if (id) {
            toggleStar(id, e);
            console.log('toggleStar called for ID:', id);
        } else {
            console.error('No listing ID found on star button');
        }
    }, true);
    
    console.log('Star button event listener registered');
    
    window.addEventListener('resize', checkFilterPosition);
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function toggleDesktopFiltersOverlay() {
    if (desktopFiltersOverlay) {
        closeDesktopFiltersOverlay();
    } else {
        openDesktopFiltersOverlay();
    }
}

function openDesktopFiltersOverlay() {
    desktopFiltersOverlay = true;
    const desktopFilters = document.getElementById('desktopFiltersContainer');
    const backdrop = document.getElementById('desktopFiltersBackdrop');
    const desktopLayout = document.getElementById('desktopLayout');
    
    if (desktopFilters) {
        desktopFilters.classList.remove('hidden');
        if (mapOpen) {
            desktopFilters.classList.remove('desktop-filters-overlay');
            desktopFilters.style.position = '';
            desktopFilters.style.width = '';
            desktopFilters.style.height = '';
            desktopFilters.style.maxHeight = '';
            desktopFilters.style.left = '';
            desktopFilters.style.top = '';
            desktopFilters.style.zIndex = '';
            desktopFilters.style.boxShadow = '';
            if (desktopLayout) {
                desktopLayout.style.display = 'flex';
                desktopLayout.style.gap = '1rem';
            }
        } else {
            desktopFilters.classList.add('desktop-filters-overlay');
            if (backdrop) backdrop.classList.remove('hidden');
        }
    }
}

function closeDesktopFiltersOverlay() {
    desktopFiltersOverlay = false;
    const desktopFilters = document.getElementById('desktopFiltersContainer');
    const backdrop = document.getElementById('desktopFiltersBackdrop');
    const desktopLayout = document.getElementById('desktopLayout');
    
    if (desktopFilters) {
        desktopFilters.classList.add('hidden');
        desktopFilters.classList.remove('desktop-filters-overlay');
    }
    if (backdrop) backdrop.classList.add('hidden');
    if (desktopLayout && mapOpen) {
        desktopLayout.style.display = '';
    }
}

function syncFilters() {
    const filterPairs = [
        'categorySearch', 'openNowFilter', 'closedNowFilter', 'openingSoonFilter',
        'closingSoonFilter', 'hoursUnknownFilter', 'onlineOnlyFilter', 'radiusFilter',
        'countryFilter', 'stateFilter', 'locationSearch'
    ];

    filterPairs.forEach(base => {
        const elem1 = document.getElementById(base);
        const elem2 = document.getElementById(base + '2');
        if (!elem1 || !elem2) return;
        
        elem1.addEventListener('input', () => { 
            if (base.includes('Filter') && elem1.type === 'checkbox') {
                elem2.checked = elem1.checked;
            } else {
                elem2.value = elem1.value;
            }
        });
        elem1.addEventListener('change', () => {
            if (base.includes('Filter') && elem1.type === 'checkbox') {
                elem2.checked = elem1.checked;
            } else {
                elem2.value = elem1.value;
            }
        });
        
        elem2.addEventListener('input', () => {
            if (base.includes('Filter') && elem2.type === 'checkbox') {
                elem1.checked = elem2.checked;
            } else {
                elem1.value = elem2.value;
            }
        });
        elem2.addEventListener('change', () => {
            if (base.includes('Filter') && elem2.type === 'checkbox') {
                elem1.checked = elem2.checked;
            } else {
                elem1.value = elem2.value;
            }
        });
    });
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function toggleFilters() {
    const panel = document.getElementById('filterPanel');
    if (!panel) return;
    
    filtersOpen = !filtersOpen;
    if (filtersOpen) {
        panel.classList.remove('hidden');
        if (mapOpen) toggleMap();
    } else {
        panel.classList.add('hidden');
    }
}

function toggleMap() {
    const container = document.getElementById('mapContainer');
    if (!container) return;
    
    mapOpen = !mapOpen;
    if (mapOpen) {
        container.classList.remove('hidden');
        if (!map) {
            initMap();
        }
        if (filtersOpen) toggleFilters();
        if (splitViewActive) toggleSplitView();
        closeDesktopFiltersOverlay();
        checkFilterPosition();
        if (map) {
            setTimeout(() => {
                map.invalidateSize();
                map._hasCenteredOnUser = false;
                updateMapMarkers();
                if (userLocation) {
                    addUserLocationMarker();
                } else {
                    estimatedLocationCircle = updateEstimatedLocationCircle(map, estimatedLocationCircle);
                }
                if (allListingsGeocoded) hideMapLoading();
            }, 100);
        }
    } else {
        container.classList.add('hidden');
        checkFilterPosition();
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function setView(view, options = {}) {
    const { skipRender = false } = options;
    currentView = view;
    const gridViewBtn = document.getElementById('gridViewBtn');
    const listViewBtn = document.getElementById('listViewBtn');
    const gridViewBtn2 = document.getElementById('gridViewBtn2');
    const listViewBtn2 = document.getElementById('listViewBtn2');
    
    // FIXED: Add 'active' class for CSS styling
    if (gridViewBtn) {
        gridViewBtn.className = view === 'grid' ? 'p-2 rounded bg-white shadow-sm active' : 'p-2 rounded';
    }
    if (listViewBtn) {
        listViewBtn.className = view === 'list' ? 'p-2 rounded bg-white shadow-sm active' : 'p-2 rounded';
    }
    if (gridViewBtn2) {
        gridViewBtn2.className = view === 'grid' ? 'p-2 rounded bg-white shadow-sm active' : 'p-2 rounded';
    }
    if (listViewBtn2) {
        listViewBtn2.className = view === 'list' ? 'p-2 rounded bg-white shadow-sm active' : 'p-2 rounded';
    }
    
    if (isPwaMode()) {
        localStorage.setItem('tgd_listings_layout', view);
    }

    if (!skipRender) {
        renderListings();
    }
}

function showMapLoading() {
    const loading = document.getElementById('mapLoading');
    if (loading) loading.style.display = 'block';
}

function hideMapLoading() {
    const loading = document.getElementById('mapLoading');
    if (loading) loading.style.display = 'none';
}


/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed 
without written permission from The Greek Directory. Unauthorized use, copying, modification, 
or distribution of this code will result in legal action to the fullest extent permitted by law.
*/

// ============================================
// LISTINGS PAGE JAVASCRIPT - PART 6
// Category & Filter Management
// ============================================

function createCategoryButtons(filteredCategories) {
    const categoriesToShow = filteredCategories && filteredCategories.length > 0 ? filteredCategories : CATEGORIES;

    ['categoryFilters', 'categoryFilters2'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const selectId = containerId === 'categoryFilters' ? 'categorySelect' : 'categorySelectDesktop';
        const textSize = containerId === 'categoryFilters' ? 'text-sm' : 'text-sm';

        container.innerHTML = `
            <select id="${selectId}" class="category-select ${textSize}">
                <option value="All">All</option>
                ${categoriesToShow.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
            </select>
        `;

        const select = container.querySelector('select');
        if (!select) return;
        select.value = selectedCategory || 'All';
        select.addEventListener('change', (event) => filterByCategory(event.target.value));
    });
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function filterByCategory(category) {
    selectedCategory = category || 'All';
    selectedSubcategories = [];
    
    createCategoryButtons();
    updateSubcategoryDisplay();
    updateURL();
    displayedListingsCount = 15;
    if (!viewingStarredOnly) applyFilters();
}

function updateSubcategoryDisplay(matchingSubcategories) {
    if (selectedCategory && selectedCategory !== 'All' && SUBCATEGORIES[selectedCategory]) {
        ['subcategoryContainer', 'subcategoryContainer2'].forEach((containerId, idx) => {
            const filtersId = idx === 0 ? 'subcategoryFilters' : 'subcategoryFilters2';
            const container = document.getElementById(containerId);
            const filtersDiv = document.getElementById(filtersId);
            
            if (container) container.classList.remove('hidden');
            if (filtersDiv) {
                filtersDiv.innerHTML = '';
                SUBCATEGORIES[selectedCategory].forEach(sub => {
                    const tag = document.createElement('div');
                    tag.className = 'subcategory-tag';
                    tag.textContent = sub;
                    if (selectedSubcategories.includes(sub)) {
                        tag.classList.add('selected');
                    }
                    tag.onclick = () => toggleSubcategory(sub);
                    filtersDiv.appendChild(tag);
                });
            }
        });
    } else if (matchingSubcategories && matchingSubcategories.length > 0) {
        ['subcategoryContainer', 'subcategoryContainer2'].forEach((containerId, idx) => {
            const filtersId = idx === 0 ? 'subcategoryFilters' : 'subcategoryFilters2';
            const container = document.getElementById(containerId);
            const filtersDiv = document.getElementById(filtersId);
            
            if (container) container.classList.remove('hidden');
            if (filtersDiv) {
                filtersDiv.innerHTML = '';
                
                matchingSubcategories.forEach(item => {
                    const tag = document.createElement('div');
                    tag.className = 'subcategory-tag';
                    tag.textContent = `${item.subcategory} (${item.category})`;
                    if (selectedSubcategories.includes(item.subcategory)) {
                        tag.classList.add('selected');
                    }
                    tag.onclick = () => toggleSubcategory(item.subcategory);
                    filtersDiv.appendChild(tag);
                });
            }
        });
    } else {
        ['subcategoryContainer', 'subcategoryContainer2'].forEach(id => {
            const container = document.getElementById(id);
            if (container) container.classList.add('hidden');
        });
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function toggleSubcategory(subcategory) {
    const index = selectedSubcategories.indexOf(subcategory);
    if (index > -1) {
        selectedSubcategories.splice(index, 1);
    } else {
        selectedSubcategories.push(subcategory);
    }
    
    updateSubcategoryDisplay();
    updateURL();
    displayedListingsCount = 15;
    if (!viewingStarredOnly) applyFilters();
}

function filterCategoriesAndSubcategories(searchTerm) {
    searchTerm = searchTerm.toLowerCase();
    
    const elem1 = document.getElementById('categorySearch');
    const elem2 = document.getElementById('categorySearch2');
    if (elem1) elem1.value = searchTerm;
    if (elem2) elem2.value = searchTerm;

    if (!searchTerm) {
        selectedSubcategories = [];
        updateSubcategoryDisplay();
        createCategoryButtons();
        if (!viewingStarredOnly) {
            displayedListingsCount = 15;
            applyFilters();
        }
        return;
    }
    
    const matchingSubcategories = [];
    const matchingCategories = new Set();
    
    Object.entries(SUBCATEGORIES).forEach(([category, subs]) => {
        subs.forEach(sub => {
            if (sub.toLowerCase().includes(searchTerm)) {
                matchingSubcategories.push({ category, subcategory: sub });
                matchingCategories.add(category);
            }
        });
    });

    CATEGORIES.forEach(cat => {
        if (cat.toLowerCase().includes(searchTerm)) {
            matchingCategories.add(cat);
        }
    });

    createCategoryButtons(Array.from(matchingCategories));

    if (matchingSubcategories.length > 0) {
        updateSubcategoryDisplay(matchingSubcategories);
    } else {
        updateSubcategoryDisplay();
    }
    
    updateURL();
    if (!viewingStarredOnly) {
        displayedListingsCount = 15;
        applyFilters();
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function clearAllFilters() {
    selectedCategory = 'All';
    selectedSubcategories = [];
    selectedCountry = '';
    selectedState = '';
    selectedCity = '';
    selectedZip = '';
    selectedRadius = 0;
    openNowOnly = false;
    closedNowOnly = false;
    openingSoonOnly = false;
    closingSoonOnly = false;
    hoursUnknownOnly = false;
    onlineOnly = false;
    comingSoonOnly = false;
    selectedPricing = '';
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    
    ['categorySearch', 'categorySearch2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.value = '';
    });
    
    ['locationSearch', 'locationSearch2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.value = '';
    });
    
    ['pricingFilter', 'pricingFilter2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    ['comingSoonFilter', 'comingSoonFilter2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });

    ['countryFilter', 'countryFilter2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.value = '';
    });
    
    ['stateFilter', 'stateFilter2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.value = '';
    });
    
    const stateContainer = document.getElementById('stateFilterContainer');
    const stateContainer2 = document.getElementById('stateFilterContainer2');
    if (stateContainer) stateContainer.classList.add('hidden');
    if (stateContainer2) stateContainer2.classList.add('hidden');
    
    ['radiusFilter', 'radiusFilter2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.value = '0';
    });
    
    ['openNowFilter', 'openNowFilter2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.checked = false;
    });
    
    ['closedNowFilter', 'closedNowFilter2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.checked = false;
    });
    
    ['openingSoonFilter', 'openingSoonFilter2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.checked = false;
    });
    
    ['closingSoonFilter', 'closingSoonFilter2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.checked = false;
    });
    
    ['hoursUnknownFilter', 'hoursUnknownFilter2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.checked = false;
    });
    

    ['comingSoonFilter', 'comingSoonFilter2'].forEach(id => {
        const cb = document.getElementById(id);
        if (cb) {
            cb.addEventListener('change', (e) => {
                comingSoonOnly = e.target.checked;
                const c1 = document.getElementById('comingSoonFilter');
                const c2 = document.getElementById('comingSoonFilter2');
                if (c1) c1.checked = comingSoonOnly;
                if (c2) c2.checked = comingSoonOnly;
                if (!viewingStarredOnly) applyFilters();
            });
        }
    });

    ['pricingFilter', 'pricingFilter2'].forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.addEventListener('change', (e) => {
                selectedPricing = e.target.value;
                const p1 = document.getElementById('pricingFilter');
                const p2 = document.getElementById('pricingFilter2');
                if (p1) p1.value = selectedPricing;
                if (p2) p2.value = selectedPricing;
                if (!viewingStarredOnly) applyFilters();
            });
        }
    });

    ['onlineOnlyFilter', 'onlineOnlyFilter2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.checked = false;
    });
    
    ['subcategoryContainer', 'subcategoryContainer2'].forEach(id => {
        const elem = document.getElementById(id);
        if (elem) elem.classList.add('hidden');
    });
    
    updateRadiusValue();
    updateURL();
    createCategoryButtons();
    displayedListingsCount = 15;
    if (viewingStarredOnly) {
        toggleStarredView();
        toggleStarredView();
    } else {
        applyFilters();
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function setupLocationSearch() {
    const locationInputs = [
        { inputId: 'locationSearch',  resultsId: 'locationSearchResults' },
        { inputId: 'locationSearch2', resultsId: 'locationSearchResults2' }
    ];

    locationInputs.forEach(({ inputId, resultsId }) => {
        const input = document.getElementById(inputId);
        const resultsDiv = document.getElementById(resultsId);
        
        if (!input || !resultsDiv) return;

        input.addEventListener('input', () => {
            const query = input.value.toLowerCase().trim();
            
            const otherId = inputId === 'locationSearch' ? 'locationSearch2' : 'locationSearch';
            const otherInput = document.getElementById(otherId);
            if (otherInput) otherInput.value = input.value;

            if (query.length < 2) {
                resultsDiv.style.display = 'none';
                return;
            }

            const matches = [];
            const seen = new Set();

            allListings.forEach(listing => {
                const city = listing.city?.toLowerCase();
                const state = listing.state?.toLowerCase();
                const zip = listing.zip_code?.toLowerCase();
                const country = (listing.country || 'USA').toLowerCase();

                if (city && city.includes(query) && !seen.has(`city-${city}-${listing.state}`)) {
                    matches.push({ type: 'city', value: listing.city, state: listing.state, display: `${listing.city}, ${listing.state}` });
                    seen.add(`city-${city}-${listing.state}`);
                }
                if (state && state.includes(query) && !seen.has(`state-${state}`)) {
                    matches.push({ type: 'state', value: listing.state, display: US_STATES[listing.state] || listing.state });
                    seen.add(`state-${state}`);
                }
                if (zip && zip.includes(query) && !seen.has(`zip-${zip}`)) {
                    matches.push({ type: 'zip', value: listing.zip_code, city: listing.city, state: listing.state, display: `${listing.zip_code} (${listing.city}, ${listing.state})` });
                    seen.add(`zip-${zip}`);
                }
                if (country.includes(query) && !seen.has(`country-${country}`)) {
                    matches.push({ type: 'country', value: listing.country || 'USA', display: listing.country === 'USA' ? 'United States' : listing.country });
                    seen.add(`country-${country}`);
                }
            });

            if (matches.length > 0) {
                resultsDiv.innerHTML = matches.slice(0, 10).map(m => 
                    `<div class="location-search-result" data-type="${m.type}" data-value="${m.value}" data-state="${m.state || ''}" data-city="${m.city || ''}">${m.display}</div>`
                ).join('');
                resultsDiv.style.display = 'block';

                resultsDiv.querySelectorAll('.location-search-result').forEach(elem => {
                    elem.addEventListener('click', () => {
                        const type = elem.dataset.type;
                        const value = elem.dataset.value;

                        if (type === 'city') {
                            const state = elem.dataset.state;
                            selectedCountry = 'USA';
                            selectedState = state;
                            selectedCity = value;
                            selectedZip = '';
                            const countryFilter = document.getElementById('countryFilter');
                            const countryFilter2 = document.getElementById('countryFilter2');
                            if (countryFilter) countryFilter.value = 'USA';
                            if (countryFilter2) countryFilter2.value = 'USA';
                            
                            const stateContainer = document.getElementById('stateFilterContainer');
                            const stateContainer2 = document.getElementById('stateFilterContainer2');
                            if (stateContainer) stateContainer.classList.remove('hidden');
                            if (stateContainer2) stateContainer2.classList.remove('hidden');
                            
                            populateStateFilter('USA');
                            
                            const stateFilter = document.getElementById('stateFilter');
                            const stateFilter2 = document.getElementById('stateFilter2');
                            if (stateFilter) stateFilter.value = state;
                            if (stateFilter2) stateFilter2.value = state;
                        } else if (type === 'state') {
                            selectedCountry = 'USA';
                            selectedState = value;
                            selectedCity = '';
                            selectedZip = '';
                            const countryFilter = document.getElementById('countryFilter');
                            const countryFilter2 = document.getElementById('countryFilter2');
                            if (countryFilter) countryFilter.value = 'USA';
                            if (countryFilter2) countryFilter2.value = 'USA';
                            
                            const stateContainer = document.getElementById('stateFilterContainer');
                            const stateContainer2 = document.getElementById('stateFilterContainer2');
                            if (stateContainer) stateContainer.classList.remove('hidden');
                            if (stateContainer2) stateContainer2.classList.remove('hidden');
                            
                            populateStateFilter('USA');
                            
                            const stateFilter = document.getElementById('stateFilter');
                            const stateFilter2 = document.getElementById('stateFilter2');
                            if (stateFilter) stateFilter.value = value;
                            if (stateFilter2) stateFilter2.value = value;
                        } else if (type === 'zip') {
                            const state = elem.dataset.state;
                            selectedCountry = 'USA';
                            selectedState = state;
                            selectedZip = value;
                            selectedCity = elem.dataset.city || '';
                            const countryFilter = document.getElementById('countryFilter');
                            const countryFilter2 = document.getElementById('countryFilter2');
                            if (countryFilter) countryFilter.value = 'USA';
                            if (countryFilter2) countryFilter2.value = 'USA';
                            
                            const stateContainer = document.getElementById('stateFilterContainer');
                            const stateContainer2 = document.getElementById('stateFilterContainer2');
                            if (stateContainer) stateContainer.classList.remove('hidden');
                            if (stateContainer2) stateContainer2.classList.remove('hidden');
                            
                            populateStateFilter('USA');
                            
                            const stateFilter = document.getElementById('stateFilter');
                            const stateFilter2 = document.getElementById('stateFilter2');
                            if (stateFilter) stateFilter.value = state;
                            if (stateFilter2) stateFilter2.value = state;
                        } else if (type === 'country') {
                            selectedCountry = value;
                            selectedState = '';
                            selectedCity = '';
                            selectedZip = '';
                            const countryFilter = document.getElementById('countryFilter');
                            const countryFilter2 = document.getElementById('countryFilter2');
                            if (countryFilter) countryFilter.value = value;
                            if (countryFilter2) countryFilter2.value = value;
                            
                            if (value === 'USA') {
                                const stateContainer = document.getElementById('stateFilterContainer');
                                const stateContainer2 = document.getElementById('stateFilterContainer2');
                                if (stateContainer) stateContainer.classList.remove('hidden');
                                if (stateContainer2) stateContainer2.classList.remove('hidden');
                                populateStateFilter('USA');
                            } else {
                                const stateContainer = document.getElementById('stateFilterContainer');
                                const stateContainer2 = document.getElementById('stateFilterContainer2');
                                if (stateContainer) stateContainer.classList.add('hidden');
                                if (stateContainer2) stateContainer2.classList.add('hidden');
                            }
                        }

                        ['locationSearch', 'locationSearch2'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.value = '';
                        });
                        ['locationSearchResults', 'locationSearchResults2'].forEach(id => {
                            const el = document.getElementById(id);
                            if (el) el.style.display = 'none';
                        });

                        updateURL();
                        if (!viewingStarredOnly) {
                            displayedListingsCount = 15;
                            applyFilters();
                        }
                    });
                });
            } else {
                resultsDiv.style.display = 'none';
            }
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                resultsDiv.style.display = 'none';
            }, 200);
        });
    });
}


/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed 
without written permission from The Greek Directory. Unauthorized use, copying, modification, 
or distribution of this code will result in legal action to the fullest extent permitted by law.
*/

// ============================================
// LISTINGS PAGE JAVASCRIPT - PART 7
// Map Functions & Geocoding
// ALL PATCHES APPLIED
// ============================================

/* Copyright (C) The Greek Directory, 2025-present. All rights reserved. */

// ============================================
// HELPER FUNCTION - Call Button Generator
// ✅ PATCH #1 APPLIED: right:116px (was right:8px)
// ============================================

function generateCallButton(listing) {
    if (!listing.phone) return '';
    
    return `
        <a href="tel:${listing.phone}" 
           onclick="event.stopPropagation();"
           style="position:absolute;bottom:8px;right:116px;display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:#10b981;color:white;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;box-shadow:0 2px 4px rgba(0,0,0,0.1);transition:background 0.2s;z-index:10;" 
           onmouseover="this.style.background='#059669'" 
           onmouseout="this.style.background='#10b981'">
            <svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
            </svg>
            Call
        </a>
    `;
}

/* Copyright (C) The Greek Directory, 2025-present. All rights reserved. */

function attachClusterClickHandler(targetMap, clusterGroup) {
    clusterGroup.on('clusterclick', function(event) {
        const cluster = event.layer;
        const childMarkers = cluster.getAllChildMarkers();
        
        if (childMarkers.length > 10) {
            targetMap.setView(cluster.getLatLng(), targetMap.getZoom() + 2);
            return;
        }
        
        const clusterCenter = cluster.getLatLng();
        const nearbyMarkers = childMarkers.filter(m => {
            const markerPos = m.getLatLng();
            const dist = calculateDistance(
                clusterCenter.lat, clusterCenter.lng,
                markerPos.lat, markerPos.lng
            );
            return dist <= 0.1;
        });
        
        const listings = nearbyMarkers.map(m => {
            const listingId = m.options.listingId;
            return filteredListings.find(l => String(l.id) === String(listingId));
        }).filter(Boolean);
        
        if (listings.length === 0) return;
        
        const tierPriority = { PREMIUM: 4, FEATURED: 3, FREE: 1 };
        listings.sort((a, b) => {
            const aTier = a.tier || 'FREE';
            const bTier = b.tier || 'FREE';
            return tierPriority[bTier] - tierPriority[aTier];
        });
        
        const clusterPopupContent = listings.map(listing => {
            const fullAddr = getFullAddress(listing);
            const directionsUrl = getDirectionsUrl(listing);
            const callButton = generateCallButton(listing);
            const badges = buildBadges(listing);
            const firstPhoto = listing.photos && listing.photos.length > 0 ? listing.photos[0] : '';
            const logoImage = listing.logo || '';
            const categorySlug = listing.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const checkmarkHtml = showsClaimedCheckmark(listing) ? 
                '<svg style="width:16px;height:16px;margin-left:4px;flex-shrink:0;" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#045093"/><path d="M7 12.5l3.5 3.5L17 9" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
            
            return `
                <div class="map-popup" style="width: 280px; margin-bottom: ${listings.length > 1 ? '16px' : '0'}; border-bottom: ${listings.length > 1 ? '1px solid #e5e7eb; padding-bottom: 16px' : '0'};">
                    ${firstPhoto ? `<img src="${firstPhoto}" alt="${listing.business_name}" style="width:100%;height:140px;object-fit:cover;border-radius:12px 12px 0 0;">` : 
                    `<div style="width:100%;height:140px;background:linear-gradient(135deg, #045093 0%, #0369a1 100%);border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;"><svg style="width:48px;height:48px;color:rgba(255,255,255,0.5);" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/></svg></div>`}
                    
                    <div class="map-popup-content" style="padding: 12px; padding-bottom: 50px; position: relative;">
                        ${logoImage ? `<div style="width:48px;height:48px;background:white;border-radius:8px;padding:4px;display:flex;align-items:center;justify-content:center;position:absolute;top:-24px;right:12px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.15);"><img src="${logoImage}" alt="${listing.business_name} logo" style="width:100%;height:100%;object-fit:contain;border-radius:4px;"></div>` : ''}
                        
                        <div class="map-popup-info">
                            <div class="map-popup-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${badges.join('')}</div>
                            
                            <a href="/listing/${listing.slug}" class="map-popup-title" style="font-size:16px;font-weight:700;color:#1f2937;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-bottom:6px;line-height:1.3;flex-wrap:wrap;word-wrap:break-word;hyphens:auto;">${listing.business_name}${checkmarkHtml}</a>
                            
                            ${listing.tagline ? `<div class="map-popup-tagline" style="font-size:13px;color:#6b7280;margin-bottom:8px;line-height:1.4;word-wrap:break-word;hyphens:auto;">${listing.tagline}</div>` : ''}
                            
                            <div class="map-popup-details" style="font-size:12px;color:#6b7280;margin-bottom:4px;">
                                <div style="display:flex;align-items:start;gap:6px;margin-bottom:4px;"><svg style="width:14px;height:14px;margin-top:2px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span style="line-height:1.4;word-wrap:break-word;hyphens:auto;">${fullAddr}</span></div>
                                ${listing.phone ? `<div style="display:flex;align-items:center;gap:6px;"><svg style="width:14px;height:14px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg><span>${formatPhoneDisplay(listing.phone)}</span></div>` : ''}
                            </div>
                            
                            ${callButton}
                            
                            <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="position:absolute;bottom:8px;right:8px;display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:#045093;color:white;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;box-shadow:0 2px 4px rgba(0,0,0,0.1);transition:background 0.2s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;" onmouseover="this.style.background='#033d7a'" onmouseout="this.style.background='#045093'"><svg style="width:14px;height:14px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>Directions</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        const popup = L.popup({
            maxWidth: 320,
            maxHeight: 400,
            className: 'custom-popup'
        })
        .setLatLng(cluster.getLatLng())
        .setContent(`<div style="max-height: 400px; overflow-y: auto;">${clusterPopupContent}</div>`)
        .openOn(targetMap);
    });
}

// ============================================
// MAP INITIALIZATION
// ============================================

function initMap() {
    if (map) return;
    showMapLoading();
    const preferred = getPreferredMapCenter();
    map = L.map('map', { 
        preferCanvas: true,
        center: preferred ? [preferred.lat, preferred.lng] : defaultMapCenter, 
        zoom: preferred ? 13 : defaultMapZoom, 
        zoomControl: true,
        scrollWheelZoom: false,
        touchZoom: true,
        doubleClickZoom: true
    });
    
    map.on('click', function() {
        map.scrollWheelZoom.enable();
    });
    map.on('mouseout', function() {
        map.scrollWheelZoom.disable();
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: null, 
        maxZoom: 19,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 1,
        reuseTiles: true
    }).addTo(map);
    
    markerClusterGroup = L.markerClusterGroup({
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
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = 'small';
            if (count >= 10) size = 'medium';
            if (count >= 50) size = 'large';
            return L.divIcon({
                html: `<div class="marker-cluster marker-cluster-${size}">${count}</div>`,
                className: '',
                iconSize: size === 'small' ? [40, 40] : size === 'medium' ? [50, 50] : [60, 60]
            });
        }
    });
    map.addLayer(markerClusterGroup);

    attachClusterClickHandler(map, markerClusterGroup);
    
    if (userLocation) {
        addUserLocationMarker();
    } else {
        estimatedLocationCircle = updateEstimatedLocationCircle(map, estimatedLocationCircle);
    }
    
    map.on('movestart', () => {
        if (locationButtonActive && !mapMoved) {
            mapMoved = true;
            locationButtonActive = false;
            const locateBtn = document.getElementById('locateBtn');
            if (locateBtn) {
                locateBtn.classList.remove('active');
                locateBtn.style.backgroundColor = '';
                locateBtn.style.color = '';
            }
            const locateIcon = document.getElementById('locateBtnIcon');
            if (locateIcon) locateIcon.setAttribute('fill', '#045093');
        }
    });

    map.on('zoomend', () => {
        if (mapOpen) updateMapMarkers();
    });
    
    setTimeout(() => {
        map.invalidateSize();
        mapReady = true;
        updateMapMarkers();
        if (allListingsGeocoded) hideMapLoading();
    }, 500);
}

/* Copyright (C) The Greek Directory, 2025-present. All rights reserved. */

// ============================================
// GEOCODING
// ============================================

async function geocodeAllListings() {
    let geocodedCount = 0;
    for (let listing of allListings) {
        if (!listing.coordinates && listing.address && !isBasedIn(listing)) {
            await geocodeListing(listing);
            geocodedCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    allListingsGeocoded = true;
    if (map && mapReady) {
        hideMapLoading();
        updateMapMarkers();
    }
    if (splitViewActive) {
        renderSplitViewListings();
        updateSplitMapMarkers();
    }
}

async function geocodeListing(listing) {
    const fullAddress = getFullAddress(listing);
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`);
        const data = await response.json();
        if (data && data.length > 0) {
            listing.coordinates = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        }
    } catch (e) {
        console.error('Geocoding failed for', listing.business_name, e);
    }
}

/* Copyright (C) The Greek Directory, 2025-present. All rights reserved. */

function mapVisibleRadiusMiles(leafletMap) {
    if (!leafletMap) return Infinity;
    try {
        var bounds = leafletMap.getBounds();
        var sw = bounds.getSouthWest();
        var ne = bounds.getNorthEast();
        var diag = calculateDistance(sw.lat, sw.lng, ne.lat, ne.lng);
        return diag / 2;
    } catch(e) { return Infinity; }
}

function getPreferredMapCenter() {
    const location = userLocation || estimatedUserLocation;
    if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
        return { lat: location.lat, lng: location.lng, estimated: location.estimated };
    }
    return null;
}

function centerMapOnPreferredLocation(mapInstance, zoomLevel = 13) {
    if (!mapInstance) return;
    const preferred = getPreferredMapCenter();
    if (preferred) {
        mapInstance.setView([preferred.lat, preferred.lng], zoomLevel);
    } else {
        mapInstance.setView(defaultMapCenter, defaultMapZoom);
    }
}

function updateEstimatedLocationCircle(mapInstance, existingCircle) {
    if (!mapInstance || userLocation || !estimatedUserLocation) return existingCircle;
    if (existingCircle) return existingCircle;
    return L.circle([estimatedUserLocation.lat, estimatedUserLocation.lng], {
        radius: 10000,
        color: '#045093',
        fillColor: '#045093',
        fillOpacity: 0.15,
        weight: 2
    }).addTo(mapInstance);
}

function clearEstimatedLocationCircle(mapInstance, existingCircle) {
    if (mapInstance && existingCircle) {
        mapInstance.removeLayer(existingCircle);
    }
    return null;
}

function getTierMarkerStyles(listing) {
    const tier = (listing.tier || '').toUpperCase();
    switch (tier) {
        case 'PREMIUM':
            return { className: 'tier-premium', zIndex: 400 };
        case 'FEATURED':
            return { className: 'tier-featured', zIndex: 300 };
                default:
            return { className: 'tier-free', zIndex: 100 };
    }
}

function buildMapPopupContent(listing) {
    const badges = buildBadges(listing);
    const checkmarkHtml = showsClaimedCheckmark(listing)
        ? '<svg style="width:16px;height:16px;margin-left:4px;flex-shrink:0;" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#045093"/><path d="M7 12.5l3.5 3.5L17 9" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '';
    const categorySlug = listing.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const firstPhoto = listing.photos && listing.photos.length > 0 ? listing.photos[0] : (listing.logo || '');
    const heroImage = firstPhoto || '';
    const logoImage = listing.logo || '';
    const fullAddr = getFullAddress(listing);
    const directionsUrl = getDirectionsUrl(listing);
    const callButton = generateCallButton(listing);

    return `
        <div class="map-popup" style="width: 280px;">
            ${heroImage ? `
                <img src="${heroImage}" 
                     alt="${listing.business_name}" 
                     style="width:100%;height:140px;object-fit:cover;border-radius:12px 12px 0 0;">
            ` : `
                <div style="width:100%;height:140px;background:linear-gradient(135deg, #045093 0%, #0369a1 100%);border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;">
                    <svg style="width:48px;height:48px;color:rgba(255,255,255,0.5);" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
                    </svg>
                </div>
            `}
            
            <div class="map-popup-content" style="padding: 12px; padding-bottom: 50px; position: relative;">
                ${logoImage ? `<div style="width:48px;height:48px;background:white;border-radius:8px;padding:4px;display:flex;align-items:center;justify-content:center;position:absolute;top:-24px;right:12px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.15);"><img src="${logoImage}" alt="${listing.business_name} logo" style="width:100%;height:100%;object-fit:contain;border-radius:4px;"></div>` : ''}
                
                <div class="map-popup-info">
                    <div class="map-popup-badges" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
                        ${badges.join('')}
                    </div>
                    
                    <a href="/listing/${listing.slug}" 
                       class="map-popup-title" 
                       style="font-size:16px;font-weight:700;color:#1f2937;text-decoration:none;display:flex;align-items:center;gap:4px;margin-bottom:6px;line-height:1.3;">
                        ${listing.business_name}${checkmarkHtml}
                    </a>
                    
                    ${listing.tagline ? `
                        <div class="map-popup-tagline" style="font-size:13px;color:#6b7280;margin-bottom:8px;line-height:1.4;">
                            ${listing.tagline}
                        </div>
                    ` : ''}
                    
                    <div class="map-popup-details" style="font-size:12px;color:#6b7280;margin-bottom:4px;">
                        ${fullAddr ? `
                        <div style="display:flex;align-items:start;gap:6px;margin-bottom:4px;">
                            <svg style="width:14px;height:14px;margin-top:2px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                            <span style="line-height:1.4;">${fullAddr}</span>
                        </div>
                        ` : ''}
                        
                        ${listing.phone ? `
                            <div style="display:flex;align-items:center;gap:6px;">
                                <svg style="width:14px;height:14px;flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                </svg>
                                <span>${formatPhoneDisplay(listing.phone)}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    ${callButton}
                    
                    <a href="${directionsUrl}" 
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
                </div>
            </div>
        </div>
    `;
}

function updateMapMarkers() {
    if (!map || !markerClusterGroup || !mapReady) return;
    markerClusterGroup.clearLayers();

    var useMapRadius = (mapOpen && selectedRadius === 0);
    var mapRadiusLimit = 50;
    var effectiveLocation = userLocation || estimatedUserLocation;

    if (useMapRadius) {
        var visibleRadius = mapVisibleRadiusMiles(map);
        if (visibleRadius > 100) {
            useMapRadius = false;
        }
    }

    const bounds = [];
    filteredListings.forEach(listing => {
        if (listing.coordinates && !isBasedIn(listing)) {

            if (useMapRadius && effectiveLocation) {
                var dist = calculateDistance(
                    effectiveLocation.lat, effectiveLocation.lng,
                    listing.coordinates.lat, listing.coordinates.lng
                );
                if (dist > mapRadiusLimit) return;
            }

            const logoImage = listing.logo || '';
            const tierMarker = getTierMarkerStyles(listing);
            const iconClass = `custom-marker ${tierMarker.className}`;
            const iconHtml = logoImage ? 
                `<div class="${iconClass}"><img src="${logoImage}" alt="${listing.business_name}"></div>` :
                `<div class="${iconClass}"><div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#666;">No logo</div></div>`;
            const customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
            const marker = L.marker([listing.coordinates.lat, listing.coordinates.lng], { 
                icon: customIcon, 
                riseOnHover: true,
                listingId: listing.id,
                zIndexOffset: tierMarker.zIndex
            });
            
            const popupContent = buildMapPopupContent(listing);
            
            marker.bindPopup(popupContent, { maxWidth: 320, className: 'custom-popup' });
            marker.on('popupopen', () => {
                const closeBtn = document.querySelector('.leaflet-popup-close-button');
                if (closeBtn) closeBtn.textContent = '×';
            });
            markerClusterGroup.addLayer(marker);
            bounds.push([listing.coordinates.lat, listing.coordinates.lng]);
        }
    });
    
    if (!map._hasCenteredOnUser) {
        const preferred = getPreferredMapCenter();
        if (preferred) {
            map.setView([preferred.lat, preferred.lng], 13);
            map._hasCenteredOnUser = true;
        }
    }
    if (!userLocation) {
        estimatedLocationCircle = updateEstimatedLocationCircle(map, estimatedLocationCircle);
    }
    if (bounds.length > 0 && !map._hasAutoFitted && !getPreferredMapCenter()) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 });
        map._hasAutoFitted = true;
    }
}

/* Copyright (C) The Greek Directory, 2025-present. All rights reserved. */


/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed 
without written permission from The Greek Directory. Unauthorized use, copying, modification, 
or distribution of this code can result in legal action to the fullest extent permitted by law.
*/

// ============================================
// LISTINGS PAGE JAVASCRIPT - PART 8
// Split View Functions
// ============================================

function toggleSplitView() {
    splitViewActive = !splitViewActive;
    if (splitViewActive) {
        document.getElementById('normalViewControls').classList.add('hidden');
        document.getElementById('normalViewListings').classList.add('hidden');
        document.getElementById('mapContainer').classList.add('hidden');
        const splitContainer = document.getElementById('splitViewContainer');
        splitContainer.classList.remove('hidden');
        splitContainer.className = 'split-view-container';
        splitContainer.style.position = 'relative';
        splitContainer.style.zIndex = '10';
        splitContainer.innerHTML = `
            <div class="split-view-listings">
                <div class="mb-3 flex items-center justify-between px-2">
                    <div class="flex items-center gap-2">
                        <p class="text-sm text-gray-600" id="splitResultsCount"></p>
                        <button id="splitFiltersBtn" class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg> Filters
                        </button>
                    </div>
                    <select id="splitSortSelect" class="text-sm border border-gray-300 rounded-lg px-3 py-2">
                        <option value="default">Default</option>
                        <option value="az">A-Z</option>
                        <option value="closest">Closest to Me</option>
                        <option value="random">Random</option>
                    </select>
                </div>
                <div id="splitListingsContainer"></div>
            </div>
            <div class="split-view-map" style="position: relative; z-index: 10;">
                <div id="splitMap"></div>
                <div class="map-controls">
                    <button class="map-control-btn" id="splitViewToggleBtn" onclick="toggleSplitView()" title="Exit split view">
                        <svg width="16" height="16" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="#045093"><rect x="15" y="4" width="2" height="24"/><path d="M10,7V25H4V7h6m0-2H4A2,2,0,0,0,2,7V25a2,2,0,0,0,2,2h6a2,2,0,0,0,2-2V7a2,2,0,0,0-2-2Z"/><path d="M28,7V25H22V7h6m0-2H22a2,2,0,0,0-2,2V25a2,2,0,0,0,2,2h6a2,2,0,0,0,2-2V7a2,2,0,0,0-2-2Z"/></svg>
                        <span class="desktop-only">Exit Split View</span>
                    </button>
                    <button class="map-control-btn" id="splitLocateBtn" title="Find my location">
                        <svg id="splitLocateBtnIcon" width="16" height="16" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="#045093">
                            <polygon points="0,9.28 9.894,9.99 10.78,20 20,0"/>
                        </svg>
                        <span class="desktop-only">Current Location</span>
                    </button>
                    <button class="map-control-btn" id="splitResetMapBtn" title="Reset map view">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        <span class="desktop-only">Reload</span>
                    </button>
                </div>
            </div>
        `;
        checkFilterPosition();
        if (filtersOpen) { filtersOpen = false; document.getElementById('filterPanel').classList.add('hidden'); }

        document.getElementById('splitSortSelect').value = document.getElementById('sortSelect').value;
        document.getElementById('splitSortSelect').addEventListener('change', (e) => {
            document.getElementById('sortSelect').value = e.target.value;
            if (e.target.value === 'closest' && !userLocation) {
                requestPreciseLocation('closest-sort');
            }
            displayedListingsCount = 15;
            if (!viewingStarredOnly) applyFilters();
            else renderListings();
        });

        const splitFiltersBtn = document.getElementById('splitFiltersBtn');
        if (splitFiltersBtn) {
            splitFiltersBtn.addEventListener('click', toggleFilters);
        }

        renderSplitViewListings();
        initSplitMap();
    } else {
        document.getElementById('splitViewContainer').classList.add('hidden');
        document.getElementById('splitViewContainer').innerHTML = '';
        document.getElementById('normalViewControls').classList.remove('hidden');
        document.getElementById('normalViewListings').classList.remove('hidden');
        document.getElementById('mapContainer').classList.remove('hidden');
        checkFilterPosition();
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                updateMapMarkers();
            }
        }, 100);
    }
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function getSplitViewListings() {
    return filteredListings.filter(listing => listing.coordinates && !isBasedIn(listing));
}

function renderSplitViewListings() {
    const container = document.getElementById('splitListingsContainer');
    if (!container) return;
    const splitListings = getSplitViewListings();
    if (splitListings.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-600 py-12">No listings found.</p>';
        const splitResultsCount = document.getElementById('splitResultsCount');
        if (splitResultsCount) splitResultsCount.textContent = '0 listings found';
        return;
    }
    container.className = 'space-y-3';
    const splitResultsCount = document.getElementById('splitResultsCount');
    if (splitResultsCount) {
        splitResultsCount.textContent = `${splitListings.length} ${splitListings.length === 1 ? 'listing' : 'listings'} found`;
    }
    container.innerHTML = splitListings.map(l => {
        const fullAddress = getFullAddress(l);
        const categorySlug = l.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const listingUrl = `/listing/${l.slug}`;
        const badges = buildBadges(l);
        const categoryLabel = (l.subcategories && l.subcategories.length > 0) ? l.subcategories[0] : l.category;
        const isStarred = starredListings.includes(String(l.id));
        const logoImage = l.logo || '';
        const checkmarkHtml = showsClaimedCheckmark(l) ? '<svg style="width:20px;height:20px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#045093"></circle><path d="M7 12.5l3.5 3.5L17 9" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>' : '';
        const isSelected = String(selectedSplitListingId) === String(l.id);
        const hasCoordinates = l.coordinates && l.coordinates.lat && l.coordinates.lng;
        
        return `
            <div class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-3 relative split-listing-item ${isSelected ? 'selected-listing' : ''}" style="margin-right: 8px; display: flex; gap: 12px;">
                <button class="star-button ${isStarred ? 'starred' : ''}" data-listing-id="${l.id}" style="top: 8px; right: 8px; width: 32px; height: 32px; touch-action: manipulation !important; -webkit-tap-highlight-color: transparent !important;">
                    <svg class="star-icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </button>
                
                ${hasCoordinates ? `
                    <button type="button" class="split-listing-content" onclick="if(typeof selectSplitListing === 'function') selectSplitListing('${l.id}', ${l.coordinates.lat}, ${l.coordinates.lng});">
                        ${logoImage ? `<img src="${logoImage}" alt="${l.business_name}" class="w-16 h-16 rounded-lg object-cover flex-shrink-0">` : '<div class="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">No logo</div>'}
                        <div class="flex-1 min-w-0 overflow-hidden ${isSelected ? 'pr-2' : 'pr-8'}">
                            <div class="flex gap-1 mb-1 flex-wrap">
                                <span class="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style="background-color:#045093;">${categoryLabel}</span>
                                ${badges.join('')}
                            </div>
                            <h3 class="text-base font-bold text-gray-900 mb-1 truncate flex items-center gap-1.5">${l.business_name}${checkmarkHtml}</h3>
                            <p class="text-xs text-gray-600 mb-1 truncate">${l.tagline || l.description}</p>
                            <div class="text-xs text-gray-600">
                                <div class="flex items-center gap-1 truncate">
                                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                    <span class="truncate">${fullAddress}</span>
                                </div>
                            </div>
                        </div>
                    </button>
                    ${isSelected ? `<a href="${listingUrl}" class="split-listing-visit-btn">View</a>` : ''}
                ` : `
                    <a href="${listingUrl}" class="flex gap-3 flex-1 min-w-0" style="touch-action: manipulation !important; -webkit-tap-highlight-color: transparent !important;">
                        ${logoImage ? `<img src="${logoImage}" alt="${l.business_name}" class="w-16 h-16 rounded-lg object-cover flex-shrink-0">` : '<div class="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs">No logo</div>'}
                        <div class="flex-1 min-w-0 overflow-hidden pr-8">
                            <div class="flex gap-1 mb-1 flex-wrap">
                                ${badges.join('')}
                            </div>
                            <h3 class="text-base font-bold text-gray-900 mb-1 truncate flex items-center gap-1.5">${l.business_name}${checkmarkHtml}</h3>
                            <p class="text-xs text-gray-600 mb-1 truncate">${l.tagline || l.description}</p>
                            <div class="text-xs text-gray-600">
                                <div class="flex items-center gap-1 truncate">
                                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                                    <span class="truncate">${fullAddress}</span>
                                </div>
                            </div>
                        </div>
                    </a>
                `}
            </div>
        `;
    }).join('');
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

function updateSplitMapMarkers() {
    if (!window.splitMap || !splitMarkerClusterGroup) return;
    splitMarkerClusterGroup.clearLayers();

    var useMapRadius = (selectedRadius === 0);
    var mapRadiusLimit = 50;
    var effectiveLocation = userLocation || estimatedUserLocation;
    if (useMapRadius) {
        try {
            var visibleRadius = mapVisibleRadiusMiles(splitMap);
            if (visibleRadius > 100) useMapRadius = false;
        } catch (e) { }
    }

    const bounds = [];
    const splitListings = getSplitViewListings();
    splitListings.forEach(listing => {
        if (useMapRadius && effectiveLocation) {
            var dist = calculateDistance(
                effectiveLocation.lat, effectiveLocation.lng,
                listing.coordinates.lat, listing.coordinates.lng
            );
            if (dist > mapRadiusLimit) return;
        }

        const logoImage = listing.logo || '';
        const tierMarker = getTierMarkerStyles(listing);
        const iconClass = `custom-marker ${tierMarker.className}`;
        const iconHtml = logoImage ?
            `<div class="${iconClass}"><img src="${logoImage}" alt="${listing.business_name}"></div>` :
            `<div class="${iconClass}"><div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#666;">No logo</div></div>`;
        const customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 20] });
        const marker = L.marker([listing.coordinates.lat, listing.coordinates.lng], { icon: customIcon, riseOnHover: true, listingId: listing.id, zIndexOffset: tierMarker.zIndex });
        const popupContent = buildMapPopupContent(listing);
        marker.bindPopup(popupContent, { maxWidth: 320, className: 'custom-popup' });
        marker.on('popupopen', () => {
            const closeBtn = document.querySelector('.leaflet-popup-close-button');
            if (closeBtn) closeBtn.textContent = '×';
        });
        splitMarkerClusterGroup.addLayer(marker);
        bounds.push([listing.coordinates.lat, listing.coordinates.lng]);
    });

    if (!splitMap._hasCenteredOnUser) {
        const preferred = getPreferredMapCenter();
        if (preferred) {
            splitMap.setView([preferred.lat, preferred.lng], 13);
            splitMap._hasCenteredOnUser = true;
        }
    }
    if (!userLocation) {
        splitEstimatedLocationCircle = updateEstimatedLocationCircle(splitMap, splitEstimatedLocationCircle);
    }
    if (bounds.length > 0 && !splitMap._hasAutoFitted && !getPreferredMapCenter()) {
        splitMap.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 15 });
        splitMap._hasAutoFitted = true;
    }

    setTimeout(() => splitMap.invalidateSize(), 250);
}

function initSplitMap() {
    const splitMapDiv = document.getElementById('splitMap');
    if (!splitMapDiv) return;
    const preferred = getPreferredMapCenter();
    window.splitMap = L.map('splitMap', { 
        preferCanvas: true,
        center: preferred ? [preferred.lat, preferred.lng] : defaultMapCenter, 
        zoom: preferred ? 13 : defaultMapZoom, 
        zoomControl: true,
        scrollWheelZoom: false,
        touchZoom: true,
        doubleClickZoom: true
    });
    
    splitMap.on('click', function() {
        splitMap.scrollWheelZoom.enable();
    });
    splitMap.on('mouseout', function() {
        splitMap.scrollWheelZoom.disable();
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: null,
        maxZoom: 19,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 1,
        reuseTiles: true
    }).addTo(splitMap);
    window.splitMarkerClusterGroup = L.markerClusterGroup({
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
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let size = count >= 50 ? 'large' : count >= 10 ? 'medium' : 'small';
            return L.divIcon({
                html: `<div class="marker-cluster marker-cluster-${size}">${count}</div>`,
                className: '', iconSize: size === 'small' ? [40, 40] : size === 'medium' ? [50, 50] : [60, 60]
            });
        }
    });
    splitMap.addLayer(splitMarkerClusterGroup);
    attachClusterClickHandler(splitMap, splitMarkerClusterGroup);
    
    /*
    Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    */
    
    if (userLocation) {
        addSplitUserLocationMarker();
    } else {
        splitEstimatedLocationCircle = updateEstimatedLocationCircle(splitMap, splitEstimatedLocationCircle);
    }

    updateSplitMapMarkers();

    splitMap.on('zoomend', () => {
        updateSplitMapMarkers();
    });
    
    /*
    Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    */
    
    const splitLocateBtn = document.getElementById('splitLocateBtn');
    if (splitLocateBtn) {
        splitLocateBtn.addEventListener('click', () => {
            if (userLocation) {
                splitMap.setView([userLocation.lat, userLocation.lng], 13);
                splitLocateBtn.style.backgroundColor = '#045093';
                splitLocateBtn.style.color = 'white';
                const splitLocateIcon = document.getElementById('splitLocateBtnIcon');
                if (splitLocateIcon) splitLocateIcon.setAttribute('fill', 'white');
                const resetOnce = () => {
                    splitLocateBtn.style.backgroundColor = '';
                    splitLocateBtn.style.color = '';
                    if (splitLocateIcon) splitLocateIcon.setAttribute('fill', '#045093');
                    splitMap.off('movestart', resetOnce);
                };
                splitMap.on('movestart', resetOnce);
            } else {
                requestPreciseLocation('current-location-button');
            }
        });
    }
    
    document.getElementById('splitResetMapBtn')?.addEventListener('click', () => {
        splitMap.setView(defaultMapCenter, defaultMapZoom);
    });
}

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
*/

// ═══════════════════════════════════════════════════════════════
// ✅ PATCH #5 APPLIED: SPLIT VIEW SELECTION FUNCTION
// ═══════════════════════════════════════════════════════════════
window.selectSplitListing = function(listingId, lat, lng) {
    selectedSplitListingId = String(listingId);
    
    if (window.splitMap) {
        window.splitMap.setView([lat, lng], 15);
        
        if (window.splitMarkerClusterGroup) {
            window.splitMarkerClusterGroup.eachLayer(marker => {
                if (String(marker.options.listingId) === String(listingId)) {
                    window.splitMarkerClusterGroup.zoomToShowLayer(marker, () => {
                        marker.openPopup();
                    });
                }
            });
        }
    }
    
    renderSplitViewListings();
};
// ═══════════════════════════════════════════════════════════════

/*
Copyright (C) The Greek Directory, 2025-present. All rights reserved.
This source code is proprietary and no part may not be used, reproduced, or distributed 
without written permission from The Greek Directory. Unauthorized use, copying, modification, 
or distribution of this code can result in legal action to the fullest extent permitted by law.
*/