importScripts("config.js");

const CACHE_MS = 3 * 60 * 60 * 1000;
const CACHE_PREFIX = "p4:"; // Refresh Google records to include their public TGD slugs.
const YELP_CACHE_PREFIX = "y1:";

async function installId() {
  const saved = await chrome.storage.local.get("installId");
  if (saved.installId) return saved.installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

async function lookup(ids) {
  const result = {}, missing = [];
  const validIds = [...new Set((ids || []).filter(
    (id) => typeof id === "string" && /^ChIJ[A-Za-z0-9_-]{23}$/.test(id)
  ))].slice(0, 30);

  for (const id of validIds) {
    const cacheKey = CACHE_PREFIX + id;
    const item = (await chrome.storage.session.get(cacheKey))[cacheKey];
    if (item && Date.now() - item.at < CACHE_MS) result[id] = item.listed;
    else missing.push(id);
  }

  if (missing.length) {
    const response = await fetch(TGD_CONFIG.url + "/functions/v1/greek-owned-maps-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: TGD_CONFIG.key },
      body: JSON.stringify({ installationId: await installId(), placeIds: missing })
    });
    if (!response.ok) throw new Error("Directory lookup unavailable");
    const data = await response.json();
    const listed = new Set(data.listedPlaceIds || []);
    const records = new Map((data.matches || []).map((item) => [item.placeId, item]));
    for (const id of missing) {
      const record = records.get(id);
      result[id] = record
        ? { listed: true, slug: typeof record.slug === "string" ? record.slug : null }
        : (listed.has(id) ? { listed: true, slug: null } : false);
      await chrome.storage.session.set({
        [CACHE_PREFIX + id]: { listed: result[id], at: Date.now() }
      });
    }
  }
  return result;
}

async function submit(payload) {
  const response = await fetch(TGD_CONFIG.url + "/functions/v1/greek-owned-maps-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: TGD_CONFIG.key },
    body: JSON.stringify({ ...payload, installationId: await installId() })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Submission failed");
  const { submitted = [] } = await chrome.storage.local.get("submitted");
  await chrome.storage.local.set({
    submitted: [...new Set([...submitted, payload.placeId])]
  });
  return data;
}

async function lookupYelp(ids) {
  const result = {}, missing = [];
  const validIds = [...new Set((ids || []).filter(
    (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,255}$/.test(id)
  ))].slice(0, 30);

  for (const id of validIds) {
    const cacheKey = YELP_CACHE_PREFIX + id;
    const item = (await chrome.storage.session.get(cacheKey))[cacheKey];
    if (item && Date.now() - item.at < CACHE_MS) result[id] = item.listed;
    else missing.push(id);
  }

  if (missing.length) {
    const response = await fetch(TGD_CONFIG.url + "/functions/v1/greek-owned-yelp-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: TGD_CONFIG.key },
      body: JSON.stringify({ installationId: await installId(), yelpIds: missing })
    });
    if (!response.ok) throw new Error("Yelp directory lookup unavailable");
    const data = await response.json();
    const listed = new Set(data.listedYelpIds || []);
    const records = new Map((data.matches || []).map((item) => [item.yelpId, item]));
    for (const id of missing) {
      const record = records.get(id);
      result[id] = record
        ? { listed: true, slug: typeof record.slug === "string" ? record.slug : null }
        : (listed.has(id) ? { listed: true, slug: null } : false);
      await chrome.storage.session.set({
        [YELP_CACHE_PREFIX + id]: { listed: result[id], at: Date.now() }
      });
    }
  }
  return result;
}

async function submitYelp(payload) {
  const response = await fetch(TGD_CONFIG.url + "/functions/v1/greek-owned-yelp-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: TGD_CONFIG.key },
    body: JSON.stringify({ ...payload, installationId: await installId() })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Submission failed");
  const { submittedYelp = [] } = await chrome.storage.local.get("submittedYelp");
  await chrome.storage.local.set({
    submittedYelp: [...new Set([...submittedYelp, payload.yelpId])]
  });
  return data;
}

function isGoogleMapsUrl(url) {
  return typeof url === "string" &&
    (url.startsWith("https://www.google.com/maps/") ||
      url.startsWith("https://maps.google.com/maps/"));
}

function isYelpUrl(url) {
  return typeof url === "string" &&
    (url.startsWith("https://www.yelp.com/") || url.startsWith("https://yelp.com/"));
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "STATUS") {
    chrome.storage.local.get(["submitted", "submittedYelp"]).then((data) => reply(data));
    return true;
  }

  if ((msg.type === "LOOKUP" || msg.type === "SUBMIT") && !isGoogleMapsUrl(sender.url)) {
    reply({ error: "Google Maps only" });
    return;
  }
  if ((msg.type === "LOOKUP_YELP" || msg.type === "SUBMIT_YELP") && !isYelpUrl(sender.url)) {
    reply({ error: "Yelp only" });
    return;
  }

  if (msg.type === "LOOKUP") {
    lookup(msg.ids).then((data) => reply({ data })).catch((error) => reply({ error: error.message }));
    return true;
  }
  if (msg.type === "SUBMIT") {
    submit(msg.payload).then((data) => reply({ data })).catch((error) => reply({ error: error.message }));
    return true;
  }
  if (msg.type === "LOOKUP_YELP") {
    lookupYelp(msg.ids).then((data) => reply({ data })).catch((error) => reply({ error: error.message }));
    return true;
  }
  if (msg.type === "SUBMIT_YELP") {
    submitYelp(msg.payload).then((data) => reply({ data })).catch((error) => reply({ error: error.message }));
    return true;
  }
});