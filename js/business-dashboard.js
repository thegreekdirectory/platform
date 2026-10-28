// js/business-dashboard.js
/*
 * THE GREEK DIRECTORY — Business Portal Dashboard
 * © The Greek Directory 2025. All rights reserved.
 */

// ─── 1. Constants & State ────────────────────────────────────────

const SUPABASE_EDGE_BASE = 'https://luetekzqrrgdxtopzvqw.supabase.co/functions/v1';
const CF_STORAGE_KEY     = 'tgdCloudflareImagesConfig';
const UPLOAD_PROXY       = 'https://tgd-images-upload.thegreekdirectory.org';

const META_DESC_SUFFIX = ' — Greek business in {city}, {state}. View address, phone, hours, and photos.';

function getTaglineMaxLength(city = '', state = '') {
    const suffix = META_DESC_SUFFIX.replace('{city}', city || '').replace('{state}', state || '');
    return Math.max(30, Math.min(75, 160 - suffix.length - 2));
}

const TIER_LIMITS = {
    FREE:     { maxDesc: 1000, maxPhotos: 2,  maxCtas: 0, maxInfoFields: 0, hasVideo: false },
    FEATURED: { maxDesc: 2000, maxPhotos: 5,  maxCtas: 1, maxInfoFields: 3, hasVideo: false },
    PREMIUM:  { maxDesc: 5000, maxPhotos: 15, maxCtas: 2, maxInfoFields: 5, hasVideo: true  },
};

// Analytics time buckets — suffix maps directly to column names in listing_analytics_summary
const TIME_BUCKETS = [
    { value: '7d',  label: 'Last 7 days'    },
    { value: '14d', label: 'Last 14 days'   },
    { value: '1m',  label: 'Last month'     },
    { value: '3m',  label: 'Last 3 months'  },
    { value: '6m',  label: 'Last 6 months'  },
    { value: '1y',  label: 'Last year'      },
    { value: '2y',  label: 'Last 2 years'   },
    { value: 'all', label: 'All time'       },
];
const DEFAULT_BUCKET = '1m';

let SUBCATEGORIES = {
    'Automotive & Transportation':       ['Auto Detailer','Auto Repair Shop','Car Dealer','Taxi & Limo Service'],
    'Beauty & Health':                   ['Barbershop','Esthetician','Hair Salon','Nail Salon','Spa','Chiropractor','Dentist','Doctor','Nutritionist','Optometrist','Orthodontist','Physical Therapist','Personal Trainer'],
    'Church & Religious Organization':   ['Church','Greek Orthodox Church'],
    'Cultural/Fraternal Organization':   ['Dance Troupe','Non-Profit','Philanthropic Group','Society','Youth Organization'],
    'Education & Community':             ['Childcare','Greek School','Senior Care','Tutor'],
    'Entertainment, Arts & Recreation':  ['Band','DJ','Entertainment Group','Photographer','Art Gallery'],
    'Food & Hospitality':                ['Banquet Hall','Catering Service','Event Venue','Bakery','Deli','Pastry Shop','Bar','Breakfast','Coffee','Lunch','Dinner','Restaurant','Hotel','Airbnb'],
    'Grocery & Imports':                 ['Butcher Shop','Liquor Shop','Market','Greek Alcohol','Honey','Olive Oil','Food Distribution','Food Manufacturer'],
    'Home & Construction':               ['Carpenter','Electrician','General Contractor','Handyman','HVAC','Landscaping','Painter','Plumber','Roofing','Tile & Stone Specialist'],
    'Industrial & Manufacturing':        ['Food Manufacturer','Industrial Supplier'],
    'Pets & Veterinary':                 ['Veterinarian','Pet Accessories'],
    'Professional & Business Services':  ['Business Services','Consultant','CPA','Financial Advisor','Insurance Agent','IT Service & Repair','Lawyer','Marketing & Creative Agency','Notary','Wedding Planner','Travel Agency'],
    'Real Estate & Development':         ['Appraiser','Broker','Developer','Lender','Property Management','Real Estate Agent'],
    'Retail & Shopping':                 ['Boutique Shop','eCommerce','Jewelry','Souvenir Shop'],
};

let _selectedSubcats  = [];
let _primarySubcat    = null;
let _uploadedImages   = { logo: null, photos: [], video: null };
let _removedPhotos    = [];
let _rteInstance      = null;
let _tierLimits       = { ...TIER_LIMITS.FREE };
let _settingsVis      = { nameTitle: true, email: false, phone: false };

// Cached analytics summary row — fetched once per dashboard load, re-used on bucket switch
let _analyticsSummaryCache = null;

// ─── 2. Toast System ─────────────────────────────────────────────

function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.className = `bp-toast bp-toast--${type}`;
    toast.innerHTML = `
        <div class="bp-toast__icon">${icons[type] || 'ℹ'}</div>
        <div class="bp-toast__msg">${message}</div>
        <button class="bp-toast__close" aria-label="Dismiss">✕</button>
    `;
    const dismiss = () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); };
    toast.querySelector('.bp-toast__close').addEventListener('click', dismiss);
    container.appendChild(toast);
    requestAnimationFrame(() => { requestAnimationFrame(() => toast.classList.add('show')); });
    if (duration > 0) setTimeout(dismiss, duration);
}

// ─── 3. Confirm Modal ────────────────────────────────────────────

