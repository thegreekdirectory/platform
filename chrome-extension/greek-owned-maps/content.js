(() => {
  if (window.__tgdMapsExtension) return;
  window.__tgdMapsExtension = true;
  const css = document.createElement("style");
  css.textContent = ".tgd-badge{display:inline-block;background:#e8f3ff;color:#064b83;border:1px solid #b8d9f5;border-radius:20px;padding:3px 8px;font:600 11px Arial;margin:4px}.tgd-suggest{background:white;color:#07558d;border:1px solid #07558d;border-radius:7px;padding:8px 10px;font-weight:600;cursor:pointer;margin:7px}";
  document.documentElement.appendChild(css);
  function idFrom(url) {
    try {
      const u = new URL(url, location.href);
      const q = u.searchParams.get("query_place_id") || u.searchParams.get("place_id");
      if (q && /^[A-Za-z0-9_-]{8,300}$/.test(q)) return q;
      const m = decodeURIComponent(u.href).match(/(ChIJ[A-Za-z0-9_-]{10,})/);
      return m ? m[1] : null;
    } catch { return null; }
  }
  function showForm(place) {
    if (document.getElementById("tgd-form")) return;
    const box = document.createElement("div");
    box.id = "tgd-form";
    box.style.cssText = "position:fixed;inset:0;z-index:999999;background:#0008;display:grid;place-items:center;font:14px Arial";
    const panel = document.createElement("div");
    panel.style.cssText = "background:white;color:#17212b;padding:22px;border-radius:12px;width:min(400px,90vw)";
    panel.innerHTML = '<h2>Suggest a Greek-owned business</h2><p>Suggestions are reviewed before being added.</p><strong class="business"></strong><form><p><label><input type="radio" name="rel" value="owner" required> I\'m the owner</label></p><p><label><input type="radio" name="rel" value="family_friend"> Family or friend</label></p><p><label><input type="radio" name="rel" value="knows"> I know it\'s Greek-owned</label></p><p>Optional note</p><textarea maxlength="500" style="width:100%;min-height:65px"></textarea><p class="status"></p><button type="button" class="cancel">Cancel</button> <button type="submit">Submit suggestion</button></form>';
    panel.querySelector(".business").textContent = place.name;
    panel.querySelector(".cancel").onclick = () => box.remove();
    panel.querySelector("form").onsubmit = async e => {
      e.preventDefault();
      const status = panel.querySelector(".status"), rel = panel.querySelector("[name=rel]:checked")?.value;
      if (!rel) return;
      const btn = panel.querySelector("button[type=submit]"); btn.disabled = true; status.textContent = "Submitting…";
      const response = await chrome.runtime.sendMessage({type:"SUBMIT",payload:{placeId:place.id,businessName:place.name,address:place.address,relationship:rel,note:panel.querySelector("textarea").value}});
      status.textContent = response.error || response.data?.message || "Submitted for review.";
      if (!response.error) setTimeout(() => box.remove(), 1800); else btn.disabled = false;
    };
    box.appendChild(panel); document.documentElement.appendChild(box);
  }
  async function scan() {
    const entries = [];
    for (const a of document.querySelectorAll('a[href*="/maps/place/"],a[href*="query_place_id"]')) {
      if (a.dataset.tgdDone) continue;
      a.dataset.tgdDone = "1";
      const id = idFrom(a.href); if (!id) continue;
      const card = a.closest('[role="article"]') || a.parentElement?.parentElement;
      const name = card?.querySelector('[role="heading"]')?.textContent?.trim() || a.getAttribute("aria-label") || "";
      if (card && name) entries.push({id,card,name:name.slice(0,200),address:""});
    }
    const detailId = idFrom(location.href), heading = document.querySelector("h1");
    if (detailId && heading && !heading.parentElement.querySelector(".tgd-suggest")) {
      const button = document.createElement("button"); button.className="tgd-suggest"; button.textContent="Suggest for the Greek-owned list";
      button.onclick=()=>showForm({id:detailId,name:heading.textContent.trim(),address:""});
      heading.parentElement.appendChild(button);
    }
    if (!entries.length) return;
    const response = await chrome.runtime.sendMessage({type:"LOOKUP",ids:entries.map(x=>x.id)});
    if (response.error) return;
    for (const item of entries) {
      if (response.data[item.id]) {
        const badge=document.createElement("span"); badge.className="tgd-badge"; badge.textContent="✓ Greek-owned · TGD";
        item.card.appendChild(badge);
      }
      if (!item.card.querySelector(".tgd-suggest")) {
        const button=document.createElement("button"); button.className="tgd-suggest"; button.textContent="Suggest for the Greek-owned list";
        button.onclick=()=>showForm(item); item.card.appendChild(button);
      }
    }
  }
  let timer; new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(scan,500)}).observe(document.documentElement,{childList:true,subtree:true});
  scan();
})();