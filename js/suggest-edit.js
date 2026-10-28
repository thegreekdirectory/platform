// js/suggest-edit.js
// Suggest-an-Edit form logic for The Greek Directory
// ============================================================

const SUPABASE_URL     = 'https://luetekzqrrgdxtopzvqw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZXRla3pxcnJnZHh0b3B6dnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNDc2NDcsImV4cCI6MjA4MzkyMzY0N30.TIrNG8VGumEJc_9JvNHW-Q-UWfUGpPxR0v8POjWZJYg';

let SUBCATEGORY_MAP = {
  'Automotive & Transportation': ['Auto Detailer','Auto Repair Shop','Car Dealer','Taxi & Limo Service'],
  'Beauty & Health': ['Barbershops','Esthetician','Hair Salons','Nail Salon','Spas','Chiropractor','Dentist','Doctor','Nutritionist','Optometrist','Orthodontist','Physical Therapist','Physical Trainer'],
  'Church & Religious Organization': ['Church'],
  'Cultural/Fraternal Organization': ['Dance Troupe','Non-Profit','Philanthropic Group','Society','Youth Organization'],
  'Education & Community': ['Childcare','Greek School','Senior Care','Tutor'],
  'Entertainment, Arts & Recreation': ['Band','DJs','Entertainment Group','Photographer','Art'],
  'Food & Hospitality': ['Banquet Hall','Catering Service','Event Venue','Bakeries','Deli','Pastry Shop','Bar','Breakfast','Coffee','Lunch','Dinner','Restaurant','Hotel','Airbnb'],
  'Grocery & Imports': ['Butcher Shop','Liquor Shop','Market','Greek Alcohol','Honey','Olive Oil','Food Distribution','Food Manufacturer'],
  'Home & Construction': ['Carpenter','Electrician','General Contractor','Handyman','HVAC','Landscaping','Painter','Plumber','Roofing','Tile & Stone Specialist'],
  'Industrial & Manufacturing': ['Food Manufacturer'],
  'Pets & Veterinary': ['Veterinarian','Pet Accessories Maker'],
  'Professional & Business Services': ['Business Services','Consultant','CPA','Financial Advisor','Insurance Agent','IT Service & Repair','Lawyer','Marketing & Creative Agency','Notaries','Wedding Planner','Travel Agency'],
  'Real Estate & Development': ['Appraiser','Broker','Developer','Lender','Property Management','Real Estate Agent'],
  'Retail & Shopping': ['Boutique Shop','ECommerce','Jewelry','Souvenir Shop']
};

const MAIN_CATEGORIES = [
  'Automotive & Transportation','Beauty & Health','Church & Religious Organization',
  'Cultural/Fraternal Organization','Education & Community','Entertainment, Arts & Recreation',
  'Food & Hospitality','Grocery & Imports','Home & Construction','Industrial & Manufacturing',
  'Pets & Veterinary','Professional & Business Services','Real Estate & Development','Retail & Shopping'
];

const US_STATES = {
  '':'Select State','AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California',
  'CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia','HI':'Hawaii',
  'ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa','KS':'Kansas','KY':'Kentucky',
  'LA':'Louisiana','ME':'Maine','MD':'Maryland','MA':'Massachusetts','MI':'Michigan',
  'MN':'Minnesota','MS':'Mississippi','MO':'Missouri','MT':'Montana','NE':'Nebraska',
  'NV':'Nevada','NH':'New Hampshire','NJ':'New Jersey','NM':'New Mexico','NY':'New York',
  'NC':'North Carolina','ND':'North Dakota','OH':'Ohio','OK':'Oklahoma','OR':'Oregon',
  'PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina','SD':'South Dakota',
  'TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont','VA':'Virginia','WA':'Washington',
  'WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming'
};

const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── State ─────────────────────────────────────────────────────────────────
let map, marker;
let selectedPrimarySubcategory = null;
let descriptionEditor = null;
let currentListingId = null;