function showConfirmModal({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, danger = false }) {
    const existing = document.getElementById('bpModal');
    if (existing) existing.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'bp-modal-backdrop';
    backdrop.id = 'bpModal';
    backdrop.innerHTML = `
        <div class="bp-modal" role="dialog" aria-modal="true">
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="bp-modal__actions">
                <button class="bp-btn bp-btn--ghost" id="modalCancel">${cancelLabel}</button>
                <button class="bp-btn ${danger ? 'bp-btn--danger' : 'bp-btn--primary'}" id="modalConfirm">${confirmLabel}</button>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);
    const close = () => { backdrop.style.opacity = '0'; setTimeout(() => backdrop.remove(), 200); };
    backdrop.querySelector('#modalCancel').addEventListener('click', close);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    backdrop.querySelector('#modalConfirm').addEventListener('click', () => { close(); if (typeof onConfirm === 'function') onConfirm(); });
}

window.BP.showConfirmModal = showConfirmModal;

// ─── 4. Tab Switching ─────────────────────────────────────────────

const TAB_LABELS = { overview: 'Overview', edit: 'Edit Listing', analytics: 'Analytics', settings: 'Settings' };

function switchTab(tab) {
    const valid = Object.keys(TAB_LABELS);
    if (!valid.includes(tab)) tab = 'overview';
    valid.forEach(t => {
        document.getElementById(`content-${t}`)?.classList.toggle('hidden', t !== tab);
        document.querySelector(`.bp-nav-item[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
    const mobileTitle = document.getElementById('mobileTitle');
    if (mobileTitle) mobileTitle.textContent = TAB_LABELS[tab] || tab;
    if (window.location.hash !== `#${tab}`) history.replaceState({}, '', `${window.location.pathname}#${tab}`);
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
}

window.BP.switchTab = switchTab;

// ─── 5. Load Listing Data ─────────────────────────────────────────

async function loadListingData() {
    const ownerData = window.BP.ownerData;
    if (!ownerData || ownerData.length === 0) return;
    const listingId = ownerData[0].listing_id;
    const { data, error } = await window.TGDAuth.supabaseClient
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();
    if (error) {
        console.error('Error loading listing:', error);
        showToast('Failed to load listing data. Please refresh.', 'error');
        return;
    }
    window.BP.currentListing = data;
    _analyticsSummaryCache = null; // bust cache on fresh load
    try {
        const { data: dynSubs } = await window.TGDAuth.supabaseClient
            .from('category_subcategories')
            .select('category, subcategories');
        if (Array.isArray(dynSubs)) {
            dynSubs.forEach(row => {
                if (row.category && Array.isArray(row.subcategories)) SUBCATEGORIES[row.category] = row.subcategories;
            });
        }
    } catch (_) { /* use defaults */ }
}

window.BP.loadListingData = loadListingData;

// ─── 6. Render Dashboard Entry Point ────────────────────────────

function renderDashboard() {
    const listing = window.BP.currentListing;
    if (!listing) return;

    document.getElementById('sbBusinessName').textContent = listing.business_name;
    document.getElementById('sbListingId').textContent    = listing.id.slice(0, 8) + '…';

    const tier = listing.tier || 'FREE';
    _tierLimits = TIER_LIMITS[tier] || TIER_LIMITS.FREE;

    const tierLabels = { FREE: 'Standard', FEATURED: 'Featured', PREMIUM: 'Premium' };
    const mobileBadge = document.getElementById('mobileTierBadge');
    if (mobileBadge) {
        mobileBadge.innerHTML = `<span class="bp-tier bp-tier--${tier.toLowerCase()}">${tierLabels[tier] || tier}</span>`;
    }

    renderOverview();
    renderEditForm();
    renderAnalytics();
    renderSettings();
}

window.BP.renderDashboard = renderDashboard;

// ─── 7. Analytics Data Layer ──────────────────────────────────────

/*
 * Fetch the listing_analytics_summary row (one per listing, all buckets pre-computed).
 * Result is cached for the session — bucket switching just reads the cached row.
 */
async function _fetchAnalyticsSummary(listingId) {
    if (_analyticsSummaryCache && _analyticsSummaryCache.listing_id === listingId) {
        return _analyticsSummaryCache;
    }
    const { data, error } = await window.TGDAuth.supabaseClient
        .from('listing_analytics_summary')
        .select('*')
        .eq('listing_id', listingId)
        .maybeSingle();
    if (error) {
        console.warn('listing_analytics_summary query error:', error.message);
        return null;
    }
    _analyticsSummaryCache = data; // may be null if no row yet
    return data;
}

/*
 * Extract the 7 metric values for a given time bucket from the summary row.
 * Column naming: {metric}_{bucket} e.g. views_1m, call_clicks_7d, directions_clicks_all
 */
function _getStatsForBucket(row, bucket) {
    if (!row) {
        return { views: 0, call_clicks: 0, email_clicks: 0, website_clicks: 0,
                 directions_clicks: 0, custom_cta_1: 0, custom_cta_2: 0,
                 share_clicks: 0, social_clicks: 0, review_clicks: 0 };
    }
    const s = bucket; // shorthand
    return {
        views:             row[`views_${s}`]             ?? 0,
        call_clicks:       row[`call_clicks_${s}`]       ?? 0,
        email_clicks:      row[`email_clicks_${s}`]      ?? 0,
        website_clicks:    row[`website_clicks_${s}`]    ?? 0,
        directions_clicks: row[`directions_clicks_${s}`] ?? 0,
        custom_cta_1:      row[`custom_cta_1_${s}`]      ?? 0,
        custom_cta_2:      row[`custom_cta_2_${s}`]      ?? 0,
        share_clicks:      row[`share_clicks_${s}`]      ?? 0,
        social_clicks:     row[`social_clicks_${s}`]     ?? 0,
        review_clicks:     row[`review_clicks_${s}`]     ?? 0,
    };
}

/*
 * Fetch recent individual event rows for the activity log.
 * Source: listing_analytics (columns: action, platform, timestamp only).
 * Used for FEATURED and PREMIUM tiers.
 */
async function _fetchAnalyticsEvents(listingId, limit = 25) {
    try {
        const { data, error } = await window.TGDAuth.supabaseClient
            .from('listing_analytics')
            .select('action, platform, timestamp')
            .eq('listing_id', listingId)
            .not('action', 'is', null)
            .order('timestamp', { ascending: false })
            .limit(limit);
        if (error) {
            console.warn('listing_analytics events query error:', error.message);
            return [];
        }
        return data || [];
    } catch (e) {
        console.warn('_fetchAnalyticsEvents error:', e);
        return [];
    }
}

// ─── 8. Overview Tab ─────────────────────────────────────────────

function renderOverview() {
    const listing    = window.BP.currentListing;
    if (!listing) return;
    const tier       = listing.tier || 'FREE';
    const limits     = TIER_LIMITS[tier] || TIER_LIMITS.FREE;
    const listingUrl = `https://thegreekdirectory.org/listing/${listing.slug}`;
    const tierLabels = { FREE: 'Standard Profile', FEATURED: 'Featured Profile', PREMIUM: 'Premium Profile' };
    const tierLabel  = tierLabels[tier] || 'Profile';

    const features = {
        FREE: [
            'Basic listing with logo and 2 photos',
            'Contact info — phone, email, and website',
            'Hours of operation',
            'Social media and review links',
            `Tagline (up to 75 characters)`,
            `Description (up to ${limits.maxDesc.toLocaleString()} characters)`,
            'Analytics — total views and engagement',
        ],
        FEATURED: [
            'Everything in Standard Profile',
            'Featured badge and elevated search ranking',
            `Extended description (up to ${limits.maxDesc.toLocaleString()} characters)`,
            `Photo gallery (up to ${limits.maxPhotos} photos)`,
            `Up to ${limits.maxInfoFields} additional info fields`,
            '1 custom CTA button',
            'Full engagement analytics with time periods',
        ],
        PREMIUM: [
            'Everything in Featured Profile',
            'Premium badge and top search priority',
            `Description up to ${limits.maxDesc.toLocaleString()} characters`,
            `Photo gallery (up to ${limits.maxPhotos} photos)`,
            'Video embed',
            `Up to ${limits.maxInfoFields} additional info fields`,
            '2 custom CTA buttons',
            'Complete analytics including CTA and share tracking',
            'Recent activity event log',
        ],
    };

    const heroImg  = (listing.photos?.length > 0) ? listing.photos[0] : listing.logo;
    const verified = listing.verified || tier === 'FEATURED' || tier === 'PREMIUM';
    const checkSvg = `<svg style="width:18px;height:18px;flex-shrink:0;" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#045093"/><path d="M7 12.5l3.5 3.5L17 9" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    document.getElementById('content-overview').innerHTML = `
        <div class="bp-welcome-banner">
            <div class="bp-welcome-banner__title">Welcome back 👋</div>
            <div class="bp-welcome-banner__sub" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">
                Managing <strong style="color:var(--white);">${_esc(listing.business_name)}</strong>
                <span class="bp-tier bp-tier--${tier.toLowerCase()}">${tierLabel}</span>
            </div>
            <div class="bp-welcome-actions">
                <button class="bp-btn bp-btn--gold bp-btn--sm" onclick="switchTab('edit')">
                    <svg style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit Listing
                </button>
                <button class="bp-btn bp-btn--ghost bp-btn--sm" onclick="switchTab('analytics')"
                        style="border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.75);">
                    View Analytics
                </button>
                <a class="bp-btn bp-btn--ghost bp-btn--sm" href="${listingUrl}" target="_blank" rel="noopener"
                   style="border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.75);text-decoration:none;">
                    View Live Page ↗
                </a>
            </div>
        </div>

        <div class="bp-overview-grid">
            <div>
                <div class="bp-listing-preview">
                    ${heroImg
                        ? `<img class="bp-listing-preview__hero" src="${_esc(heroImg)}" alt="Listing hero">`
                        : `<div class="bp-listing-preview__hero-placeholder">${_esc(listing.business_name.charAt(0))}</div>`
                    }
                    <div class="bp-listing-preview__body">
                        ${listing.logo ? `<img class="bp-listing-preview__logo" src="${_esc(listing.logo)}" alt="Logo">` : ''}
                        <div class="bp-listing-preview__info" style="min-width:0;">
                            <div class="bp-listing-preview__name" style="word-break:break-word;">
                                ${_esc(listing.business_name)}
                                ${verified ? checkSvg : ''}
                            </div>
                            ${listing.tagline ? `<div class="bp-listing-preview__tagline" style="word-break:break-word;">${_esc(listing.tagline)}</div>` : ''}
                            <div class="bp-listing-preview__meta">
                                <span class="bp-pill">${_esc(listing.category)}</span>
                                ${listing.primary_subcategory ? `<span class="bp-pill bp-pill--gold">${_esc(listing.primary_subcategory)}</span>` : ''}
                                ${listing.city && listing.state ? `<span style="font-size:.8rem;color:var(--slate-400);">📍 ${_esc(listing.city)}, ${_esc(listing.state)}</span>` : ''}
                            </div>
                            <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;min-width:0;">
                                ${listing.phone   ? `<span style="font-size:.82rem;color:var(--slate-600);white-space:nowrap;">📞 ${_esc(window.BP.formatPhoneDisplay(listing.phone))}</span>` : ''}
                                ${listing.email   ? `<span style="font-size:.82rem;color:var(--slate-600);overflow:hidden;text-overflow:ellipsis;max-width:100%;">✉️ ${_esc(listing.email)}</span>` : ''}
                                ${listing.website ? `<a href="${_esc(listing.website)}" target="_blank" style="font-size:.82rem;color:var(--blue);white-space:nowrap;">🌐 Website</a>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <div id="overviewStatsBanner" style="margin-top:16px;">
                    <div class="bp-loading-screen" style="min-height:100px;">
                        <div class="bp-spinner"></div>
                        <span style="font-size:.8rem;">Loading analytics…</span>
                    </div>
                </div>
            </div>

            <div class="bp-card">
                <div class="bp-card-header">
                    <h2 style="font-family:'Sora',sans-serif;font-size:.95rem;">${tierLabel} Features</h2>
                </div>
                <div class="bp-card-body">
                    <ul class="bp-features-list">
                        ${(features[tier] || features.FREE).map(f => `<li>${f}</li>`).join('')}
                    </ul>
                    ${tier === 'FREE' ? `
                        <div style="margin-top:18px;padding:14px;background:var(--gold-pale);border-radius:var(--r);border:1px solid #fde68a;">
                            <div style="font-size:.82rem;font-weight:600;color:#78350f;margin-bottom:4px;">Upgrade your listing</div>
                            <div style="font-size:.78rem;color:#92400e;">Contact us to unlock Featured or Premium features.</div>
                            <a href="mailto:contact@thegreekdirectory.org?subject=Upgrade%20Inquiry%20—%20${encodeURIComponent(listing.business_name)}"
                               style="display:inline-block;margin-top:10px;font-size:.8rem;font-weight:600;color:var(--gold);">
                                Contact for Upgrade →
                            </a>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    _loadOverviewStats();
}

async function _loadOverviewStats() {
    const listing = window.BP.currentListing;
    if (!listing) return;
    const banner = document.getElementById('overviewStatsBanner');
    if (!banner) return;
    try {
        const tier    = listing.tier || 'FREE';
        const row     = await _fetchAnalyticsSummary(listing.id);
        const stats   = _getStatsForBucket(row, DEFAULT_BUCKET);
        const totalEngagement = stats.call_clicks + stats.email_clicks + stats.website_clicks
                              + stats.directions_clicks + stats.share_clicks
                              + stats.social_clicks + stats.review_clicks
                              + stats.custom_cta_1 + stats.custom_cta_2;

        const visibleStats = tier === 'FREE'
            ? [
                { label: 'Views (last month)',      value: stats.views,          color: 'blue',  icon: EYE_SVG  },
                { label: 'Engagement (last month)', value: totalEngagement,      color: 'gold',  icon: STAR_SVG },
              ]
            : [
                { label: 'Views',       value: stats.views,             color: 'blue',   icon: EYE_SVG   },
                { label: 'Calls',       value: stats.call_clicks,       color: 'green',  icon: PHONE_SVG },
                { label: 'Website',     value: stats.website_clicks,    color: 'indigo', icon: GLOBE_SVG },
                { label: 'Directions',  value: stats.directions_clicks, color: 'rose',   icon: MAP_SVG   },
              ];

        const periodNote = tier === 'FREE' ? '' :
            `<p style="font-size:.75rem;color:var(--slate-400);margin-top:6px;text-align:right;">Last 30 days · <button onclick="switchTab('analytics')" style="background:none;border:none;color:var(--blue);font-size:.75rem;cursor:pointer;padding:0;font-weight:500;">View all analytics →</button></p>`;

        banner.innerHTML = `
            <div class="bp-stat-grid">
                ${visibleStats.map(s => `
                    <div class="bp-stat-card bp-stat-card--${s.color}">
                        <div class="bp-stat-card__icon">${s.icon}</div>
                        <div class="bp-stat-card__value">${_fmt(s.value)}</div>
                        <div class="bp-stat-card__label">${s.label}</div>
                    </div>
                `).join('')}
            </div>
            ${periodNote}
        `;
    } catch (err) {
        console.warn('Overview stats error:', err);
        banner.innerHTML = '';
    }
}

// ─── 9. Analytics Tab ─────────────────────────────────────────────

async function renderAnalytics() {
    const listing = window.BP.currentListing;
    if (!listing) return;
    const tier = listing.tier || 'FREE';

    const container = document.getElementById('content-analytics');
    container.innerHTML = `
        <div class="bp-page-header" style="flex-wrap:wrap;gap:12px;">
            <div><h1>Analytics</h1><p>Performance data for ${_esc(listing.business_name)}</p></div>
        </div>
        <div id="analyticsBody">
            <div class="bp-loading-screen">
                <div class="bp-spinner"></div>
                <span style="font-size:.85rem;color:var(--slate-400);">Fetching your stats…</span>
            </div>
        </div>
    `;

    try {
        const summaryRow = await _fetchAnalyticsSummary(listing.id);
        const events     = (tier === 'FREE') ? [] : await _fetchAnalyticsEvents(listing.id, 25);

        // Render with default bucket; bucket switching re-renders only the cards section
        _renderAnalyticsBody(summaryRow, events, tier, listing, DEFAULT_BUCKET);

    } catch (err) {
        console.error('Analytics render error:', err);
        document.getElementById('analyticsBody').innerHTML = `
            <div class="bp-inline-msg bp-inline-msg--warning">
                Could not load analytics data. Please try again later.
            </div>
        `;
    }
}

function _renderAnalyticsBody(summaryRow, events, tier, listing, bucket) {
    const stats      = _getStatsForBucket(summaryRow, bucket);
    const bucketLabel = TIME_BUCKETS.find(b => b.value === bucket)?.label || bucket;
    const updatedAt  = summaryRow?.updated_at
        ? `Updated ${_timeAgo(summaryRow.updated_at)}`
        : '';

    // CTA labels from listing config
    const cta1Name = listing.custom_ctas?.[0]?.name || 'CTA Button 1';
    const cta2Name = listing.custom_ctas?.[1]?.name || 'CTA Button 2';

    // Build metric card definitions for this tier
    const allMetrics = [
        { key: 'views',             label: 'Views',                    grad: 'bg-grad-1', icon: EYE_SVG,       tiers: ['FREE','FEATURED','PREMIUM'] },
        { key: 'call_clicks',       label: 'Call Clicks',              grad: 'bg-grad-2', icon: PHONE_SVG,     tiers: ['FEATURED','PREMIUM'] },
        { key: 'email_clicks',      label: 'Email Clicks',             grad: 'bg-grad-3', icon: EMAIL_SVG,     tiers: ['FEATURED','PREMIUM'] },
        { key: 'website_clicks',    label: 'Website Clicks',           grad: 'bg-grad-1', icon: GLOBE_SVG,     tiers: ['FEATURED','PREMIUM'] },
        { key: 'directions_clicks', label: 'Directions',               grad: 'bg-grad-4', icon: MAP_SVG,       tiers: ['FEATURED','PREMIUM'] },
        { key: 'share_clicks',      label: 'Shares',                   grad: 'bg-grad-5', icon: SHARE_SVG,     tiers: ['FEATURED','PREMIUM'] },
        { key: 'social_clicks',     label: 'Social Media Clicks',      grad: 'bg-grad-3', icon: CURSOR_SVG,    tiers: ['FEATURED','PREMIUM'] },
        { key: 'review_clicks',     label: 'Review Clicks',            grad: 'bg-grad-4', icon: STAR_SVG,      tiers: ['FEATURED','PREMIUM'] },
        { key: 'custom_cta_1',      label: _esc(cta1Name),             grad: 'bg-grad-6', icon: CURSOR_SVG,    tiers: ['FEATURED','PREMIUM'] },
        { key: 'custom_cta_2',      label: _esc(cta2Name),             grad: 'bg-grad-2', icon: CURSOR_SVG,    tiers: ['PREMIUM'] },
    ];

    // For FREE: show views card + total engagement card
    let cardsHtml = '';
    if (tier === 'FREE') {
        const totalEngagement = stats.call_clicks + stats.email_clicks + stats.website_clicks
                              + stats.directions_clicks + stats.share_clicks
                              + stats.social_clicks + stats.review_clicks
                              + stats.custom_cta_1 + stats.custom_cta_2;
        cardsHtml = `
            <div class="bp-analytics-card bg-grad-1">
                <div class="bp-analytics-card__value">${_fmt(stats.views)}</div>
                <div class="bp-analytics-card__label">Views</div>
            </div>
            <div class="bp-analytics-card bg-grad-2">
                <div class="bp-analytics-card__value">${_fmt(totalEngagement)}</div>
                <div class="bp-analytics-card__label">Total Engagement</div>
            </div>
        `;
    } else {
        const visibleMetrics = allMetrics.filter(m => m.tiers.includes(tier));
        // Hide CTA cards if the listing doesn't actually have those CTAs configured
        const filteredMetrics = visibleMetrics.filter(m => {
            if (m.key === 'custom_cta_1') return (listing.custom_ctas?.length ?? 0) >= 1;
            if (m.key === 'custom_cta_2') return (listing.custom_ctas?.length ?? 0) >= 2;
            return true;
        });
        cardsHtml = filteredMetrics.map(m => `
            <div class="bp-analytics-card ${m.grad}">
                <div class="bp-analytics-card__value">${_fmt(stats[m.key])}</div>
                <div class="bp-analytics-card__label">${m.label}</div>
            </div>
        `).join('');
    }

    const eventLogHtml = (tier !== 'FREE') ? `
        <div class="bp-card" style="margin-top:20px;">
            <div class="bp-card-header">
                <h2>Recent Activity</h2>
                <span style="font-size:.78rem;color:var(--slate-400);">Last 25 events</span>
            </div>
            <div class="bp-card-body">${_buildEventLog(events)}</div>
        </div>
    ` : '';

    const upgradeNotice = (tier === 'FREE') ? `
        <div class="bp-upgrade-notice" style="margin-top:16px;">
            <div class="bp-upgrade-notice__icon">📈</div>
            <div>
                <h4>Unlock Detailed Analytics</h4>
                <p>Upgrade to Featured or Premium to see call, email, website, directions, share, social media, review, and CTA click tracking across any time period.</p>
            </div>
        </div>
    ` : '';

    document.getElementById('analyticsBody').innerHTML = `
        <div class="bp-analytics-controls">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                <label style="font-size:.82rem;font-weight:600;color:var(--slate-600);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;">Time Period</label>
                <select id="analyticsBucketSelect"
                        onchange="_onBucketChange(this.value)"
                        style="flex:1;min-width:0;padding:8px 32px 8px 12px;border:1.5px solid var(--slate-200);border-radius:var(--r);font-family:inherit;font-size:.875rem;color:var(--slate-900);background:var(--white);cursor:pointer;outline:none;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 10px center;">
                    ${TIME_BUCKETS.map(b => `<option value="${b.value}" ${b.value === bucket ? 'selected' : ''}>${b.label}</option>`).join('')}
                </select>
            </div>
            ${updatedAt ? `<span style="font-size:.75rem;color:var(--slate-400);">${_esc(updatedAt)}</span>` : ''}
        </div>

        <div class="bp-analytics-grid" id="analyticsCards">${cardsHtml}</div>

        ${upgradeNotice}
        ${eventLogHtml}
    `;

    // Store on window so the bucket-change handler can access everything
    window._analyticsState = { summaryRow, events, tier, listing };
}

/*
 * Called when the time period dropdown changes.
 * Re-renders only the cards grid — no new network request needed.
 */
window._onBucketChange = function(bucket) {
    const { summaryRow, tier, listing } = window._analyticsState || {};
    if (!summaryRow && tier !== 'FREE') return;
    const stats      = _getStatsForBucket(summaryRow, bucket);
    const cta1Name   = listing?.custom_ctas?.[0]?.name || 'CTA Button 1';
    const cta2Name   = listing?.custom_ctas?.[1]?.name || 'CTA Button 2';

    let cardsHtml = '';
    if (tier === 'FREE') {
        const totalEngagement = stats.call_clicks + stats.email_clicks + stats.website_clicks
                              + stats.directions_clicks + stats.share_clicks
                              + stats.social_clicks + stats.review_clicks
                              + stats.custom_cta_1 + stats.custom_cta_2;
        cardsHtml = `
            <div class="bp-analytics-card bg-grad-1">
                <div class="bp-analytics-card__value">${_fmt(stats.views)}</div>
                <div class="bp-analytics-card__label">Views</div>
            </div>
            <div class="bp-analytics-card bg-grad-2">
                <div class="bp-analytics-card__value">${_fmt(totalEngagement)}</div>
                <div class="bp-analytics-card__label">Total Engagement</div>
            </div>
        `;
    } else {
        const allMetrics = [
            { key: 'views',             label: 'Views',               grad: 'bg-grad-1', icon: EYE_SVG,    tiers: ['FREE','FEATURED','PREMIUM'] },
            { key: 'call_clicks',       label: 'Call Clicks',         grad: 'bg-grad-2', icon: PHONE_SVG,  tiers: ['FEATURED','PREMIUM'] },
            { key: 'email_clicks',      label: 'Email Clicks',        grad: 'bg-grad-3', icon: EMAIL_SVG,  tiers: ['FEATURED','PREMIUM'] },
            { key: 'website_clicks',    label: 'Website Clicks',      grad: 'bg-grad-1', icon: GLOBE_SVG,  tiers: ['FEATURED','PREMIUM'] },
            { key: 'directions_clicks', label: 'Directions',          grad: 'bg-grad-4', icon: MAP_SVG,    tiers: ['FEATURED','PREMIUM'] },
            { key: 'share_clicks',      label: 'Shares',              grad: 'bg-grad-5', icon: SHARE_SVG,  tiers: ['FEATURED','PREMIUM'] },
            { key: 'social_clicks',     label: 'Social Media Clicks', grad: 'bg-grad-3', icon: CURSOR_SVG, tiers: ['FEATURED','PREMIUM'] },
            { key: 'review_clicks',     label: 'Review Clicks',       grad: 'bg-grad-4', icon: STAR_SVG,   tiers: ['FEATURED','PREMIUM'] },
            { key: 'custom_cta_1',      label: _esc(cta1Name),        grad: 'bg-grad-6', icon: CURSOR_SVG, tiers: ['FEATURED','PREMIUM'] },
            { key: 'custom_cta_2',      label: _esc(cta2Name),        grad: 'bg-grad-2', icon: CURSOR_SVG, tiers: ['PREMIUM'] },
        ];
        const visibleMetrics = allMetrics
            .filter(m => m.tiers.includes(tier))
            .filter(m => {
                if (m.key === 'custom_cta_1') return (listing?.custom_ctas?.length ?? 0) >= 1;
                if (m.key === 'custom_cta_2') return (listing?.custom_ctas?.length ?? 0) >= 2;
                return true;
            });
        cardsHtml = visibleMetrics.map(m => `
            <div class="bp-analytics-card ${m.grad}">
                <div class="bp-analytics-card__value">${_fmt(stats[m.key])}</div>
                <div class="bp-analytics-card__label">${m.label}</div>
            </div>
        `).join('');
    }

    const grid = document.getElementById('analyticsCards');
    if (grid) {
        grid.style.opacity = '0';
        grid.style.transition = 'opacity 0.15s ease';
        setTimeout(() => {
            grid.innerHTML = cardsHtml;
            grid.style.opacity = '1';
        }, 150);
    }
};

function _buildEventLog(events) {
    if (!events || !events.length) {
        return '<p style="color:var(--slate-400);font-size:.875rem;text-align:center;padding:20px 0;">No events recorded yet.</p>';
    }
    const customCtas = window.BP.currentListing?.custom_ctas || [];
    const colors = {
        view:       '#3b82f6',
        call:       '#10b981',
        email:      '#8b5cf6',
        website:    '#6366f1',
        directions: '#ef4444',
        share:      '#f59e0b',
        social:     '#8b5cf6',
        review:     '#f97316',
        video:      '#0ea5e9',
    };
    const labels = {
        view:       'Page View',
        call:       'Phone Call',
        email:      'Email Click',
        website:    'Website Visit',
        directions: 'Directions',
        share:      'Share',
        social:     'Social Media Click',
        review:     'Review Click',
        video:      'Video Play',
    };

    function resolveAction(action) {
        // custom_cta_1 maps to index 0, custom_cta_2 maps to index 1, etc.
        const ctaMatch = action.match(/^custom_cta_(\d+)$/);
        if (ctaMatch) {
            const idx  = parseInt(ctaMatch[1], 10) - 1;
            const name = customCtas[idx]?.name;
            return {
                label: name ? _esc(name) : 'CTA Button ' + (idx + 1),
                color: '#ec4899',
            };
        }
        return {
            label: labels[action] || _esc(action),
            color: colors[action] || '#94a3b8',
        };
    }

    return [
        '<div class="bp-event-log__list">',
        events.map(e => {
            const resolved = resolveAction(e.action);
            return [
                '<div class="bp-event-item">',
                    '<div class="bp-event-item__dot" style="background:' + resolved.color + ';"></div>',
                    '<div class="bp-event-item__action">',
                        resolved.label,
                        e.platform ? '<span style="color:var(--slate-400);font-size:.78rem;margin-left:4px;">via ' + _esc(e.platform) + '</span>' : '',
                    '</div>',
                    '<div class="bp-event-item__time">' + _timeAgo(e.timestamp) + '</div>',
                '</div>',
            ].join('');
        }).join(''),
        '</div>',
    ].join('');
}

// ─── 10. Edit Tab ──────────────────────────────────────────────────

function renderEditForm() {
    const listing = window.BP.currentListing;
    if (!listing) return;

    const tier          = listing.tier || 'FREE';
    const limits        = TIER_LIMITS[tier] || TIER_LIMITS.FREE;
    const maxDesc       = limits.maxDesc;
    const maxPhotos     = limits.maxPhotos;
    const maxCtas       = limits.maxCtas;
    const maxInfoFields = limits.maxInfoFields;
    const hasVideo      = limits.hasVideo;

    _tierLimits      = limits;
    _uploadedImages  = { logo: null, photos: [], video: null };
    _removedPhotos   = [];
    _selectedSubcats = [...(listing.subcategories || [])];
    _primarySubcat   = listing.primary_subcategory || _selectedSubcats[0] || null;

    const taglineMax = getTaglineMaxLength(listing.city, listing.state);

    document.getElementById('content-edit').innerHTML = `
        <div class="bp-page-header">
            <div>
                <h1>Edit Listing</h1>
                <p>Changes are saved to your listing and regenerate your live page.</p>
            </div>
        </div>

        ${_section('basic', EDIT_SVG, 'Basic Information', true, `
            <div class="bp-form-grid">
                <div class="bp-field col-span-2">
                    <label class="bp-label">Business Name</label>
                    <input class="bp-input" type="text" value="${_esc(listing.business_name)}" disabled>
                    <span class="bp-input-locked">🔒 Contact support to change the business name</span>
                </div>
                <div class="bp-field col-span-2">
                    <label class="bp-label" for="editTagline">Tagline <span style="color:var(--error);">*</span></label>
                    <input class="bp-input" type="text" id="editTagline"
                           value="${_esc(listing.tagline || '')}"
                           maxlength="${taglineMax}"
                           oninput="_updateCounter('tagline', this.value.length, ${taglineMax})">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:.78rem;color:var(--slate-400);">Keep it descriptive for SEO</span>
                        <span class="bp-char-counter" id="ctr-tagline">${(listing.tagline||'').length}/${taglineMax}</span>
                    </div>
                </div>
                <div class="bp-field col-span-2">
                    <label class="bp-label" for="editDescription">Description (max ${maxDesc.toLocaleString()} characters)</label>
                    <textarea class="bp-input" id="editDescription" rows="6">${_esc(listing.description || '')}</textarea>
                    <div style="display:flex;justify-content:space-between;">
                        <span style="font-size:.78rem;color:var(--slate-400);">HTML formatting supported</span>
                        <span class="bp-char-counter" id="ctr-description">0/${maxDesc}</span>
                    </div>
                </div>
                <div class="bp-field">
                    <label class="bp-label">Category</label>
                    <input class="bp-input" type="text" value="${_esc(listing.category)}" disabled>
                    <span class="bp-input-locked">🔒 Contact support to change</span>
                </div>
                <div class="bp-field">
                    <label class="bp-label" for="editPricing">Pricing</label>
                    <select class="bp-input" id="editPricing">
                        <option value="">Not specified</option>
                        ${[1,2,3,4].map(n => `<option value="${n}" ${Number(listing.pricing)===n?'selected':''}>${'$'.repeat(n)}</option>`).join('')}
                    </select>
                </div>
                <div class="bp-field">
                    <label class="bp-label" for="editComingSoon">Status</label>
                    <select class="bp-input" id="editComingSoon">
                        <option value="false" ${!listing.coming_soon?'selected':''}>Open / Active</option>
                        <option value="true"  ${listing.coming_soon?'selected':''}>Coming Soon</option>
                    </select>
                </div>
            </div>
            <div style="margin-top:18px;">
                <label class="bp-label">Subcategories</label>
                <p class="bp-subcat-hint">Select all that apply. ⭐ marks the primary (shown on listing cards).</p>
                <div class="bp-subcats-grid" id="subcatsGrid"></div>
            </div>
        `)}

        ${_section('location', MAP_SVG, 'Location', false, `
            <div class="bp-form-grid">
                <div class="bp-field col-span-2">
                    <label class="bp-label" for="editAddress">Street Address</label>
                    <input class="bp-input" type="text" id="editAddress" value="${_esc(listing.address||'')}" placeholder="123 Main St">
                </div>
                <div class="bp-field">
                    <label class="bp-label" for="editCity">City</label>
                    <input class="bp-input" type="text" id="editCity" value="${_esc(listing.city||'')}" placeholder="Chicago">
                </div>
                <div class="bp-field">
                    <label class="bp-label" for="editState">State</label>
                    <input class="bp-input" type="text" id="editState" value="${_esc(listing.state||'')}" placeholder="IL" maxlength="2">
                </div>
                <div class="bp-field">
                    <label class="bp-label" for="editZip">ZIP Code</label>
                    <input class="bp-input" type="text" id="editZip" value="${_esc(listing.zip_code||'')}" placeholder="60601" maxlength="10">
                </div>
            </div>
        `)}

        ${_section('contact', PHONE_SVG, 'Contact Information', false, `
            <div class="bp-form-grid">
                <div class="bp-field">
                    <label class="bp-label">Phone</label>
                    <div id="editPhoneWrap"></div>
                </div>
                <div class="bp-field">
                    <label class="bp-label" for="editEmail">Email</label>
                    <input class="bp-input" type="email" id="editEmail" value="${_esc(listing.email||'')}" placeholder="hello@yourbusiness.com">
                </div>
                <div class="bp-field col-span-2">
                    <label class="bp-label" for="editWebsite">Website</label>
                    <input class="bp-input" type="url" id="editWebsite" value="${_esc(listing.website||'')}" placeholder="https://yourbusiness.com">
                </div>
            </div>
        `)}

        ${_section('hours', CLOCK_SVG, 'Hours of Operation', false, `
            <div class="bp-hours-grid" id="hoursGrid"></div>
        `)}

        ${_section('media', IMAGE_SVG, 'Photos & Media', false, `
            <div id="uploadStatus" class="bp-upload-status"></div>
            <div style="margin-bottom:20px;">
                <label class="bp-label">Logo</label>
                <label class="bp-upload-box" for="logoUpload">
                    <input type="file" id="logoUpload" accept="image/*" onchange="_handleLogoUpload(event)">
                    <div class="bp-upload-icon">${IMAGE_SVG}</div>
                    <p><strong>Click to upload</strong> or drag and drop</p>
                    <p style="font-size:.78rem;margin-top:4px;">PNG, JPG, WebP — square recommended</p>
                </label>
                <div id="logoPreview" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                    ${listing.logo ? `<div class="bp-photo-thumb"><img src="${_esc(listing.logo)}" alt="Logo"></div>` : ''}
                </div>
            </div>
            <div style="margin-bottom:20px;">
                <label class="bp-label">Photos <span style="color:var(--slate-400);font-weight:400;">(${maxPhotos} max for your plan)</span></label>
                <label class="bp-upload-box" for="photosUpload">
                    <input type="file" id="photosUpload" accept="image/*" multiple onchange="_handlePhotosUpload(event)">
                    <div class="bp-upload-icon">${IMAGE_SVG}</div>
                    <p><strong>Click to upload photos</strong></p>
                    <p style="font-size:.78rem;margin-top:4px;">Select up to ${maxPhotos} total photos</p>
                </label>
                <div id="photosPreview" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                    ${(listing.photos || []).map((url, i) => _photoThumb(url, i, 'existing')).join('')}
                </div>
            </div>
            ${hasVideo ? `
                <div>
                    <label class="bp-label">Video</label>
                    <label class="bp-upload-box" for="videoUpload">
                        <input type="file" id="videoUpload" accept="video/*" onchange="_handleVideoUpload(event)">
                        <div class="bp-upload-icon">${VIDEO_SVG}</div>
                        <p><strong>Upload a video</strong></p>
                        <p style="font-size:.78rem;margin-top:4px;">MP4 recommended</p>
                    </label>
                    ${listing.video ? `<div style="margin-top:8px;font-size:.82rem;color:var(--slate-500);">Current: <a href="${_esc(listing.video)}" target="_blank" style="color:var(--blue);">View video ↗</a></div>` : ''}
                </div>
            ` : `
                <div class="bp-inline-msg bp-inline-msg--info">
                    Video uploads are available on the Premium plan.
                    <a href="mailto:contact@thegreekdirectory.org?subject=Upgrade%20to%20Premium" style="margin-left:4px;font-weight:600;">Upgrade →</a>
                </div>
            `}
        `)}

        ${_section('social', SHARE_SVG, 'Social Media', false, `
            <div class="bp-form-grid">
                ${_socialField('Facebook',       'editFacebook',   listing.social_media?.facebook,   'username or page URL')}
                ${_socialField('Instagram',      'editInstagram',  listing.social_media?.instagram,  'username')}
                ${_socialField('Twitter / X',    'editTwitter',    listing.social_media?.twitter,    'username')}
                ${_socialField('YouTube',        'editYoutube',    listing.social_media?.youtube,    'channel name or URL')}
                ${_socialField('TikTok',         'editTiktok',     listing.social_media?.tiktok,     'username')}
                ${_socialField('LinkedIn',       'editLinkedin',   listing.social_media?.linkedin,   'full URL')}
                ${_socialField('Other 1 — Name', 'editOther1Name', listing.social_media?.other1_name,'e.g. Pinterest')}
                ${_socialField('Other 1 — URL',  'editOther1',     listing.social_media?.other1,     'https://')}
                ${_socialField('Other 2 — Name', 'editOther2Name', listing.social_media?.other2_name,'e.g. Discord')}
                ${_socialField('Other 2 — URL',  'editOther2',     listing.social_media?.other2,     'https://')}
                ${_socialField('Other 3 — Name', 'editOther3Name', listing.social_media?.other3_name,'e.g. Reddit')}
                ${_socialField('Other 3 — URL',  'editOther3',     listing.social_media?.other3,     'https://')}
            </div>
        `)}

        ${_section('reviews', STAR_SVG, 'Review Sites', false, `
            <p style="font-size:.85rem;color:var(--slate-500);margin-bottom:16px;">
                You can add review links if they are empty. Existing links are locked — contact support to change them.
            </p>
            <div class="bp-form-grid bp-form-grid--1">
                ${_reviewField('Google Reviews',        'editGoogleReviews', listing.reviews?.google,      'https://g.page/…')}
                ${_reviewField('Yelp',                  'editYelp',          listing.reviews?.yelp,        'https://yelp.com/biz/…')}
                ${_reviewField('TripAdvisor',           'editTripadvisor',   listing.reviews?.tripadvisor, 'https://tripadvisor.com/…')}
                ${_reviewField('Other Review 1 — Name', 'editRev1Name',      listing.reviews?.other1_name, 'e.g. Angi', false)}
                ${_reviewField('Other Review 1 — URL',  'editRev1',          listing.reviews?.other1,      'https://', false)}
                ${_reviewField('Other Review 2 — Name', 'editRev2Name',      listing.reviews?.other2_name, 'e.g. BBB', false)}
                ${_reviewField('Other Review 2 — URL',  'editRev2',          listing.reviews?.other2,      'https://', false)}
                ${_reviewField('Other Review 3 — Name', 'editRev3Name',      listing.reviews?.other3_name, 'e.g. OpenTable', false)}
                ${_reviewField('Other Review 3 — URL',  'editRev3',          listing.reviews?.other3,      'https://', false)}
            </div>
        `)}

        ${_section('info', EDIT_SVG, 'Additional Information', false,
            maxInfoFields === 0
                ? `<div class="bp-inline-msg bp-inline-msg--info">
                       Additional information fields are available on Featured (3) and Premium (5) plans.
                       <a href="mailto:contact@thegreekdirectory.org?subject=Upgrade%20Inquiry" style="margin-left:4px;font-weight:600;">Upgrade →</a>
                   </div>`
                : `<p style="font-size:.85rem;color:var(--slate-500);margin-bottom:16px;">Up to ${maxInfoFields} custom label/value pairs shown on your listing page.</p>
                   <div class="bp-form-grid">
                       ${[...Array(maxInfoFields)].map((_, i) => {
                           const item = (listing.additional_info || [])[i] || {};
                           return `
                               <div class="bp-field">
                                   <label class="bp-label" for="infoLabel${i}">Label ${i+1}</label>
                                   <input class="bp-input" type="text" id="infoLabel${i}" value="${_esc(item.label||'')}" maxlength="30" placeholder="e.g. Founded">
                               </div>
                               <div class="bp-field">
                                   <label class="bp-label" for="infoValue${i}">Value ${i+1}</label>
                                   <input class="bp-input" type="text" id="infoValue${i}" value="${_esc(item.value||'')}" maxlength="120" placeholder="e.g. 1987">
                               </div>`;
                       }).join('')}
                   </div>`
        )}

        ${maxCtas > 0
            ? _section('ctas', STAR_SVG, `Custom CTA Buttons (${maxCtas} allowed)`, false, `
                <p style="font-size:.85rem;color:var(--slate-500);margin-bottom:16px;">Button name max 15 characters.</p>
                ${[...Array(maxCtas)].map((_, i) => {
                    const cta = (listing.custom_ctas || [])[i] || {};
                    return `
                        <div class="bp-cta-builder">
                            <div style="font-size:.82rem;font-weight:600;color:var(--slate-500);margin-bottom:12px;text-transform:uppercase;letter-spacing:.04em;">Button ${i+1}</div>
                            <div class="bp-form-grid">
                                <div class="bp-field">
                                    <label class="bp-label" for="ctaName${i}">Button Label</label>
                                    <input class="bp-input" type="text" id="ctaName${i}" value="${_esc(cta.name||'')}" maxlength="15" placeholder="e.g. Order Online">
                                </div>
                                <div class="bp-field">
                                    <label class="bp-label" for="ctaUrl${i}">Link URL</label>
                                    <input class="bp-input" type="url" id="ctaUrl${i}" value="${_esc(cta.url||'')}" placeholder="https://">
                                </div>
                                <div class="bp-field">
                                    <label class="bp-label" for="ctaColor${i}">Button Color</label>
                                    <input class="bp-input" type="color" id="ctaColor${i}" value="${_esc(cta.color||'#045093')}" style="height:44px;padding:4px 8px;cursor:pointer;">
                                </div>
                                <div class="bp-field">
                                    <label class="bp-label" for="ctaIcon${i}">Icon (optional)</label>
                                    <select class="bp-input" id="ctaIcon${i}">${_ctaIconOptions(cta.icon||'')}</select>
                                </div>
                            </div>
                        </div>`;
                }).join('')}
            `)
            : `<div class="bp-section" style="margin-bottom:16px;">
                   <div class="bp-section__head" style="cursor:default;">
                       <div class="bp-section__head-left">
                           <div class="bp-section__head-icon">${STAR_SVG}</div>
                           <span class="bp-section__title">Custom CTA Buttons</span>
                       </div>
                   </div>
                   <div class="bp-section__body" style="display:block;">
                       <div class="bp-inline-msg bp-inline-msg--info">
                           Custom CTA buttons are available on Featured (1 button) and Premium (2 buttons) plans.
                       </div>
                   </div>
               </div>`
        }

        <div class="bp-save-bar">
            <p>Changes will update your listing and regenerate your live page.</p>
            <div style="display:flex;gap:10px;">
                <button class="bp-btn bp-btn--ghost" onclick="renderEditForm()">Reset</button>
                <button class="bp-btn bp-btn--primary bp-btn--lg" id="saveBtn" onclick="saveChanges()">Save Changes</button>
            </div>
        </div>
    `;

    window.BP.createPhoneInput('editPhoneWrap', listing.phone || '', window.BP.userCountry);

    if (window.RichTextEditor) {
        _rteInstance = window.RichTextEditor.mount({
            inputId:  'editDescription',
            onChange: (html, text) => _updateCounter('description', text.length, maxDesc),
        });
        _updateCounter('description', window.RichTextEditor.stripHtml(listing.description || '').length, maxDesc);
    } else {
        const descEl = document.getElementById('editDescription');
        if (descEl) {
            descEl.addEventListener('input', () => _updateCounter('description', descEl.value.length, maxDesc));
            _updateCounter('description', descEl.value.length, maxDesc);
        }
    }

    _renderSubcats();
    _renderHours(listing.hours || {});
    document.querySelector('.bp-section')?.classList.add('open');
}

// ── Section helpers ───────────────────────────────────────────────

function _section(id, iconSvg, title, openByDefault, bodyHtml) {
    return `
        <div class="bp-section ${openByDefault ? 'open' : ''}" id="section-${id}">
            <div class="bp-section__head" onclick="_toggleSection('section-${id}')">
                <div class="bp-section__head-left">
                    <div class="bp-section__head-icon">${iconSvg}</div>
                    <span class="bp-section__title">${title}</span>
                </div>
                <svg class="bp-section__chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="bp-section__body">${bodyHtml}</div>
        </div>
    `;
}

window._toggleSection  = id => document.getElementById(id)?.classList.toggle('open');

// ── Subcategories ─────────────────────────────────────────────────

function _renderSubcats() {
    const listing  = window.BP.currentListing;
    const category = listing?.category;
    const grid     = document.getElementById('subcatsGrid');
    if (!grid || !category) return;
    const options = SUBCATEGORIES[category] || [];
    if (!options.length) { grid.innerHTML = '<p style="color:var(--slate-400);font-size:.85rem;">No subcategories available for this category.</p>'; return; }
    grid.innerHTML = options.map(sub => {
        const selected  = _selectedSubcats.includes(sub);
        const isPrimary = sub === _primarySubcat;
        return `
            <div class="bp-subcat-item ${selected ? 'selected' : ''}" id="subcat-wrap-${_safeId(sub)}">
                <input type="checkbox" id="subcat-${_safeId(sub)}" ${selected?'checked':''}
                       onchange="_toggleSubcat('${sub.replace(/'/g,"\\'")}')">
                <label for="subcat-${_safeId(sub)}" style="flex:1;">${_esc(sub)}</label>
                <input type="radio" name="primarySubcat" title="Set as primary"
                       ${isPrimary?'checked':''} ${!selected?'disabled':''}
                       onchange="_setPrimarySubcat('${sub.replace(/'/g,"\\'")}')">
                <span title="Primary subcategory" style="font-size:.7rem;color:var(--gold);flex-shrink:0;">⭐</span>
            </div>
        `;
    }).join('');
}

window._toggleSubcat = function(sub) {
    const idx = _selectedSubcats.indexOf(sub);
    if (idx > -1) { _selectedSubcats.splice(idx, 1); if (_primarySubcat === sub) _primarySubcat = _selectedSubcats[0] || null; }
    else { _selectedSubcats.push(sub); if (!_primarySubcat) _primarySubcat = sub; }
    _renderSubcats();
};
window._setPrimarySubcat = function(sub) { _primarySubcat = sub; _renderSubcats(); };

// ── Hours ─────────────────────────────────────────────────────────

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function _renderHours(hours) {
    const grid = document.getElementById('hoursGrid');
    if (!grid) return;
    grid.innerHTML = DAYS.map(day => {
        const key      = day.toLowerCase();
        // Per-day { status, ranges } objects (older rows hold one string per day; both are understood).
        const dayData  = window.TGDListingHours.normalizeDay(hours[key]);
        const isClosed = dayData.status === 'closed';
        const is24h    = dayData.status === '24_hours';
        const val      = dayData.status === 'open' ? window.TGDListingHours.formatDayText(dayData) : '';
        return `
            <div class="bp-hours-row">
                <span class="bp-hours-day">${day.slice(0,3)}</span>
                <input class="bp-input" type="text" id="hours-${key}"
                       value="${_esc(val)}"
                       placeholder="9:00 AM - 5:00 PM"
                       title="Separate several sets of hours with commas, e.g. 8:00 AM - 11:00 AM, 5:00 PM - 8:00 PM"
                       ${isClosed || is24h ? 'disabled' : ''}>
                <div class="bp-hours-checks" style="display:flex;gap:14px;">
                    <label class="bp-hours-check">
                        <input type="checkbox" id="closed-${key}" ${isClosed?'checked':''}
                               onchange="_toggleDayClosed('${key}')"> Closed
                    </label>
                    <label class="bp-hours-check">
                        <input type="checkbox" id="open24-${key}" ${is24h?'checked':''}
                               onchange="_toggle24Hours('${key}')"> 24 hrs
                    </label>
                </div>
            </div>
        `;
    }).join('');
}

window._toggleDayClosed = function(key) {
    const input = document.getElementById(`hours-${key}`), closed = document.getElementById(`closed-${key}`), open24 = document.getElementById(`open24-${key}`);
    if (closed.checked) { input.value = ''; input.disabled = true; open24.checked = false; } else { input.disabled = false; }
};
window._toggle24Hours = function(key) {
    const input = document.getElementById(`hours-${key}`), open24 = document.getElementById(`open24-${key}`), closed = document.getElementById(`closed-${key}`);
    if (open24.checked) { input.value = ''; input.disabled = true; closed.checked = false; } else { input.disabled = false; }
};

// ─── 11. Save Changes ─────────────────────────────────────────────

async function saveChanges() {
    const listing = window.BP.currentListing;
    if (!listing) return;

    const limits        = _tierLimits;
    const maxDesc       = limits.maxDesc;
    const maxInfoFields = limits.maxInfoFields;

    const tagline    = document.getElementById('editTagline').value.trim();
    const city       = document.getElementById('editCity').value.trim();
    const state      = document.getElementById('editState').value.trim();
    const taglineMax = getTaglineMaxLength(city, state);

    if (!tagline)                      return showToast('Tagline is required.', 'error');
    if (tagline.length > taglineMax)   return showToast(`Tagline must be ${taglineMax} characters or fewer.`, 'error');
    if (_selectedSubcats.length === 0) return showToast('Please select at least one subcategory.', 'error');

    let description = '';
    if (_rteInstance) {
        description = window.RichTextEditor.sanitizeRichTextHtml(_rteInstance.getHtml());
        const plainLen = window.RichTextEditor.stripHtml(description).length;
        if (plainLen > maxDesc) return showToast(`Description is too long (${plainLen}/${maxDesc} chars).`, 'error');
    } else {
        description = document.getElementById('editDescription')?.value || '';
        if (description.length > maxDesc) return showToast('Description is too long.', 'error');
    }

    const phone    = window.BP.getPhoneValue('editPhoneWrap');
    const phoneRaw = document.querySelector('#editPhoneWrap .phone-number')?.value?.trim();
    if (phoneRaw && !phone) return showToast('Phone number is not valid. US numbers need 10 digits.', 'error');

    const hours = {};
    let hoursChanged = false;
    for (const day of DAYS) {
        const key    = day.toLowerCase();
        const closed = document.getElementById(`closed-${key}`)?.checked;
        const open24 = document.getElementById(`open24-${key}`)?.checked;
        const input  = document.getElementById(`hours-${key}`)?.value.trim() || '';
        let val;
        if (closed)      val = { status: 'closed', ranges: [] };
        else if (open24) val = { status: '24_hours', ranges: [] };
        else {
            // "9:00 AM - 5:00 PM", or several sets separated by commas ("8:00 AM - 11:00 AM, 5:00 PM - 8:00 PM").
            val = window.TGDListingHours.parseHoursText(input);
            if (!val) return showToast(`${day} hours look incomplete. Use a format like 9:00 AM - 5:00 PM (separate several sets of hours with commas).`, 'error');
            const problem = window.TGDListingHours.findRangeProblem(val.ranges);
            if (problem === 'same')    return showToast(`${day}: a set of hours can't open and close at the same time. Use "24 hrs" for all-day hours.`, 'error');
            if (problem === 'overlap') return showToast(`${day}: two sets of hours overlap. Adjust the times so they don't overlap.`, 'error');
        }
        hours[key] = val;
        // Compare in canonical form so a not-yet-migrated string value isn't reported as a change.
        if (JSON.stringify(window.TGDListingHours.normalizeDay((listing.hours || {})[key])) !== JSON.stringify(val)) hoursChanged = true;
    }

    const additionalInfo = [];
    for (let i = 0; i < maxInfoFields; i++) {
        const label = document.getElementById(`infoLabel${i}`)?.value.trim();
        const value = document.getElementById(`infoValue${i}`)?.value.trim();
        if (label && value) additionalInfo.push({ label, value });
    }

    const customCtas = [];
    for (let i = 0; i < limits.maxCtas; i++) {
        const name  = document.getElementById(`ctaName${i}`)?.value.trim();
        const url   = document.getElementById(`ctaUrl${i}`)?.value.trim();
        const color = document.getElementById(`ctaColor${i}`)?.value || '#045093';
        const icon  = document.getElementById(`ctaIcon${i}`)?.value || '';
        if (!name && !url) continue;
        if (!name || !url) return showToast(`CTA Button ${i+1} needs both a name and a link.`, 'error');
        if (name.length > 15) return showToast(`CTA Button ${i+1} name must be 15 characters or fewer.`, 'error');
        customCtas.push({ name, url, color, icon });
    }

    const existingPhotos = (listing.photos || []).filter(u => !_removedPhotos.includes(u));
    const mergedPhotos   = [...existingPhotos, ..._uploadedImages.photos].slice(0, limits.maxPhotos);
    const updatedLogo    = _uploadedImages.logo  || listing.logo  || null;
    const updatedVideo   = limits.hasVideo ? (_uploadedImages.video || listing.video || null) : listing.video;

    const updates = {
        tagline, description,
        subcategories:       _selectedSubcats,
        primary_subcategory: _primarySubcat,
        pricing:             document.getElementById('editPricing').value ? Number(document.getElementById('editPricing').value) : null,
        coming_soon:         document.getElementById('editComingSoon').value === 'true',
        address:             document.getElementById('editAddress').value.trim() || null,
        city:                city || null,
        state:               state || null,
        zip_code:            document.getElementById('editZip').value.trim() || null,
        phone, logo: updatedLogo, photos: mergedPhotos, video: updatedVideo,
        email:               document.getElementById('editEmail').value.trim() || null,
        website:             document.getElementById('editWebsite').value.trim() || null,
        hours,
        social_media: {
            facebook:    document.getElementById('editFacebook')?.value.trim()   || null,
            instagram:   document.getElementById('editInstagram')?.value.trim()  || null,
            twitter:     document.getElementById('editTwitter')?.value.trim()    || null,
            youtube:     document.getElementById('editYoutube')?.value.trim()    || null,
            tiktok:      document.getElementById('editTiktok')?.value.trim()     || null,
            linkedin:    document.getElementById('editLinkedin')?.value.trim()   || null,
            other1_name: document.getElementById('editOther1Name')?.value.trim() || null,
            other1:      document.getElementById('editOther1')?.value.trim()     || null,
            other2_name: document.getElementById('editOther2Name')?.value.trim() || null,
            other2:      document.getElementById('editOther2')?.value.trim()     || null,
            other3_name: document.getElementById('editOther3Name')?.value.trim() || null,
            other3:      document.getElementById('editOther3')?.value.trim()     || null,
        },
        reviews: {
            google:      listing.reviews?.google      || document.getElementById('editGoogleReviews')?.value.trim() || null,
            yelp:        listing.reviews?.yelp        || document.getElementById('editYelp')?.value.trim()          || null,
            tripadvisor: listing.reviews?.tripadvisor || document.getElementById('editTripadvisor')?.value.trim()   || null,
            other1_name: document.getElementById('editRev1Name')?.value.trim() || null,
            other1:      document.getElementById('editRev1')?.value.trim()     || null,
            other2_name: document.getElementById('editRev2Name')?.value.trim() || null,
            other2:      document.getElementById('editRev2')?.value.trim()     || null,
            other3_name: document.getElementById('editRev3Name')?.value.trim() || null,
            other3:      document.getElementById('editRev3')?.value.trim()     || null,
        },
        additional_info: additionalInfo,
        custom_ctas:     customCtas,
        updated_by_role: 'owner',
    };

    if (hoursChanged) { updates.hours_updated_at = new Date().toISOString(); updates.hours_updated_by = 'owner'; }

    const changes = _diffChanges(listing, updates);
    if (changes.length === 0) { showToast('No changes detected.', 'info'); return; }

    showConfirmModal({
        title:        'Save Changes',
        message:      `The following will be updated:\n\n${changes.map(c => `• ${c}`).join('\n')}`,
        confirmLabel: 'Save',
        onConfirm:    () => _performSave(listing.id, updates),
    });
}

/*
 * _performSave
 * UPDATE without chained .select() to avoid PGRST116/406.
 * Then a clean separate .select() to reload the row.
 */
async function _performSave(listingId, updates) {
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) saveBtn.classList.add('bp-btn--loading');

    try {
        const ALLOWED = new Set([
            'tagline','description','subcategories','primary_subcategory',
            'pricing','coming_soon','address','city','state','zip_code','country','timezone',
            'phone','email','website','logo','photos','video',
            'hours','hours_label_custom','hours_disclaimer_custom',
            'hours_updated_at','hours_updated_by',
            'social_media','reviews','additional_info','custom_ctas','updated_by_role',
        ]);
        const filtered = {};
        for (const [k, v] of Object.entries(updates)) {
            if (ALLOWED.has(k)) filtered[k] = v;
        }

        const { error: updateError } = await window.TGDAuth.supabaseClient
            .from('listings')
            .update(filtered)
            .eq('id', listingId);

        if (updateError) throw new Error(updateError.message || 'Update failed');

        const { data: updatedListing, error: fetchError } = await window.TGDAuth.supabaseClient
            .from('listings')
            .select('*')
            .eq('id', listingId)
            .single();

        if (fetchError) throw new Error(fetchError.message || 'Could not reload listing after save');

        window.BP.currentListing = updatedListing;
        _analyticsSummaryCache = null; // bust cache so analytics re-fetch with new data
        showToast('Listing saved successfully!', 'success');
        renderDashboard();
        switchTab('overview');

    } catch (err) {
        console.error('_performSave error:', err);
        showToast(`Save failed: ${err.message}`, 'error');
    } finally {
        if (saveBtn) saveBtn.classList.remove('bp-btn--loading');
    }
}

window.saveChanges = saveChanges;

// ─── 12. Media Upload ─────────────────────────────────────────────

/*
 * _uploadToCloudflare — Direct Creator Upload flow.
 *
 * Step 1: POST to our worker (?action=request-upload-url) to get a
 *         one-time Cloudflare upload URL. The worker calls the CF Images API
 *         with its server-side token — no credentials ever reach the browser.
 *
 * Step 2: POST the file directly to the one-time URL returned by CF.
 *         CF accepts it without any auth header on the client side.
 *
 * Step 3: Return the canonical image URL (constructed in step 1 from the
 *         image ID, so it's available before the upload even starts).
 *
 * @param {File}   file      - The file to upload
 * @param {string} assetType - 'logo' | 'photo' | 'video'
 */
async function _uploadToCloudflare(file, assetType = 'photo') {
    const listingId = window.BP.currentListing?.id || '';

    // ── Step 1: Request a one-time upload URL from our proxy worker ──
    let urlRes, urlData;
    try {
        urlRes  = await fetch(`${UPLOAD_PROXY}?action=request-upload-url`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ assetType, listingId }),
        });
        urlData = await urlRes.json();
    } catch (netErr) {
        throw new Error(`Could not reach upload server: ${netErr.message}`);
    }
    if (!urlRes.ok || !urlData.success) {
        throw new Error(urlData?.error || `Upload server error (HTTP ${urlRes.status})`);
    }

    // ── Step 2: Upload directly to Cloudflare — no auth needed here ──
    const uploadForm = new FormData();
    uploadForm.append('file', file);
    const uploadRes = await fetch(urlData.uploadURL, { method: 'POST', body: uploadForm });
    if (!uploadRes.ok) {
        let errMsg = `Cloudflare upload failed (HTTP ${uploadRes.status})`;
        try {
            const errData = await uploadRes.json();
            if (errData?.errors?.[0]?.message) errMsg = errData.errors[0].message;
        } catch (_) { /* non-JSON body, keep generic message */ }
        throw new Error(errMsg);
    }

    if (!urlData.imageUrl) throw new Error('Upload succeeded but no image URL was returned.');
    return urlData.imageUrl;
}

