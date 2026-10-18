// js/admin.js - PART 1
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================
// PAGE SECURITY REDIRECT RULE
// ============================
(function() {
    // vars
    const SECRET_redirect_KEY = 'mpesmesa';
    const SECRET_redirect_VALUE = 'thelonampo';
    const newdatetoday = new Date();
    const dateDD = String(newdatetoday.getDate()).padStart(2, '0');
    const params = new URLSearchParams(window.location.search);
    // function part
    if (params.get(SECRET_redirect_KEY) !== SECRET_redirect_VALUE + dateDD) {
      window.location.replace("https://thegreekdirectory.org");
    }
  })();

// ============================
// CONSOLE LOGS MESSAGES POPUPS 
// ============================

(function () {
  // Store the original console methods
  const originals = {
    log: console.log,
    warn: console.warn,
    error: console.error
  };

  // Helper function to create the on-screen notification
  function showNotification(args, type) {
    const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(" ");
    
    const box = document.createElement("div");
    box.textContent = `[${type.toUpperCase()}] ${msg}`;

    // Base styling
    box.style.position = "fixed";
    box.style.bottom = "10px";
    box.style.right = "10px";
    box.style.color = "#fff";
    box.style.padding = "10px";
    box.style.borderRadius = "4px";
    box.style.fontFamily = "monospace";
    box.style.zIndex = "9999";
    box.style.marginBottom = "5px"; // Helps if multiple pop up

    // Color coding based on log type
    if (type === 'error') {
      box.style.background = "#ff4d4d";
    } else if (type === 'warn') {
      box.style.background = "#ffae42";
      box.style.color = "#000"; // Dark text for better contrast on yellow
    } else {
      box.style.background = "#222";
    }

    document.body.appendChild(box);

    setTimeout(() => {
      box.remove();
    }, 2000);
  }

  // Override console.log
  console.log = function (...args) {
    originals.log.apply(console, args);
    showNotification(args, 'log');
  };

  // Override console.warn
  console.warn = function (...args) {
    originals.warn.apply(console, args);
    showNotification(args, 'warn');
  };

  // Override console.error
  console.error = function (...args) {
    originals.error.apply(console, args);
    showNotification(args, 'error');
  };
})();

// ============================================
// ADMIN PORTAL - PART 1
// Configuration & State Management
// ============================================

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

const CATEGORIES = [
    'Automotive & Transportation', 'Beauty & Health', 'Church & Religious Organization',
    'Cultural/Fraternal Organization', 'Education & Community', 'Entertainment, Arts & Recreation',
    'Food & Hospitality', 'Grocery & Imports', 'Home & Construction', 'Industrial & Manufacturing',
    'Pets & Veterinary', 'Professional & Business Services', 'Real Estate & Development', 'Retail & Shopping'
];

let CATEGORY_SCHEMA_TYPE_MAPS = {};

let SUBCATEGORIES = {
    'Automotive & Transportation': ['Auto Detailer', 'Auto Repair Shop', 'Car Dealer', 'Taxi & Limo Service'],
    'Beauty & Health': ['Barbershops', 'Esthetician', 'Hair Salons', 'Nail Salon', 'Spas', 'Chiropractor', 'Dentist', 'Doctor', 'Nutritionist', 'Optometrist', 'Orthodontist', 'Physical Therapist', 'Physical Trainer'],
    'Church & Religious Organization': ['Church'],
    'Cultural/Fraternal Organization': ['Dance Troupe', 'Non-Profit', 'Philanthropic Group', 'Society', 'Youth Organization'],
    'Education & Community': ['Childcare', 'Greek School', 'Senior Care', 'Tutor'],
    'Entertainment, Arts & Recreation': ['Band', 'DJs', 'Entertainment Group', 'Photographer', 'Art'],
    'Food & Hospitality': ['Banquet Hall', 'Catering Service', 'Event Venue', 'Bakeries', 'Deli', 'Pastry Shop', 'Bar', 'Breakfast', 'Coffee', 'Lunch', 'Dinner', 'Restaurant', 'Hotel', 'Airbnb'],
    'Grocery & Imports': ['Butcher Shop', 'Liquor Shop', 'Market', 'Greek Alcohol', 'Honey', 'Olive Oil', 'Food Distribution', 'Food Manufacturer'],
    'Home & Construction': ['Carpenter', 'Electrician', 'General Contractor', 'Handyman', 'HVAC', 'Landscaping', 'Painter', 'Plumber', 'Roofing', 'Tile & Stone Specialist'],
    'Industrial & Manufacturing': ['Food Manufacturer'],
    'Pets & Veterinary': ['Veterinarian', 'Pet Accessories Maker'],
    'Professional & Business Services': ['Business Services', 'Consultant', 'CPA', 'Financial Advisor', 'Insurance Agent', 'IT Service & Repair', 'Lawyer', 'Marketing & Creative Agency', 'Notaries', 'Wedding Planner', 'Travel Agency'],
    'Real Estate & Development': ['Appraiser', 'Broker', 'Developer', 'Lender', 'Property Management', 'Real Estate Agent'],
    'Retail & Shopping': ['Boutique Shop', 'ECommerce', 'Jewelry', 'Souvenir Shop']
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

const US_STATES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DC': 'D.C.', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'
};

const COUNTRY_CODES = {
    'USA': '1',
    'Greece': '30',
    'Canada': '1',
    'UK': '44',
    'Cyprus': '357',
    'Australia': '61'
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

const CATEGORY_DEFAULT_IMAGES = {
    'Automotive & Transportation': 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3',
    'Beauty & Health': 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8',
    'Church & Religious Organization': 'https://images.unsplash.com/photo-1601231656153-73aa7f115365',
    'Cultural/Fraternal Organization': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac',
    'Education & Community': 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1',
    'Entertainment, Arts & Recreation': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819',
    'Food & Hospitality': 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
    'Grocery & Imports': 'https://images.unsplash.com/photo-1542838132-92c53300491e',
    'Home & Construction': 'https://images.unsplash.com/photo-1503387762-592deb58ef4e',
    'Industrial & Manufacturing': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158',
    'Pets & Veterinary': 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b',
    'Professional & Business Services': 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40',
    'Real Estate & Development': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa',
    'Retail & Shopping': 'https://images.unsplash.com/photo-1441986300917-64674bd600d8'
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.
const SUPABASE_URL = 'https://luetekzqrrgdxtopzvqw.supabase.co/functions/v1/admin-proxy';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZXRla3pxcnJnZHh0b3B6dnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc2NDcsImV4cCI6MjA4MzkyMzY0N30.TIrNG8VGumEJc_9JvNHW-Q-UWfUGpPxR0v8POjWZJYg';
let currentAdminUser = null;
let adminGithubToken = null;
let allListings = [];
let editingListing = null;
let adminDescriptionEditor = null;
let selectedSubcategories = [];
let primarySubcategory = null;
let userCountry = 'USA';
let allRequests = [];
let currentAdminView = 'listings';
let customShortlinkCheckTimer = null;

async function adminProxy(action, payload = {}) {
    const res = await fetch(
        'https://luetekzqrrgdxtopzvqw.supabase.co/functions/v1/admin-proxy',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-github-token': adminGithubToken,
            },
            body: JSON.stringify({ action, payload }),
        }
    );
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Admin proxy error');
    return json.data;
}

const SYSTEM_SHORTLINK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function isValidSystemShortlink(path) {
    return typeof path === 'string'
        && /^\/l\/[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]{6}$/.test(path)
        && !/[A-Za-z]{4}/.test(path);
}

function isValidCustomShortlink(path) {
    return typeof path === 'string'
        && /^\/[A-Za-z0-9/_-]+$/.test(path)
        && !path.endsWith('/')
        && !path.includes('//');
}

function generateSystemShortlinkCandidate() {
    let suffix = '';
    for (let i = 0; i < 6; i += 1) {
        suffix += SYSTEM_SHORTLINK_ALPHABET[Math.floor(Math.random() * SYSTEM_SHORTLINK_ALPHABET.length)];
    }
    return `/l/${suffix}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Admin Portal...');
    console.log('✅ Admin proxy initialized');
    
    await detectUserCountry();
    setupEventListeners();
    
    const savedToken = localStorage.getItem('tgd_admin_token');
    if (savedToken) {
        document.getElementById('githubToken').value = savedToken;
        handleAdminLogin();
    }
});

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

async function detectUserCountry() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.country_code === 'US') {
            userCountry = 'USA';
        } else if (data.country_code === 'GR') {
            userCountry = 'Greece';
        } else if (data.country_code === 'CA') {
            userCountry = 'Canada';
        } else if (data.country_code === 'GB') {
            userCountry = 'UK';
        } else if (data.country_code === 'CY') {
            userCountry = 'Cyprus';
        } else if (data.country_code === 'AU') {
            userCountry = 'Australia';
        }
    } catch (error) {
        console.log('Could not detect country, defaulting to USA');
        userCountry = 'USA';
    }
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function setupEventListeners() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleAdminLogin);
    }
    
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('newListingBtn')?.addEventListener('click', newListing);
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadListings();
        loadRequests();
        if (typeof window.loadEventsAdmin === 'function') window.loadEventsAdmin();
    });
    document.getElementById('manageSubcategoriesBtn')?.addEventListener('click', manageSubcategories);
    document.getElementById('adminSearch')?.addEventListener('input', renderTable);
    document.getElementById('saveEdit')?.addEventListener('click', saveListing);
    document.getElementById('generateAllBtn')?.addEventListener('click', generateAllListingPages);
    document.getElementById('csvUpload')?.addEventListener('change', handleCSVUpload);
    document.getElementById('listingsViewBtn')?.addEventListener('click', () => switchAdminView('listings'));
    document.getElementById('requestsViewBtn')?.addEventListener('click', () => switchAdminView('requests'));
    document.getElementById('cancelEdit')?.addEventListener('click', () => {
        if (confirm('Discard changes?')) {
            document.getElementById('editModal').classList.add('hidden');
            document.getElementById('editModal').dataset.mode = '';
            document.getElementById('editModal').dataset.requestId = '';
            document.getElementById('saveEdit')?.classList.remove('hidden');
        }
    });
    document.getElementById('closeModal')?.addEventListener('click', () => {
        if (confirm('Discard changes?')) {
            document.getElementById('editModal').classList.add('hidden');
            document.getElementById('editModal').dataset.mode = '';
            document.getElementById('editModal').dataset.requestId = '';
            document.getElementById('saveEdit')?.classList.remove('hidden');
        }
    });
    document.getElementById('closeAnalyticsModal')?.addEventListener('click', () => {
        if (typeof closeAnalyticsModal === 'function') {
            closeAnalyticsModal();
        }
    });
    document.getElementById('analyticsModal')?.addEventListener('click', (event) => {
        if (event.target && event.target.id === 'analyticsModal') {
            if (typeof closeAnalyticsModal === 'function') {
                closeAnalyticsModal();
            }
        }
    });
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 2
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 2
// Authentication & Login Functions
// ============================================

async function handleAdminLogin() {
    const token = document.getElementById('githubToken').value.trim();
    
    if (!token) {
        showError('Please enter your GitHub token');
        return;
    }
    
    clearAuthMessage();
    
    try {
        const response = await fetch('https://api.github.com/repos/thegreekdirectory/platform', {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid GitHub token');
        }
        
        adminGithubToken = token;
        localStorage.setItem('tgd_admin_token', token);
        
        showSuccess('Login successful!');
        showDashboard();
        await loadSubcategories();
        await loadListings();
        await loadRequests();
        
    } catch (error) {
        console.error('Login error:', error);
        showError('Invalid GitHub token. Please check and try again.');
    }
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function showLoginPage() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
}

async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        adminGithubToken = null;
        localStorage.removeItem('tgd_admin_token');
        showLoginPage();
    }
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function showError(message) {
    const msgDiv = document.getElementById('authMessage');
    msgDiv.className = 'error-message';
    msgDiv.textContent = message;
    msgDiv.classList.remove('hidden');
}

function showSuccess(message) {
    const msgDiv = document.getElementById('authMessage');
    msgDiv.className = 'success-message';
    msgDiv.textContent = message;
    msgDiv.classList.remove('hidden');
}

function clearAuthMessage() {
    const msgDiv = document.getElementById('authMessage');
    msgDiv.classList.add('hidden');
    msgDiv.textContent = '';
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

const LISTING_IMAGE_CDN = 'https://images.thegreekdirectory.org';
const META_DESCRIPTION_SUFFIX = 'Greek business in {city}, {state}. View address, phone, hours, and photos.';

function normalizeTagline(tagline = '') {
    const cleaned = String(tagline || '').replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim();
    return cleaned ? `${cleaned}.` : '';
}

function buildMetaDescription(tagline, city, state) {
    const normalizedTagline = normalizeTagline(tagline);
    const base = `${normalizedTagline} ${META_DESCRIPTION_SUFFIX.replace('{city}', city || '').replace('{state}', state || '')}`
        .replace(/\s+/g, ' ')
        .replace(/\.{2,}/g, '.')
        .replace(/\s+([.,!?])/g, '$1')
        .trim();
    return base.length > 160 ? `${base.slice(0, 157).trimEnd()}.` : base;
}

function getTaglineMaxLength(city = '', state = '') {
    const suffixLength = META_DESCRIPTION_SUFFIX.replace('{city}', city || '').replace('{state}', state || '').length;
    const available = 160 - suffixLength - 2;
    return Math.max(30, Math.min(75, available));
}

function normalizeImageCdnUrl(url = '') {
    const raw = String(url || '').trim();
    if (!raw) return '';
    return raw;
}

function normalizePhoneE164(value, country = 'USA') {
    if (!value) return null;
    const digits = String(value).replace(/\D/g, '');
    if (!digits) return null;

    if (country === 'USA') {
        if (digits.length !== 10) return null;
        return `+1${digits}`;
    }

    const code = COUNTRY_CODES[country] || '1';
    const national = digits.startsWith(code) ? digits.slice(code.length) : digits;
    return national ? `+${code}${national}` : null;
}

function formatPhoneNumber(phone) {
    if (!phone) return '';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
    }
    return String(phone);
}

function sanitizeListingDescription(value) {
    if (window.RichTextEditor) return window.RichTextEditor.sanitizeRichTextHtml(value || '');
    return escapeHtml(value || '');
}

function toDisplayHourLabel(hoursValue) {
    const raw = String(hoursValue || '').trim();
    if (!raw || /^closed$/i.test(raw) || /24/.test(raw.toLowerCase())) return raw || 'Closed';
    if (raw === '00:00-23:59' || raw === '00:00 - 23:59') return 'Open All Day';
    const match = raw.match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
    if (!match) return raw;

    const toTwelveHour = (hourPart, minutePart) => {
        const hour = parseInt(hourPart, 10);
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const convertedHour = hour % 12 || 12;
        return `${convertedHour}:${minutePart} ${suffix}`;
    };

    return `${toTwelveHour(match[1], match[2])} - ${toTwelveHour(match[3], match[4])}`;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return 'recently';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'recently';
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${Math.max(minutes, 1)} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
}

function formatUtcTimestamp(timestamp) {
    if (!timestamp) return 'unknown';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'unknown';
    return date.toISOString().replace('T', ' ').slice(0, 16);
}

function getHoursUpdatedByLabel(listing) {
    const raw = String(listing.hours_updated_by || listing.updated_by_role || listing.updated_by || '').trim().toLowerCase();
    if (!raw) return 'TGD Admin';
    if (raw.includes('owner') || raw.includes('business')) return 'Business Owner';
    if (raw.includes('admin')) return 'TGD Admin';
    return raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCustomCtaIconOptions(selected = '') {
    const normalizedSelected = normalizeCustomCtaIcon(selected);
    const options = [
        { value: '', label: 'No icon' },
        { value: 'star', label: 'Star' },
        { value: 'shop', label: 'Shop' },
        { value: 'calendar', label: 'Calendar' },
        { value: 'ticket', label: 'Ticket' },
        { value: 'food', label: 'Food' },
        { value: 'package', label: 'Package' },
        { value: 'message', label: 'Message' },
        { value: 'quote', label: 'Quote' },
        { value: 'event', label: 'Event' }
    ];
    return options.map((option) => `<option value="${option.value}" ${normalizedSelected === option.value ? 'selected' : ''}>${option.label}</option>`).join('');
}

function normalizeCustomCtaIcon(icon = '') {
    const value = String(icon || '').trim();
    const legacyMap = {
        '⭐': 'star',
        '🛍️': 'shop',
        '📅': 'calendar',
        '🎟️': 'ticket',
        '🍽️': 'food',
        '📦': 'package',
        '💬': 'message',
        '🧾': 'quote',
        '🎉': 'event'
    };
    return legacyMap[value] || value;
}

function getCustomCtaIconSvg(icon = '', className = 'w-5 h-5') {
    const normalized = normalizeCustomCtaIcon(icon);
    if (normalized === 'food') {
        return `<svg class="${className}" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><g><path d="M207.103,23.875v109.219c0,7-5.656,12.641-12.625,12.641h-3.375c-6.969,0-12.641-5.641-12.641-12.641V23.375c0-18-12.109-23.375-23.719-23.375s-23.719,5.375-23.719,23.375v109.719c0,7-5.672,12.641-12.641,12.641h-3.375c-6.969,0-12.625-5.641-12.625-12.641V23.875c0-32.219-45.938-31.125-45.938,0.359c0,37.703,0,104.297,0,104.297c-0.219,57.906,13.625,72.953,36.469,91c18.422,14.531,34.156,22.859,34.156,58.953v232.188h55.344V278.484c0-36.094,15.734-44.422,34.156-58.953c22.859-18.047,36.688-33.094,36.469-91c0,0,0-66.594,0-104.297C253.04-7.25,207.103-8.344,207.103,23.875z"/><path d="M385.228,34.75c-11.75,32.953-45.578,110.156-47.719,178.344c-3.313,105.844,61.547,90.188,62.703,159.531v138.688h55.078l0.266,0.688c0,0,0-0.281,0-0.688c0-9.266,0-119.625,0-232.203c0-111.359,0-224.797,0-244.359C455.556-5.438,403.524-16.531,385.228,34.75z"/></g></svg>`;
    }
    const iconPaths = {
        star: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321 1.012l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.386a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0l-4.725 2.885a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-1.012l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />',
        shop: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7.5h18M6 7.5l1.2 12h9.6L18 7.5M9.75 11.25v4.5m4.5-4.5v4.5M9 4.5h6"/>',
        calendar: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 2.75v2.5m8-2.5v2.5M3.75 9.25h16.5m-15 10h13.5a1.5 1.5 0 001.5-1.5V6.25a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v11.5a1.5 1.5 0 001.5 1.5z"/>',
        ticket: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 8.25A2.25 2.25 0 016.75 6h10.5A2.25 2.25 0 0119.5 8.25V10a1.5 1.5 0 000 3v1.75A2.25 2.25 0 0117.25 17H6.75A2.25 2.25 0 014.5 14.75V13a1.5 1.5 0 000-3V8.25z"/>',
        food: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7.5 3v8.25M5.25 3v8.25m2.25 0a2.25 2.25 0 01-2.25 2.25m2.25-2.25a2.25 2.25 0 002.25 2.25M15 3v18m0-10.5h3.75c0-4.142-1.678-7.5-3.75-7.5"/>',
        package: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 7.5L12 3l8.25 4.5M3.75 7.5V16.5L12 21m-8.25-13.5L12 12m8.25-4.5V16.5L12 21m0-9v9"/>',
        message: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.25 12c0-4.28 4.364-7.75 9.75-7.75s9.75 3.47 9.75 7.75-4.364 7.75-9.75 7.75a11.7 11.7 0 01-3.725-.6l-4.025 1.35 1.13-3.39A7.12 7.12 0 012.25 12z"/>',
        quote: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 9a3.75 3.75 0 00-3.75 3.75V15a3 3 0 003 3h2.25A1.5 1.5 0 0011.25 16.5V10.5A1.5 1.5 0 009.75 9h-1.5zm8.25 0a3.75 3.75 0 00-3.75 3.75V15a3 3 0 003 3H18a1.5 1.5 0 001.5-1.5V10.5A1.5 1.5 0 0018 9h-1.5z"/>',
        event: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM12 12v9m0-9c-4.5 0-7.5 2.1-7.5 5.25V21h15v-3.75C19.5 14.1 16.5 12 12 12z"/>'
    };
    const path = iconPaths[normalized];
    if (!path) return '';
    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">${path}</svg>`;
}

