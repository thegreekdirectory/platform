importScripts("config.js");
const CACHE_MS = 3 * 60 * 60 * 1000;
async function installId() {
  const saved = await chrome.storage.local.get("installId");
  if (saved.installId) return saved.installId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}
async function lookup(ids) {
  const result = {}, missing = [];
  for (const id of [...new Set(ids)].slice(0, 30)) {
    const item = (await chrome.storage.session.get("p:" + id))["p:" + id];
    if (item && Date.now() - item.at < CACHE_MS) result[id] = item.listed;
    else missing.push(id);
  }
  if (missing.length) {
    const response = await fetch(TGD_CONFIG.url + "/functions/v1/greek-owned-maps-lookup", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: TGD_CONFIG.key },
      body: JSON.stringify({ installationId: await installId(), placeIds: missing })
    });
    if (!response.ok) throw new Error("Directory lookup unavailable");
    const data = await response.json(), listed = new Set(data.listedPlaceIds || []);
    for (const id of missing) {
      result[id] = listed.has(id);
      await chrome.storage.session.set({ ["p:" + id]: { listed: result[id], at: Date.now() } });
    }
  }
  return result;
}
async function submit(payload) {
  const response = await fetch(TGD_CONFIG.url + "/functions/v1/greek-owned-maps-suggest", {
    method: "POST", headers: { "Content-Type": "application/json", apikey: TGD_CONFIG.key },
    body: JSON.stringify({ ...payload, installationId: await installId() })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || "Submission failed");
  const { submitted = [] } = await chrome.storage.local.get("submitted");
  await chrome.storage.local.set({ submitted: [...new Set([...submitted, payload.placeId])] });
  return data;
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type !== "STATUS" && !sender.url?.startsWith("https://www.google.com/maps/") && !sender.url?.startsWith("https://maps.google.com/maps/")) {
    reply({ error: "Google Maps only" }); return;
  }
  if (msg.type === "LOOKUP") { lookup(msg.ids).then(data => reply({ data })).catch(e => reply({ error: e.message })); return true; }
  if (msg.type === "SUBMIT") { submit(msg.payload).then(data => reply({ data })).catch(e => reply({ error: e.message })); return true; }
  if (msg.type === "STATUS") { chrome.storage.local.get("submitted").then(data => reply(data)); return true; }
});