function _setUploadStatus(msg, type = '') {
    const el = document.getElementById('uploadStatus');
    if (!el) return;
    el.textContent = msg;
    el.className   = `bp-upload-status ${type ? `visible ${type}` : ''}`;
}

window._handleLogoUpload = async function(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    _setUploadStatus('Uploading logo…', 'loading');
    try {
        const url = await _uploadToCloudflare(file, 'logo');
        _uploadedImages.logo = url;
        const preview = document.getElementById('logoPreview');
        if (preview) preview.innerHTML = `<div class="bp-photo-thumb"><img src="${_esc(url)}" alt="Logo"></div>`;
        _setUploadStatus('Logo uploaded successfully.', 'success');
    } catch (err) { _setUploadStatus(`Logo upload failed: ${err.message}`, 'error'); }
};

window._handlePhotosUpload = async function(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const existing = (window.BP.currentListing?.photos || []).filter(u => !_removedPhotos.includes(u));
    const slots    = _tierLimits.maxPhotos - existing.length - _uploadedImages.photos.length;
    if (slots <= 0) { showToast(`Photo limit reached (${_tierLimits.maxPhotos} max for your plan).`, 'warning'); return; }
    const toUpload = files.slice(0, slots);
    _setUploadStatus(`Uploading ${toUpload.length} photo(s)…`, 'loading');
    const preview  = document.getElementById('photosPreview');
    let successCount = 0;
    for (let i = 0; i < toUpload.length; i++) {
        try {
            const url = await _uploadToCloudflare(toUpload[i], 'photo');
            _uploadedImages.photos.push(url);
            if (preview) { const idx = existing.length + _uploadedImages.photos.length - 1; preview.insertAdjacentHTML('beforeend', _photoThumb(url, idx, 'new')); }
            successCount++;
        } catch (err) { _setUploadStatus(`Photo ${i+1} failed: ${err.message}`, 'error'); }
    }
    if (successCount > 0) _setUploadStatus(`${successCount} photo(s) uploaded successfully.`, 'success');
};