// ─── Small Helpers ──────────────────────────────────────────────────────────
const onlyDigits       = (v = '') => v.replace(/\D/g, '');
const stripProtocol    = (v = '') => v.trim().replace(/^https?:\/\//i, '').replace(/^\/+/, '');
const normalizeHttpsUrl = (v = '') => { const c = stripProtocol(v); return c ? `https://${c}` : null; };
const setVal           = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

const formatUSPhoneNoCode = (v = '') => {
  const d = onlyDigits(v).slice(0, 10);
  if (!d) return '';
  if (d.length < 4)  return `(${d}`;
  if (d.length < 7)  return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
};

const normalizePhone = (id) => {
  const d = onlyDigits(document.getElementById(id)?.value || '');
  return d.length === 10 ? `+1${d}` : null;
};

// ─── Lock https:// prefix on URL inputs ────────────────────────────────────
function lockHttpsInputs() {
  document.querySelectorAll('input[type="url"]').forEach((input) => {
    if (input.dataset.lockedHttps === '1') return;
    input.dataset.lockedHttps = '1';
    const wrap        = document.createElement('div');
    wrap.className    = 'url-prefix-wrap';
    const span        = document.createElement('span');
    span.textContent  = 'https://';
    const replacement = document.createElement('input');
    replacement.type       = 'text';
    replacement.id         = input.id;
    replacement.value      = stripProtocol(input.value || '');
    replacement.placeholder = input.placeholder || 'example.com';
    replacement.autocomplete = 'off';
    replacement.className  = input.className;
    wrap.appendChild(span);
    wrap.appendChild(replacement);
    input.replaceWith(wrap);
  });
}

// ─── Phone mask ─────────────────────────────────────────────────────────────
function attachPhoneMask(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => { el.value = formatUSPhoneNoCode(el.value); });
}

// ─── Photo URL rows ──────────────────────────────────────────────────────────
function setupPhotoUrlRows(prefill = []) {
  const list   = document.getElementById('photoUrlsList');
  const addBtn = document.getElementById('addPhotoUrlBtn');
  list.innerHTML = '';

  const addRow = (value = '') => {
    const row   = document.createElement('div');
    row.className = 'photo-url-row';
    const input = document.createElement('input');
    input.type  = 'text';
    input.className = 'photo-url-input';
    input.placeholder = 'https://image-url…';
    input.value = stripProtocol(value);
    input.addEventListener('input', () => { input.value = stripProtocol(input.value); });
    const rm    = document.createElement('button');
    rm.type     = 'button';
    rm.textContent = 'Remove';
    rm.addEventListener('click', () => row.remove());
    row.appendChild(input);
    row.appendChild(rm);
    list.appendChild(row);
  };

  (prefill.length ? prefill : ['']).forEach(v => addRow(v));
  addBtn.onclick = () => addRow('');
}

// ─── Map ─────────────────────────────────────────────────────────────────────
function setupMap() {
  map    = L.map('submitMap').setView([39.5, -98.35], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  marker = L.marker([39.5, -98.35]).addTo(map);
}

function setMapPin(lat, lng) {
  if (map && marker) { marker.setLatLng([lat, lng]); map.setView([lat, lng], 14); }
}

async function geocodeAddress(query) {
  if (!query || query.length < 4) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  return resp.json();
}

function setupAddressAutocomplete() {
  const input = document.getElementById('address');
  const list  = document.getElementById('addressSuggestions');
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const results = await geocodeAddress(input.value.trim());
      list.innerHTML = results.map(r => `<option value="${r.display_name.replace(/"/g,'&quot;')}"></option>`).join('');
      if (results[0]) setMapPin(parseFloat(results[0].lat), parseFloat(results[0].lon));
    }, 300);
  });
}

// ─── Hours rows ──────────────────────────────────────────────────────────────
function buildHoursRows() {
  const box = document.getElementById('hoursFields');
  box.innerHTML = days.map(day => `
    <div class="hour-row">
      <div><strong>${day.charAt(0).toUpperCase() + day.slice(1)}</strong></div>
      <input type="text" id="hours_${day}" placeholder="9:00 AM - 5:00 PM or 7:00 PM - 3:00 AM" />
      <div class="hour-actions">
        <button type="button" class="tiny-btn" data-day="${day}" data-kind="closed">Closed</button>
        <button type="button" class="tiny-btn" data-day="${day}" data-kind="open24">Open 24 Hours</button>
      </div>
    </div>`).join('');

  box.querySelectorAll('.tiny-btn').forEach(btn => btn.addEventListener('click', () => {
    const { day, kind } = btn.dataset;
    const input = document.getElementById(`hours_${day}`);
    const sibs  = box.querySelectorAll(`.tiny-btn[data-day="${day}"]`);
    if (btn.classList.contains('active')) {
      sibs.forEach(s => s.classList.remove('active'));
      input.disabled = false;
      if (input.value === 'Closed' || input.value === 'Open 24 Hours') input.value = '';
      return;
    }
    sibs.forEach(s => s.classList.remove('active'));
    if (kind === 'closed')  { input.value = 'Closed';         input.disabled = true; }
    if (kind === 'open24')  { input.value = 'Open 24 Hours';  input.disabled = true; }
    btn.classList.add('active');
  }));
}

