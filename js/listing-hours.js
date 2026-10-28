/*
 * Shared listing-hours helpers + the listing page's open/closed badge.
 *
 * DATA MODEL (listings.hours, jsonb)
 * ----------------------------------
 * Every weekday key (monday..sunday) holds an object:
 *
 *   { "status": "open" | "closed" | "24_hours" | "unknown",
 *     "ranges": [ { "open": "08:00", "close": "11:00" },
 *                 { "open": "17:00", "close": "20:00" } ] }
 *
 *  - Times are 24-hour "HH:MM". A range whose close is earlier than its open
 *    runs past midnight (e.g. 19:00 -> 03:00).
 *  - "closed", "24_hours" and "unknown" always carry "ranges": [].
 *  - A single 00:00 -> 23:59 range is the 24-hour sentinel and is always
 *    stored as status "24_hours".
 *
 * Rows written before this model existed stored one string per day
 * ("09:00-17:00", "Closed", "00:00-23:59", or free text such as
 * "9:00 AM - 5:00 PM"). normalizeDay() reads both shapes, so every consumer
 * keeps working whether a row has been migrated yet or not.
 *
 * Pure helpers (no DOM): normalizeDay, normalizeHours, hasAnyHours,
 * parseHoursText, formatTime12, formatDayLines, formatDayText, dayToSchedule,
 * findRangeProblem, computeOpenStatus.
 */