window._handleVideoUpload = async function(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    _setUploadStatus('Uploading video…', 'loading');
    try {
        const url = await _uploadToCloudflare(file, 'video');
        _uploadedImages.video = url;
        _setUploadStatus('Video uploaded successfully.', 'success');
    } catch (err) { _setUploadStatus(`Video upload failed: ${err.message}`, 'error'); }
};

window._removePhoto = function(url, type) {
    if (type === 'existing') { _removedPhotos.push(url); window.BP.currentListing.photos = (window.BP.currentListing.photos || []).filter(u => u !== url); }
    else { _uploadedImages.photos = _uploadedImages.photos.filter(u => u !== url); }
    const preview = document.getElementById('photosPreview');
    if (preview) {
        const all = [...(window.BP.currentListing?.photos || []).filter(u => !_removedPhotos.includes(u)), ..._uploadedImages.photos];
        preview.innerHTML = all.map((u, i) => _photoThumb(u, i, _uploadedImages.photos.includes(u) ? 'new' : 'existing')).join('');
    }
};

function _photoThumb(url, idx, type) {
    return `
        <div class="bp-photo-thumb">
            <img src="${_esc(url)}" alt="Photo ${idx+1}">
            <button class="bp-photo-thumb__remove" onclick="_removePhoto('${url.replace(/'/g,"\\'")}','${type}')" title="Remove">✕</button>
        </div>
    `;
}