// ─── Pre-fill hours ──────────────────────────────────────────────────────────
function prefillHours(hoursObj) {
  if (!hoursObj) return;
  const box = document.getElementById('hoursFields');
  // A listing stores one { status, ranges } object per day (older rows hold a string). Show each
  // day as the text this form accepts, e.g. "8:00 AM - 11:00 AM, 5:00 PM - 8:00 PM".
  Object.entries(window.TGDListingHours.normalizeHours(hoursObj)).forEach(([day, dayData]) => {
    const input = document.getElementById(`hours_${day}`);
    const val = window.TGDListingHours.formatDayText(dayData);
    if (!input || !val) return;
    input.value = val;
    if (dayData.status === 'closed') {
      input.disabled = true;
      const btn = box.querySelector(`.tiny-btn[data-day="${day}"][data-kind="closed"]`);
      if (btn) btn.classList.add('active');
    } else if (dayData.status === '24_hours') {
      input.disabled = true;
      const btn = box.querySelector(`.tiny-btn[data-day="${day}"][data-kind="open24"]`);
      if (btn) btn.classList.add('active');
    }
  });
}

// ─── Subcategories ───────────────────────────────────────────────────────────
function renderSubcategories(selected = [], primary = null) {
  const cat     = document.getElementById('category').value;
  const options = SUBCATEGORY_MAP[cat] || [];
  if (!selectedPrimarySubcategory && primary) selectedPrimarySubcategory = primary;

  document.getElementById('subcategoryCheckboxes').innerHTML = options.map(sub => {
    const checked   = selected.includes(sub);
    const isPrimary = selectedPrimarySubcategory ? selectedPrimarySubcategory === sub : selected[0] === sub;
    return `<label>
      <input type="checkbox" value="${sub}" ${checked ? 'checked' : ''}/>
      ${sub}
      <input type="radio" name="suggestPrimarySubcategory" value="${sub}"
        ${checked && isPrimary ? 'checked' : ''} ${!checked ? 'disabled' : ''} title="Primary">
    </label>`;
  }).join('');

  document.querySelectorAll('#subcategoryCheckboxes input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const radio = document.querySelector(`#subcategoryCheckboxes input[type="radio"][value="${CSS.escape(cb.value)}"]`);
      if (cb.checked) {
        radio.disabled = false;
        if (!selectedPrimarySubcategory) { selectedPrimarySubcategory = cb.value; radio.checked = true; }
      } else {
        radio.checked = false; radio.disabled = true;
        if (selectedPrimarySubcategory === cb.value) {
          const first = document.querySelector('#subcategoryCheckboxes input[type="checkbox"]:checked');
          selectedPrimarySubcategory = first ? first.value : null;
          if (first) {
            const r = document.querySelector(`#subcategoryCheckboxes input[type="radio"][value="${CSS.escape(first.value)}"]`);
            if (r) r.checked = true;
          }
        }
      }
    });
  });

  document.querySelectorAll('#subcategoryCheckboxes input[type="radio"]').forEach(r => {
    r.addEventListener('change', () => { if (r.checked) selectedPrimarySubcategory = r.value; });
  });
}

// ─── Additional info rows ────────────────────────────────────────────────────
function setupAdditionalInfoRows(prefill = []) {
  const holder = document.getElementById('additionalInfoFields');
  holder.innerHTML = '';
  const rows = prefill.length ? prefill : [{}];
  rows.forEach((r, idx) => {
    const row = document.createElement('div');
    row.className = 'pair-grid';
    row.innerHTML = `
      <label>Info Name ${idx+1}<input type="text" id="info_name_${idx}" maxlength="30" value="${r.label || ''}"></label>
      <label>Info Value ${idx+1}<input type="text" id="info_value_${idx}" maxlength="120" value="${r.value || ''}"></label>`;
    holder.appendChild(row);
  });
  document.getElementById('addInfoRowBtn').onclick = () => {
    if (holder.children.length >= 5) return;
    const last = holder.lastElementChild;
    if (last && ![...last.querySelectorAll('input')].every(i => i.value.trim())) return;
    const idx = holder.children.length;
    const row = document.createElement('div');
    row.className = 'pair-grid';
    row.innerHTML = `
      <label>Info Name ${idx+1}<input type="text" id="info_name_${idx}" maxlength="30"></label>
      <label>Info Value ${idx+1}<input type="text" id="info_value_${idx}" maxlength="120"></label>`;
    holder.appendChild(row);
  };
}