(function () {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  // Display / storage order (Monday first), unlike `days` which follows Date#getDay().
  const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const STATUS_OPEN = 'open';
  const STATUS_CLOSED = 'closed';
  const STATUS_24_HOURS = '24_hours';
  const STATUS_UNKNOWN = 'unknown';

  function pad2(n) { return String(n).padStart(2, '0'); }
  function minutesToHHMM(minutes) { return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`; }
  function hhmmToMinutes(hhmm) { return parseTimeToken(hhmm); }

  function makeDay(status, ranges) {
    return { status, ranges: ranges || [] };
  }

  // "9:00 AM", "9 am", "9:00AM", "09:00", "17:30" -> minutes since midnight, else null.
  // A bare "9" (no colon, no AM/PM) is ambiguous and is rejected.
  function parseTimeToken(token) {
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

  // "9:00 AM - 5:00 PM", "09:00-17:00", "9am to 5pm" -> { open, close } | null
  function parseRangeText(piece) {
    const parts = String(piece || '').trim().split(/\s*(?:-|\u2013|\u2014|\bto\b)\s*/i);
    if (parts.length !== 2) return null;
    const open = parseTimeToken(parts[0]);
    const close = parseTimeToken(parts[1]);
    if (open === null || close === null) return null;
    return { open: minutesToHHMM(open), close: minutesToHHMM(close) };
  }

  // Sort chronologically, drop exact duplicates, collapse the 00:00-23:59 sentinel
  // to "24_hours", and fall back to "unknown" when nothing valid is left.
  function normalizeRanges(list) {
    const sorted = (list || []).slice().sort((a, b) =>
      (hhmmToMinutes(a.open) - hhmmToMinutes(b.open)) || (hhmmToMinutes(a.close) - hhmmToMinutes(b.close)));
    const unique = sorted.filter((r, i) => i === 0 || r.open !== sorted[i - 1].open || r.close !== sorted[i - 1].close);
    if (!unique.length) return makeDay(STATUS_UNKNOWN, []);
    if (unique.length === 1 && unique[0].open === '00:00' && unique[0].close === '23:59') return makeDay(STATUS_24_HOURS, []);
    return makeDay(STATUS_OPEN, unique);
  }

  // Free text / legacy string -> day object.
  //   ''                       -> unknown
  //   'Closed'                 -> closed
  //   'Open 24 Hours', '00:00-23:59', 'Open All Day' -> 24_hours
  //   '9:00 AM - 5:00 PM'      -> one range
  //   '8-11 AM, 5-8 PM' style  -> several ranges, separated by , ; | & "and" or a new line
  // Returns null when the text is not empty but cannot be understood, so form
  // code can tell "left blank" apart from "typed something invalid".
  function parseHoursText(text) {
    const raw = String(text === null || text === undefined ? '' : text).trim();
    if (!raw) return makeDay(STATUS_UNKNOWN, []);
    if (/^closed$/i.test(raw)) return makeDay(STATUS_CLOSED, []);
    if (/24\s*hours?|open\s*24|^(?:open\s+)?all\s*day$/i.test(raw)) return makeDay(STATUS_24_HOURS, []);
    const pieces = raw.split(/\s*(?:,|;|\||\n|&|\band\b)\s*/i).filter(Boolean);
    const ranges = [];
    for (const piece of pieces) {
      const range = parseRangeText(piece);
      if (!range) return null;
      ranges.push(range);
    }
    return normalizeRanges(ranges);
  }

  // Any stored day value (new object, legacy string, null, garbage) -> { status, ranges }.
  function normalizeDay(value) {
    if (value === null || value === undefined) return makeDay(STATUS_UNKNOWN, []);
    if (typeof value === 'string') return parseHoursText(value) || makeDay(STATUS_UNKNOWN, []);
    if (typeof value !== 'object' || Array.isArray(value)) return makeDay(STATUS_UNKNOWN, []);
    const status = String(value.status || '').trim().toLowerCase();
    if (status === STATUS_CLOSED) return makeDay(STATUS_CLOSED, []);
    if (status === STATUS_24_HOURS) return makeDay(STATUS_24_HOURS, []);
    const ranges = (Array.isArray(value.ranges) ? value.ranges : []).map((r) => {
      if (!r || typeof r !== 'object') return null;
      const open = parseTimeToken(r.open);
      const close = parseTimeToken(r.close);
      return open === null || close === null ? null : { open: minutesToHHMM(open), close: minutesToHHMM(close) };
    }).filter(Boolean);
    return normalizeRanges(ranges);
  }

  // Full seven-day map in Monday..Sunday order; missing days become "unknown".
  function normalizeHours(hours) {
    const source = hours && typeof hours === 'object' && !Array.isArray(hours) ? hours : {};
    const out = {};
    DAY_KEYS.forEach((key) => { out[key] = normalizeDay(source[key]); });
    return out;
  }

  // True when at least one day is closed / 24 hours / has ranges.
  function hasAnyHours(hours) {
    if (!hours || typeof hours !== 'object') return false;
    return DAY_KEYS.some((key) => normalizeDay(hours[key]).status !== STATUS_UNKNOWN);
  }

  // 'HH:MM' -> '9:00 AM'
  function formatTime12(hhmm) {
    const minutes = parseTimeToken(hhmm);
    if (minutes === null) return '';
    const hour24 = Math.floor(minutes / 60);
    return `${hour24 % 12 || 12}:${pad2(minutes % 60)} ${hour24 >= 12 ? 'PM' : 'AM'}`;
  }

  // Lines for a day on a listing page / PDF. unknown -> [] so the caller decides the fallback.
  function formatDayLines(value, labels) {
    const l = Object.assign({ closed: 'Closed', allDay: 'Open All Day' }, labels || {});
    const day = normalizeDay(value);
    if (day.status === STATUS_CLOSED) return [l.closed];
    if (day.status === STATUS_24_HOURS) return [l.allDay];
    return day.ranges.map((r) => `${formatTime12(r.open)} - ${formatTime12(r.close)}`);
  }

  // Single-line text for plain text inputs (public suggest-edit form).
  function formatDayText(value) {
    const day = normalizeDay(value);
    if (day.status === STATUS_CLOSED) return 'Closed';
    if (day.status === STATUS_24_HOURS) return 'Open 24 Hours';
    return formatDayLines(day).join(', ');
  }

  // Shape the status engines work with: null (unknown), { closed: true },
  // { allDay: true, ... } or { ranges: [{ startMinutes, endMinutes }] }.
  // Each engine decides for itself what counts as "overnight".
  function dayToSchedule(value) {
    const day = normalizeDay(value);
    if (day.status === STATUS_CLOSED) return { closed: true };
    if (day.status === STATUS_24_HOURS) return { allDay: true, startMinutes: 0, endMinutes: 1439, overnight: false, closed: false, ranges: [] };
    if (day.status !== STATUS_OPEN) return null;
    return {
      closed: false,
      allDay: false,
      ranges: day.ranges.map((r) => ({ startMinutes: hhmmToMinutes(r.open), endMinutes: hhmmToMinutes(r.close) }))
    };
  }

  // Validation for editors. `ranges` must already be complete { open, close } pairs.
  // Returns '' when fine, 'same' when a range opens and closes at the same time,
  // 'overlap' when two ranges on the same day overlap.
  function findRangeProblem(ranges) {
    const items = (ranges || []).map((r) => ({ s: hhmmToMinutes(r.open), e: hhmmToMinutes(r.close) }));
    if (items.some((it) => it.s === it.e)) return 'same';
    // For same-day overlap an overnight range is treated as running until midnight.
    const spans = items.map((it) => ({ s: it.s, e: it.e > it.s ? it.e : 1440 })).sort((a, b) => a.s - b.s);
    for (let i = 1; i < spans.length; i += 1) {
      if (spans[i].s < spans[i - 1].e) return 'overlap';
    }
    return '';
  }

  function parseHoursToMinutes(hoursText) {
    if (!hoursText || typeof hoursText !== 'string') return null;
    const value = hoursText.trim();
    if (!value || value.toLowerCase() === 'closed') return null;
    if (/24\s*hours|open\s*24/i.test(value) || value === '00:00-23:59') {
      return { startMinutes: 0, endMinutes: 1439, overnight: false, is24Hours: true };
    }
    const h24 = value.match(/^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/);
    if (h24) {
      const startMinutes = Number(h24[1]) * 60 + Number(h24[2]);
      const endMinutes = Number(h24[3]) * 60 + Number(h24[4]);
      return { startMinutes, endMinutes, overnight: endMinutes < startMinutes, is24Hours: false };
    }
    const h12 = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!h12) return null;
    let [, sh, sm, sp, eh, em, ep] = h12;
    let start = Number(sh); let end = Number(eh);
    if (sp.toUpperCase() === 'PM' && start !== 12) start += 12;
    if (sp.toUpperCase() === 'AM' && start === 12) start = 0;
    if (ep.toUpperCase() === 'PM' && end !== 12) end += 12;
    if (ep.toUpperCase() === 'AM' && end === 12) end = 0;
    const startMinutes = start * 60 + Number(sm);
    const endMinutes = end * 60 + Number(em);
    return { startMinutes, endMinutes, overnight: endMinutes < startMinutes, is24Hours: false };
  }

  async function getServerNow(endpoint, authHeaders = {}) {
    const resp = await fetch(endpoint, { method: 'GET', headers: { 'Accept': 'application/json', ...authHeaders }, cache: 'no-store' });
    if (!resp.ok) throw new Error('Failed to fetch authoritative server time.');
    const payload = await resp.json();
    if (!payload?.nowUtc) throw new Error('Server time payload missing nowUtc.');
    return new Date(payload.nowUtc);
  }

  function getListingLocalParts(serverNow, tz) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(serverNow);
    const weekday = (parts.find(p => p.type === 'weekday')?.value || '').toLowerCase();
    const hour = Number(parts.find(p => p.type === 'hour')?.value || 0);
    const minute = Number(parts.find(p => p.type === 'minute')?.value || 0);
    return { weekday, hour, minute, currentMinutes: hour * 60 + minute };
  }

  function applyStatus(status) {
    const badge = document.getElementById('openClosedBadge');
    const statusText = document.getElementById('openStatusText');
    if (!badge || !statusText) return;
    const map = {
      OPEN: ['OPEN', 'badge badge-open', 'Open Now', 'open-now'],
      CLOSED: ['CLOSED', 'badge badge-closed', 'Closed Now', 'closed-now'],
      OPENING_SOON: ['OPENING SOON', 'badge badge-opening-soon', 'Opening Soon', 'open-now'],
      CLOSING_SOON: ['CLOSING SOON', 'badge badge-closing-soon', 'Closing Soon', 'open-now'],
      OPEN_24: ['OPEN', 'badge badge-open', 'Open 24 Hours', 'open-now']
    };
    const m = map[status] || map.CLOSED;
    badge.textContent = m[0]; badge.className = m[1];
    statusText.textContent = m[2]; statusText.className = m[3];
  }

  // Open/closed status for a given local weekday + time. Pure (no DOM, no network).
  // Returns 'OPEN' | 'CLOSED' | 'OPENING_SOON' | 'CLOSING_SOON' | 'OPEN_24', or null when the
  // listing has no hours at all. Every range of the day is considered, so a business that is
  // open 8-11 AM and 5-8 PM reads Closed at 2 PM and Opening Soon from 4 PM.
  function computeOpenStatus(hoursData, local) {
    if (!hasAnyHours(hoursData)) return null;
    const today = local.weekday;
    const todayIndex = days.indexOf(today);
    const yesterday = days[(todayIndex + 6) % 7];
    const todaySchedule = dayToSchedule(hoursData[today]);
    const yesterdaySchedule = dayToSchedule(yesterday && hoursData[yesterday]);
    const now = local.currentMinutes;

    if (todaySchedule?.allDay) return 'OPEN_24';

    // A range that started yesterday and runs past midnight.
    const carryOver = (yesterdaySchedule?.ranges || []).find((r) => r.endMinutes < r.startMinutes && now <= r.endMinutes);
    if (carryOver) {
      const remaining = carryOver.endMinutes - now;
      return remaining > 0 && remaining <= 60 ? 'CLOSING_SOON' : 'OPEN';
    }

    const ranges = todaySchedule && !todaySchedule.closed && !todaySchedule.allDay ? todaySchedule.ranges : [];
    if (!ranges.length) return 'CLOSED';

    for (const r of ranges) {
      const overnight = r.endMinutes < r.startMinutes;
      const isOpen = overnight
        ? (now >= r.startMinutes || now <= r.endMinutes)
        : (now >= r.startMinutes && now <= r.endMinutes);
      if (!isOpen) continue;
      const minsToClose = overnight
        ? (now <= r.endMinutes ? r.endMinutes - now : (1440 - now) + r.endMinutes)
        : r.endMinutes - now;
      return minsToClose > 0 && minsToClose <= 60 ? 'CLOSING_SOON' : 'OPEN';
    }

    // Closed right now: "opening soon" when the next range starts within the hour.
    const untilNext = ranges.map((r) => r.startMinutes - now).filter((d) => d > 0);
    const minsToOpen = untilNext.length ? Math.min(...untilNext) : Infinity;
    return minsToOpen <= 60 ? 'OPENING_SOON' : 'CLOSED';
  }

  async function updateOpenClosedBadge({ hoursData, businessTimezone, hoursServerTimeEndpoint, hoursServerAuth }) {
    if (!hasAnyHours(hoursData)) return;
    const serverNow = await getServerNow(hoursServerTimeEndpoint, hoursServerAuth || {});
    const local = getListingLocalParts(serverNow, businessTimezone || 'America/Chicago');
    const today = local.weekday;

    document.querySelectorAll('[data-hours-day]').forEach((row) => {
      row.querySelector('.hours-day-label')?.classList.remove('font-bold');
      row.querySelector('.hours-day-value')?.classList.remove('font-bold');
    });
    const todayRow = document.querySelector(`[data-hours-day="${today}"]`);
    todayRow?.querySelector('.hours-day-label')?.classList.add('font-bold');
    todayRow?.querySelector('.hours-day-value')?.classList.add('font-bold');

    applyStatus(computeOpenStatus(hoursData, local));
  }

  window.TGDListingHours = {
    updateOpenClosedBadge,
    parseHoursToMinutes,
    getListingLocalParts,
    computeOpenStatus,
    DAY_KEYS,
    normalizeDay,
    normalizeHours,
    hasAnyHours,
    parseHoursText,
    formatTime12,
    formatDayLines,
    formatDayText,
    dayToSchedule,
    findRangeProblem
  };
})();