// ─── 13. Settings Tab ─────────────────────────────────────────────

function renderSettings() {
    const ownerData = window.BP.ownerData;
    if (!ownerData || ownerData.length === 0) return;
    const owner = ownerData[0];
    _settingsVis = { nameTitle: owner.name_title_visible !== false, email: !!owner.email_visible, phone: !!owner.phone_visible };

    document.getElementById('content-settings').innerHTML = `
        <div class="bp-page-header">
            <div><h1>Settings</h1><p>Manage your contact visibility and account security.</p></div>
        </div>

        <div class="bp-card" style="margin-bottom:16px;">
            <div class="bp-card-header"><h2>Contact Information &amp; Visibility</h2></div>
            <div class="bp-card-body">
                <p style="font-size:.85rem;color:var(--slate-500);margin-bottom:20px;">
                    Control which of your contact details appear publicly on your listing page.
                </p>
                <div class="bp-vis-row">
                    <div>
                        <div class="bp-vis-row__label">Owner Name &amp; Title</div>
                        <div class="bp-vis-row__sub">Shows "${_esc(owner.full_name||'')}"${owner.title ? ` — ${_esc(owner.title)}` : ''}</div>
                    </div>
                    <label class="bp-toggle-switch">
                        <input type="checkbox" id="visNameTitle" ${_settingsVis.nameTitle?'checked':''}
                               onchange="_onVisChange('nameTitle', this.checked)">
                        <span class="bp-toggle-switch__track"></span>
                    </label>
                </div>
                <div class="bp-vis-row">
                    <div>
                        <div class="bp-vis-row__label">Owner Email</div>
                        <div class="bp-vis-row__sub">
                            <input class="bp-input" type="email" id="settingsEmail" value="${_esc(owner.owner_email||'')}"
                                   style="max-width:300px;margin-top:6px;" placeholder="owner@example.com">
                        </div>
                    </div>
                    <label class="bp-toggle-switch">
                        <input type="checkbox" id="visEmail" ${_settingsVis.email?'checked':''}
                               onchange="_onVisChange('email', this.checked)">
                        <span class="bp-toggle-switch__track"></span>
                    </label>
                </div>
                <div class="bp-vis-row">
                    <div>
                        <div class="bp-vis-row__label">Owner Phone</div>
                        <div class="bp-vis-row__sub"><div id="settingsPhoneWrap" style="margin-top:6px;max-width:360px;"></div></div>
                    </div>
                    <label class="bp-toggle-switch">
                        <input type="checkbox" id="visPhone" ${_settingsVis.phone?'checked':''}
                               onchange="_onVisChange('phone', this.checked)">
                        <span class="bp-toggle-switch__track"></span>
                    </label>
                </div>
                <div style="margin-top:20px;">
                    <button class="bp-btn bp-btn--primary" id="saveSettingsBtn" onclick="saveSettings()">Save Contact Settings</button>
                </div>
            </div>
        </div>

        <div class="bp-card">
            <div class="bp-card-header"><h2>Change Password</h2></div>
            <div class="bp-card-body">
                <div style="max-width:360px;display:flex;flex-direction:column;gap:14px;">
                    <div class="bp-field">
                        <label class="bp-label" for="newPassword">New Password</label>
                        <input class="bp-input" type="password" id="newPassword" placeholder="Min 6 characters" autocomplete="new-password">
                    </div>
                    <div class="bp-field">
                        <label class="bp-label" for="confirmPassword">Confirm New Password</label>
                        <input class="bp-input" type="password" id="confirmPassword" placeholder="Re-enter password" autocomplete="new-password">
                    </div>
                    <div>
                        <button class="bp-btn bp-btn--primary" id="changePassBtn" onclick="changePassword()">Update Password</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.BP.createPhoneInput('settingsPhoneWrap', owner.owner_phone || '', window.BP.userCountry);
}

window._onVisChange = function(field, checked) {
    if (field === 'nameTitle' && !checked) {
        _settingsVis.nameTitle = false; _settingsVis.email = false; _settingsVis.phone = false;
        document.getElementById('visEmail').checked = false;
        document.getElementById('visPhone').checked = false;
    } else if ((field === 'email' || field === 'phone') && checked && !_settingsVis.nameTitle) {
        showToast('Enable "Owner Name & Title" visibility first.', 'warning');
        document.getElementById(`vis${field.charAt(0).toUpperCase()+field.slice(1)}`).checked = false;
        return;
    } else {
        _settingsVis[field] = checked;
    }
};

async function saveSettings() {
    const btn = document.getElementById('saveSettingsBtn');
    if (btn) btn.classList.add('bp-btn--loading');

    const email = document.getElementById('settingsEmail')?.value.trim();
    const phone = window.BP.getPhoneValue('settingsPhoneWrap');

    const updates = {
        owner_email:        email || window.BP.ownerData?.[0]?.owner_email,
        owner_phone:        phone,
        name_title_visible: _settingsVis.nameTitle,
        email_visible:      _settingsVis.email,
        phone_visible:      _settingsVis.phone,
    };

    const result = await window.TGDAuth.updateBusinessOwnerContact(updates);

    if (btn) btn.classList.remove('bp-btn--loading');

    if (result.success) {
        window.BP.ownerData = result.data;
        showToast('Settings saved successfully!', 'success');
        renderSettings();
    } else {
        showToast(`Failed to save settings: ${result.error}`, 'error');
    }
}

window.saveSettings = saveSettings;

async function changePassword() {
    const newPass     = document.getElementById('newPassword')?.value;
    const confirmPass = document.getElementById('confirmPassword')?.value;
    if (!newPass || !confirmPass)  return showToast('Please fill in both password fields.', 'error');
    if (newPass.length < 6)        return showToast('Password must be at least 6 characters.', 'error');
    if (newPass !== confirmPass)   return showToast('Passwords do not match.', 'error');
    const btn = document.getElementById('changePassBtn');
    if (btn) btn.classList.add('bp-btn--loading');
    const result = await window.TGDAuth.updatePassword(newPass);
    if (btn) btn.classList.remove('bp-btn--loading');
    if (result.success) {
        showToast('Password updated successfully!', 'success');
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    } else {
        showToast(`Password update failed: ${result.error}`, 'error');
    }
}

window.changePassword = changePassword;

// ─── 14. Inline SVG Icons ────────────────────────────────────────

const _svgAttr = `style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24"`;
const EYE_SVG    = `<svg ${_svgAttr}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const PHONE_SVG  = `<svg ${_svgAttr}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.89 9.11 19.79 19.79 0 01.83.5a2 2 0 012 2v3a2 2 0 001.45 1.93 12.66 12.66 0 002.77.78 2 2 0 001.74-1.62l.18-.74a16 16 0 008.52 8.52l-.74.18a2 2 0 00-1.62 1.74 12.66 12.66 0 00.78 2.77A2 2 0 0020.1 19"/></svg>`;
const GLOBE_SVG  = `<svg ${_svgAttr}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`;
const MAP_SVG    = `<svg ${_svgAttr}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const SHARE_SVG  = `<svg ${_svgAttr}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;
const VIDEO_SVG  = `<svg ${_svgAttr}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
const STAR_SVG   = `<svg ${_svgAttr}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const EDIT_SVG   = `<svg ${_svgAttr}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const CLOCK_SVG  = `<svg ${_svgAttr}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
const IMAGE_SVG  = `<svg ${_svgAttr}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
const EMAIL_SVG  = `<svg ${_svgAttr}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`;
const CURSOR_SVG = `<svg ${_svgAttr}><path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/></svg>`;

// ─── 15. Helper Functions ────────────────────────────────────────

function _esc(str)    { return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function _safeId(str) { return str.replace(/[^a-z0-9]/gi, '-').toLowerCase(); }
function _fmt(n)      { return Number(n || 0).toLocaleString(); }

function _timeAgo(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days < 30 ? `${days}d ago` : new Date(ts).toLocaleDateString();
}

function _socialField(label, id, value, placeholder) {
    return `
        <div class="bp-field">
            <label class="bp-label" for="${id}">${label}</label>
            <input class="bp-input" type="text" id="${id}" value="${_esc(value||'')}" placeholder="${_esc(placeholder)}">
        </div>
    `;
}

function _reviewField(label, id, value, placeholder, lockIfSet = true) {
    const locked = lockIfSet && !!value;
    return `
        <div class="bp-field">
            <label class="bp-label" for="${id}">${label}</label>
            <input class="bp-input" type="url" id="${id}" value="${_esc(value||'')}"
                   placeholder="${_esc(placeholder)}" ${locked ? 'disabled' : ''}>
            ${locked ? `<span class="bp-input-locked">🔒 Contact support to update this link</span>` : ''}
        </div>
    `;
}

function _ctaIconOptions(selected) {
    const opts = [
        { v: '',         l: 'No icon'   },
        { v: 'star',     l: '⭐ Star'    },
        { v: 'shop',     l: '🛍️ Shop'   },
        { v: 'calendar', l: '📅 Calendar'},
        { v: 'ticket',   l: '🎟️ Ticket' },
        { v: 'food',     l: '🍽️ Food'   },
        { v: 'package',  l: '📦 Package' },
        { v: 'message',  l: '💬 Message' },
        { v: 'quote',    l: '🧾 Quote'   },
        { v: 'event',    l: '🎉 Event'   },
    ];
    return opts.map(o => `<option value="${o.v}" ${selected === o.v ? 'selected' : ''}>${o.l}</option>`).join('');
}

function _updateCounter(field, current, max) {
    const el = document.getElementById(`ctr-${field}`);
    if (!el) return;
    el.textContent = `${current}/${max}`;
    el.className   = `bp-char-counter${current > max ? ' over' : current > max * 0.9 ? ' warn' : ''}`;
}
window._updateCounter = _updateCounter;

function _diffChanges(original, updates) {
  const changes = [];
  const simple = [
    ['tagline', 'Tagline'], ['description', 'Description'], ['pricing', 'Pricing'],
    ['coming_soon', 'Coming Soon status'], ['address', 'Address'], ['city', 'City'],
    ['state', 'State'], ['zip_code', 'ZIP Code'], ['phone', 'Phone'],
    ['email', 'Email'], ['website', 'Website'], ['logo', 'Logo'], ['video', 'Video']
  ];
  simple.forEach(([k, label]) => {
    if (String(original[k] ?? '') !== String(updates[k] ?? '')) changes.push(label);
  });
  if (JSON.stringify(original.subcategories?.sort()) !== JSON.stringify(updates.subcategories?.sort())) changes.push('Subcategories');
  if (original.primary_subcategory !== updates.primary_subcategory) changes.push('Primary subcategory');

  // Canonical flat-object compare: strip null/undefined/'' values, then sort keys so
  // key-insertion-order differences between the DB record and the hardcoded update payload
  // don't produce false positives.
  const _canonObj = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .sort(([a], [b]) => a.localeCompare(b))
    );
  };

  // Hours: compare the canonical per-day form on both sides, so a legacy string such as
  // "9:00 AM - 5:00 PM" or "09:00-17:00" and the per-day object it becomes compare as equal,
  // and days with nothing entered don't count as a change.
  const _canonHours = (obj) => {
    if (!obj || typeof obj !== 'object') return {};
    return Object.fromEntries(
      Object.entries(window.TGDListingHours.normalizeHours(obj))
        .filter(([, day]) => day.status !== 'unknown')
    );
  };

  // CTAs: treat icon null and '' as equivalent (the <select> always returns '').
  const _canonCtas = (arr) =>
  (arr || []).map(c => ({
    name:  c.name  || '',
    url:   c.url   || '',
    color: c.color || '#045093',
    icon:  c.icon  || ''
  }));

  if (JSON.stringify(_canonHours(original.hours))      !== JSON.stringify(_canonHours(updates.hours)))      changes.push('Hours of operation');
  if (JSON.stringify(_canonObj(original.social_media)) !== JSON.stringify(_canonObj(updates.social_media))) changes.push('Social media links');
  if (JSON.stringify(_canonObj(original.reviews))      !== JSON.stringify(_canonObj(updates.reviews)))      changes.push('Review links');
  if (JSON.stringify(original.additional_info || [])   !== JSON.stringify(updates.additional_info || []))   changes.push('Additional information');
  if (JSON.stringify(_canonCtas(original.custom_ctas)) !== JSON.stringify(_canonCtas(updates.custom_ctas))) changes.push('Custom CTA buttons');

  return changes;
}