// ─── Pre-fill social media ───────────────────────────────────────────────────
function prefillSocialMedia(social) {
  if (!social) return;
  setVal('facebook',  social.facebook  || '');
  setVal('instagram', social.instagram || '');
  setVal('twitter',   social.twitter   || '');
  setVal('youtube',   social.youtube   || '');
  setVal('tiktok',    social.tiktok    || '');
  if (social.linkedin) setVal('linkedin', stripProtocol(social.linkedin));
}

// ─── Pre-fill reviews ────────────────────────────────────────────────────────
function prefillReviews(reviews) {
  if (!reviews) return;
  if (reviews.google)      setVal('google_reviews', stripProtocol(reviews.google));
  if (reviews.yelp)        setVal('yelp',           stripProtocol(reviews.yelp));
  if (reviews.tripadvisor) setVal('tripadvisor',    stripProtocol(reviews.tripadvisor));
}

// ─── Pre-fill owner info (respects visibility) ───────────────────────────────
function prefillOwnerInfo(listing) {
  const nameTitleVisible = !!listing.owner_name_title_visible;
  const emailVisible     = !!listing.owner_email_visible;
  const phoneVisible     = !!listing.owner_phone_visible;

  document.getElementById('owner_name_title_visible').checked = nameTitleVisible;
  document.getElementById('owner_email_visible').checked      = emailVisible;
  document.getElementById('owner_phone_visible').checked      = phoneVisible;

  if (nameTitleVisible) {
    setVal('owner_name', listing.owner_name || '');
    setVal('from_greece', listing.from_greece || '');

    const standardTitles = ['Founder','Co-Founder','CEO','Owner','Manager','Principal','Director','Co-Owner'];
    const titleEl = document.getElementById('owner_title');
    if (listing.owner_title) {
      if (standardTitles.includes(listing.owner_title)) {
        titleEl.value = listing.owner_title;
      } else {
        titleEl.value = 'Other';
        document.getElementById('ownerTitleOtherWrap').classList.remove('hidden');
        setVal('owner_title_other', listing.owner_title);
      }
    }
  }

  if (emailVisible && listing.owner_email) {
    setVal('owner_email', listing.owner_email);
  }

  if (phoneVisible && listing.owner_phone) {
    const digits = onlyDigits(listing.owner_phone).slice(-10);
    setVal('owner_phone', formatUSPhoneNoCode(digits));
  }

  // Enforce toggle dependency (email/phone disabled if name+title hidden)
  const emailToggle = document.getElementById('owner_email_visible');
  const phoneToggle = document.getElementById('owner_phone_visible');
  emailToggle.disabled = !nameTitleVisible;
  phoneToggle.disabled = !nameTitleVisible;
}