function createPhoneInput(value = '', country = 'USA') {
    const numericValue = value ? value.replace(/\D/g, '') : '';
    const digits = country === 'USA' && numericValue.startsWith('1') && numericValue.length === 11
        ? numericValue.slice(1)
        : numericValue;
    
    return `
        <div class="flex gap-2">
            <select class="phone-country-select px-3 py-2 border border-gray-300 rounded-lg" onchange="updatePhoneFormat(this)">
                ${Object.entries(COUNTRY_CODES).map(([c, code]) => 
                    `<option value="${c}" ${country === c ? 'selected' : ''}>${c} +${code}</option>`
                ).join('')}
            </select>
            <input type="tel" class="phone-number-input flex-1 px-4 py-2 border border-gray-300 rounded-lg" 
                value="${digits}" 
                placeholder="${country === 'USA' ? '(555) 123-4567' : 'Phone number'}"
                oninput="formatPhoneInput(this)">
        </div>
    `;
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.formatPhoneInput = function(input) {
    const country = input.closest('.flex').querySelector('.phone-country-select').value;
    let value = input.value.replace(/\D/g, '');
    
    if (country === 'USA' && value.length > 10) {
        value = value.substr(0, 10);
    }
    
    input.value = value;
};

window.updatePhoneFormat = function(select) {
    const input = select.closest('.flex').querySelector('.phone-number-input');
    const digits = input.value.replace(/\D/g, '');
    input.value = digits;
    formatPhoneInput(input);
};

function getPhoneValue(container) {
    const countrySelect = container.querySelector('.phone-country-select');
    const phoneInput = container.querySelector('.phone-number-input');
    
    if (!phoneInput || !phoneInput.value.trim()) return null;
    
    const country = countrySelect ? countrySelect.value : 'USA';
    const digits = phoneInput.value.replace(/\D/g, '');
    const code = COUNTRY_CODES[country];
    
    return normalizePhoneE164(digits, country);
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.handleAdminLogin = handleAdminLogin;
window.logout = logout;

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 3
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 3
// Load & Render Listings
// ============================================


function generateSlugFromName(business_name = '', address = '', city = '', state = '') {
    const greekToLatin = {
        'α':'a','β':'b','γ':'g','δ':'d','ε':'e','ζ':'z','η':'h','θ':'th','ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p','ρ':'r','σ':'s','ς':'s','τ':'t','υ':'y','φ':'f','χ':'ch','ψ':'ps','ω':'o',
        'Α':'a','Β':'b','Γ':'g','Δ':'d','Ε':'e','Ζ':'z','Η':'h','Θ':'th','Ι':'i','Κ':'k','Λ':'l','Μ':'m','Ν':'n','Ξ':'x','Ο':'o','Π':'p','Ρ':'r','Σ':'s','Τ':'t','Υ':'y','Φ':'f','Χ':'ch','Ψ':'ps','Ω':'o'
    };

    // Helper function to clean individual slug components
    function processComponent(text, removeApostrophes = false) {
        let out = text || '';
        
        // Convert "&" to "and" explicitly before other character replacements
        out = out.replace(/&/g, 'and');
        
        // Transliterate Greek characters to Latin
        Object.entries(greekToLatin).forEach(([gr, lt]) => {
            out = out.replace(new RegExp(gr, 'g'), lt);
        });
        
        // Completely remove specific apostrophes/quotes instead of converting to hyphens
        if (removeApostrophes) {
            out = out.replace(/['’‘]/g, '');
        }
        
        // Convert to lowercase, replace remaining non-alphanumeric characters with '-', and strip leading/trailing '-'
        out = out.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return out;
    }

    // Process each necessary component
    const cleanBusinessName = processComponent(business_name, true);

    // Fallback if the business name becomes completely empty after formatting
    const finalBusinessName = cleanBusinessName || `listing-${Date.now()}`;

    // Determine the slug prefix format based on the presence of an address
    if (address && String(address).trim()) {
        const cleanCity = processComponent(city, true);
        const cleanState = processComponent(state, false);
        return `${cleanCity}-${cleanState}/${finalBusinessName}`;
    } else {
        return `online/${finalBusinessName}`;
    }
}

async function loadSubcategories() {
    try {
        const data = await adminProxy('subcategories:list');
        if (Array.isArray(data) && data.length > 0) {
            const next = {};
            data.forEach((row) => {
                // Safely checks if row values align with your Supabase schema definition
                if (row.category && Array.isArray(row.subcategories)) {
                    next[row.category] = row.subcategories;
                }
                if (row.category && row.schema_type_map && typeof row.schema_type_map === 'object') {
                    CATEGORY_SCHEMA_TYPE_MAPS[row.category] = row.schema_type_map;
                }
            });
            if (Object.keys(next).length > 0) {
                SUBCATEGORIES = { ...SUBCATEGORIES, ...next };
            }
        }
        
        // Triggers UI checkpoint update if modal is already open during lazy load
        if (document.getElementById('editCategory')) {
            window.updateSubcategoriesForCategory();
        }
    } catch (error) {
        console.warn('Could not load dynamic subcategories', error);
    }
}

window.manageSubcategories = async function() {
    const category = prompt('Enter the exact main category to edit subcategories for:\n\n' + CATEGORIES.join('\n'));
    if (!category || !CATEGORIES.includes(category)) return;
    const current = (SUBCATEGORIES[category] || []).join(', ');
    const updated = prompt(`Enter comma-separated subcategories for ${category}:`, current);
    if (updated === null) return;
    const list = updated.split(',').map(v => v.trim()).filter(Boolean);
    try {
        await adminProxy('subcategories:insert', { category, subcategories: list });
        SUBCATEGORIES[category] = list;
        updateSubcategoriesForCategory();
        alert('Subcategories updated.');
    } catch (error) {
        alert('Failed to save subcategories: ' + error.message);
    }
};

async function loadListings() {
    try {
        console.log('📥 Loading listings from Supabase...');

        const listings = await adminProxy('listings:list');
        allListings = Array.isArray(listings)
            ? listings.slice().sort((a, b) => {
                const aTime = new Date(a.created_at || 0).getTime();
                const bTime = new Date(b.created_at || 0).getTime();
                if (aTime !== bTime) return bTime - aTime;
                return String(a.business_name || '').localeCompare(String(b.business_name || ''));
            })
            : [];
        console.log(`✅ Loaded ${allListings.length} listings`);
        
        renderTable();
        
    } catch (error) {
        console.error('❌ Error loading listings:', error);
        alert('Failed to load listings: ' + error.message);
    }
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.



async function loadRequests() {
    try {
        const data = await adminProxy('requests:list');
        allRequests = Array.isArray(data)
            ? data.slice().sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
            : [];
        renderRequestsTable();
    } catch (error) {
        console.error('❌ Error loading requests:', error);
        alert('Failed to load requests: ' + error.message);
    }
}

function switchAdminView(view) {
    currentAdminView = view;
    const listingsBtn    = document.getElementById('listingsViewBtn');
    const requestsBtn    = document.getElementById('requestsViewBtn');
    const suggestionsBtn = document.getElementById('tab-btn-suggestions');
    const eventsBtn       = document.getElementById('eventsViewBtn');
    const listingsSection    = document.getElementById('listingsSection');
    const requestsSection    = document.getElementById('requestsSection');
    const suggestionsSection = document.getElementById('tab-suggestions');
    const eventsSection      = document.getElementById('eventsSection');
    const newListingBtn  = document.getElementById('newListingBtn');
    const newEventBtn    = document.getElementById('newEventBtn');

    // Hide all sections first
    listingsSection?.classList.add('hidden');
    requestsSection?.classList.add('hidden');
    suggestionsSection?.classList.add('hidden');
    eventsSection?.classList.add('hidden');
    newListingBtn?.classList.add('hidden');
    newEventBtn?.classList.add('hidden');

    // Reset all tab button styles
    if (listingsBtn)    listingsBtn.className    = 'px-4 py-2 bg-blue-100 text-blue-800 rounded-lg font-medium';
    if (requestsBtn)    requestsBtn.className    = 'px-4 py-2 bg-orange-100 text-orange-800 rounded-lg font-medium';
    if (suggestionsBtn) suggestionsBtn.className = 'px-4 py-2 rounded-lg font-medium text-sm transition-colors text-gray-600 hover:bg-gray-100 relative';
    if (eventsBtn)       eventsBtn.className     = 'px-4 py-2 bg-teal-100 text-teal-800 rounded-lg font-medium';

    if (view === 'requests') {
        requestsSection?.classList.remove('hidden');
        if (requestsBtn) requestsBtn.className = 'px-4 py-2 bg-orange-600 text-white rounded-lg font-medium';
        loadRequests();
    } else if (view === 'suggestions') {
        suggestionsSection?.classList.remove('hidden');
        if (suggestionsBtn) suggestionsBtn.className = 'px-4 py-2 bg-purple-600 text-white rounded-lg font-medium text-sm relative';
        loadSuggestions();
    } else if (view === 'events') {
        eventsSection?.classList.remove('hidden');
        newEventBtn?.classList.remove('hidden');
        if (eventsBtn) eventsBtn.className = 'px-4 py-2 bg-teal-600 text-white rounded-lg font-medium';
        // Defined in js/admin-events.js, loaded after this file — see
        // that file's own header comment for why this is a plain global
        // call rather than an event/module import, matching how
        // loadRequests()/loadSuggestions() are called here for their
        // own tabs.
        if (typeof window.loadEventsAdmin === 'function') window.loadEventsAdmin();
    } else {
        // default: listings
        listingsSection?.classList.remove('hidden');
        newListingBtn?.classList.remove('hidden');
        if (listingsBtn) listingsBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded-lg font-medium';
        renderTable();
    }
}

function renderRequestsTable() {
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) return;

    const searchTerm = document.getElementById('adminSearch')?.value.toLowerCase() || '';
    const filtered = searchTerm
        ? allRequests.filter((r) =>
            (r.business_name || '').toLowerCase().includes(searchTerm) ||
            (r.category || '').toLowerCase().includes(searchTerm) ||
            (r.city || '').toLowerCase().includes(searchTerm) ||
            String(r.id || '').includes(searchTerm)
        )
        : allRequests;

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="py-10 px-4 text-center text-gray-500">No listing requests found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map((r) => `
        <tr class="border-b hover:bg-orange-50">
            <td class="py-4 px-4 text-sm font-mono text-gray-600">#${r.id}</td>
            <td class="py-4 px-4 font-medium">${r.business_name || ''}</td>
            <td class="py-4 px-4 text-gray-700">${r.category || ''}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${r.city || ''}${r.state ? ', ' + r.state : ''}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
            <td class="py-4 px-4">
                <div class="flex justify-end gap-2 flex-wrap">
                    <button onclick="viewRequest('${r.id}')" class="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">View</button>
                    <button onclick="editRequest('${r.id}')" class="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Edit</button>
                    <button onclick="acceptRequest('${r.id}')" class="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200">Accept</button>
                    <button onclick="denyRequest('${r.id}')" class="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Deny</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.viewRequest = async function(requestId) {
    await openRequestInEditor(requestId, false);
};

window.editRequest = async function(requestId) {
    await openRequestInEditor(requestId, true);
};

async function openRequestInEditor(requestId, editable) {
    const request = allRequests.find((r) => String(r.id) === String(requestId));
    if (!request) {
        alert('Request not found');
        return;
    }

    const normalized = normalizeRequestToListing(request);
    editingListing = { ...normalized, id: null };
    selectedSubcategories = normalized.subcategories || [];
    primarySubcategory = normalized.primary_subcategory || null;

    document.getElementById('modalTitle').textContent = editable
        ? `Edit Request #${request.id}`
        : `View Request #${request.id}`;
    fillEditForm(editingListing);

    if (!editable) {
        const fields = document.querySelectorAll('#editFormContent input, #editFormContent textarea, #editFormContent select');
        fields.forEach((el) => el.setAttribute('disabled', 'disabled'));
        const saveBtn = document.getElementById('saveEdit');
        if (saveBtn) saveBtn.classList.add('hidden');
    } else {
        const saveBtn = document.getElementById('saveEdit');
        if (saveBtn) saveBtn.classList.remove('hidden');
    }

    document.getElementById('editModal').dataset.requestId = String(request.id);
    document.getElementById('editModal').dataset.mode = editable ? 'request-edit' : 'request-view';
    document.getElementById('editModal').classList.remove('hidden');
}

function normalizeRequestToListing(request) {
    return {
        business_name: request.business_name || '',
        slug: request.slug || '',
        tagline: request.tagline || '',
        description: request.description || '',
        category: request.category || CATEGORIES[0],
        subcategories: request.subcategories || [],
        primary_subcategory: request.primary_subcategory || null,
        verified: false,
        is_chain: !!request.is_chain,
        is_claimed: false,
        chain_name: request.chain_name || '',
        chain_id: request.chain_id || '',
        address: request.address || '',
        city: request.city || '',
        state: request.state || '',
        zip_code: request.zip_code || '',
        country: request.country || 'USA',
        phone: request.phone || '',
        email: request.email || '',
        website: request.website || '',
        logo: request.logo || '',
        photos: request.photos || [],
        video: request.video || '',
        additional_info: request.additional_info || [],
        custom_ctas: request.custom_ctas || [],
        hours: request.hours || {},
        social_media: request.social_media || {},
        reviews: request.reviews || {},
        owner: [{
            full_name: request.owner_name || '',
            title: request.owner_title || '',
            from_greece: request.from_greece || '',
            owner_email: request.owner_email || '',
            owner_phone: request.owner_phone || '',
            confirmation_key: null
        }]
    };
}

window.acceptRequest = async function(requestId) {
    const request = allRequests.find((r) => String(r.id) === String(requestId));
    if (!request) return;
    if (!confirm(`Accept request from ${request.business_name || 'business'} and create listing?`)) return;

    try {
        const listingData = normalizeRequestToListing(request);
        const safeSlug = listingData.slug && listingData.slug.trim()
            ? generateSlugFromName(listingData.slug)
            : generateSlugFromName(listingData.business_name || request.business_name || 'listing');
        const payload = {
            ...listingData,
            slug: safeSlug,
            tier: 'FREE',
            visible: true,
            owner: undefined
        };
        delete payload.owner;

        const inserted = await adminProxy('listings:insert', payload);

        const ownerRows = [];
        ownerRows.push({
            listing_id: inserted.id,
            full_name: request.owner_name || null,
            title: request.owner_title || null,
            from_greece: request.from_greece || null,
            owner_email: request.owner_email || null,
            owner_phone: request.owner_phone || null,
            name_title_visible: request.owner_name_title_visible !== false,
            email_visible: request.owner_email_visible === true,
            phone_visible: request.owner_phone_visible === true,
            confirmation_key: null
        });

        const extraOwners = Array.isArray(request.owner_contacts) ? request.owner_contacts.slice(1) : [];
        extraOwners.forEach((o) => {
            if (!o || !o.enabled) return;
            ownerRows.push({
                listing_id: inserted.id,
                full_name: o.name || null,
                title: o.title || null,
                from_greece: request.from_greece || null,
                owner_email: o.email || null,
                owner_phone: normalizePhoneE164(o.phone, 'USA'),
                name_title_visible: true,
                email_visible: true,
                phone_visible: true,
                confirmation_key: null
            });
        });

        for (const row of ownerRows) {
            await adminProxy('owners:upsert', row);
        }

        await adminProxy('requests:delete', { id: requestId });
        await loadRequests();
        await loadListings();
        const pageGenerated = await generateListingPage(inserted.id);
        if (pageGenerated) {
            await updateSitemap();
            alert('✅ Request accepted, listing created, and page generated.');
        } else {
            alert('⚠️ Request accepted and listing created, but page generation failed. Please click 🔨 on the listing row.');
        }
    } catch (error) {
        console.error('Error accepting request:', error);
        alert('Failed to accept request: ' + error.message);
    }
};

window.denyRequest = async function(requestId) {
    const request = allRequests.find((r) => String(r.id) === String(requestId));
    if (!request) return;
    if (!confirm(`Deny request from ${request.business_name || 'business'}?`)) return;

    try {
        await adminProxy('requests:delete', { id: requestId });
        await loadRequests();
    } catch (error) {
        console.error('Error denying request:', error);
        alert('Failed to deny request: ' + error.message);
    }
};

function renderTable() {
    const tbody = document.getElementById('listingsTableBody');
    const searchTerm = document.getElementById('adminSearch')?.value.toLowerCase() || '';
    
    if (currentAdminView === 'requests') {
        renderRequestsTable();
        return;
    }

    const filtered = searchTerm ? allListings.filter(l => 
        l.business_name.toLowerCase().includes(searchTerm) ||
        l.category.toLowerCase().includes(searchTerm) ||
        (l.city && l.city.toLowerCase().includes(searchTerm)) ||
        (l.id && l.id.toString().includes(searchTerm))
    ) : allListings;
    
    tbody.innerHTML = filtered.map(l => {
        const categorySlug = l.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const listingUrl = `/listing/${l.slug}`;
        const tier = l.tier || 'FREE';
        const tierColors = {
            FREE: 'bg-gray-100 text-gray-700',
            FEATURED: 'bg-yellow-100 text-yellow-700',
            PREMIUM: 'bg-purple-100 text-purple-700'
        };
        
        const ownerInfo = l.owner && l.owner.length > 0 ? l.owner[0] : null;
        const isClaimed = l.is_claimed === true;
        
        let badges = '';
        if (tier === 'PREMIUM') {
            badges = '<span class="ml-2 px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">⭐ Featured</span>';
            badges += '<span class="ml-2 px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">👑 Premium</span>';
        } else if (tier === 'FEATURED') {
            badges = '<span class="ml-2 px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">⭐ Featured</span>';
        }
        
        if (isClaimed) {
            badges += '<span class="ml-2 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">✓ Claimed</span>';
        }
        
        if (l.is_chain) {
            badges += '<span class="ml-2 px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">🔗 Chain</span>';
        }
        
        // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
        
        return `
        <tr class="border-b hover:bg-gray-50">
            <td class="py-4 px-4 text-sm font-mono text-gray-600">${l.id}</td>
            <td class="py-4 px-4">
                <label class="inline-flex items-center cursor-pointer">
                    <input type="checkbox" ${l.visible ? 'checked' : ''} onchange="toggleVisibility('${l.id}')" class="w-4 h-4">
                    <span class="ml-2 text-sm">${l.visible ? '👁️ Visible' : '🚫 Hidden'}</span>
                </label>
            </td>
            <td class="py-4 px-4">
                <span class="px-2 py-1 rounded text-xs font-medium ${tierColors[tier]}">${tier}</span>
                ${badges}
            </td>
            <td class="py-4 px-4 font-medium">${l.business_name}</td>
            <td class="py-4 px-4 text-gray-600">${l.category}</td>
            <td class="py-4 px-4 text-sm text-gray-600">${l.city || ''}, ${l.state || ''}</td>
            <td class="py-4 px-4 text-sm text-gray-600">
                <button onclick="viewAnalytics('${l.id}')" class="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200">
                    📊 Analytics
                </button>
            </td>
            <td class="py-4 px-4 text-sm text-gray-600">${new Date(l.updated_at).toLocaleString()}</td>
            <td class="py-4 px-4">
                <div class="flex justify-end gap-2 flex-wrap">
                    <button onclick="editListing('${l.id}')" class="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Edit</button>
                    <a href="${listingUrl}" target="_blank" class="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">View</a>
                    <button onclick="generateListingPage('${l.id}')" class="px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200" title="Generate Static Page">🔨</button>
                    ${isClaimed ? `<button onclick="sendMagicLink('${l.id}')" class="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">🔗</button>` : ''}
                    <button onclick="deleteListing('${l.id}')" class="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">Delete</button>
                </div>
            </td>
        </tr>
    `}).join('');
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.toggleVisibility = async function(id) {
    try {
        const listing = allListings.find(l => l.id === id);
        const newVisible = !listing.visible;
        
        await adminProxy('listings:update', { id, visible: newVisible });
        
        listing.visible = newVisible;
        renderTable();
        
    } catch (error) {
        console.error('Error toggling visibility:', error);
        alert('Failed to update visibility');
    }
};

window.loadListings = loadListings;

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 4 (FIXED)
// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

// ============================================
// ADMIN PORTAL - PART 4
// Analytics Modal & Viewing
// ============================================

window.viewAnalytics = async function(listingId) {
    console.log('📊 viewAnalytics called for listing:', listingId);
    
    const listing = allListings.find(l => l.id === listingId);
    if (!listing) {
        console.error('Listing not found:', listingId);
        alert('Listing not found');
        return;
    }
    
    console.log('Found listing:', listing.business_name);
    
    try {
        console.log('Fetching analytics data...');
        
        const analyticsData = await adminProxy('analytics:get', { listing_id: listingId });
        const analyticsEvents = await adminProxy('analytics:events', { listing_id: listingId, limit: 20 });
        console.log('Analytics data fetched:', analyticsData ? 1 : 0, 'events');
        
        // Aggregate analytics
        const analytics = {
            summary: analyticsData || null
        };
        
        console.log('Aggregated analytics:', analytics);
        
        // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
        
        const modal = document.getElementById('analyticsModal');
        const modalTitle = document.getElementById('analyticsModalTitle');
        const modalContent = document.getElementById('analyticsContent');

        if (modalTitle) {
            modalTitle.textContent = `Analytics: ${listing.business_name}`;
        }
        if (modalContent) {
            modalContent.innerHTML = generateAnalyticsContent(listing, analytics);

            const grid = document.getElementById('analyticsSummaryGrid');
            if (grid && analyticsData) {
                const renderSummaryCards = (bucket) => {
                    const metric = (prefix) => Number(analyticsData[prefix + '_' + bucket] || 0);
                    const cards = [
                        ['Total Views', metric('views'), 'from-blue-500 to-blue-600'],
                        ['Call Clicks', metric('call_clicks'), 'from-green-500 to-green-600'],
                        ['Email Clicks', metric('email_clicks'), 'from-violet-500 to-violet-600'],
                        ['Website Clicks', metric('website_clicks'), 'from-purple-500 to-purple-600'],
                        ['Directions', metric('directions_clicks'), 'from-orange-500 to-orange-600'],
                        ['Custom CTA 1', metric('custom_cta_1'), 'from-cyan-500 to-cyan-600'],
                        ['Custom CTA 2', metric('custom_cta_2'), 'from-indigo-500 to-indigo-600'],
                        ['Shares', metric('share_clicks'), 'from-pink-500 to-pink-600'],
                        ['Social Media Clicks', metric('social_clicks'), 'from-violet-500 to-violet-600'],
                        ['Review Clicks', metric('review_clicks'), 'from-amber-500 to-amber-600']
                    ];
                    grid.innerHTML = cards.map(function(card) {
                        return '<div class="bg-gradient-to-br ' + card[2] + ' text-white p-4 rounded-lg shadow-sm">'
                            + '<div class="text-2xl font-bold">' + card[1] + '</div>'
                            + '<div class="text-xs opacity-90">' + card[0] + '</div>'
                            + '</div>';
                    }).join('');
                };

                const select = document.getElementById('analyticsTimeBucket');
                if (select) {
                    renderSummaryCards(select.value || 'all');
                    select.addEventListener('change', (event) => renderSummaryCards(event.target.value));
                }
            }

            const eventsContainer = document.getElementById('analyticsRecentActivity');
            if (eventsContainer) {
                const labels = {
                    view: 'Page View',
                    call: 'Phone Call',
                    email: 'Email Click',
                    website: 'Website Visit',
                    directions: 'Directions',
                    share: 'Share',
                    social: 'Social Media Click',
                    review: 'Review Click',
                    custom_cta_1: 'Custom CTA 1',
                    custom_cta_2: 'Custom CTA 2'
                };
                const colors = {
                    view: '#3b82f6',
                    call: '#10b981',
                    email: '#8b5cf6',
                    website: '#6366f1',
                    directions: '#f97316',
                    share: '#ec4899',
                    social: '#8b5cf6',
                    review: '#f59e0b',
                    custom_cta_1: '#06b6d4',
                    custom_cta_2: '#4f46e5'
                };
                const rows = Array.isArray(analyticsEvents) ? analyticsEvents : [];
                if (!rows.length) {
                    eventsContainer.innerHTML = '<p class="text-sm text-gray-500 text-center py-6">No events recorded yet.</p>';
                } else {
                    eventsContainer.innerHTML = rows.map((row) => {
                        const label = labels[row.action] || row.action || 'Event';
                        const platform = row.platform ? '<span class="text-xs text-gray-500"> via ' + row.platform + '</span>' : '';
                        const time = row.timestamp ? new Date(row.timestamp).toLocaleString() : 'Unknown time';
                        const dot = colors[row.action] || '#94a3b8';
                        return '<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">'
                            + '<div class="flex items-center gap-2">'
                            + '<span class="inline-block w-2 h-2 rounded-full" style="background:' + dot + ';"></span>'
                            + '<span class="text-sm font-medium text-gray-800">' + label + '</span>'
                            + platform
                            + '</div>'
                            + '<div class="text-xs text-gray-500">' + time + '</div>'
                            + '</div>';
                    }).join('');
                }
            }
        }

        if (modal) {
            modal.classList.remove('hidden');
        }
        console.log('✅ Analytics modal displayed');
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        alert('Failed to load analytics: ' + error.message);
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function generateAnalyticsContent(listing, analytics) {
    const summary = analytics?.summary;
    const buckets = [
        { key: '7d', label: 'Last 7 Days' },
        { key: '14d', label: 'Last 14 Days' },
        { key: '1m', label: 'Last 1 Month' },
        { key: '3m', label: 'Last 3 Months' },
        { key: '6m', label: 'Last 6 Months' },
        { key: '1y', label: 'Last 1 Year' },
        { key: '2y', label: 'Last 2 Years' },
        { key: 'all', label: 'All Time' }
    ];

    if (!summary) {
        return `
            <div class="p-8 text-center bg-gray-50 rounded-lg">
                <div class="text-gray-400 text-4xl mb-2">📊</div>
                <div class="text-gray-600">No analytics summary available yet</div>
            </div>
        `;
    }

    const bucketOptions = buckets
        .map((bucket) => `<option value="${bucket.key}" ${bucket.key === 'all' ? 'selected' : ''}>${bucket.label}</option>`)
        .join('');

    return `
        <div class="mb-4 flex items-center gap-3">
            <label for="analyticsTimeBucket" class="text-sm font-medium text-gray-700">Time Range</label>
            <select id="analyticsTimeBucket" class="border border-gray-300 rounded-lg px-3 py-2 text-sm">
                ${bucketOptions}
            </select>
        </div>
        <div id="analyticsSummaryGrid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-4"></div>
        <div class="mt-6 bg-white border border-gray-200 rounded-lg p-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h3>
            <div id="analyticsRecentActivity"></div>
        </div>
    `;
}


// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.closeAnalyticsModal = function() {
    const modal = document.getElementById('analyticsModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 5
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 5
// Edit Listing & Form Management - Part 1
// ============================================

window.editListing = async function(id) {
    try {
        const listings = await adminProxy('listings:list');
        const listing = Array.isArray(listings)
            ? listings.find((row) => String(row.id) === String(id))
            : null;
        if (!listing) throw new Error('Listing not found');
        
        editingListing = listing;
        selectedSubcategories = listing.subcategories || [];
        primarySubcategory = listing.primary_subcategory || null;
        
        document.getElementById('modalTitle').textContent = 'Edit Listing';
        fillEditForm(listing);
        document.getElementById('editModal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading listing:', error);
        alert('Failed to load listing');
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.newListing = async function() {
    try {
        const nextId = (window.crypto && typeof window.crypto.randomUUID === 'function')
            ? window.crypto.randomUUID()
            : `listing-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

        editingListing = {
            id: nextId,
            business_name: '',
            tagline: '',
            description: '',
            category: CATEGORIES[0],
            subcategories: [],
            tier: 'FREE',
            visible: true,
            is_chain: false,
            is_claimed: false
        };
        
        selectedSubcategories = [];
        primarySubcategory = null;
        
        document.getElementById('modalTitle').textContent = 'New Listing';
        fillEditForm(editingListing);
        document.getElementById('editModal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error creating new listing:', error);
        alert('Failed to create new listing');
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function fillEditForm(listing) {
    const owner = listing?.owner && listing.owner.length > 0 ? listing.owner[0] : null;
    
    const formContent = document.getElementById('editFormContent');
    formContent.innerHTML = `
        <div class="space-y-6">
            <!-- Basic Info -->
            <div>
                <h3 class="text-lg font-bold mb-4">Basic Information</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium mb-2">Business Name *</label>
                        <input type="text" id="editBusinessName" value="${listing?.business_name || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium mb-2">Slug</label>
                        <div class="flex gap-2">
                            <input type="text" id="editSlug" value="${listing?.slug || ''}" class="flex-1 px-4 py-2 border rounded-lg" placeholder="auto-generated">
                            <button type="button" onclick="checkSlugAvailability()" class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Check</button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1" id="slugStatus"></p>
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium mb-2">Custom Shortlink</label>
                        <input type="text" id="editCustomShortlink" value="" class="w-full px-4 py-2 border rounded-lg" placeholder="/your-custom-path">
                        <p class="text-xs mt-1" id="editCustomShortlinkStatus"></p>
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium mb-2">Tagline *</label>
                        <input type="text" id="editTagline" value="${listing?.tagline || ''}" class="w-full px-4 py-2 border rounded-lg" oninput="updateCharCounters()">
                        <p class="text-xs text-gray-500 mt-1"><span id="taglineCount">${(listing?.tagline || '').length}</span> characters</p>
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium mb-2">Description *</label>
                        <textarea id="editDescription" rows="5" class="w-full px-4 py-2 border rounded-lg">${listing?.description || ''}</textarea>
                        <p class="text-xs text-gray-500 mt-1"><span id="descCount">${(window.RichTextEditor ? window.RichTextEditor.stripHtml(listing?.description || '') : (listing?.description || '').length)}</span> characters</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Category *</label>
                        <select id="editCategory" class="w-full px-4 py-2 border rounded-lg" onchange="handleCategoryChange()">
                            ${CATEGORIES.map(cat => `<option value="${cat}" ${listing?.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Pricing</label>
                        <select id="editPricing" class="w-full px-4 py-2 border rounded-lg">
                            <option value="">Select pricing</option>
                            <option value="1" ${Number(listing?.pricing) === 1 ? 'selected' : ''}>$</option>
                            <option value="2" ${Number(listing?.pricing) === 2 ? 'selected' : ''}>$$</option>
                            <option value="3" ${Number(listing?.pricing) === 3 ? 'selected' : ''}>$$$</option>
                            <option value="4" ${Number(listing?.pricing) === 4 ? 'selected' : ''}>$$$$</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Coming Soon *</label>
                        <select id="editComingSoon" class="w-full px-4 py-2 border rounded-lg" required>
                            <option value="false" ${(listing?.coming_soon ?? false) ? '' : 'selected'}>No</option>
                            <option value="true" ${(listing?.coming_soon ?? false) ? 'selected' : ''}>Yes</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Tier</label>
                        <select id="editTier" class="w-full px-4 py-2 border rounded-lg">
                            <option value="FREE" ${listing?.tier === 'FREE' ? 'selected' : ''}>FREE</option>
                            <option value="FEATURED" ${listing?.tier === 'FEATURED' ? 'selected' : ''}>FEATURED</option>
                            <option value="PREMIUM" ${listing?.tier === 'PREMIUM' ? 'selected' : ''}>PREMIUM</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Subcategories -->
            <div id="subcategoriesContainer">
                <div class="flex items-center justify-between mb-2">
                    <label class="block text-sm font-medium">Subcategories *</label>
                    <span class="text-xs text-gray-500">Select at least one</span>
                </div>
                <div id="subcategoryCheckboxes" class="grid grid-cols-2 gap-2"></div>
            </div>

            <!-- Chain Info -->
            <div>
                <label class="flex items-center gap-2 mb-4">
                    <input type="checkbox" id="editIsChain" ${listing?.is_chain ? 'checked' : ''} onchange="toggleChainFields()">
                    <span class="text-sm font-medium">This is a chain business</span>
                </label>
                <div id="chainFieldsContainer" class="${listing?.is_chain ? '' : 'hidden'} grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Chain Name</label>
                        <input type="text" id="editChainName" value="${listing?.chain_name || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Chain ID</label>
                        <input type="text" id="editChainId" value="${listing?.chain_id || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Auto-generated if empty">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium mb-2">More Listings Title</label>
                        <input type="text" id="editMoreListingsTitleCustom" value="${escapeHtml(listing?.more_listings_title_custom || '')}" class="w-full px-4 py-2 border rounded-lg" placeholder="More Locations">
                    </div>
                </div>
            </div>

            <!-- Parent / Child Listing -->
            <div>
                <label class="flex items-center gap-2 mb-4">
                    <input type="checkbox" id="editHasParentListing" ${listing?.parent_listing ? 'checked' : ''} onchange="toggleParentListingFields()">
                    <span class="text-sm font-medium">This listing has a parent listing</span>
                </label>
                <div id="parentListingFieldsContainer" class="${listing?.parent_listing ? '' : 'hidden'} grid grid-cols-1 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Parent Listing UUID</label>
                        <div class="flex gap-2">
                            <input type="text" id="editParentListing"
                                   value="${escapeHtml(listing?.parent_listing || '')}"
                                   class="flex-1 px-4 py-2 border rounded-lg font-mono text-sm"
                                   placeholder="Search by name or paste UUID…"
                                   oninput="handleParentListingInput(this.value)"
                                   autocomplete="off">
                            <button type="button" onclick="checkParentListingUUID()" class="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium whitespace-nowrap">Check</button>
                        </div>
                        <p class="text-xs mt-1" id="parentListingStatus"></p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Parent Listing Section Custom Title</label>
                        <input type="text" id="editParentListingTitleCustom"
                               value="${escapeHtml(listing?.parent_listing_title_custom || '')}"
                               class="w-full px-4 py-2 border rounded-lg"
                               placeholder="Parent Listing">
                        <p class="text-xs text-gray-500 mt-1">Default: "Parent Listing"</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Child Listings Section Custom Title</label>
                        <input type="text" id="editChildListingsTitleCustom"
                               value="${escapeHtml(listing?.child_listings_custom_title || '')}"
                               class="w-full px-4 py-2 border rounded-lg"
                               placeholder="Child Listings">
                        <p class="text-xs text-gray-500 mt-1">Default: "Child Listings"</p>
                    </div>
                </div>
            </div>
            <!-- Location -->
            <div>
                <h3 class="text-lg font-bold mb-4">Location</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium mb-2">Address</label>
                        <input type="text" id="editAddress" value="${listing?.address || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">City</label>
                        <input type="text" id="editCity" value="${listing?.city || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">State</label>
                        <select id="editState" class="w-full px-4 py-2 border rounded-lg">
                            <option value="">Select State</option>
                            ${Object.entries(US_STATES).map(([code, name]) => 
                                `<option value="${code}" ${listing?.state === code ? 'selected' : ''}>${name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Zip Code</label>
                        <input type="text" id="editZipCode" value="${listing?.zip_code || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Country</label>
                        <select id="editCountry" class="w-full px-4 py-2 border rounded-lg">
                            <option value="USA" ${listing?.country === 'USA' ? 'selected' : ''}>USA</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Timezone *</label>
                        <input type="text" id="editTimezone" value="${listing?.timezone || 'America/Chicago'}" class="w-full px-4 py-2 border rounded-lg" placeholder="America/Chicago" required>
                        <p class="text-xs text-gray-500 mt-1">Use an IANA timezone (example: America/Chicago).</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2" for="editCoordinates">Coordinates</label>
                        <textarea id="editCoordinates" rows="4" class="w-full px-4 py-2 border rounded-lg font-mono text-sm" placeholder='{&quot;lat&quot;:43.83850,&quot;lng&quot;:-87.92659101}'>${escapeHtml(coordinatesToRawText(listing?.coordinates))}</textarea>
                        <p class="text-xs text-gray-500 mt-1">Raw Supabase jsonb value. Saved exactly as entered; invalid JSON is left for Supabase to reject.</p>
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium mb-2" for="editGooglePlaceId">Google Place ID</label>
                        <input type="text" id="editGooglePlaceId" value="${escapeHtml(listing?.google_place_id || '').replace(/"/g, '&quot;')}" class="w-full px-4 py-2 border rounded-lg" placeholder="e.g. ChIJ...">
                        <p class="text-xs text-gray-500 mt-1">Optional. The Google Maps Place ID for this location.</p>
                    </div>
                </div>
            </div>

            <!-- Contact -->
            <div>
                <h3 class="text-lg font-bold mb-4">Contact Information</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Phone</label>
                        <div id="editPhoneContainer"></div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Email</label>
                        <input type="email" id="editEmail" value="${listing?.email || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-sm font-medium mb-2">Website</label>
                        <input type="url" id="editWebsite" value="${listing?.website || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                </div>
            </div>
    `;
    
    const phoneContainer = document.getElementById('editPhoneContainer');
    if (phoneContainer) {
        phoneContainer.innerHTML = createPhoneInput(listing?.phone || '', userCountry);
    }
    
    fillEditFormContinuation(listing, owner);
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 6
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 6
// Edit Form Continuation (Hours, Social, Reviews, Owner, Media)
// ============================================

function fillEditFormContinuation(listing, owner) {
    const formContent = document.getElementById('editFormContent');
    formContent.innerHTML += `
            <!-- Hours -->
            <div>
                <h3 class="text-lg font-bold mb-4">Hours of Operation</h3>
                <div class="grid grid-cols-1 gap-3">
                    ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                        const dayLower = day.toLowerCase();
                        const hours = listing?.hours && listing.hours[dayLower] ? listing.hours[dayLower] : '';
                        const isClosed = hours.toLowerCase() === 'closed';
                        const is24Hours = hours.toLowerCase().includes('24') || hours.toLowerCase().includes('open 24');
                        
                        return `
                        <div class="flex gap-2 items-center">
                            <label class="w-28 flex items-center font-medium text-gray-700">${day}:</label>
                            <input type="text" id="editHours${day}" value="${hours}" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg" placeholder="9:00 AM - 5:00 PM or 7:00 PM - 3:00 AM" ${isClosed || is24Hours ? 'disabled' : ''}>
                            <label class="flex items-center gap-1">
                                <input type="checkbox" id="editClosed${day}" ${isClosed ? 'checked' : ''} onchange="toggleDayClosed('${day}')">
                                <span class="text-sm">Closed</span>
                            </label>
                            <label class="flex items-center gap-1">
                                <input type="checkbox" id="edit24Hours${day}" ${is24Hours ? 'checked' : ''} onchange="toggle24Hours('${day}')">
                                <span class="text-sm">24 Hours</span>
                            </label>
                        </div>
                    `}).join('')}
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Hours Label</label>
                        <input type="text" id="editHoursLabelCustom" value="${listing?.hours_label_custom || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Hours">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Hours Disclaimer</label>
                        <input type="text" id="editHoursDisclaimerCustom" value="${listing?.hours_disclaimer_custom || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Hours may vary — call to confirm.">
                    </div>
                </div>
            </div>

            <!-- Social Media -->
            <div>
                <h3 class="text-lg font-bold mb-4">Social Media Links</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Facebook</label>
                        <input type="text" id="editFacebook" value="${listing?.social_media?.facebook || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="username">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Instagram</label>
                        <input type="text" id="editInstagram" value="${listing?.social_media?.instagram || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="username">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Twitter/X</label>
                        <input type="text" id="editTwitter" value="${listing?.social_media?.twitter || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="username">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">YouTube</label>
                        <input type="text" id="editYoutube" value="${listing?.social_media?.youtube || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="channel">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">TikTok</label>
                        <input type="text" id="editTiktok" value="${listing?.social_media?.tiktok || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="username">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">LinkedIn</label>
                        <input type="url" id="editLinkedin" value="${listing?.social_media?.linkedin || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Full URL">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Social 1 Name</label>
                        <input type="text" id="editOtherSocial1Name" value="${listing?.social_media?.other1_name || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="e.g. Threads">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Social 1 URL</label>
                        <input type="url" id="editOtherSocial1" value="${listing?.social_media?.other1 || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Full URL">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Social 2 Name</label>
                        <input type="text" id="editOtherSocial2Name" value="${listing?.social_media?.other2_name || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="e.g. Discord">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Social 2 URL</label>
                        <input type="url" id="editOtherSocial2" value="${listing?.social_media?.other2 || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Full URL">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Social 3 Name</label>
                        <input type="text" id="editOtherSocial3Name" value="${listing?.social_media?.other3_name || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="e.g. Pinterest">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Social 3 URL</label>
                        <input type="url" id="editOtherSocial3" value="${listing?.social_media?.other3 || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Full URL">
                    </div>
                </div>
            </div>

            <!-- Reviews -->
            <div>
                <h3 class="text-lg font-bold mb-4">Review Sites</h3>
                <div class="grid grid-cols-1 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Google Reviews</label>
                        <input type="url" id="editGoogleReviews" value="${listing?.reviews?.google || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Full Google Reviews URL">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Yelp</label>
                        <input type="url" id="editYelp" value="${listing?.reviews?.yelp || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Full Yelp URL">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">TripAdvisor</label>
                        <input type="url" id="editTripadvisor" value="${listing?.reviews?.tripadvisor || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Full TripAdvisor URL">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Review 1 Name</label>
                        <input type="text" id="editOtherReview1Name" value="${listing?.reviews?.other1_name || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="e.g. BBB">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Review 1 URL</label>
                        <input type="url" id="editOtherReview1" value="${listing?.reviews?.other1 || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Full URL">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Review 2 Name</label>
                        <input type="text" id="editOtherReview2Name" value="${listing?.reviews?.other2_name || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="e.g. Angi">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Review 2 URL</label>
                        <input type="url" id="editOtherReview2" value="${listing?.reviews?.other2 || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Full URL">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Review 3 Name</label>
                        <input type="text" id="editOtherReview3Name" value="${listing?.reviews?.other3_name || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="e.g. OpenTable">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Other Review 3 URL</label>
                        <input type="url" id="editOtherReview3" value="${listing?.reviews?.other3 || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="Full URL">
                    </div>
                </div>
            </div>

            <!-- Additional Information -->
            <div>
                <h3 class="text-lg font-bold mb-4">Additional Information</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${[0, 1, 2, 3, 4].map(index => {
                        const info = listing?.additional_info?.[index] || {};
                        return `
                        <div>
                            <label class="block text-sm font-medium mb-2">Info Name ${index + 1}</label>
                            <input type="text" id="editInfoName${index}" value="${info.label || ''}" class="w-full px-4 py-2 border rounded-lg" maxlength="30">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-2">Info Value ${index + 1}</label>
                            <input type="text" id="editInfoValue${index}" value="${info.value || ''}" class="w-full px-4 py-2 border rounded-lg" maxlength="120">
                        </div>
                        `;
                    }).join('')}
                </div>
                <div class="mt-4">
                    <label class="block text-sm font-medium mb-2">Additional Schema.org Properties</label>
                    <textarea id="editCustomSchemaProperties" rows="4" class="w-full px-4 py-2 border rounded-lg font-mono text-sm" placeholder='"paymentAccepted": "Cash, Credit Card",&#10;"hasMenu": "https://example.com/menu"'>${listing?.custom_schema_properties || ''}</textarea>
                </div>
            </div>

            <!-- Custom CTA Buttons -->
            <div>
                <h3 class="text-lg font-bold mb-4">Custom CTA Buttons</h3>
                <p class="text-sm text-gray-600 mb-4">Featured listings get 1 custom CTA. Premium listings get 2. Name max 15 characters.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${[0].map(index => {
                        const cta = listing?.custom_ctas?.[index] || {};
                        return `
                        <div class="md:col-span-2 border border-gray-200 rounded-lg p-4 space-y-3">
                            <div>
                                <label class="block text-sm font-medium mb-2">CTA ${index + 1} Name</label>
                                <input type="text" id="editCtaName${index}" value="${cta.name || ''}" class="w-full px-4 py-2 border rounded-lg">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-2">CTA ${index + 1} Link</label>
                                <input type="url" id="editCtaUrl${index}" value="${cta.url || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="https://">
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium mb-2">Button Color</label>
                                    <input type="color" id="editCtaColor${index}" value="${cta.color || '#045093'}" class="w-full h-10 border rounded-lg">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium mb-2">Icon</label>
                                    <select id="editCtaIcon${index}" class="w-full px-4 py-2 border rounded-lg">
                                        ${getCustomCtaIconOptions(cta.icon || '')}
                                    </select>
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Owner Info -->
            <div>
                <h3 class="text-lg font-bold mb-4">Leadership</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div class="md:col-span-2">
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="editIsClaimed" ${listing?.is_claimed ? 'checked' : ''} onchange="toggleClaimedFields()">
                            <span class="text-sm font-medium">This listing is claimed</span>
                        </label>
                        <p class="text-xs text-gray-500 mt-1">When checked, confirmation key will be cleared</p>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-2">Owner Name</label>
                        <input type="text" id="editOwnerName" value="${owner?.full_name || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Title</label>
                        <input type="text" id="editOwnerTitle" value="${owner?.title || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Where in Greece are you from?</label>
                        <input type="text" id="editOwnerGreece" value="${owner?.from_greece || ''}" class="w-full px-4 py-2 border rounded-lg" placeholder="e.g. Athens">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Owner Email</label>
                        <input type="email" id="editOwnerEmail" value="${owner?.owner_email || ''}" class="w-full px-4 py-2 border rounded-lg">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-2">Owner Phone</label>
                        <div id="editOwnerPhoneContainer"></div>
                    </div>
                    <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <label class="flex items-center gap-2"><input type="checkbox" id="editOwnerNameTitleVisible" ${owner?.name_title_visible !== false ? 'checked' : ''}> <span class="text-sm">Show Name + Title</span></label>
                        <label class="flex items-center gap-2"><input type="checkbox" id="editOwnerEmailVisible" ${owner?.email_visible !== false ? 'checked' : ''}> <span class="text-sm">Show Owner Email</span></label>
                        <label class="flex items-center gap-2"><input type="checkbox" id="editOwnerPhoneVisible" ${owner?.phone_visible ? 'checked' : ''}> <span class="text-sm">Show Owner Phone</span></label>
                    </div>
                    <div id="confirmationKeyField">
                        <label class="block text-sm font-medium mb-2">Confirmation Key</label>
                        <input type="text" id="editConfirmationKey" value="${owner?.confirmation_key || ''}" class="w-full px-4 py-2 border rounded-lg" ${listing?.is_claimed ? 'disabled title="Listing is claimed"' : ''} placeholder="${listing?.is_claimed ? 'Listing is claimed' : 'Auto-generated if empty'}">
                    </div>
                </div>
            </div>

            <!-- Media -->
            <div>
                <h3 class="text-lg font-bold mb-4">Media</h3>
                <div class="grid grid-cols-1 gap-4">

                    <!-- Logo -->
                    <div class="border border-gray-200 rounded-lg p-4 space-y-2">
                        <label class="block text-sm font-semibold text-gray-800">Logo</label>
                        <label for="editLogoUpload"
                               class="flex flex-col items-center justify-center gap-1 w-full border-2 border-dashed border-gray-300 rounded-lg py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                            <svg class="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            <span class="text-sm font-medium text-gray-600">Click to upload logo</span>
                            <span class="text-xs text-gray-400">PNG, JPG, WebP — square recommended</span>
                            <input type="file" id="editLogoUpload" accept="image/*" class="hidden">
                        </label>
                        <input type="url" id="editLogo" value="${listing?.logo || ''}"
                               class="w-full px-4 py-2 border rounded-lg text-sm"
                               placeholder="Or paste a logo URL">
                    </div>

                    <!-- Photos -->
                    <div class="border border-gray-200 rounded-lg p-4 space-y-2">
                        <label class="block text-sm font-semibold text-gray-800">Photos</label>
                        <label for="editPhotosUpload"
                               class="flex flex-col items-center justify-center gap-1 w-full border-2 border-dashed border-gray-300 rounded-lg py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                            <svg class="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            <span class="text-sm font-medium text-gray-600">Click to upload photos</span>
                            <span class="text-xs text-gray-400">Select one or more images</span>
                            <input type="file" id="editPhotosUpload" accept="image/*" multiple class="hidden">
                        </label>
                        <textarea id="editPhotos" rows="4"
                                  class="w-full px-4 py-2 border rounded-lg text-sm font-mono"
                                  placeholder="Uploaded URLs appear here automatically (one per line)">${listing?.photos ? listing.photos.join('\n') : ''}</textarea>
                        <p class="text-xs text-gray-400">You can also paste external URLs directly — one per line.</p>
                    </div>

                    <!-- Video -->
                    <div class="border border-gray-200 rounded-lg p-4 space-y-2">
                        <label class="block text-sm font-semibold text-gray-800">Video</label>
                        <label for="editVideoUpload"
                               class="flex flex-col items-center justify-center gap-1 w-full border-2 border-dashed border-gray-300 rounded-lg py-5 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                            <svg class="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                            </svg>
                            <span class="text-sm font-medium text-gray-600">Click to upload video</span>
                            <span class="text-xs text-gray-400">MP4 recommended</span>
                            <input type="file" id="editVideoUpload" accept="video/*" class="hidden">
                        </label>
                        <input type="url" id="editVideo" value="${listing?.video || ''}"
                               class="w-full px-4 py-2 border rounded-lg text-sm"
                               placeholder="Or paste a video URL">
                    </div>

                    <!-- Upload status -->
                    <div id="mediaUploadStatus" class="text-sm text-gray-600"></div>

                </div>
            </div>
            </div>
        </div>
    `;
    
    const ownerPhoneContainer = document.getElementById('editOwnerPhoneContainer');
    if (ownerPhoneContainer) {
        ownerPhoneContainer.innerHTML = createPhoneInput(owner?.owner_phone || '', userCountry);
    }
    initializeCustomShortlinkField(listing);
    
    updateSubcategoriesForCategory();
    if (window.RichTextEditor) {
        adminDescriptionEditor = window.RichTextEditor.mount({ inputId: 'editDescription', onChange: () => updateCharCounters() });
    }
    updateCharCounters();
    attachMediaUploadHandlers();
}

async function initializeCustomShortlinkField(listing) {
    const input = document.getElementById('editCustomShortlink');
    const status = document.getElementById('editCustomShortlinkStatus');
    if (!input || !status) return;
    status.textContent = '';
    try {
        if (listing?.id) {
            const rows = await adminProxy('shortlinks:get', { listing_id: listing.id });
            const custom = (Array.isArray(rows) ? rows : []).find((row) => row.listing_custom === true && isValidCustomShortlink(row.path));
            input.value = custom?.path || '';
        }
    } catch (error) {
        console.warn('Failed to load custom shortlink:', error);
        status.textContent = '⚠️ Could not load existing custom shortlink.';
        status.className = 'text-xs mt-1 text-yellow-700';
    }
    input.addEventListener('input', () => {
        const path = input.value.trim();
        status.textContent = '';
        if (customShortlinkCheckTimer) clearTimeout(customShortlinkCheckTimer);
        customShortlinkCheckTimer = setTimeout(async () => {
            if (!path) return;
            if (!isValidCustomShortlink(path)) {
                status.textContent = '❌ Invalid format.';
                status.className = 'text-xs mt-1 text-red-600';
                return;
            }
            try {
                const exists = await adminProxy('shortlinks:check', { path });
                status.textContent = exists ? '❌ Taken' : '✅ Available';
                status.className = `text-xs mt-1 ${exists ? 'text-red-600' : 'text-green-600'}`;
            } catch (err) {
                status.textContent = '⚠️ Could not verify uniqueness right now.';
                status.className = 'text-xs mt-1 text-yellow-700';
            }
        }, 300);
    });
}

const UPLOAD_PROXY = 'https://tgd-images-upload.thegreekdirectory.org';

/**
 * Upload a file to Cloudflare Images using the Direct Creator Upload flow.
 * Mirrors the exact same approach used in business-dashboard.js.
 *
 * @param {File}   file      - The File object to upload
 * @param {string} assetType - 'logo' | 'photo' | 'video'
 * @returns {Promise<string>} - Resolves to the canonical image URL string
 */
async function uploadToCloudflareImages(file, assetType = 'photo') {
    const listingId = editingListing?.id || '';

    let urlRes, urlData;
    try {
        urlRes = await fetch(`${UPLOAD_PROXY}?action=request-upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assetType, listingId }),
        });
        urlData = await urlRes.json();
    } catch (netErr) {
        throw new Error(`Could not reach upload server: ${netErr.message}`);
    }

    if (!urlRes.ok || !urlData.success) {
        throw new Error(urlData?.error || `Upload server error (HTTP ${urlRes.status})`);
    }

    const uploadForm = new FormData();
    uploadForm.append('file', file);

    const uploadRes = await fetch(urlData.uploadURL, { method: 'POST', body: uploadForm });
    if (!uploadRes.ok) {
        let msg = `Cloudflare upload failed (HTTP ${uploadRes.status})`;
        try {
            const errData = await uploadRes.json();
            if (errData?.errors?.[0]?.message) msg = errData.errors[0].message;
        } catch (_) { }
        throw new Error(msg);
    }

    if (!urlData.imageUrl) throw new Error('Upload succeeded but no image URL was returned.');
    return urlData.imageUrl;
}

window.uploadToCloudflareImages = uploadToCloudflareImages;

function setMediaUploadStatus(message, isError = false) {
    const statusEl = document.getElementById('mediaUploadStatus');
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.className = `text-sm ${isError ? 'text-red-600' : 'text-gray-600'}`;
}

async function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        setMediaUploadStatus('Uploading logo…');
        const url = await uploadToCloudflareImages(file, 'logo');
        const logoInput = document.getElementById('editLogo');
        if (logoInput) logoInput.value = url;
        setMediaUploadStatus('✅ Logo uploaded successfully.');
    } catch (error) {
        console.error('Logo upload failed:', error);
        setMediaUploadStatus(`❌ Logo upload failed: ${error.message}`, true);
    }
}

async function handlePhotosUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    const photoInput = document.getElementById('editPhotos');
    if (!photoInput) return;
    try {
        setMediaUploadStatus(`Uploading ${files.length} photo${files.length > 1 ? 's' : ''}…`);
        for (const file of files) {
            const url = await uploadToCloudflareImages(file, 'photo');
            photoInput.value = `${photoInput.value.trim() ? `${photoInput.value.trim()}
` : ''}${url}`;
        }
        setMediaUploadStatus(`✅ ${files.length} photo${files.length > 1 ? 's' : ''} uploaded successfully.`);
    } catch (error) {
        console.error('Photo upload failed:', error);
        setMediaUploadStatus(`❌ Photo upload failed: ${error.message}`, true);
    }
}

async function handleVideoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        setMediaUploadStatus('Uploading video…');
        const url = await uploadToCloudflareImages(file, 'video');
        const videoInput = document.getElementById('editVideo');
        if (videoInput) videoInput.value = url;
        setMediaUploadStatus('✅ Video uploaded successfully.');
    } catch (error) {
        console.error('Video upload failed:', error);
        setMediaUploadStatus(`❌ Video upload failed: ${error.message}`, true);
    }
}

function attachMediaUploadHandlers() {
    const logoUpload = document.getElementById('editLogoUpload');
    if (logoUpload) logoUpload.onchange = handleLogoUpload;
    
    const photosUpload = document.getElementById('editPhotosUpload');
    if (photosUpload) photosUpload.onchange = handlePhotosUpload;
    
    const videoUpload = document.getElementById('editVideoUpload');
    if (videoUpload) videoUpload.onchange = handleVideoUpload;
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.checkSlugAvailability = async function() {
    const slug = document.getElementById('editSlug').value.trim();
    const statusEl = document.getElementById('slugStatus');
    
    if (!slug) {
        statusEl.textContent = 'Enter a slug to check';
        statusEl.className = 'text-xs text-gray-500 mt-1';
        return;
    }
    
    try {
        const listings = await adminProxy('listings:list');
        const data = Array.isArray(listings)
            ? listings.find((row) => row.slug === slug) || null
            : null;
        
        if (data && data.id !== editingListing?.id) {
            statusEl.textContent = '❌ Slug already in use';
            statusEl.className = 'text-xs text-red-600 mt-1';
        } else {
            statusEl.textContent = '✅ Slug available';
            statusEl.className = 'text-xs text-green-600 mt-1';
        }
    } catch (error) {
        statusEl.textContent = 'Error checking slug';
        statusEl.className = 'text-xs text-red-600 mt-1';
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function updateCharCounters() {
    const tagline = document.getElementById('editTagline')?.value || '';
    const descRaw = document.getElementById('editDescription')?.value || '';
    const desc = window.RichTextEditor ? window.RichTextEditor.stripHtml(descRaw) : descRaw;
    
    const taglineCount = document.getElementById('taglineCount');
    const descCount = document.getElementById('descCount');
    
    if (taglineCount) taglineCount.textContent = tagline.length;
    if (descCount) descCount.textContent = desc.length;
}

window.handleCategoryChange = function() {
    // Clear previously selected subcategories so they don't carry over to the new category
    selectedSubcategories = [];
    primarySubcategory = null;
    
    // Trigger the re-render
    updateSubcategoriesForCategory();
};

window.updateSubcategoriesForCategory = function() {
    const category = document.getElementById('editCategory')?.value;
    const container = document.getElementById('subcategoriesContainer');
    const checkboxDiv = document.getElementById('subcategoryCheckboxes');
    
    // Safety check: If the modal element isn't active on screen, exit quietly
    if (!container || !checkboxDiv) {
        return;
    }

    if (!category || !SUBCATEGORIES[category] || SUBCATEGORIES[category].length === 0) {
        container.classList.add('hidden');
        return;
    }
    
    container.classList.remove('hidden');
    checkboxDiv.innerHTML = '';
    
    SUBCATEGORIES[category].forEach(sub => {
        const isSelected = selectedSubcategories.includes(sub);
        const isPrimary = sub === primarySubcategory;
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 p-2 border rounded';
        
        // RESTORED: Uses the proper radio buttons with working state controls
        div.innerHTML = `
            <input type="checkbox" id="subcat-${sub.replace(/\s+/g, '-')}" value="${sub}" ${isSelected ? 'checked' : ''} onchange="window.toggleSubcategory('${sub.replace(/'/g, "\\'")}')" class="rounded text-blue-600 focus:ring-blue-500">
            <label for="subcat-${sub.replace(/\s+/g, '-')}" class="text-sm select-none flex-1 text-gray-700">${sub}</label>
            <input type="radio" name="primarySub" ${isPrimary ? 'checked' : ''} ${!isSelected ? 'disabled' : ''} onchange="window.setPrimarySubcategory('${sub.replace(/'/g, "\\'")}')" class="text-blue-600 focus:ring-blue-500" title="Primary">
        `;
        checkboxDiv.appendChild(div);
    });
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.toggleSubcategory = function(subcategory) {
    const index = selectedSubcategories.indexOf(subcategory);
    
    if (index > -1) {
        selectedSubcategories.splice(index, 1);
        if (primarySubcategory === subcategory) {
            primarySubcategory = selectedSubcategories.length > 0 ? selectedSubcategories[0] : null;
        }
    } else {
        selectedSubcategories.push(subcategory);
        if (!primarySubcategory) {
            primarySubcategory = subcategory;
        }
    }
    
    updateSubcategoriesForCategory();
};

window.setPrimarySubcategory = function(subcategory) {
    primarySubcategory = subcategory;
    updateSubcategoriesForCategory();
};

window.toggleChainFields = function() {
    const isChain = document.getElementById('editIsChain')?.checked;
    const container = document.getElementById('chainFieldsContainer');
    
    if (isChain) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
};

// ─── Parent Listing toggle + UUID check + live search ────────────────────────
window.toggleParentListingFields = function() {
    const hasParent = document.getElementById('editHasParentListing')?.checked;
    const container = document.getElementById('parentListingFieldsContainer');
    if (!container) return;
    if (hasParent) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        // Clear the UUID, dropdown, and status when unchecking
        const input = document.getElementById('editParentListing');
        if (input) input.value = '';
        _closeParentListingDropdown();
        const status = document.getElementById('parentListingStatus');
        if (status) { status.textContent = ''; status.className = 'text-xs mt-1'; }
    }
};

// ── Internal helpers ──────────────────────────────────────────────────────────
let _parentSearchTimer = null;

function _setParentStatus(text, type) {
    const el = document.getElementById('parentListingStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'text-xs mt-1 ' + (
        type === 'ok'      ? 'text-green-600' :
        type === 'error'   ? 'text-red-600'   :
        type === 'loading' ? 'text-gray-500'  : 'text-gray-500'
    );
}

function _closeParentListingDropdown() {
    const el = document.getElementById('parentListingDropdown');
    if (el) el.style.display = 'none';
}

function _selectParentListing(uuid, name, city, state) {
    const input = document.getElementById('editParentListing');
    if (input) input.value = uuid;
    _closeParentListingDropdown();
    const loc = [city, state].filter(Boolean).join(', ');
    _setParentStatus('✅ ' + name + (loc ? ' · ' + loc : ''), 'ok');
}

window._selectParentListingRow = function(uuid, name, city, state) {
    _selectParentListing(uuid, name, city, state);
};

// ── Live search on the UUID input ────────────────────────────────────────────
// The input's wrapper <div style="position:relative"> must contain the dropdown
// div injected below. We inject it lazily on first keystroke so we don't have
// to touch the HTML template.
function _ensureParentDropdown() {
    if (document.getElementById('parentListingDropdown')) return;
    const input = document.getElementById('editParentListing');
    if (!input) return;
    const wrap = input.closest('div') || input.parentElement;
    const dd = document.createElement('div');
    dd.id = 'parentListingDropdown';
    dd.style.cssText = 'position:absolute;top:100%;left:0;right:0;z-index:50;background:#fff;border:1px solid #d1d5db;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);max-height:220px;overflow-y:auto;display:none;';
    // Make the wrapper position:relative so the dropdown anchors correctly
    if (wrap && getComputedStyle(wrap).position === 'static') {
        wrap.style.position = 'relative';
    }
    if (wrap) wrap.appendChild(dd);
}

window.handleParentListingInput = async function(value) {
    const statusEl = document.getElementById('parentListingStatus');
    _ensureParentDropdown();
    const dd = document.getElementById('parentListingDropdown');

    const trimmed = value.trim();
    _setParentStatus('', '');
    if (dd) dd.style.display = 'none';

    if (!trimmed) return;

    if (_parentSearchTimer) clearTimeout(_parentSearchTimer);

    _parentSearchTimer = setTimeout(async () => {
        _setParentStatus('Searching…', 'loading');

        let listings;
        try {
            listings = await adminProxy('listings:list');
            if (!Array.isArray(listings)) listings = [];
        } catch (_) {
            listings = [];
        }

        const currentId = String(editingListing?.id || '');
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isUuid = uuidRe.test(trimmed);

        if (isUuid) {
            // Exact UUID typed — validate inline without dropdown
            if (trimmed === currentId) {
                _setParentStatus('❌ A listing cannot be its own parent.', 'error');
                return;
            }
            const match = listings.find(l => String(l.id) === trimmed);
            if (match) {
                _setParentStatus(
                    `✅ ${match.business_name}${match.city ? ' · ' + match.city : ''}${match.state ? ', ' + match.state : ''}`,
                    'ok'
                );
            } else {
                _setParentStatus('❌ No listing found with that UUID.', 'error');
            }
            return;
        }

        // Name / partial search — show dropdown, fill input with UUID on select
        const term = trimmed.toLowerCase();
        const matches = listings
            .filter(l => String(l.id) !== currentId &&
                         (l.business_name.toLowerCase().includes(term) ||
                          String(l.id).toLowerCase().includes(term)))
            .slice(0, 6);

        if (!dd) return;

        if (matches.length === 0) {
            dd.innerHTML = '<div style="padding:10px 12px;color:#6b7280;font-size:.85rem;">No listings found.</div>';
            dd.style.display = 'block';
            _setParentStatus('', '');
            return;
        }

        dd.innerHTML = matches.map(l => {
            const safeId   = escapeHtml(String(l.id));
            const safeName = escapeHtml(l.business_name);
            const safeCity = escapeHtml(l.city  || '');
            const safeSt   = escapeHtml(l.state || '');
            const loc      = [l.city, l.state].filter(Boolean).join(', ');
            return `
                <div onclick="window._selectParentListingRow('${safeId}','${safeName.replace(/'/g,"\\'")}','${safeCity.replace(/'/g,"\\'")}','${safeSt.replace(/'/g,"\\'")}')"
                     style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f3f4f6;"
                     onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background=''">
                    <div style="font-weight:600;font-size:.88rem;color:#111827;">${safeName}</div>
                    <div style="font-size:.75rem;color:#6b7280;">${escapeHtml(loc)} · <span style="font-family:monospace;">${safeId}</span></div>
                </div>`;
        }).join('');
        dd.style.display = 'block';
        _setParentStatus('', '');
    }, 280);
};

// Close dropdown when clicking outside the input or dropdown
document.addEventListener('click', function(e) {
    if (!e.target.closest('#editParentListing') &&
        !e.target.closest('#parentListingDropdown')) {
        _closeParentListingDropdown();
    }
});

// ── Check button (manual UUID validation) ────────────────────────────────────
window.checkParentListingUUID = async function() {
    const input    = document.getElementById('editParentListing');
    const statusEl = document.getElementById('parentListingStatus');
    if (!input || !statusEl) return;

    const uuid    = input.value.trim();
    const uuidRe  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    _closeParentListingDropdown();

    if (!uuid) {
        _setParentStatus('Enter a UUID first.', '');
        return;
    }
    if (!uuidRe.test(uuid)) {
        _setParentStatus('❌ Not a valid UUID format.', 'error');
        return;
    }
    if (uuid === String(editingListing?.id || '')) {
        _setParentStatus('❌ A listing cannot be its own parent.', 'error');
        return;
    }

    _setParentStatus('Checking…', 'loading');

    try {
        const listings = await adminProxy('listings:list');
        const match = Array.isArray(listings)
            ? listings.find(l => String(l.id) === uuid)
            : null;

        if (match) {
            _setParentStatus(
                `✅ ${match.business_name}${match.city ? ' · ' + match.city : ''}${match.state ? ', ' + match.state : ''}`,
                'ok'
            );
        } else {
            _setParentStatus('❌ No listing found with that UUID.', 'error');
        }
    } catch (err) {
        _setParentStatus('⚠️ Could not verify — check console.', 'loading');
        console.error('checkParentListingUUID error:', err);
    }
};
// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.toggleClaimedFields = function() {
    const isClaimed = document.getElementById('editIsClaimed')?.checked;
    const confirmationKeyInput = document.getElementById('editConfirmationKey');
    
    if (isClaimed) {
        confirmationKeyInput.disabled = true;
        confirmationKeyInput.placeholder = 'Listing is claimed';
        confirmationKeyInput.title = 'Listing is claimed';
    } else {
        confirmationKeyInput.disabled = false;
        confirmationKeyInput.placeholder = 'Auto-generated if empty';
        confirmationKeyInput.title = '';
    }
};

window.toggleDayClosed = function(day) {
    const input = document.getElementById(`editHours${day}`);
    const closedCheckbox = document.getElementById(`editClosed${day}`);
    const hours24Checkbox = document.getElementById(`edit24Hours${day}`);
    
    if (closedCheckbox.checked) {
        input.value = 'Closed';
        input.disabled = true;
        hours24Checkbox.checked = false;
    } else {
        if (input.value.toLowerCase() === 'closed') {
            input.value = '';
        }
        input.disabled = false;
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.toggle24Hours = function(day) {
    const input = document.getElementById(`editHours${day}`);
    const closedCheckbox = document.getElementById(`editClosed${day}`);
    const hours24Checkbox = document.getElementById(`edit24Hours${day}`);
    
    if (hours24Checkbox.checked) {
        input.value = 'Open 24 Hours';
        input.disabled = true;
        closedCheckbox.checked = false;
    } else {
        if (input.value.toLowerCase().includes('24') || input.value.toLowerCase().includes('open 24')) {
            input.value = '';
        }
        input.disabled = false;
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 7
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 7
// Geocoding & Save Listing Functions
// ============================================

async function geocodeAddress(address, city, state, zipCode) {
    try {
        const fullAddress = [address, city, state, zipCode].filter(Boolean).join(', ');
        
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&limit=1`,
            {
                headers: {
                    'User-Agent': 'TheGreekDirectory/1.0'
                }
            }
        );
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
        
        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function normalizeCoordinates(value) {
    if (!value || typeof value !== 'object') return null;

    const lat = Number(value.lat);
    const lng = Number(value.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }

    return { lat, lng };
}

function coordinatesToRawText(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.


function normalizeSingleTime(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return null;
    const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || '0');
    const meridiem = match[3];
    if (minute > 59 || hour > 24) return null;
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeHoursInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^closed$/i.test(raw)) return 'Closed';
    if (/24\s*hours|open\s*24/i.test(raw)) return '00:00-23:59';
    const parts = raw.split(/\s*-\s*/);
    if (parts.length === 2) {
        const start = normalizeSingleTime(parts[0]);
        const end = normalizeSingleTime(parts[1]);
        return start && end ? `${start}-${end}` : null;
    }
    return normalizeSingleTime(raw);
}

async function saveListing() {
    try {
        const editModal = document.getElementById('editModal');
        const isRequestEdit = editModal?.dataset.mode === 'request-edit';
        const requestId = editModal?.dataset.requestId;
        const businessName = document.getElementById('editBusinessName').value.trim();
        const tagline = document.getElementById('editTagline').value.trim();
        
        if (!businessName) {
            alert('Business name is required');
            return;
        }
        
        if (!tagline) {
            alert('Tagline is required');
            return;
        }

        if (selectedSubcategories.length === 0) {
            alert('At least one subcategory is required');
            return;
        }
        
        const isChain = document.getElementById('editIsChain').checked;
        const chainName = document.getElementById('editChainName').value.trim();
        
        if (isChain && !chainName) {
            alert('Chain name is required for chain listings');
            return;
        }
        
        const photosText = document.getElementById('editPhotos').value;
        const photos = photosText ? photosText.split('\n').map(url => url.trim()).filter(url => url) : [];
        
        let chainId = document.getElementById('editChainId')?.value.trim();
        if (isChain && !chainId) {
            chainId = `chain-${chainName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
        }
        
        const phoneContainer = document.getElementById('editPhoneContainer');
        const phone = getPhoneValue(phoneContainer);
        const phoneRawValue = phoneContainer?.querySelector('.phone-number-input')?.value?.trim();
        if (phoneRawValue && !phone) {
            alert('Phone number must be a valid US 10-digit number and is stored as E.164.');
            return;
        }
        
// In saveListing function, replace the slug generation with:

let slug = document.getElementById('editSlug').value.trim();

if (!slug) {
    // Grab all the necessary fields from the modal form inputs
    const businessNameInput = document.getElementById('editBusinessName')?.value.trim() || '';
    const addressInput = document.getElementById('editAddress')?.value.trim() || '';
    const cityInput = document.getElementById('editCity')?.value.trim() || '';
    const stateInput = document.getElementById('editState')?.value.trim() || '';

    // Let the main function handle the heavy lifting and routing rules
    slug = generateSlugFromName(businessNameInput, addressInput, cityInput, stateInput);
}
        
        const address = document.getElementById('editAddress').value.trim() || null;
        const city = document.getElementById('editCity').value.trim() || null;
        const state = document.getElementById('editState').value || null;
        const zipCode = document.getElementById('editZipCode').value.trim() || null;
        const coordinatesRaw = document.getElementById('editCoordinates')?.value ?? '';
        
        // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
        
        // AUTO-GEOCODING
        let coordinates = coordinatesRaw === '' ? null : coordinatesRaw;
        if (coordinatesRaw !== '') {
            console.log('📍 Manual coordinates supplied; skipping auto-geocoding.');
        } else if (address && city && state) {
            console.log('🌍 Auto-geocoding address...');
            coordinates = normalizeCoordinates(await geocodeAddress(address, city, state, zipCode));
            if (coordinates) {
                console.log('✅ Coordinates found:', coordinates);
            } else {
                console.log('⚠️ Could not geocode address');
            }
        }
        
        const isClaimed = document.getElementById('editIsClaimed').checked;
        const tierValue = document.getElementById('editTier').value;
        const maxCtas = 1;
        
        const additionalInfo = [];
        for (let i = 0; i < 5; i += 1) {
            const label = document.getElementById(`editInfoName${i}`)?.value.trim();
            const value = document.getElementById(`editInfoValue${i}`)?.value.trim();
            if (label && value) {
                additionalInfo.push({ label, value });
            }
        }
        
        const customCtas = [];
        for (let i = 0; i < 1; i += 1) {
            const name = document.getElementById(`editCtaName${i}`)?.value.trim();
            const url = document.getElementById(`editCtaUrl${i}`)?.value.trim();
            const color = document.getElementById(`editCtaColor${i}`)?.value.trim();
            const icon = normalizeCustomCtaIcon(document.getElementById(`editCtaIcon${i}`)?.value.trim());
            
            if (!name && !url && !icon) continue;
            if (!name || !url) {
                alert(`CTA ${i + 1} requires both a name and a link.`);
                return;
            }
            customCtas.push({
                name,
                url,
                color: color || '#045093',
                icon: icon || ''
            });
        }
        

        
        const timezoneInput = document.getElementById('editTimezone');
        const timezone = (timezoneInput?.value || '').trim() || 'America/Chicago';
        const isValidIanaTimezone = (tz) => {
            try {
                return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone === tz;
            } catch (error) {
                return false;
            }
        };

        if (!isValidIanaTimezone(timezone)) {
            alert('Please enter a valid IANA timezone (example: America/Chicago).');
            timezoneInput?.focus();
            return;
        }

const listingData = {
            business_name: businessName,
            slug: slug,
            tagline: tagline,
            description: sanitizeListingDescription(adminDescriptionEditor ? adminDescriptionEditor.getHtml() : document.getElementById('editDescription').value.trim()),
            category: document.getElementById('editCategory').value,
            subcategories: selectedSubcategories,
            primary_subcategory: primarySubcategory,
            tier: tierValue,
            pricing: document.getElementById('editPricing').value ? Number(document.getElementById('editPricing').value) : null,
            coming_soon: document.getElementById('editComingSoon').value === 'true',
            is_chain: isChain,
            is_claimed: isClaimed,
            chain_name: isChain ? chainName : null,
            chain_id: isChain ? chainId : null,
            more_listings_title_custom: isChain ? (document.getElementById('editMoreListingsTitleCustom').value.trim() || null) : null,
            address: address,
            city: city,
            state: state,
            zip_code: zipCode,
            country: document.getElementById('editCountry').value || 'USA',
            timezone,
            coordinates: coordinates,
            google_place_id: document.getElementById('editGooglePlaceId').value.trim() || null,
            phone: phone,
            email: document.getElementById('editEmail').value.trim() || null,
            website: document.getElementById('editWebsite').value.trim() || null,
            logo: normalizeImageCdnUrl(document.getElementById('editLogo').value.trim()) || null,
            photos: photos.map((photo) => normalizeImageCdnUrl(photo)).filter(Boolean),
            video: normalizeImageCdnUrl(document.getElementById('editVideo').value.trim()) || null,
            additional_info: additionalInfo,
            custom_ctas: customCtas.slice(0, maxCtas),
            visible: editingListing?.visible !== false,
            hours: {
                monday: normalizeHoursInput(document.getElementById('editHoursMonday').value.trim()),
                tuesday: normalizeHoursInput(document.getElementById('editHoursTuesday').value.trim()),
                wednesday: normalizeHoursInput(document.getElementById('editHoursWednesday').value.trim()),
                thursday: normalizeHoursInput(document.getElementById('editHoursThursday').value.trim()),
                friday: normalizeHoursInput(document.getElementById('editHoursFriday').value.trim()),
                saturday: normalizeHoursInput(document.getElementById('editHoursSaturday').value.trim()),
                sunday: normalizeHoursInput(document.getElementById('editHoursSunday').value.trim())
            },
            hours_label_custom: document.getElementById('editHoursLabelCustom').value.trim() || null,
            hours_disclaimer_custom: document.getElementById('editHoursDisclaimerCustom').value.trim() || null,
            custom_schema_properties: document.getElementById('editCustomSchemaProperties').value || null,
            social_media: {
                facebook: document.getElementById('editFacebook').value.trim() || null,
                instagram: document.getElementById('editInstagram').value.trim() || null,
                twitter: document.getElementById('editTwitter').value.trim() || null,
                youtube: document.getElementById('editYoutube').value.trim() || null,
                tiktok: document.getElementById('editTiktok').value.trim() || null,
                linkedin: document.getElementById('editLinkedin').value.trim() || null,
                other1_name: document.getElementById('editOtherSocial1Name').value.trim() || null,
                other1: document.getElementById('editOtherSocial1').value.trim() || null,
                other2_name: document.getElementById('editOtherSocial2Name').value.trim() || null,
                other2: document.getElementById('editOtherSocial2').value.trim() || null,
                other3_name: document.getElementById('editOtherSocial3Name').value.trim() || null,
                other3: document.getElementById('editOtherSocial3').value.trim() || null
            },
            reviews: {
                google: document.getElementById('editGoogleReviews').value.trim() || null,
                yelp: document.getElementById('editYelp').value.trim() || null,
                tripadvisor: document.getElementById('editTripadvisor').value.trim() || null,
                other1_name: document.getElementById('editOtherReview1Name').value.trim() || null,
                other1: document.getElementById('editOtherReview1').value.trim() || null,
                other2_name: document.getElementById('editOtherReview2Name').value.trim() || null,
                other2: document.getElementById('editOtherReview2').value.trim() || null,
                other3_name: document.getElementById('editOtherReview3Name').value.trim() || null,
                other3: document.getElementById('editOtherReview3').value.trim() || null
            },
            // Parent / Child Listing
            // Parent / Child Listing
            parent_listing: (function() {
                const checked = document.getElementById('editHasParentListing')?.checked;
                if (!checked) return null;
                const val = document.getElementById('editParentListing')?.value.trim();
                return val || null;
            })(),
            parent_listing_title_custom: document.getElementById('editParentListingTitleCustom')?.value.trim() || null,
            child_listings_custom_title: document.getElementById('editChildListingsTitleCustom')?.value.trim() || null,
            updated_by_role: null
        };
        
        const customShortlinkPath = document.getElementById('editCustomShortlink')?.value.trim() || null;
        
        // Copyright (C) The Greek Directory, 2025-present. All rights reserved.

        if (isRequestEdit && requestId) {
            const requestPayload = {
                business_name: listingData.business_name,
                slug: listingData.slug,
                tagline: listingData.tagline,
                description: listingData.description,
                category: listingData.category,
                subcategories: listingData.subcategories,
                primary_subcategory: listingData.primary_subcategory,
                is_chain: listingData.is_chain,
                chain_name: listingData.chain_name,
                chain_id: listingData.chain_id,
                address: listingData.address,
                city: listingData.city,
                state: listingData.state,
                zip_code: listingData.zip_code,
                country: listingData.country,
                phone: listingData.phone,
                email: listingData.email,
                website: listingData.website,
                logo: listingData.logo,
                photos: listingData.photos,
                video: listingData.video,
                additional_info: listingData.additional_info,
                custom_ctas: listingData.custom_ctas,
                hours: listingData.hours,
                timezone: listingData.timezone,
                hours_label_custom: listingData.hours_label_custom,
                hours_disclaimer_custom: listingData.hours_disclaimer_custom,
                custom_schema_properties: listingData.custom_schema_properties,
                social_media: listingData.social_media,
                reviews: listingData.reviews,
                owner_name: document.getElementById('editOwnerName').value.trim() || null,
                owner_title: document.getElementById('editOwnerTitle').value.trim() || null,
                from_greece: document.getElementById('editOwnerGreece').value.trim() || null,
                owner_email: document.getElementById('editOwnerEmail').value.trim() || null,
                owner_phone: getPhoneValue(document.getElementById('editOwnerPhoneContainer'))
            };

            await adminProxy('requests:update', {
                id: requestId,
                ...requestPayload
            });

            document.getElementById('editModal').classList.add('hidden');
            document.getElementById('editModal').dataset.mode = '';
            document.getElementById('editModal').dataset.requestId = '';
            document.getElementById('saveEdit')?.classList.remove('hidden');
            await loadRequests();
            alert('✅ Request updated successfully!');
            return;
        }

        let savedListing;
        const isExisting = editingListing && editingListing.id && allListings.find(l => String(l.id) === String(editingListing.id));
        
        if (isExisting) {
            savedListing = await adminProxy('listings:update', {
                id: editingListing.id,
                ...listingData
            });
        } else {
            savedListing = await adminProxy('listings:insert', listingData);
        }

        const customPath = customShortlinkPath;
        if (!isExisting) {
    // System shortlink — only for new listings
    let systemPath;
    for (;;) {
        const candidate = generateSystemShortlinkCandidate();
        if (!isValidSystemShortlink(candidate)) continue;
        const exists = await adminProxy('shortlinks:check', { path: candidate });
        if (exists) continue;
        try {
            await adminProxy('shortlinks:insert', {
                title: `LISTING: ${listingData.business_name}`,
                path: candidate,
                redirect_to: `https://thegreekdirectory.org/listing/${savedListing.slug || listingData.slug}`,
                listing_refer_id: savedListing.id,
                listing_custom: false
            });
            systemPath = candidate;
            break;
        } catch (err) {
            if (err?.message && err.message.includes('path_conflict')) continue;
            throw err;
        }
    }
}

// Custom shortlink — runs for both new and existing listings
if (customShortlinkPath && isValidCustomShortlink(customShortlinkPath)) {
    const existingRows = await adminProxy('shortlinks:get', { listing_id: savedListing.id });
    const existingCustom = (Array.isArray(existingRows) ? existingRows : [])
        .find(row => row.listing_custom === true);

    if (!existingCustom) {
        const pathTaken = await adminProxy('shortlinks:check', { path: customShortlinkPath });
        if (pathTaken) {
            alert('⚠️ That custom shortlink path is already taken. Listing saved, but custom shortlink was not created.');
        } else {
            try {
                await adminProxy('shortlinks:insert', {
                    title: `LISTING: ${listingData.business_name}`,
                    path: customShortlinkPath,
                    redirect_to: `https://thegreekdirectory.org/listing/${savedListing.slug || listingData.slug}`,
                    listing_refer_id: savedListing.id,
                    listing_custom: true
                });
            } catch (err) {
                if (err?.message && err.message.includes('path_conflict')) {
                    alert('⚠️ Custom shortlink path conflict. Listing saved without custom shortlink.');
                } else {
                    throw err;
                }
            }
        }
    } else if (existingCustom.path !== customShortlinkPath) {
        alert('⚠️ A custom shortlink already exists for this listing. To change it, delete the existing row from Supabase first.');
    }
}
        
        

    await saveOwnerInfo(savedListing.id, isClaimed);
    document.getElementById('editModal').classList.add('hidden');
    await loadListings();

    // Array to collect files and push everything in a single Git transaction
    const filesToCommit = [];
    let shortlinksVerificationRequired = false;

    // 1. Prepare Parent Listing Page
    try {
        console.log('🔨 Preparing parent listing page content...');
        const parentFile = await prepareListingPageGeneration(savedListing.id, { skipAnalytics: true });
        if (parentFile) {
            filesToCommit.push(parentFile);
            if (!parentFile.shortlinksFound) shortlinksVerificationRequired = true;
        }
    } catch (parentErr) {
        console.error('Could not prepare parent listing page:', parentErr);
    }

    // 2. Prepare Child Listing Pages
    try {
        const allListingsData = await adminProxy('listings:list');
        const childListings = Array.isArray(allListingsData) ? allListingsData.filter(l => String(l.parent_listing) === String(savedListing.id)) : [];
        
        if (childListings.length > 0) {
            console.log(`🔨 Preparing ${childListings.length} child listing page(s)…`);
            for (const child of childListings) {
                try {
                    const childFile = await prepareListingPageGeneration(child.id, { skipAnalytics: true });
                    if (childFile) {
                        filesToCommit.push(childFile);
                        if (!childFile.shortlinksFound) shortlinksVerificationRequired = true;
                    }
                } catch (childErr) {
                    console.error(`Could not prepare child page for listing ID ${child.id}:`, childErr);
                }
            }
        }
    } catch (childErr) {
        console.error('Could not gather child listing pages:', childErr);
    }

    // 3. Batch commit to GitHub in ONE unified push
    if (filesToCommit.length > 0) {
        try {
            console.log(`🚀 Committing ${filesToCommit.length} file(s) to GitHub simultaneously...`);
            
            await saveMultipleFilesToGitHub(
                filesToCommit,
                `Update parent and child pages for ${savedListing.business_name || savedListing.id}`
            );
            
            console.log('✅ All pages committed successfully in a single push!');
            
            if (shortlinksVerificationRequired) {
                alert('Pages generated, but shortlink integrity must be checked in Supabase.');
            }
        } catch (gitErr) {
            console.error('Failed to commit pages package to GitHub:', gitErr);
            alert('❌ Failed to push updates to GitHub: ' + gitErr.message);
        }
    }

// 4. Update the global sitemap once after the unified push finishes
    try {
        console.log('🗺️ Updating sitemap...');
        await updateSitemap();
        console.log('✅ Sitemap updated successfully!');
        alert('✅ Listing saved, pages pushed, and sitemap updated successfully!');
    } catch (sitemapErr) {
        console.error('Could not update sitemap:', sitemapErr);
        alert('✅ Listing saved and pages pushed, but sitemap encountered an issue.');
    }

    } catch (error) {
        console.error('Error saving listing:', error);
        alert('Failed to save listing: ' + error.message);
    }
}

// ==============================================================================
// ADMIN PORTAL — SUGGESTIONS TAB — JS SNIPPET
// Add this entire block to admin.js.
// Recommended location: paste it right after the submissions/requests section.
//
// IMPORTANT: This code calls the admin-proxy Supabase edge function for all
// database operations (SELECT, UPDATE on listing_suggestions + UPDATE listings).
// The proxy call format below (adminProxySuggest) uses the same headers pattern
// as the rest of your admin.js.  Rename / adapt "adminProxySuggest" to match
// your existing admin proxy helper if you already have one.
// ==============================================================================

// ─── State ────────────────────────────────────────────────────────────────────
let currentSuggestions       = [];
let currentViewingSuggestionId = null;

// ─── Proxy helper (adapt to match your existing admin proxy call pattern) ──────
async function adminProxySuggest(body) {
  // Uses the SUPABASE_URL and SUPABASE_ANON_KEY constants already in admin.js.
  // The admin-proxy edge function uses the service-role key server-side.
  const githubToken = localStorage.getItem('tgd_admin_token') || '';
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'x-github-token': githubToken
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Admin proxy error ${resp.status}: ${text}`);
  }
  return resp.json();
}

// ─── Load & render suggestions ────────────────────────────────────────────────
async function loadSuggestions() {
  const filter      = document.getElementById('suggestionsStatusFilter')?.value;
  const loadingEl   = document.getElementById('suggestionsLoading');
  const emptyEl     = document.getElementById('suggestionsEmpty');
  const tableWrap   = document.getElementById('suggestionsTableWrap');
  const tbody       = document.getElementById('suggestionsTableBody');

  loadingEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  tableWrap.classList.add('hidden');
  tbody.innerHTML = '';

  try {
    // Build query filters
    const filters = {};
    if (filter) filters.status = filter;

    const result = await adminProxySuggest({
      action:  'select',
      table:   'listing_suggestions',
      filters,
      order:   { column: 'created_at', ascending: false },
      limit:   200
    });

    const rows = result.data || result || [];
    currentSuggestions = rows;
    loadingEl.classList.add('hidden');

    // Update pending badge
    const pendingCount = rows.filter(r => r.status === 'pending').length;
    const badge = document.getElementById('suggestionsPendingBadge');
    if (badge) {
      badge.textContent = pendingCount || '';
      badge.classList.toggle('hidden', !pendingCount);
    }

    if (!rows.length) {
      emptyEl.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = rows.map(s => {
      const statusClasses = {
        pending:  'bg-yellow-100 text-yellow-800',
        approved: 'bg-green-100 text-green-700',
        denied:   'bg-red-100 text-red-700'
      };
      const sc   = statusClasses[s.status] || 'bg-gray-100 text-gray-600';
      const date = s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';

      return `<tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="px-3 py-2">
          <div class="font-medium text-gray-800">${escHtml(s.listing_name || '—')}</div>
          <div class="text-xs text-gray-400">Listing ID: ${escHtml(String(s.listing_id))}</div>
        </td>
        <td class="px-3 py-2 text-gray-700">${escHtml(s.suggester_name || '—')}</td>
        <td class="px-3 py-2 text-gray-500 text-xs">${escHtml(s.suggester_email || '—')}</td>
        <td class="px-3 py-2">
          <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${sc}">${escHtml(s.status)}</span>
        </td>
        <td class="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">${date}</td>
        <td class="px-3 py-2">
          <div class="flex gap-2 flex-wrap">
            <button onclick="viewSuggestion(${s.id})"
              class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-200">
              View
            </button>
            ${s.status === 'pending' ? `
            <button onclick="approveSuggestion(${s.id})"
              class="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200">
              Approve
            </button>
            <button onclick="denySuggestion(${s.id})"
              class="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200">
              Deny
            </button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');

    tableWrap.classList.remove('hidden');
  } catch (err) {
    loadingEl.classList.add('hidden');
    console.error('loadSuggestions error:', err);
    alert(`Failed to load suggestions: ${err.message}`);
  }
}

// ─── Diff helpers ──────────────────────────────────────────────────────────────
// Fields to compare side-by-side (label, key path)
const SUGGESTION_DIFF_FIELDS = [
  ['Business Name',    'business_name'],
  ['Tagline',          'tagline'],
  ['Description',      'description'],
  ['Category',         'category'],
  ['Pricing',          'pricing'],
  ['Coming Soon',      'coming_soon'],
  ['Subcategories',    'subcategories'],
  ['Primary Subcat.',  'primary_subcategory'],
  ['Address',          'address'],
  ['City',             'city'],
  ['State',            'state'],
  ['ZIP',              'zip_code'],
  ['Country',          'country'],
  ['Phone',            'phone'],
  ['Email',            'email'],
  ['Website',          'website'],
  ['Logo',             'logo'],
  ['Photos',           'photos'],
  ['Video',            'video'],
  ['Hours',            'hours'],
  ['Social Media',     'social_media'],
  ['Reviews',          'reviews'],
  ['Additional Info',  'additional_info'],
  ['Custom CTAs',      'custom_ctas'],
  ['Owner Name',       'owner_name'],
  ['Owner Title',      'owner_title'],
  ['From Greece',      'from_greece'],
  ['Owner Email',      'owner_email'],
  ['Owner Phone',      'owner_phone'],
  ['Name+Title Vis.',  'owner_name_title_visible'],
  ['Email Visible',    'owner_email_visible'],
  ['Phone Visible',    'owner_phone_visible'],
];

function diffVal(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v))  return v.length ? v.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ') : '(empty)';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v).trim() || '—';
}

function valuesAreDifferent(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function buildDiffRows(suggestion, currentListing) {
  const diffBody = document.getElementById('suggestionDiffBody');
  diffBody.innerHTML = '';

  let changedCount = 0;
  SUGGESTION_DIFF_FIELDS.forEach(([label, key]) => {
    const suggested = suggestion[key];
    // Only show rows where the suggestion has a value (non-null/non-empty)
    const hasValue = suggested !== null && suggested !== undefined &&
                     !(typeof suggested === 'string' && suggested.trim() === '') &&
                     !(Array.isArray(suggested) && suggested.length === 0);
    if (!hasValue) return;

    const current   = currentListing ? currentListing[key] : undefined;
    const isDiff    = valuesAreDifferent(current, suggested);
    if (isDiff) changedCount++;

    const rowClass  = isDiff ? 'bg-blue-50' : '';
    const diffBadge = isDiff ? '<span class="ml-1 text-xs bg-blue-200 text-blue-800 rounded px-1">changed</span>' : '';
    const curHtml   = `<span class="text-gray-600 whitespace-pre-wrap break-all">${escHtml(diffVal(current))}</span>`;
    const sugHtml   = isDiff
      ? `<span class="text-blue-800 font-semibold whitespace-pre-wrap break-all">${escHtml(diffVal(suggested))}</span>`
      : `<span class="text-gray-500 whitespace-pre-wrap break-all">${escHtml(diffVal(suggested))}</span>`;

    diffBody.insertAdjacentHTML('beforeend', `
      <tr class="border-b border-gray-100 ${rowClass}">
        <td class="px-3 py-2 font-medium text-gray-700 align-top whitespace-nowrap">
          ${escHtml(label)}${diffBadge}
        </td>
        <td class="px-3 py-2 align-top text-sm">${curHtml}</td>
        <td class="px-3 py-2 align-top text-sm">${sugHtml}</td>
      </tr>`);
  });

  if (!changedCount) {
    diffBody.insertAdjacentHTML('beforeend', `
      <tr><td colspan="3" class="px-3 py-4 text-center text-gray-400 text-sm">
        No detectable differences from current listing values.
      </td></tr>`);
  }
}

// ─── View suggestion (opens modal) ────────────────────────────────────────────
async function viewSuggestion(id) {
  const s = currentSuggestions.find(x => x.id === id);
  if (!s) return;

  currentViewingSuggestionId = id;

  // Populate header
  document.getElementById('suggestionModalTitle').textContent =
    `Suggestion for: ${s.listing_name || s.listing_id}`;
  document.getElementById('suggestionModalSubtitle').textContent =
    `Submitted by ${s.suggester_name} — Status: ${s.status}`;

  // Populate suggester card
  document.getElementById('smSuggesterName').textContent    = s.suggester_name  || '—';
  document.getElementById('smSuggesterEmail').textContent   = s.suggester_email || '—';
  document.getElementById('smSuggesterPhone').textContent   = s.suggester_phone || '—';
  document.getElementById('smSuggesterMessage').textContent = s.suggester_message || '(no message)';
  document.getElementById('smSuggesterDate').textContent    = s.created_at
    ? new Date(s.created_at).toLocaleString('en-US') : '—';

  // Show/hide approve & deny buttons based on status
  const isPending = s.status === 'pending';
  document.getElementById('smApproveBtn').classList.toggle('hidden', !isPending);
  document.getElementById('smDenyBtn').classList.toggle('hidden', !isPending);

  // Open modal
  document.getElementById('suggestionModal').classList.remove('hidden');

  // Load current listing for comparison
  const diffLoading = document.getElementById('suggestionDiffLoading');
  const diffBody    = document.getElementById('suggestionDiffBody');
  diffLoading.classList.remove('hidden');
  diffBody.innerHTML = '';

  try {
    const result = await adminProxySuggest({
      action:  'select',
      table:   'listings',
      filters: { id: s.listing_id },
      limit:   1
    });
    const rows   = result.data || result || [];
    const current = rows[0] || null;
    diffLoading.classList.add('hidden');
    buildDiffRows(s, current);
  } catch (err) {
    diffLoading.classList.add('hidden');
    diffBody.innerHTML = `<tr><td colspan="3" class="px-3 py-4 text-center text-red-500 text-sm">
      Failed to load current listing for comparison: ${escHtml(err.message)}
    </td></tr>`;
  }
}

function closeSuggestionModal() {
  document.getElementById('suggestionModal').classList.add('hidden');
  currentViewingSuggestionId = null;
}

// ─── Approve suggestion (merge into listing) ───────────────────────────────────
async function approveSuggestion(id) {
  const s = currentSuggestions.find(x => x.id === id);
  if (!s) return;

  const confirmed = confirm(
    `Approve this suggestion from ${s.suggester_name}?\n\n` +
    `This will MERGE the suggested fields into "${s.listing_name || s.listing_id}".\n` +
    `Only non-empty suggested fields will overwrite existing values.`
  );
  if (!confirmed) return;

  // Build merge payload — only non-null / non-empty fields from the suggestion
  const MERGE_FIELDS = [
    'business_name','tagline','description','category','subcategories','primary_subcategory',
    'pricing','coming_soon',
    'address','city','state','zip_code','country',
    'phone','email','website',
    'logo','photos','video',
    'hours','social_media','reviews','additional_info','custom_ctas',
    'owner_name','owner_title','from_greece','owner_email','owner_phone',
    'owner_name_title_visible','owner_email_visible','owner_phone_visible','owner_contacts'
  ];

  const mergePayload = {};
  MERGE_FIELDS.forEach(field => {
    const val = s[field];
    if (val === null || val === undefined) return;
    if (typeof val === 'string' && val.trim() === '') return;
    if (Array.isArray(val) && val.length === 0) return;
    mergePayload[field] = val;
  });

  if (!Object.keys(mergePayload).length) {
    alert('No non-empty fields found in this suggestion to merge.');
    return;
  }

  try {
    // 1. Update the listing
    await adminProxySuggest({
      action:  'update',
      table:   'listings',
      id:      s.listing_id,
      data:    mergePayload
    });

    // 2. Mark suggestion as approved
    await adminProxySuggest({
      action:  'update',
      table:   'listing_suggestions',
      id:      String(s.id),
      data:    { status: 'approved' }
    });

    alert(`✅ Suggestion approved! "${s.listing_name || s.listing_id}" has been updated.`);
    closeSuggestionModal();
    loadSuggestions();

    // Refresh listings table if function exists
    if (typeof loadListings === 'function') loadListings();

  } catch (err) {
    console.error('approveSuggestion error:', err);
    alert(`Failed to approve suggestion: ${err.message}`);
  }
}

// ─── Deny suggestion ──────────────────────────────────────────────────────────
async function denySuggestion(id) {
  const s = currentSuggestions.find(x => x.id === id);
  if (!s) return;

  const confirmed = confirm(
    `Deny this suggestion from ${s.suggester_name}?\n\nThe listing will NOT be changed.`
  );
  if (!confirmed) return;

  try {
    await adminProxySuggest({
      action: 'update',
      table:  'listing_suggestions',
      id:     String(s.id),
      data:   { status: 'denied' }
    });

    alert('Suggestion denied.');
    closeSuggestionModal();
    loadSuggestions();

  } catch (err) {
    console.error('denySuggestion error:', err);
    alert(`Failed to deny suggestion: ${err.message}`);
  }
}

// ─── Hook into your existing showTab() function ────────────────────────────────
// If your showTab function looks like the common pattern below, add the
// 'suggestions' case to it.  If it's structured differently, just make sure
// loadSuggestions() is called when the Suggestions tab becomes active.
//
// EXAMPLE — find your showTab function and add this case:
//
//   case 'suggestions':
//     loadSuggestions();
//     break;
//
// OR, if your tab system fires a custom event, listen for it:
//
// document.addEventListener('tgd:tab-changed', (e) => {
//   if (e.detail?.tab === 'suggestions') loadSuggestions();
// });
//
// ─────────────────────────────────────────────────────────────────────────────

// ─── Keyboard: Escape closes modal ────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('suggestionModal').classList.contains('hidden')) {
    closeSuggestionModal();
  }
});

// ─── escHtml helper (only add if not already defined in admin.js) ──────────────
// If admin.js already has an escHtml / escapeHtml / he.encode function, delete
// this block and rename the calls above to match yours.
if (typeof escHtml === 'undefined') {
  window.escHtml = function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
}






// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

async function saveOwnerInfo(listingId, isClaimed) {
    const ownerPhoneContainer = document.getElementById('editOwnerPhoneContainer');
    const ownerPhone = getPhoneValue(ownerPhoneContainer);
    
    const ownerData = {
        listing_id: listingId,
        full_name: document.getElementById('editOwnerName').value.trim() || null,
        title: document.getElementById('editOwnerTitle').value.trim() || null,
        from_greece: document.getElementById('editOwnerGreece').value.trim() || null,
        owner_email: document.getElementById('editOwnerEmail').value.trim() || null,
        owner_phone: ownerPhone,
        name_title_visible: document.getElementById('editOwnerNameTitleVisible') ? document.getElementById('editOwnerNameTitleVisible').checked : true,
        email_visible: document.getElementById('editOwnerEmailVisible') ? document.getElementById('editOwnerEmailVisible').checked : true,
        phone_visible: document.getElementById('editOwnerPhoneVisible') ? document.getElementById('editOwnerPhoneVisible').checked : false,
        confirmation_key: isClaimed ? null : (document.getElementById('editConfirmationKey').value.trim() || null)
    };
    
    if (!isClaimed && !ownerData.confirmation_key) {
        const words = [
            'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
            'iota', 'kappa', 'lambda', 'sigma', 'omega', 'phoenix', 'apollo',
            'athena', 'zeus', 'hera', 'poseidon', 'demeter', 'ares', 'hermes'
        ];
        const word1 = words[Math.floor(Math.random() * words.length)];
        const word2 = words[Math.floor(Math.random() * words.length)];
        const word3 = words[Math.floor(Math.random() * words.length)];
        ownerData.confirmation_key = `${word1}-${word2}-${word3}`;
    }

    await adminProxy('owners:upsert', ownerData);
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.saveListing = saveListing;

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 8
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 8
// Delete Listing & Magic Link Functions
// ============================================

window.sendMagicLink = async function(listingId) {
    try {
        const listings = await adminProxy('listings:list');
        const listing = Array.isArray(listings)
            ? listings.find((row) => String(row.id) === String(listingId))
            : null;
        if (!listing) throw new Error('Listing not found');
        
        const owner = listing.owner && listing.owner.length > 0 ? listing.owner[0] : null;
        if (!owner || !owner.owner_email || !owner.owner_user_id) {
            alert('No claimed owner email found for this listing');
            return;
        }
        
        const confirmText = prompt(`Send magic link to ${owner.owner_email}?\n\nType "CONFIRM" to proceed.`);
        
        if (confirmText !== 'CONFIRM') {
            return;
        }
        
        const response = await fetch('https://luetekzqrrgdxtopzvqw.supabase.co/functions/v1/send-magic-link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: owner.owner_email,
                redirectTo: `${window.location.origin}/business`
            })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Failed to send magic link');
        }
        
        alert(`Magic link sent successfully to ${owner.owner_email}`);
        
    } catch (error) {
        console.error('Error sending magic link:', error);
        alert('Failed to send magic link: ' + error.message);
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.deleteListing = async function(listingId) {
    const listing = allListings.find(l => l.id === listingId);
    if (!listing) return;
    
    const confirmText = prompt(`Are you sure you want to DELETE "${listing.business_name}"?\n\nThis action CANNOT be undone.\n\nType "DELETE" to confirm.`);
    
    if (confirmText !== 'DELETE') {
        return;
    }
    
    try {
        await adminProxy('owners:delete', { listing_id: listingId });
        await adminProxy('shortlinks:delete', { listing_refer_id: listingId });
        await adminProxy('listings:delete', { id: listingId });
        
        alert('✅ Listing deleted successfully');
        await loadListings();
        
    } catch (error) {
        console.error('Error deleting listing:', error);
        alert('Failed to delete listing: ' + error.message);
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.editListing = editListing;
window.newListing = newListing;
window.deleteListing = deleteListing;
window.sendMagicLink = sendMagicLink;

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 9
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 9
// Page Generation Helper Functions
// ============================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeJsonForTemplate(value) {
    if (value === undefined || value === null) return '';
    
    // We intentionally stringify the value to handle control characters/newlines,
    // then slice off the outer JSON-provided double quotes.
    return JSON.stringify(String(value))
        .slice(1, -1)
        .replace(/'/g, "\\'"); // Manually escape single quotes so they won't break single-quoted template literals
}

function decodeEscapedText(value) {
    if (value === undefined || value === null) return '';
    const str = String(value);
    if (!/\\[\\'"nrtbf]/.test(str)) return str;
    try {
        return JSON.parse(`"${str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t')}"`);
    } catch (_) {
        return str
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, '\n');
    }
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function generateHoursSchema(listing) {
    if (!listing.hours || Object.keys(listing.hours).length === 0) {
        return '[]';
    }

    const dayMap = {
        monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
        friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday'
    };

    const schemaHours = [];
    Object.entries(listing.hours).forEach(([day, hours]) => {
        const normalized = normalizeHoursInput(hours);
        if (!normalized || normalized === 'Closed') return;
        const range = normalized.split('-');
        if (range.length !== 2) return;
        schemaHours.push({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: dayMap[day],
            opens: range[0],
            closes: range[1]
        });
    });

    return JSON.stringify(schemaHours);
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function generateSocialMediaSection(listing, options = {}) {
    const socialMedia = listing.social_media || {};
    const hasSocial = Object.values(socialMedia).some(v => v);
    
    if (!hasSocial) return '';
    
    let socialIcons = '';
    
    const socialSVGs = {
        facebook: '<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
        instagram: '<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>',
        twitter: '<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
        youtube: '<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
        tiktok: '<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
        linkedin: '<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
        other: '<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"/><path d="M5 5h6v2H7v10h10v-4h2v6H5z"/></svg>'
    };
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    if (socialMedia.facebook) {
        socialIcons += `<a href="https://facebook.com/${socialMedia.facebook}" target="_blank" rel="noopener noreferrer" class="social-icon social-facebook" title="Facebook" onclick="trackClick('social', 'facebook')">${socialSVGs.facebook}</a>`;
    }
    if (socialMedia.instagram) {
        socialIcons += `<a href="https://instagram.com/${socialMedia.instagram}" target="_blank" rel="noopener noreferrer" class="social-icon social-instagram" title="Instagram" onclick="trackClick('social', 'instagram')">${socialSVGs.instagram}</a>`;
    }
    if (socialMedia.twitter) {
        socialIcons += `<a href="https://twitter.com/${socialMedia.twitter}" target="_blank" rel="noopener noreferrer" class="social-icon social-twitter" title="Twitter/X" onclick="trackClick('social', 'twitter')">${socialSVGs.twitter}</a>`;
    }
    if (socialMedia.youtube) {
        socialIcons += `<a href="https://youtube.com/@${socialMedia.youtube}" target="_blank" rel="noopener noreferrer" class="social-icon social-youtube" title="YouTube" onclick="trackClick('social', 'youtube')">${socialSVGs.youtube}</a>`;
    }
    if (socialMedia.tiktok) {
        socialIcons += `<a href="https://tiktok.com/@${socialMedia.tiktok}" target="_blank" rel="noopener noreferrer" class="social-icon social-tiktok" title="TikTok" onclick="trackClick('social', 'tiktok')">${socialSVGs.tiktok}</a>`;
    }
    if (socialMedia.linkedin) {
        socialIcons += `<a href="${socialMedia.linkedin}" target="_blank" rel="noopener noreferrer" class="social-icon social-linkedin" title="LinkedIn" onclick="trackClick('social', 'linkedin')">${socialSVGs.linkedin}</a>`;
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    // Other social links (1-3)
    if (socialMedia.other1 && socialMedia.other1_name) {
        socialIcons += `<a href="${socialMedia.other1}" target="_blank" rel="noopener noreferrer" class="social-icon social-other" title="${escapeHtml(socialMedia.other1_name)}" onclick="trackClick('social', 'other1')">${socialSVGs.other}</a>`;
    }
    if (socialMedia.other2 && socialMedia.other2_name) {
        socialIcons += `<a href="${socialMedia.other2}" target="_blank" rel="noopener noreferrer" class="social-icon social-other" title="${escapeHtml(socialMedia.other2_name)}" onclick="trackClick('social', 'other2')">${socialSVGs.other}</a>`;
    }
    if (socialMedia.other3 && socialMedia.other3_name) {
        socialIcons += `<a href="${socialMedia.other3}" target="_blank" rel="noopener noreferrer" class="social-icon social-other" title="${escapeHtml(socialMedia.other3_name)}" onclick="trackClick('social', 'other3')">${socialSVGs.other}</a>`;
    }
    
    if (!socialIcons) return '';
    
    const shouldAddBreak = Boolean(options.hasMapSection) && !(options.hasOwnerInfoSection || options.hasAdditionalInfoSection);

    return `
        <div>
            ${shouldAddBreak ? '<br>' : ''}
            <h2 class="text-xl font-bold text-gray-900 mb-3">Social Media</h2>
            <div class="flex flex-wrap gap-2">
                ${socialIcons}
            </div>
        </div>
    `;
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function generateReviewSection(listing) {
    const reviews = listing.reviews || {};
    const hasReviews = Object.values(reviews).some(v => v);
    
    if (!hasReviews) return '';
    
    let reviewLinks = '';
    
    const googleSVG = '<svg width="22" height="22" viewBox="0 0 256 262" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid"><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/></svg>';
    
    const yelpSVG = '<img src="https://static.thegreekdirectory.org/img/ylogo.svg" alt="Yelp" width="22" height="22" style="width:22px;height:22px;">';
    
    const tripadvisorSVG = '<img src="https://static.thegreekdirectory.org/img/talogo.svg" alt="TripAdvisor" width="22" height="22" style="width:22px;height:22px;">';
    
    const starSVG = '<svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    if (reviews.google) {
        reviewLinks += `<a href="${reviews.google}" target="_blank" rel="noopener noreferrer" class="social-icon social-google" title="Google Reviews" onclick="trackClick('review', 'google')">${googleSVG}</a>`;
    }
    if (reviews.yelp) {
        reviewLinks += `<a href="${reviews.yelp}" target="_blank" rel="noopener noreferrer" class="social-icon social-yelp" title="Yelp" onclick="trackClick('review', 'yelp')">${yelpSVG}</a>`;
    }
    if (reviews.tripadvisor) {
        reviewLinks += `<a href="${reviews.tripadvisor}" target="_blank" rel="noopener noreferrer" class="social-icon social-tripadvisor" title="TripAdvisor" onclick="trackClick('review', 'tripadvisor')">${tripadvisorSVG}</a>`;
    }
    
    // Other review links (1-3)
    if (reviews.other1 && reviews.other1_name) {
        reviewLinks += `<a href="${reviews.other1}" target="_blank" rel="noopener noreferrer" class="social-icon social-other" title="${escapeHtml(reviews.other1_name)}" onclick="trackClick('review', 'other1')">${starSVG}</a>`;
    }
    if (reviews.other2 && reviews.other2_name) {
        reviewLinks += `<a href="${reviews.other2}" target="_blank" rel="noopener noreferrer" class="social-icon social-other" title="${escapeHtml(reviews.other2_name)}" onclick="trackClick('review', 'other2')">${starSVG}</a>`;
    }
    if (reviews.other3 && reviews.other3_name) {
        reviewLinks += `<a href="${reviews.other3}" target="_blank" rel="noopener noreferrer" class="social-icon social-other" title="${escapeHtml(reviews.other3_name)}" onclick="trackClick('review', 'other3')">${starSVG}</a>`;
    }
    
    if (!reviewLinks) return '';
    
    return `
        <div>
            <br>
            <h2 class="text-xl font-bold text-gray-900 mb-3">Reviews</h2>
            <div class="flex flex-wrap gap-2">
                ${reviewLinks}
            </div>
        </div>
    `;
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 10
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 10
// Template Replacements Generation - Part 1
// ============================================

function getBusinessSchemaType(listing) {
    const category = String(listing.category || '').toLowerCase();
    const subcategories = Array.isArray(listing.subcategories)
        ? listing.subcategories.map((sub) => String(sub || '').toLowerCase())
        : [];
    const primarySubcategory = String(listing.primary_subcategory || '').toLowerCase();
    const terms = [category, primarySubcategory, ...subcategories].filter(Boolean).join(' ');

    const keywordTypeMap = [
        { keywords: ['restaurant', 'diner', 'taverna'], type: 'Restaurant' },
        { keywords: ['church'], type: 'Church' },
        { keywords: ['bakery'], type: 'Bakery' },
        { keywords: ['travel', 'tour'], type: 'TravelAgency' },
        { keywords: ['bar', 'pub', 'lounge'], type: 'BarOrPub' },
        { keywords: ['hair', 'salon', 'beauty', 'spa'], type: 'HairSalon' },
        { keywords: ['dentist', 'dental'], type: 'Dentist' },
        { keywords: ['attorney', 'law', 'legal'], type: 'Attorney' },
        { keywords: ['accounting', 'accountant', 'tax'], type: 'AccountingService' },
        { keywords: ['auto', 'automotive', 'car repair', 'mechanic'], type: 'AutoRepair' }
    ];

    const match = keywordTypeMap.find((entry) => entry.keywords.some((keyword) => terms.includes(keyword)));
    return match ? match.type : 'LocalBusiness';
}

function getSameAsLinks(listing) {
    const social = listing.social_media || {};
    const reviews = listing.reviews || {};
    const links = [];

    const facebook = String(social.facebook || '').trim();
    if (facebook) links.push(`https://facebook.com/${facebook}`);

    const instagram = String(social.instagram || '').trim();
    if (instagram) links.push(`https://instagram.com/${instagram}`);

    const twitter = String(social.twitter || '').trim();
    if (twitter) links.push(`https://twitter.com/${twitter}`);

    if (social.linkedin) links.push(String(social.linkedin).trim());
    if (social.other1) links.push(String(social.other1).trim());
    if (social.other2) links.push(String(social.other2).trim());
    if (social.other3) links.push(String(social.other3).trim());

    if (reviews.yelp) links.push(String(reviews.yelp).trim());

    return [...new Set(links.filter(Boolean))];
}


function isValidSchemaOrgType(type) {
    return typeof type === 'string' && /^[A-Z][A-Za-z0-9]*$/.test(type);
}

function getListingSchemaTypes(listing) {
    const categoryMap = CATEGORY_SCHEMA_TYPE_MAPS[listing.category] || {};
    const mappedTypes = categoryMap && listing.primary_subcategory
        ? categoryMap[listing.primary_subcategory]
        : null;

    if (Array.isArray(mappedTypes) && mappedTypes.length > 0) {
        const validTypes = mappedTypes.filter(isValidSchemaOrgType);
        if (validTypes.length > 0) return [...new Set(validTypes)];
    }

    return ['LocalBusiness'];
}

function detectImageMimeType(url = '') {
    const cleanUrl = String(url || '').split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.png')) return 'image/png';
    if (cleanUrl.endsWith('.webp')) return 'image/webp';
    if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg';
    return 'image/jpeg';
}

function generateTemplateReplacements(listing) {
    const pricingToSymbols = (value) => {
        if (value === null || value === undefined || value === '') return '';
        const symbolMap = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };
        const numeric = parseInt(value, 10);
        if (!Number.isNaN(numeric) && symbolMap[numeric]) {
            return symbolMap[numeric];
        }
        const valueStr = String(value).trim();
        if (/^\${1,4}$/.test(valueStr)) {
            return valueStr;
        }
        return '';
    };

    const decodedBusinessName = decodeEscapedText(listing.business_name || '');
    const decodedTagline = decodeEscapedText(listing.tagline || '');
    const decodedDescription = decodeEscapedText(listing.description || '');
    const decodedCity = decodeEscapedText(listing.city || '');
    const decodedState = decodeEscapedText(listing.state || '');
    const decodedAddress = decodeEscapedText(listing.address || '');
    const categorySlug = listing.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const listingUrl = `https://thegreekdirectory.org/listing/${listing.slug}`;
    const categoryUrl = `https://thegreekdirectory.org/${categorySlug}`;
    
    const cityState = decodedCity && decodedState ? ` in ${decodedCity}, ${decodedState}` : '';
    const inCity = decodedCity ? ` in ${decodedCity}` : '';
    const schemaTypes = getListingSchemaTypes(listing);
    const hasCoordinates = listing.coordinates && listing.coordinates.lat && listing.coordinates.lng;
    const latitude = hasCoordinates ? String(listing.coordinates.lat) : '';
    const longitude = hasCoordinates ? String(listing.coordinates.lng) : '';
    const hasMapUrl = hasCoordinates ? `https://maps.google.com/?q=${latitude},${longitude}` : '';
    const sameAsSchema = JSON.stringify(getSameAsLinks(listing));
    
    const photos = (listing.photos || []).map((photo) => normalizeImageCdnUrl(photo)).filter(Boolean);
    listing.logo = normalizeImageCdnUrl(listing.logo || '');
    const photoList = photos.length > 0 ? photos : (listing.logo ? [listing.logo] : []);
    const totalPhotos = photoList.length || 1;
    
    // Generate photo slides
    let photosSlides = '';
    if (photoList.length > 0) {
        photosSlides = photoList.map((photo, index) => 
            `<div class="carousel-slide" style="background: url('${photo}') center/cover;" role="img" aria-label="${escapeHtml(decodedBusinessName)} in ${escapeHtml(decodedCity)}, ${escapeHtml(decodedState)}"></div>`
        ).join('');
    } else if (listing.logo) {
        photosSlides = `<div class="carousel-slide" style="background: url('${listing.logo}') center/cover;"></div>`;
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    // Generate carousel controls
    let carouselControls = '';
    if (photoList.length > 1) {
        const dots = photoList.map((_, index) => 
            `<span class="carousel-dot ${index === 0 ? 'active' : ''}" onclick="goToSlide(${index})"></span>`
        ).join('');
        carouselControls = `
            <button class="carousel-nav carousel-prev" onclick="prevSlide()">❮</button>
            <button class="carousel-nav carousel-next" onclick="nextSlide()">❯</button>
            <div class="carousel-dots">${dots}</div>
        `;
    }
    
    // Generate subcategory tags
    let subcategoriesTags = '';
    if (listing.subcategories && listing.subcategories.length > 0) {
        const uniqueSubs = [...new Set(listing.subcategories.filter(Boolean))];
        const primary = listing.primary_subcategory && uniqueSubs.includes(listing.primary_subcategory)
            ? listing.primary_subcategory
            : null;
        const orderedSubs = [
            ...(primary ? [primary] : []),
            ...uniqueSubs.filter((s) => s !== primary).sort((a, b) => a.localeCompare(b))
        ];
        subcategoriesTags = orderedSubs.map(sub => 
            `<span class="subcategory-tag">${escapeHtml(sub)}</span>`
        ).join('');
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    // Generate status badges
    const owner = listing.owner && listing.owner.length > 0 ? listing.owner[0] : null;
    const isFeatured = listing.tier === 'FEATURED';
    const isPremium = listing.tier === 'PREMIUM';
    const isClaimed = listing.is_claimed || (owner && owner.owner_user_id) || listing.show_claim_button === false;
    
    let statusBadges = '';
    const hasBusinessHours = listing.hours && Object.values(listing.hours).some(value => typeof value === 'string' && value.trim().length > 0);
    if (hasBusinessHours) {
        statusBadges += '<span class="badge badge-closed" id="openClosedBadge">CLOSED</span>';
    }

    if (isPremium) {
        statusBadges += '<span class="badge badge-premium">Premium</span>';
    } else if (isFeatured) {
        statusBadges += '<span class="badge badge-featured">Featured</span>';
    }

    if (listing.coming_soon === true) {
        statusBadges += '<span class="badge badge-coming-soon">COMING SOON!</span>';
    }

    let pricingBadge = '';
    const pricingSymbols = pricingToSymbols(listing.pricing);
    if (pricingSymbols) {
        pricingBadge = `<span class="pricing-chip">${pricingSymbols}</span>`;
    }
    
    const taglineDisplay = decodedTagline ? `<h2 class="text-gray-600 italic text-xl font-semibold mb-2">${escapeHtml(decodedTagline)}</h2>` : '';

    let claimedCheckmark = '';
    if (isFeatured || isClaimed) {
        claimedCheckmark = '<button type="button" id="verifiedCheckmarkButton" class="verified-checkmark-btn" aria-label="Listing verification info">' +
            '<svg style="width:20px;height:20px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="12" cy="12" r="12" fill="#045093"></circle>' +
            '<path d="M7 12.5l3.5 3.5L17 9" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>' +
            '</svg>' +
            '<span class="verified-checkmark-tooltip">This checkmark means that this listing has been claimed by its owner(s).</span>' +
            '</button>';
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    // Address section - only show if listing has any address value
    let addressSection = '';
    const hasStreetAddress = typeof listing.address === 'string' && listing.address.trim().length > 0;
    
    if (hasStreetAddress || (listing.city && listing.state)) {
        const addressParts = [];
        if (hasStreetAddress) {
            addressParts.push(escapeHtml(decodedAddress));
        }
        if (listing.city && listing.state) {
            addressParts.push(`${escapeHtml(decodedCity)}, ${escapeHtml(decodedState)}${listing.zip_code ? ' ' + escapeHtml(listing.zip_code) : ''}`);
        }
        
        let addressLinkIfItExists = '';
        let endOfAHTMLLink = '';
        
        if (listing.address) {
            addressLinkIfItExists = `<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([listing.address, listing.city, listing.state, listing.zip_code].filter(Boolean).join(', '))}" target="_blank" rel="noopener noreferrer">`;
            endOfAHTMLLink = `</a>`;
        }
        
        if (addressParts.length > 0) {
            addressSection = `
                <div class="flex items-start gap-2">
                    <svg class="w-5 h-5 text-gray-600 mt-0.5" fill="none" stroke="#045093" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    ${addressLinkIfItExists}${addressParts.join(', ')}${endOfAHTMLLink}
                </div>
            `;
        }
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    let phoneSection = '';
    if (listing.phone) {
        phoneSection = `
            <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="#045093" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                </svg>
                <a href="tel:${listing.phone}">${formatPhoneNumber(listing.phone)}</a>
            </div>
        `;
    }
    
    let emailSection = '';
    if (listing.email) {
        emailSection = `
            <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="#045093" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                <a href="mailto:${listing.email}" target="_blank">${escapeHtml(listing.email)}</a>
            </div>
        `;
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    let websiteSection = '';
    if (listing.website) {
        const displayUrl = decodeEscapedText(listing.website).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        websiteSection = `
            <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="#045093" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                </svg>
                <a href="${listing.website}" target="_blank">${escapeHtml(displayUrl)}</a>
            </div>
        `;
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    let hoursSection = '';
    if (listing.hours && Object.keys(listing.hours).some(day => listing.hours[day])) {
        const hoursUpdatedAtUtc = formatUtcTimestamp(listing.hours_updated_at || listing.updated_at || listing.modified_at);
        const hoursUpdatedBy = getHoursUpdatedByLabel(listing);
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        const hoursRows = dayKeys.map((key, index) => {
            const hours = listing.hours[key] || 'Closed';
            return `<div class="flex justify-between text-sm" data-hours-day="${key}"><span class="font-medium hours-day-label">${days[index]}:</span><span class="hours-day-value">${escapeHtml(toDisplayHourLabel(hours))}</span></div>`;
        }).join('');
        
        hoursSection = `
            <div>
                <h3 class="font-semibold text-gray-900 mb-2">${escapeHtml(listing.hours_label_custom || 'Hours')}
                    <span class="hours-tooltip-wrap" id="hoursTooltipButton" aria-label="Hours update information">
                        <svg class="hours-tooltip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" stroke-width="2"></circle><path d="M12 10v6" stroke-width="2" stroke-linecap="round"></path><circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none"></circle></svg>
                        <span class="hours-tooltip">Last updated at ${escapeHtml(hoursUpdatedAtUtc)} UTC by ${escapeHtml(hoursUpdatedBy)}.</span>
                    </span>
                </h3>
                <div class="space-y-1">${hoursRows}</div>
                <div id="openStatusText" class="mt-2 text-sm"></div>
                <div class="hours-disclaimer">${escapeHtml(listing.hours_disclaimer_custom || 'Hours may vary — call to confirm.')}</div>
            </div>
        `;
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.

    let additionalInfoSection = '';
    if (Array.isArray(listing.additional_info) && listing.additional_info.length > 0) {
        const infoRows = listing.additional_info
            .filter(info => info && info.label && info.value)
            .map(info => `
                <div class="additional-info-row text-sm">
                    <span class="font-medium text-gray-900">${escapeHtml(decodeEscapedText(info.label))}</span>
                    <span class="text-gray-700">${escapeHtml(decodeEscapedText(info.value))}</span>
                </div>
            `).join('');
        
        if (infoRows) {
            additionalInfoSection = `
                <div class="mb-6">
                    <br>
                    <h3 class="font-semibold text-gray-900 mb-2">Additional Information</h3>
                    <div class="additional-info-table">${infoRows}</div>
                </div>
            `;
        }
    }
    
    let phoneButton = '';
    let phoneButtonMobile = '';
    if (listing.phone) {
        phoneButton = `
            <a href="tel:${listing.phone}" class="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium hover-bounce">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                </svg>
                Call
            </a>
        `;
        phoneButtonMobile = `<a href="tel:${listing.phone}" class="mobile-cta-button hover-bounce" style="background:#16a34a;"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg><span>Call</span></a>`;
    }

    let emailButton = '';
    let emailButtonMobile = '';
    if (listing.email) {
        emailButton = `
            <a href="mailto:${listing.email}" class="flex items-center justify-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-700 font-medium hover-bounce" target="_blank">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
                Email
            </a>
        `;
        emailButtonMobile = `<a href="mailto:${listing.email}" class="mobile-cta-button hover-bounce" style="background:#6b7280;" target="_blank"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg><span>Email</span></a>`;
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    let websiteButton = '';
    let websiteButtonMobile = '';
    if (listing.website) {
        websiteButton = `
            <a href="${listing.website}" target="_blank" class="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium hover-bounce">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                </svg>
                Website
            </a>
        `;
        websiteButtonMobile = `<a href="${listing.website}" target="_blank" class="mobile-cta-button hover-bounce" style="background:#2563eb;"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg><span>Website</span></a>`;
    }
    
    // Only show directions if listing has an address string
    let directionsButton = '';
    let directionsButtonMobile = '';
    if (hasStreetAddress && listing.city) {
        const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([listing.address, listing.city, listing.state, listing.zip_code].filter(Boolean).join(', '))}`;
        directionsButton = `
            <a href="${directionsHref}" class="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium hover-bounce" onclick="openDirections(event);">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                </svg>
                Directions
            </a>
        `;
        directionsButtonMobile = `<a href="${directionsHref}" class="mobile-cta-button hover-bounce" style="background:#111827;" onclick="openDirections(event);"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg><span>Directions</span></a>`;
    }

    const maxCtaButtons = 1;
    let customCtaButtons = '';
    let customCtaButtonsMobile = '';
    if (maxCtaButtons > 0 && Array.isArray(listing.custom_ctas)) {
        customCtaButtons = listing.custom_ctas
            .filter(cta => cta && cta.name && cta.url)
            .slice(0, maxCtaButtons)
            .map((cta) => {
                const label = String(cta.name).trim();
                const color = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(cta.color || '') ? cta.color : '#045093';
                const icon = getCustomCtaIconSvg(cta.icon, 'w-5 h-5') || '';
                return `
                    <a href="${escapeHtml(String(cta.url).trim())}" target="_blank" rel="noopener noreferrer"
                        class="flex items-center justify-center gap-2 px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 hover-bounce"
                        style="background-color:${color};" data-cta-name="${escapeHtml(label)}">
                        ${icon}
                        <span>${escapeHtml(label)}</span>
                    </a>
                `;
            }).join('');

        customCtaButtonsMobile = listing.custom_ctas
            .filter(cta => cta && cta.name && cta.url)
            .map((cta) => {
                const label = String(cta.name).trim();
                const color = /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(cta.color || '') ? cta.color : '#045093';
                const icon = getCustomCtaIconSvg(cta.icon, 'w-4 h-4') || '';
                return `<a href="${escapeHtml(String(cta.url).trim())}" target="_blank" rel="noopener noreferrer" class="mobile-cta-button hover-bounce" style="background:${color};" data-cta-name="${escapeHtml(label)}">${icon}<span>${escapeHtml(label)}</span></a>`;
            }).join('');
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    return {
        'BUSINESS_NAME': escapeHtml(decodedBusinessName),
        'BUSINESS_NAME_JS': escapeJsonForTemplate(decodedBusinessName),
        'BUSINESS_NAME_ENCODED': encodeURIComponent(decodedBusinessName),
        'CITY_STATE': cityState,
        'IN_CITY': inCity,
        'TAGLINE': escapeHtml(normalizeTagline(decodedTagline)),
        'TAGLINE_JS': escapeJsonForTemplate(decodedTagline),
        'DESCRIPTION': sanitizeListingDescription(decodedDescription),
        'DESCRIPTION_JS': escapeJsonForTemplate(decodedDescription),
        'CATEGORY': escapeHtml(listing.category),
        'PRIMARY_SUBCATEGORY': escapeHtml(listing.primary_subcategory || 'business'),
        'CATEGORY_URL': categoryUrl,
        'LISTING_URL': listingUrl,
        'SHORTLINK_URL': listing.shortlink_url || listingUrl,
        'LISTING_ID': listing.id,
        'SLUG': listing.slug || '',
        'LOGO': listing.logo || '',
        'PRIMARY_IMAGE': photoList[0] || listing.logo || '',
        'LOGO_ALT': `${escapeHtml(decodedBusinessName)} in ${escapeHtml(decodedCity)}, ${escapeHtml(decodedState)}`,
        'OG_IMAGE_TYPE': detectImageMimeType(photoList[0] || listing.logo || ''),
        'ADDRESS': escapeHtml(decodedAddress),
        'ADDRESS_JS': escapeJsonForTemplate(decodedAddress),
        'CITY': escapeHtml(decodedCity),
        'CITY_JS': escapeJsonForTemplate(decodedCity),
        'STATE': escapeHtml(decodedState),
        'STATE_JS': escapeJsonForTemplate(decodedState),
        'LAT': latitude,
        'LNG': longitude,
        'HAS_MAP_URL': hasMapUrl,
        'SCHEMA_TYPES_JSON': JSON.stringify(schemaTypes),
        'SAME_AS_SCHEMA': sameAsSchema,
        'ZIP_CODE': escapeHtml(listing.zip_code || ''),
        'IN_CITY_STATE': (decodedCity && decodedState) 
            ? ` in ${escapeHtml(decodedCity)}, ${escapeHtml(decodedState)}` 
            : '',
        'COUNTRY': 'US',
        'PHONE': listing.phone || '',
        'PHONE_SCHEMA': listing.phone || '',
        'PRICE_RANGE': pricingSymbols || '',
        'META_DESCRIPTION': escapeHtml(buildMetaDescription(decodedTagline, decodedCity, decodedState)),
        'EMAIL': listing.email || '',
        'EMAIL_JS': escapeJsonForTemplate(decodeEscapedText(listing.email || '')),
        'WEBSITE': listing.website || '',
        'WEBSITE_JS': escapeJsonForTemplate(decodeEscapedText(listing.website || '')),
        'WEBSITE_DOMAIN': listing.website ? new URL(listing.website).hostname : '',
        'TOTAL_PHOTOS': totalPhotos,
        'PHOTOS_SLIDES': photosSlides,
        'PHOTOS_ARRAY': photoList.map(photo => `'${photo.replace(/'/g, "\\'")}'`).join(', '),
        'PHOTOS_JSON': JSON.stringify(photoList),
        'CAROUSEL_CONTROLS': carouselControls,
        'SUBCATEGORIES_TAGS': subcategoriesTags,
        'STATUS_BADGES': statusBadges,
        'TAGLINE_DISPLAY': taglineDisplay,
        'CLAIMED_CHECKMARK': claimedCheckmark,
        'PRICING_BADGE': pricingBadge,
        'ADDRESS_SECTION': addressSection,
        'PHONE_SECTION': phoneSection,
        'EMAIL_SECTION': emailSection,
        'WEBSITE_SECTION': websiteSection,
        'HOURS_SECTION': hoursSection,
        'ADDITIONAL_INFO_SECTION': additionalInfoSection,
        'PHONE_BUTTON': phoneButton,
        'EMAIL_BUTTON': emailButton,
        'WEBSITE_BUTTON': websiteButton,
        'DIRECTIONS_BUTTON': directionsButton,
        'CUSTOM_CTA_BUTTONS': customCtaButtons,
        'PHONE_BUTTON_MOBILE': phoneButtonMobile,
        'EMAIL_BUTTON_MOBILE': emailButtonMobile,
        'WEBSITE_BUTTON_MOBILE': websiteButtonMobile,
        'DIRECTIONS_BUTTON_MOBILE': directionsButtonMobile,
        'CUSTOM_CTA_BUTTONS_MOBILE': customCtaButtonsMobile
    };
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 11
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 11
// Template Replacements Generation - Part 2 & Related Listings
// ============================================

function generateTemplateReplacementsPart2(listing) {
    let ownerInfoSection = '';
    const owners = Array.isArray(listing.owner) ? listing.owner : [];
    const ownerCards = owners.map((owner) => {
        let ownerDetails = '';
        if (owner.name_title_visible !== false && owner.full_name) {
            const safeFullName = decodeEscapedText(owner.full_name);
            const safeTitle = decodeEscapedText(owner.title || '');
            const ownerLine = safeTitle ? `${safeTitle}: ${safeFullName}` : `Owner: ${safeFullName}`;
            ownerDetails += safeTitle
                ? `<p><strong>${escapeHtml(safeTitle)}:</strong> ${escapeHtml(safeFullName)}</p>`
                : `<p><strong>Owner:</strong> ${escapeHtml(safeFullName)}</p>`;
        }
        if (owner.from_greece){
          const ownerLowerC = owner.from_greece.toLowerCase();
          if (ownerLowerC.includes("cyprus") || ownerLowerC.includes("pontus") || ownerLowerC.includes("greece") || ownerLowerC.includes("constantinople")){
            ownerDetails += `<p><strong>From:</strong> ${escapeHtml(decodeEscapedText(owner.from_greece))}</p>`;
          }
          else {
          	ownerDetails += `<p><strong>From:</strong> ${escapeHtml(decodeEscapedText(owner.from_greece))}, Greece</p>`;
          }
        }
        if (owner.email_visible && owner.owner_email) ownerDetails += `<p><strong>Email:</strong> <a href="mailto:${owner.owner_email}" class="text-blue-600 hover:underline" target="_blank">${escapeHtml(owner.owner_email)}</a></p>`;
        if (owner.phone_visible && owner.owner_phone) ownerDetails += `<p><strong>Phone:</strong> <a href="tel:${owner.owner_phone}" class="text-blue-600 hover:underline">${formatPhoneNumber(owner.owner_phone)}</a></p>`;
        return ownerDetails ? `<div class="mb-4">${ownerDetails}</div>` : '';
    }).filter(Boolean).join('');
    if (ownerCards) {
        ownerInfoSection = `
            <div class="owner-info-section">
                <h3 class="text-lg font-bold text-gray-900 mb-3">Leadership</h3>
                ${ownerCards}
            </div>
        `;
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    const hasOwnerInfoSection = Boolean(ownerCards);
    const hasAdditionalInfoSection = Array.isArray(listing.additional_info)
        && listing.additional_info.some(info => info && info.label && info.value);
    const hasStreetAddress = typeof listing.address === 'string' && listing.address.trim().length > 0;

    const socialMediaSection = generateSocialMediaSection(listing, {
        hasOwnerInfoSection,
        hasAdditionalInfoSection,
        hasMapSection: hasStreetAddress
    });
    const reviewSection = generateReviewSection(listing);
    const socialBreak = '';
    const reviewBreak = '';
    
    // Only show map if listing has an address string
    let mapSection = '';
    if (hasStreetAddress) {
        mapSection = `
            <div id="locationSection" class="location-section">
                <h2 class="text-xl font-bold text-gray-900 mb-3">Location</h2>
                <div id="listingMap"></div>
                <div id="mapFallback" class="map-fallback" role="status" aria-live="polite"></div>
            </div>
        `;
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.

    // ── Parent Listing section ────────────────────────────────────────────────
    let parentListingSection = '';
    if (listing.parent_listing) {
        const parentTitle = escapeHtml(listing.parent_listing_title_custom || 'Parent Listing');
        parentListingSection = `
            <div class="mt-8" id="parentListingSection">
                <h2 class="text-xl font-bold text-gray-900 mb-4">${parentTitle}</h2>
                <div id="parentListingContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p class="text-gray-600 col-span-full">Loading parent listing…</p>
                </div>
            </div>
            <script>
            (async function() {
                try {
                    const parentId = '${escapeJsonForTemplate(listing.parent_listing)}';
                    const response = await fetch(
                        'https://luetekzqrrgdxtopzvqw.supabase.co/rest/v1/listings?id=eq.' + parentId + '&visible=eq.true&select=*',
                        { headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZXRla3pxcnJnZHh0b3B6dnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc2NDcsImV4cCI6MjA4MzkyMzY0N30.TIrNG8VGumEJc_9JvNHW-Q-UWfUGpPxR0v8POjWZJYg' } }
                    );
                    if (!response.ok) throw new Error('Failed to load parent listing');
                    const data = await response.json();
                    const container = document.getElementById('parentListingContainer');
                    if (!data.length) { container.innerHTML = '<p class="text-gray-600 col-span-full">Parent listing not available.</p>'; return; }
                    const l = data[0];
                    const listingUrl = '/listing/' + l.slug;
                    const location = (l.city && l.state) ? l.city + ', ' + l.state : (l.city || l.state || '');
                    const formatPhone = (phone) => {
                        if (!phone) return '';
                        const digits = String(phone).replace(/\\D/g, '');
                        if (digits.length === 11 && digits.startsWith('1')) return '(' + digits.slice(1,4) + ') ' + digits.slice(4,7) + '-' + digits.slice(7,11);
                        if (digits.length === 10) return '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6,10);
                        return phone;
                    };
                    const getHoursBadge = (hours) => {
                        if (!hours || typeof hours !== 'object') return '';
                        const dayKeys = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
                        const now = new Date();
                        const day = dayKeys[now.getDay()];
                        const todayHours = (hours[day] || '').toLowerCase();
                        if (!todayHours) return '';
                        if (todayHours.includes('closed')) return '<span class="badge badge-closed">CLOSED</span>';
                        return '<span class="badge badge-open">OPEN</span>';
                    };
                    const getTierBadge = (tier) => {
                        if (tier === 'PREMIUM') return '<span class="badge badge-premium">Premium</span>';
                        if (tier === 'FEATURED') return '<span class="badge badge-featured">Featured</span>';
                        return '';
                    };
                    container.innerHTML = \`<a href="\${listingUrl}" class="related-listing-card block bg-white p-3">
                        <div class="flex items-start gap-4">
                            \${l.logo ? \`<img src="\${l.logo}" alt="\${l.business_name}" class="w-14 h-14 rounded-lg object-cover flex-shrink-0">\` : ''}
                            <div class="flex-1 min-w-0 pl-3">
                                <div class="flex flex-wrap gap-1 mb-1">\${getHoursBadge(l.hours)}\${getTierBadge(l.tier)}</div>
                                <h3 class="font-bold text-gray-900 mb-1 leading-snug">\${l.business_name}</h3>
                                \${location ? \`<p class="text-sm text-gray-600 mb-0.5" style="display:flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#045093" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg><span>\${location}</span></p>\` : ''}
                                \${l.phone ? \`<p class="text-sm text-gray-600" style="display:flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#045093" stroke-width="2"><path d="M3 5a2 2 0 012-2h3.3a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21L8 10.5a11 11 0 005.5 5.5l1.1-2.25a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.7.95V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z"/></svg><span>\${formatPhone(l.phone)}</span></p>\` : ''}
                            </div>
                        </div>
                    </a>\`;
                } catch (error) {
                    document.getElementById('parentListingContainer').innerHTML = '<p class="text-gray-600 col-span-full">Failed to load parent listing.</p>';
                }
            })();
            <\/script>
        `;
    }

    // ── Child Listings section ────────────────────────────────────────────────
    let childListingsSection = '';
    {
        // We always render the shell; the script decides at runtime whether any children exist.
        const childTitle = escapeHtml(listing.child_listings_custom_title || 'Child Listings');
        const listingId  = escapeJsonForTemplate(String(listing.id));
        childListingsSection = `
            <div class="mt-8" id="childListingsSection" style="display:none;">
                <h2 class="text-xl font-bold text-gray-900 mb-4">${childTitle}</h2>
                <div id="childListingsContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
            </div>
            <script>
            (async function() {
                try {
                    const currentId = '${listingId}';
                    const response = await fetch(
                        'https://luetekzqrrgdxtopzvqw.supabase.co/rest/v1/listings?parent_listing=eq.' + currentId + '&visible=eq.true&select=*',
                        { headers: { 'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZXRla3pxcnJnZHh0b3B6dnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc2NDcsImV4cCI6MjA4MzkyMzY0N30.TIrNG8VGumEJc_9JvNHW-Q-UWfUGpPxR0v8POjWZJYg' } }
                    );
                    if (!response.ok) throw new Error('Failed to load child listings');
                    const data = await response.json();
                    if (!data.length) return; // hide section if no children
                    document.getElementById('childListingsSection').style.display = '';
                    const container = document.getElementById('childListingsContainer');
                    const formatPhone = (phone) => {
                        if (!phone) return '';
                        const digits = String(phone).replace(/\\D/g, '');
                        if (digits.length === 11 && digits.startsWith('1')) return '(' + digits.slice(1,4) + ') ' + digits.slice(4,7) + '-' + digits.slice(7,11);
                        if (digits.length === 10) return '(' + digits.slice(0,3) + ') ' + digits.slice(3,6) + '-' + digits.slice(6,10);
                        return phone;
                    };
                    const getHoursBadge = (hours) => {
                        if (!hours || typeof hours !== 'object') return '';
                        const dayKeys = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
                        const now = new Date();
                        const day = dayKeys[now.getDay()];
                        const todayHours = (hours[day] || '').toLowerCase();
                        if (!todayHours) return '';
                        if (todayHours.includes('closed')) return '<span class="badge badge-closed">CLOSED</span>';
                        return '<span class="badge badge-open">OPEN</span>';
                    };
                    const getTierBadge = (tier) => {
                        if (tier === 'PREMIUM') return '<span class="badge badge-premium">Premium</span>';
                        if (tier === 'FEATURED') return '<span class="badge badge-featured">Featured</span>';
                        return '';
                    };
                    container.innerHTML = data.map(l => {
                        const listingUrl = '/listing/' + l.slug;
                        const location = (l.city && l.state) ? l.city + ', ' + l.state : (l.city || l.state || '');
                        return \`<a href="\${listingUrl}" class="related-listing-card block bg-white p-3">
                            <div class="flex items-start gap-4">
                                \${l.logo ? \`<img src="\${l.logo}" alt="\${l.business_name}" class="w-14 h-14 rounded-lg object-cover flex-shrink-0">\` : ''}
                                <div class="flex-1 min-w-0 pl-3">
                                    <div class="flex flex-wrap gap-1 mb-1">\${getHoursBadge(l.hours)}\${getTierBadge(l.tier)}</div>
                                    <h3 class="font-bold text-gray-900 mb-1 leading-snug">\${l.business_name}</h3>
                                    \${location ? \`<p class="text-sm text-gray-600 mb-0.5" style="display:flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#045093" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg><span>\${location}</span></p>\` : ''}
                                    \${l.phone ? \`<p class="text-sm text-gray-600" style="display:flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#045093" stroke-width="2"><path d="M3 5a2 2 0 012-2h3.3a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21L8 10.5a11 11 0 005.5 5.5l1.1-2.25a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.7.95V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z"/></svg><span>\${formatPhone(l.phone)}</span></p>\` : ''}
                                </div>
                            </div>
                        </a>\`;
                    }).join('');
                } catch (error) {
                    // silently fail — section stays hidden
                }
            })();
            <\/script>
        `;
    }
    
    // Generate Related Listings section for chain businesses
    let relatedListingsSection = '';
    if (listing.is_chain && listing.chain_id) {
        const moreListingsTitle = escapeHtml(listing.more_listings_title_custom || 'More Locations');
        relatedListingsSection = `
            <div class="mt-8">
                <h2 class="text-xl font-bold text-gray-900 mb-4">${moreListingsTitle}</h2>
                <div id="relatedListingsContainer" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p class="text-gray-600 col-span-full">Loading related locations...</p>
                </div>
            </div>
            <script>
            // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
            
            // Load related chain listings
            (async function() {
                try {
                    const chainId = '${listing.chain_id}';
                    const currentListingId = '${listing.id}';
                    
                    const response = await fetch('https://luetekzqrrgdxtopzvqw.supabase.co/rest/v1/listings?chain_id=eq.' + chainId + '&visible=eq.true&select=*', {
                        headers: {
                            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZXRla3pxcnJnZHh0b3B6dnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc2NDcsImV4cCI6MjA4MzkyMzY0N30.TIrNG8VGumEJc_9JvNHW-Q-UWfUGpPxR0v8POjWZJYg'
                        }
                    });
                    
                    if (!response.ok) throw new Error('Failed to load related listings');
                    
                    const data = await response.json();
                    const relatedListings = data.filter(l => l.id !== currentListingId);
                    
                    const container = document.getElementById('relatedListingsContainer');
                    
                    if (relatedListings.length === 0) {
                        container.innerHTML = '<p class="text-gray-600 col-span-full">No other locations found.</p>';
                        return;
                    }
                    
                    container.innerHTML = relatedListings.map(l => {
                        const listingUrl = '/listing/' + l.slug;
                        const location = (l.city && l.state) ? l.city + ', ' + l.state : (l.city || l.state || 'Location TBD');
                        
                        const formatPhone = (phone) => {
                            if (!phone) return '';
                            const digits = String(phone).replace(/\\D/g, '');
                            if (digits.length === 11 && digits.startsWith('1')) {
                                return "(" + digits.slice(1,4) + ") " + digits.slice(4,7) + "-" + digits.slice(7,11);
                            }
                            if (digits.length === 10) {
                                return "(" + digits.slice(0,3) + ") " + digits.slice(3,6) + "-" + digits.slice(6,10);
                            }
                            return phone;
                        };

                        const getHoursBadge = (hours) => {
                            if (!hours || typeof hours !== 'object') return '';
                            const dayKeys = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
                            const now = new Date();
                            const day = dayKeys[now.getDay()];
                            const todayHours = (hours[day] || '').toLowerCase();
                            if (!todayHours) return '';
                            if (todayHours.includes('closed')) return '<span class="badge badge-closed">CLOSED</span>';
                            return '<span class="badge badge-open">OPEN</span>';
                        };

                        const getTierBadge = (tier) => {
                            if (tier === 'PREMIUM') return '<span class="badge badge-premium">Premium</span>';
                            if (tier === 'FEATURED') return '<span class="badge badge-featured">Featured</span>';
                            return '';
                        };

                        const getComingSoonBadge = (comingSoon) => comingSoon === true
                            ? '<span class="badge badge-coming-soon">COMING SOON!</span>'
                            : '';

                        return \`
                            <a href="\${listingUrl}" class="related-listing-card block bg-white p-3">
                                <div class="flex items-start gap-4">
                                    \${l.logo ? \`<img src="\${l.logo}" alt="\${l.business_name}" class="w-14 h-14 rounded-lg object-cover flex-shrink-0">\` : ''}
                                    <div class="flex-1 min-w-0 pl-3">
                                        <div class="flex flex-wrap gap-1 mb-1">\${getHoursBadge(l.hours)}\${getTierBadge(l.tier)}\${getComingSoonBadge(l.coming_soon)}</div>
                                        <h3 class="font-bold text-gray-900 mb-1 leading-snug">\${l.business_name}</h3>
                                        <p class="text-sm text-gray-600 mb-0.5" style="display:flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#045093" stroke-width="2"><path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="3"/></svg><span>\${location}</span></p>
                                        \${l.phone ? \`<p class="text-sm text-gray-600" style="display:flex;align-items:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#045093" stroke-width="2"><path d="M3 5a2 2 0 012-2h3.3a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21L8 10.5a11 11 0 005.5 5.5l1.1-2.25a1 1 0 011.2-.5l4.5 1.5a1 1 0 01.7.95V19a2 2 0 01-2 2h-1C9.7 21 3 14.3 3 6V5z"/></svg><span>\${formatPhone(l.phone)}</span></p>\` : ''}
                                    </div>
                                </div>
                            </a>
                        \`;
                    }).join('');
                    
                } catch (error) {
                    console.error('Error loading related listings:', error);
                    document.getElementById('relatedListingsContainer').innerHTML = 
                        '<p class="text-gray-600 col-span-full">Failed to load related locations.</p>';
                }
            })();
            
            // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
            </script>
        `;
    }
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    let claimButton = '';
    const firstOwner = owners.length > 0 ? owners[0] : null;
    const isClaimed = listing.is_claimed || (firstOwner && firstOwner.owner_user_id);
    if (!isClaimed && listing.show_claim_button !== false) {
        const cityState = listing.city && listing.state ? `${decodeEscapedText(listing.city)}, ${decodeEscapedText(listing.state)}` : '';
        const country = listing.country && listing.country !== 'USA' ? `, ${listing.country}` : '';
        const locationInfo = listing.state ? cityState + country : (listing.city ? listing.city + country : '');
        const subject = encodeURIComponent(`Claim My Listing: ${decodeEscapedText(listing.business_name)}${locationInfo ? ' - ' + locationInfo : ''}`);
        
        claimButton = `<a href="mailto:contact@thegreekdirectory.org?subject=${subject}" target="_blank" rel="noopener noreferrer" class="action-cta-btn inline-flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg font-semibold hover-bounce" style="background-color:#045093;"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block;flex-shrink:0;"><path d="M17.8086 9.70558C18.1983 9.31421 18.1969 8.68105 17.8056 8.29137C17.4142 7.90169 16.781 7.90305 16.3913 8.29442L10.6215 14.0892L7.30211 10.816C6.90886 10.4283 6.27571 10.4327 5.88793 10.8259C5.50015 11.2192 5.50459 11.8524 5.89784 12.2401L9.92581 16.212C10.3177 16.5985 10.9482 16.5956 11.3366 16.2056L17.8086 9.70558Z" fill="#FFFFFF"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12 1C5.92487 1 1 5.92487 1 12C1 18.0751 5.92487 23 12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1ZM3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" fill="#FFFFFF"/></svg><span>Claim This Listing</span></a>`;
    }
    
    const hoursSchema = generateHoursSchema(listing);
    const hasStreetAddress2 = typeof listing.address === 'string' && listing.address.trim().length > 0;
    const coordinates = (hasStreetAddress2 && listing.coordinates) ? `${listing.coordinates.lat},${listing.coordinates.lng}` : '';
    const fullAddress = hasStreetAddress2 ? [listing.address, listing.city, listing.state, listing.zip_code].filter(Boolean).join(', ') : '';
    const hoursJson = listing.hours ? JSON.stringify(listing.hours) : 'null';
    const hasBusinessHours = listing.hours && Object.values(listing.hours).some(value => typeof value === 'string' && value.trim().length > 0);
    
    // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
    
    const suggestEditHref = `/suggest-edit?id=${encodeURIComponent(String(listing.id || ''))}`;
    const suggestEditButton = `<a href="${suggestEditHref}" class="action-cta-btn inline-flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg font-semibold hover-bounce" style="background-color:#045093;" target="_blank"><svg width="1em" height="1em" viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true" style="display:block;flex-shrink:0;"><path d="m104.175 90.97-4.252 38.384 38.383-4.252L247.923 15.427V2.497L226.78-18.646h-12.93zm98.164-96.96 31.671 31.67" style="fill:none;stroke:#FFFFFF;stroke-width:12;stroke-linecap:round;stroke-linejoin:round;" transform="translate(-77.923 40.646)"/><path d="m195.656 33.271-52.882 52.882" style="fill:none;stroke:#FFFFFF;stroke-width:12;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:5;" transform="translate(-77.923 40.646)"/></svg><span>Suggest Edit</span></a>`;

    return {
        'OWNER_INFO_SECTION': ownerInfoSection,
        'SOCIAL_MEDIA_SECTION': socialMediaSection,
        'SOCIAL_BREAK': socialBreak,
        'REVIEW_SECTION': reviewSection,
        'REVIEW_BREAK': reviewBreak,
        'MAP_SECTION': mapSection,
        'PARENT_LISTING_SECTION': parentListingSection,
        'CHILD_LISTINGS_SECTION': childListingsSection,
        'RELATED_LISTINGS_SECTION': relatedListingsSection,
        'CLAIM_BUTTON': claimButton,
        'SHARE_TRIGGER_BUTTON': `<a class="hero-chip justify-center gap-2 px-4 py-3 text-white" onclick="openShareModal()" style="background-color:#045093; font-size: 16px; cursor: pointer;" type="button"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="display:block;flex-shrink:0;"><path fill-rule="evenodd" clip-rule="evenodd" d="M19.6495 0.799565C18.4834 -0.72981 16.0093 0.081426 16.0093 1.99313V3.91272C12.2371 3.86807 9.65665 5.16473 7.9378 6.97554C6.10034 8.9113 5.34458 11.3314 5.02788 12.9862C4.86954 13.8135 5.41223 14.4138 5.98257 14.6211C6.52743 14.8191 7.25549 14.7343 7.74136 14.1789C9.12036 12.6027 11.7995 10.4028 16.0093 10.5464V13.0069C16.0093 14.9186 18.4834 15.7298 19.6495 14.2004L23.3933 9.29034C24.2022 8.2294 24.2022 6.7706 23.3933 5.70966L19.6495 0.799565ZM7.48201 11.6095C9.28721 10.0341 11.8785 8.55568 16.0093 8.55568H17.0207C17.5792 8.55568 18.0319 9.00103 18.0319 9.55037L18.0317 13.0069L21.7754 8.09678C22.0451 7.74313 22.0451 7.25687 21.7754 6.90322L18.0317 1.99313V4.90738C18.0317 5.4567 17.579 5.90201 17.0205 5.90201H16.0093C11.4593 5.90201 9.41596 8.33314 9.41596 8.33314C8.47524 9.32418 7.86984 10.502 7.48201 11.6095Z" fill="#FFFFFF"/><path d="M7 1.00391H4C2.34315 1.00391 1 2.34705 1 4.00391V20.0039C1 21.6608 2.34315 23.0039 4 23.0039H20C21.6569 23.0039 23 21.6608 23 20.0039V17.0039C23 16.4516 22.5523 16.0039 22 16.0039C21.4477 16.0039 21 16.4516 21 17.0039V20.0039C21 20.5562 20.5523 21.0039 20 21.0039H4C3.44772 21.0039 3 20.5562 3 20.0039V4.00391C3 3.45162 3.44772 3.00391 4 3.00391H7C7.55228 3.00391 8 2.55619 8 2.00391C8 1.45162 7.55228 1.00391 7 1.00391Z" fill="#FFFFFF"/></svg><span>Share</span></a>`,
        'SUGGEST_EDIT_BUTTON': suggestEditButton,
        'HOURS_SCHEMA': hoursSchema,
        'CUSTOM_SCHEMA_PROPERTIES': listing.custom_schema_properties || '',
        'COORDINATES': coordinates,
        'FULL_ADDRESS': fullAddress.replace(/'/g, "\\'"),
        'HOURS_JSON': hoursJson,
        'SUGGEST_EDIT_MAILTO': suggestEditHref,
        'BUSINESS_TIMEZONE': escapeHtml(listing.timezone || 'America/Chicago'),
        'HOURS_LOGIC_SCRIPT': hasBusinessHours ? '<script src="/js/listing-hours.js"></script>' : '',
        'VERSION_NUM': listing.version != null ? String(listing.version) : '1'
    };
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 12
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 12
// Generate Listing Page & Analytics Tracking
// ============================================

async function prepareListingPageGeneration(listingId, options = {}) {
    const { skipAnalytics = false, template: preFetchedTemplate = null } = options;
    
    const listings = await adminProxy('listings:list');
    const listing = Array.isArray(listings)
        ? listings.find((row) => String(row.id) === String(listingId))
        : null;
    if (!listing) {
        throw new Error('Listing not found');
    }
    
    console.log('📄 Generating page for:', listing.business_name);
    
    // Apply default images if needed
    const defaultImage = CATEGORY_DEFAULT_IMAGES[listing.category];
    const firstLetterOfBusiness = listing.business_name.trim().charAt(0).toLowerCase() || '';
    
    if (!listing.logo) {
        listing.logo = `https://thegreekdirectory.pages.dev/assets/images/letter-icon/${firstLetterOfBusiness}.svg`;
        
        // Update in database
        await adminProxy('listings:update', { id: listingId, logo: listing.logo });
    }
    
    if (!listing.photos || listing.photos.length === 0) {
        listing.photos = [`${defaultImage}?w=800&q=80`];
        
        // Update in database
        await adminProxy('listings:update', { id: listingId, photos: listing.photos });
    }
    
    
    let template;
    if (preFetchedTemplate != null) {
        template = preFetchedTemplate;
    } else {
        const templateResponse = await fetch('https://raw.githubusercontent.com/thegreekdirectory/platform/main/listing-template.html');
        if (!templateResponse.ok) {
            throw new Error('Failed to fetch template');
        }
        template = await templateResponse.text();
    }
    
    const shortlinkRows = await adminProxy('shortlinks:get', { listing_id: listingId });
    const validRows = Array.isArray(shortlinkRows) ? shortlinkRows : [];
    const preferredCustom = validRows.find((row) => row.listing_custom === true && isValidCustomShortlink(row.path));
    const systemShortlink = validRows.find((row) => row.listing_custom === false && isValidSystemShortlink(row.path));
    const resolvedShortlinkPath = preferredCustom?.path || systemShortlink?.path || '';
    listing.shortlink_url = resolvedShortlinkPath ? `https://tgd.gr${resolvedShortlinkPath}` : '';

    const replacements1 = generateTemplateReplacements(listing);
    const replacements2 = generateTemplateReplacementsPart2(listing);
    const replacements = { ...replacements1, ...replacements2 };
    
    Object.keys(replacements).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        const replacementValue = replacements[key] == null ? '' : String(replacements[key]);
        template = template.replace(regex, () => replacementValue);
    });
    
    return {
        businessName: listing.business_name,
        filePath: `listing/${listing.slug}.html`,
        content: template,
        shortlinksFound: validRows.length > 0
    };
}

window.generateListingPage = async function(listingId, options = {}) {
    const { skipSitemap = false, skipAnalytics = false } = options;
    try {
        const generatedFile = await prepareListingPageGeneration(listingId, { skipAnalytics });
        await saveToGitHub(generatedFile.filePath, generatedFile.content, generatedFile.businessName);
        if (!generatedFile.shortlinksFound) {
            alert('Page generated, but shortlink integrity must be checked in Supabase.');
        }
        
        if (!skipSitemap) {
            await updateSitemap();
        }
        
        console.log('✅ Page generated successfully');
        return true;
        
    } catch (error) {
        console.error('Error generating page:', error);
        alert('❌ Failed to generate listing page: ' + error.message);
        return false;
    }
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

async function updateSitemap() {
    try {
        const allListingsData = await adminProxy('listings:list');
        const database = {
            listings: Array.isArray(allListingsData)
                ? allListingsData.filter((listing) => listing.visible)
                : []
        };
        
        const now = new Date().toISOString().split('T')[0];
        const baseUrl = 'https://thegreekdirectory.org';
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
`;
        
        // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
        
        // Collect unique places (cities)
        const places = new Set();
        const usStates = new Set();
        
        // Define major city mappings for each state
        const majorCityMappings = {
            'IL': {
                'Chicago': 'chicago',
                'Chicagoland': 'chicagoland',
                'Springfield': 'springfield',
                'Rockford': 'rockford',
                'Peoria': 'peoria',
                'Champaign': 'champaign',
                'Urbana': 'champaign'
            }
        };
        
        // Chicago suburbs that should map to "chicagoland"
        const chicagolandSuburbs = [
  "Addison", "Algonquin", "Alsip", "Antioch", "Arlington Heights", "Aurora", 
  "Bannockburn", "Barrington", "Barrington Hills", "Bartlett", "Batavia", "Beach Park", 
  "Bedford Park", "Beecher", "Bellwood", "Bensenville", "Berkeley", "Berwyn", 
  "Bloomingdale", "Blue Island", "Bolingbrook", "Bowdre", "Braidwood", "Bridgeview", 
  "Broadview", "Brookfield", "Buffalo Grove", "Burbank", "Burnham", "Burr Ridge", 
  "Calumet City", "Calumet Park", "Campton Hills", "Carol Stream", "Carpentersville", "Cary", 
  "Cedar Lake", "Channahon", "Chicago Heights", "Chicago Ridge", "Cicero", "Clarendon Hills", 
  "Country Club Hills", "Countryside", "Crest Hill", "Crestwood", "Crete", "Crystal Lake", 
  "Darien", "Deer Park", "Deerfield", "Des Plaines", "Diamond", "Dixmoor", 
  "Dolton", "Downers Grove", "Dyer", "East Chicago", "East Dundee", "East Hazel Crest", 
  "Elburn", "Elgin", "Elk Grove Village", "Elmhurst", "Elmwood Park", "Evanston", 
  "Evergreen Park", "Flossmoor", "Ford Heights", "Forest Park", "Forest View", "Fox Lake", 
  "Fox River Grove", "Frankfort", "Franklin Park", "Gary", "Geneva", "Gilberts", 
  "Glen Ellyn", "Glencoe", "Glendale Heights", "Glenview", "Glenwood", "Godley", 
  "Golf", "Grayslake", "Green Oaks", "Gurnee", "Hammond", "Hainesville", 
  "Hampshire", "Hanover Park", "Harvard", "Harvey", "Harwood Heights", "Hawthorn Woods", 
  "Hazel Crest", "Hebron", "Hickory Hills", "Highland", "Highland Park", "Highwood", 
  "Hillside", "Hinsdale", "Hodgkins", "Hoffman Estates", "Hometown", "Homewood", 
  "Huntley", "Indian Head Park", "Inverness", "Island Lake", "Itasca", "Johnsburg", 
  "Joliet", "Justice", "Kankakee", "Kenilworth", "Kildeer", "La Grange", 
  "La Grange Park", "Lake Barrington", "Lake Blossom", "Lake Bluff", "Lake Forest", "Lake In The Hills", 
  "Lake Station", "Lake Villa", "Lake Zurich", "Lakemoor", "Lakewood", "Lansing", 
  "Lemont", "Libertyville", "Lily Lake", "Lincolnshire", "Lincolnwood", "Lindenhurst", 
  "Lisbon", "Lisle", "Lockport", "Lombard", "Long Grove", "Lynwood", 
  "Lyons", "Manhattan", "Maple Park", "Marengo", "Markham", "Matteson", 
  "Maywood", "McCook", "McCullom Lake", "McHenry", "Melrose Park", "Merrillville", 
  "Merrionette Park", "Midlothian", "Minooka", "Mokena", "Monee", "Montgomery", 
  "Morris", "Morton Grove", "Mount Prospect", "Mundelein", "Munster", "Naperville", 
  "New Lenox", "Niles", "Norridge", "North Aurora", "North Chicago", "North Riverside", 
  "Northbrook", "Northfield", "Northlake", "Oak Brook", "Oak Forest", "Oak Lawn", 
  "Oak Park", "Oakwood Hills", "Olympia Fields", "Orland Hills", "Orland Park", "Oswego", 
  "Palatine", "Palos Heights", "Palos Hills", "Palos Park", "Park City", "Park Forest", 
  "Park Ridge", "Peotone", "Phoenix", "Pingree Grove", "Plainfield", "Posen", 
  "Prairie Grove", "Prospect Heights", "Richmond", "Richton Park", "Ringwood", "River Forest", 
  "River Grove", "Riverdale", "Riverside", "Riverwoods", "Robbins", "Rockdale", 
  "Rolling Meadows", "Romeoville", "Roselle", "Rosemont", "Round Lake", "Round Lake Beach", 
  "Round Lake Heights", "Round Lake Park", "Sauk Village", "Schaumburg", "Schiller Park", "Schererville", 
  "Shorewood", "Skokie", "Sleepy Hollow", "South Barrington", "South Chicago Heights", "South Elgin", 
  "South Holland", "Spring Grove", "St. Charles", "Steger", "Stickney", "Stone Park", 
  "Streamwood", "Sugar Grove", "Summit", "Symphony Center", "Symerton", "Third Lake", 
  "Thornton", "Tinley Park", "Tower Lakes", "Trout Valley", "Turnberry", "University Park", 
  "Valparaiso", "Vernon Hills", "Villa Park", "Volo", "Wadsworth", "Warrenville", 
  "Wauconda", "Waukegan", "Wayne", "West Chicago", "West Dundee", "Westchester", 
  "Western Springs", "Westmont", "Wheaton", "Wheeling", "Whiting", "Willow Springs", 
  "Willowbrook", "Wilmette", "Wilmington", "Winfield", "Winthrop Harbor", "Winnetka", 
  "Wood Dale", "Woodridge", "Woodstock", "Worth", "Yorkville", "Zion"
];
        
        database.listings.forEach(listing => {
            if (listing.visible !== false && listing.city && listing.state && (listing.country || 'USA') === 'USA') {
                const city = listing.city.toLowerCase();
                const state = listing.state;
                
                let citySlug;
                
                // Check if it's Illinois and a Chicago suburb
                if (state === 'IL' && chicagolandCities.includes(city)) {
                    citySlug = 'chicagoland';
                } else if (majorCityMappings[state] && majorCityMappings[state][listing.city]) {
                    // Use major city mapping if available
                    citySlug = majorCityMappings[state][listing.city];
                } else {
                    // For non-major cities, just use state
                    citySlug = null;
                }
                
                const stateSlug = state.toLowerCase();
                usStates.add(stateSlug);
                
                if (citySlug) {
                    places.add(`${stateSlug}/${citySlug}`);
                }
            }
        });
        
        // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
        
        // Add state pages
        usStates.forEach(state => {
            xml += `  <url>
    <loc>${baseUrl}/places/usa/${state}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
`;
        });
        
        // Add place pages
        places.forEach(place => {
            xml += `  <url>
    <loc>${baseUrl}/places/usa/${place}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
        });
        
        // Collect unique categories
        const categories = new Set();
        database.listings.forEach(listing => {
            if (listing.visible !== false && listing.category) {
                categories.add(listing.category);
            }
        });
        
        // Add category pages
        categories.forEach(category => {
            const categorySlug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            xml += `  <url>
    <loc>${baseUrl}/category/${categorySlug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
        });
        
        // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
        
        // Add individual listings
        database.listings.forEach(listing => {
            if (listing.visible !== false) {
                const categorySlug = listing.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const listingSlug = listing.slug;
                const lastMod = listing.updated_at ? 
                    listing.updated_at.split('T')[0] : now;
                
                xml += `  <url>
    <loc>${baseUrl}/listing/${listingSlug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
`;
            }
        });
        
        xml += `</urlset>`;
        
        await saveToGitHub('sitemap.xml', xml, 'Sitemap');
        
        console.log('✅ Sitemap updated successfully');
        
    } catch (error) {
        console.error('Error updating sitemap:', error);
    }
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

async function saveToGitHub(filePath, content, businessName) {
    try {
        let currentSha = null;
        try {
            const fileInfoResponse = await fetch(
                `https://api.github.com/repos/thegreekdirectory/platform/contents/${filePath}`,
                {
                    headers: {
                        'Authorization': `token ${adminGithubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (fileInfoResponse.ok) {
                const fileInfo = await fileInfoResponse.json();
                currentSha = fileInfo.sha;
            }
        } catch (error) {
            console.log('File does not exist, will create new');
        }
        
        const base64Content = btoa(unescape(encodeURIComponent(content)));
        
        const uploadBody = {
            message: `${currentSha ? 'Update' : 'Create'} listing page for ${businessName}`,
            content: base64Content,
            committer: {
                name: 'TGD Admin',
                email: 'admin@thegreekdirectory.org'
            }
        };
        
        if (currentSha) {
            uploadBody.sha = currentSha;
        }
        
        // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
        
        const uploadResponse = await fetch(
            `https://api.github.com/repos/thegreekdirectory/platform/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${adminGithubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(uploadBody)
            }
        );
        
        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`GitHub upload failed: ${errorData.message}`);
        }
        
        return true;
    } catch (error) {
        console.error('Error saving to GitHub:', error);
        throw error;
    }
}

async function saveMultipleFilesToGitHub(files, commitMessage) {
    if (!Array.isArray(files) || files.length === 0) {
        return;
    }
    
    const headers = {
        'Authorization': `token ${adminGithubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };
    
    const branchResponse = await fetch(
        'https://api.github.com/repos/thegreekdirectory/platform/git/ref/heads/main',
        { headers }
    );
    
    if (!branchResponse.ok) {
        const errorData = await branchResponse.json();
        throw new Error(`Failed to fetch branch reference: ${errorData.message}`);
    }
    
    const branchData = await branchResponse.json();
    const latestCommitSha = branchData.object.sha;
    
    const commitResponse = await fetch(
        `https://api.github.com/repos/thegreekdirectory/platform/git/commits/${latestCommitSha}`,
        { headers }
    );
    
    if (!commitResponse.ok) {
        const errorData = await commitResponse.json();
        throw new Error(`Failed to fetch latest commit: ${errorData.message}`);
    }
    
    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;
    
    const treeEntries = files.map(file => ({
        path: file.filePath,
        mode: '100644',
        type: 'blob',
        content: file.content
    }));
    
    const treeResponse = await fetch(
        'https://api.github.com/repos/thegreekdirectory/platform/git/trees',
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                base_tree: baseTreeSha,
                tree: treeEntries
            })
        }
    );
    
    if (!treeResponse.ok) {
        const errorData = await treeResponse.json();
        throw new Error(`Failed to create tree: ${errorData.message}`);
    }
    
    const treeData = await treeResponse.json();
    
    const createCommitResponse = await fetch(
        'https://api.github.com/repos/thegreekdirectory/platform/git/commits',
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                message: commitMessage,
                tree: treeData.sha,
                parents: [latestCommitSha],
                committer: {
                    name: 'TGD Admin',
                    email: 'admin@thegreekdirectory.org'
                }
            })
        }
    );
    
    if (!createCommitResponse.ok) {
        const errorData = await createCommitResponse.json();
        throw new Error(`Failed to create commit: ${errorData.message}`);
    }
    
    const newCommit = await createCommitResponse.json();
    
    const updateRefResponse = await fetch(
        'https://api.github.com/repos/thegreekdirectory/platform/git/refs/heads/main',
        {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
                sha: newCommit.sha,
                force: false
            })
        }
    );
    
    if (!updateRefResponse.ok) {
        const errorData = await updateRefResponse.json();
        throw new Error(`Failed to update branch reference: ${errorData.message}`);
    }
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
// js/admin.js - PART 13
// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.

// ============================================
// ADMIN PORTAL - PART 13
// Generate All Pages & CSV Upload
// ============================================

window.generateAllListingPages = async function() {
    if (!confirm('This will generate pages for ALL visible listings. This may take several minutes. Continue?')) {
        return;
    }
    
    const visibleListings = allListings.filter(l => l.visible);
    
    console.log(`🔨 Generating ${visibleListings.length} listing pages...`);
    
    // Fetch the template once for the whole batch instead of once per listing
    const templateResponse = await fetch('https://raw.githubusercontent.com/thegreekdirectory/platform/main/listing-template.html');
    if (!templateResponse.ok) {
        alert('Failed to fetch listing template. Generation aborted.');
        return;
    }
    const sharedTemplate = await templateResponse.text();
    
    let successful = 0;
    let failed = 0;
    const failedListings = [];
    const filesToCommit = [];
    
    for (const listing of visibleListings) {
        try {
            const generatedFile = await prepareListingPageGeneration(listing.id, { skipAnalytics: true, template: sharedTemplate });
            filesToCommit.push(generatedFile);
            successful++;
            console.log(`✅ Generated: ${listing.business_name}`);
            
            // Rate limit: wait to reduce API pressure for listings fetch/template generation
            await new Promise(resolve => setTimeout(resolve, 250));
        } catch (error) {
            console.error(`❌ Failed: ${listing.business_name}`, error);
            failed++;
            failedListings.push(listing.business_name);
        }
    }
    
    if (filesToCommit.length > 0) {
        await saveMultipleFilesToGitHub(
            filesToCommit,
            `Generate all listing pages (${filesToCommit.length} files)`
        );
        console.log(`✅ Committed ${filesToCommit.length} listing pages in a single commit`);
    }
    
    console.log('📊 Generation Summary:');
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    if (failedListings.length > 0) {
        console.log('   Failed listings:', failedListings.join(', '));
    }
    
    alert(`Generation complete!\n\nSuccessful: ${successful}\nFailed: ${failed}${failedListings.length > 0 ? '\n\nFailed listings:\n' + failedListings.join('\n') : ''}`);
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

window.handleCSVUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📁 Processing CSV file:', file.name);
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const text = e.target.result;
            const rows = text.split('\n').map(row => row.trim()).filter(row => row);
            
            if (rows.length < 2) {
                alert('CSV file is empty or invalid');
                return;
            }
            
            const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
            console.log('📋 CSV Headers:', headers);
            
            const listings = [];
            
            for (let i = 1; i < rows.length; i++) {
                const values = rows[i].split(',').map(v => v.trim().replace(/"/g, ''));
                
                if (values.length < headers.length) {
                    console.warn(`⚠️ Row ${i + 1} has fewer columns than headers, skipping`);
                    continue;
                }
                
                const listing = {};
                headers.forEach((header, index) => {
                    listing[header] = values[index] || '';
                });
                
                listings.push(listing);
            }
            
            console.log(`✅ Parsed ${listings.length} listings from CSV`);
            
            if (!confirm(`Upload ${listings.length} listings to database?\n\nThis will create new listings for all entries in the CSV.`)) {
                return;
            }
            
            await uploadListingsFromCSV(listings);
            
        } catch (error) {
            console.error('Error parsing CSV:', error);
            alert('Failed to parse CSV: ' + error.message);
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
};

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

async function uploadListingsFromCSV(listings) {
    let successful = 0;
    let failed = 0;
    const failedListings = [];
    
    console.log('📤 Starting bulk upload...');
    
    for (const csvListing of listings) {
        try {
            const businessName = csvListing.business_name || csvListing.BusinessName || csvListing['Business Name'];
            
            if (!businessName) {
                console.warn('⚠️ Skipping row without business name');
                failed++;
                continue;
            }
            
            const slug = (csvListing.slug || businessName.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, ''));
            
            const category = csvListing.category || csvListing.Category || CATEGORIES[0];
            
            const subcategoriesStr = csvListing.subcategories || csvListing.Subcategories || '';
            const subcategories = subcategoriesStr ? subcategoriesStr.split('|').map(s => s.trim()).filter(s => s) : [];
            
            const photosStr = csvListing.photos || csvListing.Photos || '';
            const photos = photosStr ? photosStr.split('|').map(p => p.trim()).filter(p => p) : [];
            
            let coordinates = null;
            const coordsStr = csvListing.coordinates || csvListing.Coordinates || '';
            if (coordsStr) {
                const [lat, lng] = coordsStr.split(',').map(c => parseFloat(c.trim()));
                if (!isNaN(lat) && !isNaN(lng)) {
                    coordinates = { lat, lng };
                }
            }
            
            const isClaimed = csvListing.is_claimed === 'true' || csvListing.is_claimed === '1';
            
            // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
            
            
        const timezoneInput = document.getElementById('editTimezone');
        const timezone = (timezoneInput?.value || '').trim() || 'America/Chicago';
        const isValidIanaTimezone = (tz) => {
            try {
                return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone === tz;
            } catch (error) {
                return false;
            }
        };

        if (!isValidIanaTimezone(timezone)) {
            alert('Please enter a valid IANA timezone (example: America/Chicago).');
            timezoneInput?.focus();
            return;
        }

const listingData = {
                business_name: businessName,
                slug: slug,
                tagline: csvListing.tagline || csvListing.Tagline || '',
                description: csvListing.description || csvListing.Description || '',
                category: category,
                subcategories: subcategories,
                primary_subcategory: subcategories.length > 0 ? subcategories[0] : null,
                tier: csvListing.tier || csvListing.Tier || 'FREE',
                visible: csvListing.visible === 'false' ? false : true,
                is_chain: csvListing.is_chain === 'true',
                is_claimed: isClaimed,
                chain_name: csvListing.chain_name || csvListing.ChainName || null,
                chain_id: csvListing.chain_id || csvListing.ChainID || null,
                address: csvListing.address || csvListing.Address || null,
                city: csvListing.city || csvListing.City || null,
                state: csvListing.state || csvListing.State || null,
                zip_code: csvListing.zip_code || csvListing.ZipCode || csvListing['Zip Code'] || null,
                country: csvListing.country || csvListing.Country || 'USA',
                coordinates: coordinates,
                phone: csvListing.phone || csvListing.Phone || null,
                email: csvListing.email || csvListing.Email || null,
                website: csvListing.website || csvListing.Website || null,
                logo: csvListing.logo || csvListing.Logo || null,
                photos: photos,
                video: csvListing.video || csvListing.Video || null,
                hours: parseHours(csvListing),
                social_media: parseSocialMedia(csvListing),
                reviews: parseReviews(csvListing)
            };
            
            // Copyright (C) The Greek Directory, 2025-present. All rights reserved.
            
            const data = await adminProxy('listings:insert', listingData);
            
            const ownerData = {
                listing_id: data.id,
                full_name: csvListing.owner_name || csvListing.OwnerName || csvListing['Owner Name'] || null,
                title: csvListing.owner_title || csvListing.OwnerTitle || csvListing['Owner Title'] || null,
                from_greece: csvListing.from_greece || csvListing.FromGreece || csvListing['From Greece'] || null,
                owner_email: csvListing.owner_email || csvListing.OwnerEmail || csvListing['Owner Email'] || null,
                owner_phone: csvListing.owner_phone || csvListing.OwnerPhone || csvListing['Owner Phone'] || null,
                confirmation_key: isClaimed ? null : (csvListing.confirmation_key || null)
            };
            
            // Generate confirmation key if not claimed and not provided
            if (!isClaimed && !ownerData.confirmation_key) {
                const words = [
                    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
                    'iota', 'kappa', 'lambda', 'sigma', 'omega', 'phoenix', 'apollo'
                ];
                const word1 = words[Math.floor(Math.random() * words.length)];
                const word2 = words[Math.floor(Math.random() * words.length)];
                const word3 = words[Math.floor(Math.random() * words.length)];
                ownerData.confirmation_key = `${word1}-${word2}-${word3}`;
            }
            
            try {
                await adminProxy('owners:upsert', ownerData);
            } catch (ownerError) {
                console.warn('⚠️ Failed to create owner record for', businessName, ownerError);
            }
            
            successful++;
            console.log(`✅ Uploaded: ${businessName}`);
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.error(`❌ Failed to upload:`, error);
            failed++;
            failedListings.push(csvListing.business_name || 'Unknown');
        }
    }
    
    console.log('📊 Upload Summary:');
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    
    await loadListings();
    
    alert(`CSV Upload complete!\n\nSuccessful: ${successful}\nFailed: ${failed}${failedListings.length > 0 ? '\n\nFailed listings:\n' + failedListings.join('\n') : ''}`);
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

function parseHours(csvListing) {
    const hours = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    days.forEach(day => {
        const value = csvListing[`hours_${day}`] || csvListing[`Hours${day.charAt(0).toUpperCase() + day.slice(1)}`] || null;
        if (value) {
            hours[day] = value;
        }
    });
    
    return Object.keys(hours).length > 0 ? hours : null;
}

function parseSocialMedia(csvListing) {
    return {
        facebook: csvListing.facebook || csvListing.Facebook || null,
        instagram: csvListing.instagram || csvListing.Instagram || null,
        twitter: csvListing.twitter || csvListing.Twitter || null,
        youtube: csvListing.youtube || csvListing.YouTube || null,
        tiktok: csvListing.tiktok || csvListing.TikTok || null,
        linkedin: csvListing.linkedin || csvListing.LinkedIn || null,
        other1_name: csvListing.other_social_1_name || csvListing.OtherSocial1Name || null,
        other1: csvListing.other_social_1 || csvListing.OtherSocial1 || null,
        other2_name: csvListing.other_social_2_name || csvListing.OtherSocial2Name || null,
        other2: csvListing.other_social_2 || csvListing.OtherSocial2 || null,
        other3_name: csvListing.other_social_3_name || csvListing.OtherSocial3Name || null,
        other3: csvListing.other_social_3 || csvListing.OtherSocial3 || null
    };
}

function parseReviews(csvListing) {
    return {
        google: csvListing.google_reviews || csvListing.GoogleReviews || null,
        yelp: csvListing.yelp || csvListing.Yelp || null,
        tripadvisor: csvListing.tripadvisor || csvListing.TripAdvisor || null,
        other1_name: csvListing.other_review_1_name || csvListing.OtherReview1Name || null,
        other1: csvListing.other_review_1 || csvListing.OtherReview1 || null,
        other2_name: csvListing.other_review_2_name || csvListing.OtherReview2Name || null,
        other2: csvListing.other_review_2 || csvListing.OtherReview2 || null,
        other3_name: csvListing.other_review_3_name || csvListing.OtherReview3Name || null,
        other3: csvListing.other_review_3 || csvListing.OtherReview3 || null
    };
}

// Copyright (C) The Greek Directory, 2025-present. All rights reserved.

// Bind to button click
document.addEventListener('DOMContentLoaded', () => {
    const generateAllBtn = document.getElementById('generateAllBtn');
    if (generateAllBtn) {
        generateAllBtn.addEventListener('click', generateAllListingPages);
    }
});

// Copyright (C) The Greek Directory, 2025-present. All rights reserved. This source code is proprietary and no part may not be used, reproduced, or distributed without written permission from The Greek Directory. Unauthorized use, copying, modification, or distribution of this code will result in legal action to the fullest extent permitted by law. For more information, visit https://thegreekdirectory.org/legal.