// ─── Pre-fill form ───────────────────────────────────────────────────────────
function prefillForm(listing) {
  // Hidden / banner fields
  setVal('listing_id_hidden',   String(listing.id));
  setVal('listing_name_hidden', listing.business_name || '');

  // Basic info
  setVal('business_name', listing.business_name || '');
  setVal('tagline', listing.tagline || '');

  // Category
  const catEl = document.getElementById('category');
  if (listing.category) catEl.value = listing.category;

  // Pricing
  if (listing.pricing != null) setVal('pricing', String(listing.pricing));

  // Coming soon
  document.getElementById('coming_soon').value = listing.coming_soon ? 'true' : 'false';

  // Subcategories (after category is set so options are rendered)
  selectedPrimarySubcategory = listing.primary_subcategory || null;
  renderSubcategories(listing.subcategories || [], listing.primary_subcategory);

  // Location
  setVal('address',  listing.address  || '');
  setVal('city',     listing.city     || '');
  setVal('zip_code', listing.zip_code || '');
  if (listing.state) document.getElementById('state').value = listing.state;

  // Map
  if (listing.coordinates?.lat && listing.coordinates?.lng) {
    setMapPin(parseFloat(listing.coordinates.lat), parseFloat(listing.coordinates.lng));
  }

  // Contact
  if (listing.phone) {
    const digits = onlyDigits(listing.phone).slice(-10);
    setVal('phone', formatUSPhoneNoCode(digits));
  }
  setVal('email', listing.email || '');
  if (listing.website) setVal('website', stripProtocol(listing.website));

  // Hours (after buildHoursRows)
  prefillHours(listing.hours);

  // Social media
  prefillSocialMedia(listing.social_media);

  // Reviews
  prefillReviews(listing.reviews);

  // Additional info
  setupAdditionalInfoRows(listing.additional_info || []);

  // Custom CTA (first one)
  if (listing.custom_ctas && listing.custom_ctas.length > 0) {
    const cta = listing.custom_ctas[0];
    setVal('cta_name_0', cta.name || '');
    if (cta.url)   setVal('cta_url_0',   stripProtocol(cta.url));
    if (cta.color) document.getElementById('cta_color_0').value = cta.color;
    setVal('cta_icon_0', cta.icon || '');
  }

  // Owner info (respects visibility)
  prefillOwnerInfo(listing);

  // Media
  if (listing.logo)  setVal('logo',  stripProtocol(listing.logo));
  if (listing.video) setVal('video', stripProtocol(listing.video));
  setupPhotoUrlRows(Array.isArray(listing.photos) ? listing.photos.map(p => stripProtocol(p || '')) : []);

  // Description - set via RTE or raw textarea
  if (descriptionEditor) {
    descriptionEditor.setHtml(listing.description || '');
  } else {
    setVal('description', listing.description || '');
  }
}

// ─── Fetch listing by ID ─────────────────────────────────────────────────────
async function fetchListing(id) {
  try {
    const { data, error } = await supabaseClient
      .from('listings')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) { console.error('Supabase error:', error); return null; }
    return data;
  } catch (err) {
    console.error('Fetch listing error:', err);
    return null;
  }
}

// ─── Load dynamic subcategories ───────────────────────────────────────────────
async function loadDynamicSubcategories() {
  try {
    const { data, error } = await supabaseClient.from('category_subcategories').select('category, subcategories');
    if (error) return;
    if (Array.isArray(data)) {
      const next = {};
      data.forEach(row => { if (row.category && Array.isArray(row.subcategories)) next[row.category] = row.subcategories; });
      SUBCATEGORY_MAP = { ...SUBCATEGORY_MAP, ...next };
    }
  } catch (e) { console.warn('Could not load dynamic subcategories', e); }
}

// ─── Collect form data ────────────────────────────────────────────────────────
function getFormData() {
  const subcategories  = [...document.querySelectorAll('#subcategoryCheckboxes input[type="checkbox"]:checked')].map(i => i.value);
  const additional_info = Array.from({ length: 5 }).map((_, i) => ({
    label: document.getElementById(`info_name_${i}`)?.value?.trim(),
    value: document.getElementById(`info_value_${i}`)?.value?.trim()
  })).filter(v => v.label && v.value);

  const hours = {};
  days.forEach(day => { const val = document.getElementById(`hours_${day}`)?.value?.trim(); if (val) hours[day] = val; });

  const custom_ctas = [];
  const ctaName = document.getElementById('cta_name_0').value.trim();
  const ctaUrl  = document.getElementById('cta_url_0').value.trim();
  if (ctaName || ctaUrl) {
    custom_ctas.push({
      name:  ctaName || 'Custom Button',
      url:   normalizeHttpsUrl(ctaUrl),
      color: document.getElementById('cta_color_0').value.trim() || '#045093',
      icon:  document.getElementById('cta_icon_0').value.trim()
    });
  }

  const photoUrls = [...document.querySelectorAll('.photo-url-input')]
    .map(i => normalizeHttpsUrl(i.value)).filter(Boolean);

  const ownerTitle = document.getElementById('owner_title').value === 'Other'
    ? document.getElementById('owner_title_other')?.value.trim()
    : document.getElementById('owner_title').value;

  const nameTitleVisible = document.getElementById('owner_name_title_visible').checked;
  const emailVisible     = document.getElementById('owner_email_visible').checked;
  const phoneVisible     = document.getElementById('owner_phone_visible').checked;

  return {
    listing_id:   document.getElementById('listing_id_hidden').value,
    listing_name: document.getElementById('listing_name_hidden').value,

    // Suggester info
    suggester_name:    document.getElementById('suggester_name').value.trim(),
    suggester_email:   document.getElementById('suggester_email').value.trim(),
    suggester_phone:   normalizePhone('suggester_phone'),
    suggester_message: document.getElementById('suggester_message').value.trim() || null,

    // Listing fields
    business_name:      document.getElementById('business_name').value.trim(),
    tagline:            document.getElementById('tagline').value.trim(),
    description:        descriptionEditor ? descriptionEditor.getHtml() : document.getElementById('description').value.trim(),
    category:           document.getElementById('category').value,
    pricing:            document.getElementById('pricing').value ? Number(document.getElementById('pricing').value) : null,
    coming_soon:        document.getElementById('coming_soon').value === 'true',
    subcategories,
    primary_subcategory: (selectedPrimarySubcategory && subcategories.includes(selectedPrimarySubcategory))
      ? selectedPrimarySubcategory : (subcategories[0] || null),

    address:  document.getElementById('address').value.trim()  || null,
    city:     document.getElementById('city').value.trim()     || null,
    state:    document.getElementById('state').value           || null,
    zip_code: document.getElementById('zip_code').value.trim() || null,
    country:  document.getElementById('country').value         || 'USA',

    phone:   normalizePhone('phone'),
    email:   document.getElementById('email').value.trim()       || null,
    website: normalizeHttpsUrl(document.getElementById('website').value),

    logo:   normalizeHttpsUrl(document.getElementById('logo').value),
    photos: photoUrls,
    video:  normalizeHttpsUrl(document.getElementById('video').value),

    hours,

    social_media: {
      facebook:  document.getElementById('facebook').value.trim()  || null,
      instagram: document.getElementById('instagram').value.trim() || null,
      twitter:   document.getElementById('twitter').value.trim()   || null,
      youtube:   document.getElementById('youtube').value.trim()   || null,
      tiktok:    document.getElementById('tiktok').value.trim()    || null,
      linkedin:  normalizeHttpsUrl(document.getElementById('linkedin').value)
    },

    reviews: {
      google:      normalizeHttpsUrl(document.getElementById('google_reviews').value),
      yelp:        normalizeHttpsUrl(document.getElementById('yelp').value),
      tripadvisor: normalizeHttpsUrl(document.getElementById('tripadvisor').value)
    },

    additional_info,
    custom_ctas,

    owner_name:  document.getElementById('owner_name').value.trim()  || null,
    owner_title: ownerTitle || null,
    from_greece: document.getElementById('from_greece').value.trim() || null,
    owner_email: document.getElementById('owner_email').value.trim() || null,
    owner_phone: normalizePhone('owner_phone'),

    owner_name_title_visible: nameTitleVisible,
    owner_email_visible:      emailVisible,
    owner_phone_visible:      phoneVisible,

    status: 'pending'
  };
}

// ─── Validate ─────────────────────────────────────────────────────────────────
function validatePayload(p) {
  const errors = [];

  if (!p.suggester_name)  errors.push('Your name is required.');
  if (!p.suggester_email) errors.push('Your email is required.');
  if (p.suggester_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.suggester_email)) {
    errors.push('Your email address is invalid.');
  }

  if (!p.business_name || !p.tagline || !p.description ||
      (window.RichTextEditor && !window.RichTextEditor.stripHtml(p.description))) {
    errors.push('Business name, tagline and description are required.');
  }
  if (!p.subcategories.length) errors.push('Select at least one subcategory.');
  if (p.zip_code && !/^\d{5}$/.test(p.zip_code)) errors.push('ZIP code must be exactly 5 digits.');
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) errors.push('Business email is invalid.');
  if (p.owner_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.owner_email)) errors.push('Owner email is invalid.');
  if (p.website && !/^https:\/\/[\w.-]+\.[a-z]{2,}/i.test(p.website)) errors.push('Website URL is invalid.');
  if (!p.listing_id) errors.push('No listing ID found — please return to the listing page.');

  // Each day must be readable as "Closed", "Open 24 Hours" or one or more time ranges
  // ("9:00 AM - 5:00 PM", or "8:00 AM - 11:00 AM, 5:00 PM - 8:00 PM" for split hours).
  Object.entries(p.hours || {}).forEach(([d, h]) => {
    if (h && window.TGDListingHours.parseHoursText(h) === null) {
      errors.push(`Hours for ${d} look incomplete (e.g. 9:00 AM - 5:00 PM).`);
    }
  });

  return errors;
}

// ─── Submit suggestion ────────────────────────────────────────────────────────
async function submitSuggestion(event) {
  event.preventDefault();
  const status    = document.getElementById('submitStatus');
  const submitBtn = document.getElementById('submitBtn');
  const payload   = getFormData();
  const errors    = validatePayload(payload);

  if (errors.length) {
    status.textContent = errors[0];
    status.style.color = '#b91c1c';
    return;
  }

  submitBtn.disabled   = true;
  status.textContent   = 'Submitting your suggestion…';
  status.style.color   = '#1f2937';

  const { error } = await supabaseClient.from('listing_suggestions').insert(payload);

  if (error) {
    status.textContent = `Submission failed: ${error.message}`;
    status.style.color = '#b91c1c';
    submitBtn.disabled = false;
  } else {
    status.textContent = '✅ Thank you! Your suggestion has been submitted and will be reviewed by our team.';
    status.style.color = '#166534';
    submitBtn.disabled = true; // keep disabled after success
    // Scroll to status
    status.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ─── UI state helpers ─────────────────────────────────────────────────────────
function showLoading()  { document.getElementById('loadingState').classList.remove('hidden'); }
function hideLoading()  { document.getElementById('loadingState').classList.add('hidden'); }
function showNotFound(msg) {
  hideLoading();
  document.getElementById('notFoundMsg').textContent = msg || 'Listing not found.';
  document.getElementById('notFoundState').classList.remove('hidden');
}
function showForm(businessName) {
  hideLoading();
  document.getElementById('bannerBusinessName').textContent = businessName;
  document.getElementById('suggestBanner').classList.remove('hidden');
  document.getElementById('suggestForm').classList.remove('hidden');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  const params    = new URLSearchParams(window.location.search);
  const listingId = params.get('id');

  if (!listingId) {
    showNotFound('No listing ID was provided. Please go back to the listing page and click "Suggest an Edit".');
    return;
  }

  currentListingId = listingId;

  // Build static form elements
  const categoryEl = document.getElementById('category');
  categoryEl.innerHTML = MAIN_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
  categoryEl.addEventListener('change', () => {
    selectedPrimarySubcategory = null;
    renderSubcategories();
  });

  const stateEl = document.getElementById('state');
  stateEl.innerHTML = Object.entries(US_STATES).map(([k,v]) => `<option value="${k}">${v}</option>`).join('');

  // Dynamic subcategory overrides
  await loadDynamicSubcategories();

  buildHoursRows();
  renderSubcategories();
  setupAdditionalInfoRows();
  setupPhotoUrlRows();
  setupMap();
  setupAddressAutocomplete();

  attachPhoneMask('phone');
  attachPhoneMask('owner_phone');
  attachPhoneMask('suggester_phone');

  lockHttpsInputs();

  // Owner toggle enforcement
  const nameTitleToggle = document.getElementById('owner_name_title_visible');
  const emailToggle     = document.getElementById('owner_email_visible');
  const phoneToggle     = document.getElementById('owner_phone_visible');

  const enforceOwnerToggles = () => {
    if (!nameTitleToggle.checked) { emailToggle.checked = false; phoneToggle.checked = false; }
    emailToggle.disabled = !nameTitleToggle.checked;
    phoneToggle.disabled = !nameTitleToggle.checked;
  };
  nameTitleToggle.addEventListener('change', enforceOwnerToggles);
  emailToggle.addEventListener('change', enforceOwnerToggles);
  phoneToggle.addEventListener('change', enforceOwnerToggles);

  // Owner title "Other" handler
  document.getElementById('owner_title').addEventListener('change', () => {
    const isOther = document.getElementById('owner_title').value === 'Other';
    document.getElementById('ownerTitleOtherWrap').classList.toggle('hidden', !isOther);
  });

  // Mount RTE
  if (window.RichTextEditor) {
    descriptionEditor = window.RichTextEditor.mount({ inputId: 'description' });
  }

  // Fetch and pre-fill listing
  showLoading();
  const listing = await fetchListing(listingId);

  if (!listing) {
    showNotFound(`Listing with ID "${listingId}" was not found.`);
    return;
  }

  prefillForm(listing);
  showForm(listing.business_name);
  enforceOwnerToggles();

  document.getElementById('suggestForm').addEventListener('submit', submitSuggestion);
}

document.addEventListener('DOMContentLoaded', init);