(() => {
  if (window.__tgdMapsExtension) return;
  window.__tgdMapsExtension = true;

  const style = document.createElement("style");
  style.textContent = `
    #tgd-maps-status{position:fixed!important;top:88px!important;right:16px!important;z-index:2147483647!important;max-width:320px!important;padding:10px 14px!important;border:1px solid #b8d9f5!important;border-radius:10px!important;background:#fff!important;color:#123!important;box-shadow:0 2px 12px #0003!important;font:600 13px/1.4 Arial,sans-serif!important}
    .tgd-badge{display:inline-block!important;background:#e8f3ff!important;color:#064b83!important;border:1px solid #b8d9f5!important;border-radius:20px!important;padding:3px 8px!important;font:600 11px Arial,sans-serif!important;margin:4px!important}
    .tgd-suggest{background:white!important;color:#07558d!important;border:1px solid #07558d!important;border-radius:7px!important;padding:8px 10px!important;font:600 12px Arial,sans-serif!important;cursor:pointer!important;margin:7px!important}
    #tgd-form{position:fixed!important;inset:0!important;z-index:2147483647!important;background:#0008!important;display:grid!important;place-items:center!important;font:14px Arial,sans-serif!important}
    #tgd-form-panel{background:white!important;color:#17212b!important;padding:22px!important;border-radius:12px!important;width:min(400px,90vw)!important;box-shadow:0 5px 30px #0004!important}
  `;
  (document.head || document.documentElement).appendChild(style);

  function status(message) {
    let node = document.getElementById("tgd-maps-status");
    if (!node) {
      node = document.createElement("div");
      node.id = "tgd-maps-status";
      node.setAttribute("role", "status");
      (document.body || document.documentElement).appendChild(node);
    }
    node.textContent = "The Greek Directory · " + message;
  }

  function idFrom(value) {
    try {
      const url = new URL(value, location.href);
      const parameter = url.searchParams.get("query_place_id") || url.searchParams.get("place_id");
      if (parameter && /^[A-Za-z0-9_-]{8,300}$/.test(parameter)) return parameter;
      const decoded = decodeURIComponent(url.href);
      const match = decoded.match(/(ChIJ[A-Za-z0-9_-]{10,})/);
      return match ? match[1] : null;
    } catch { return null; }
  }

  function showForm(place) {
    if (document.getElementById("tgd-form")) return;
    const overlay = document.createElement("div");
    overlay.id = "tgd-form";
    const panel = document.createElement("div");
    panel.id = "tgd-form-panel";
    const title = document.createElement("h2");
    title.textContent = "Suggest a Greek-owned business";
    const intro = document.createElement("p");
    intro.textContent = "Suggestions are reviewed by The Greek Directory before being added.";
    const business = document.createElement("strong");
    business.textContent = place.name || "Current Google Maps business";
    const form = document.createElement("form");
    const choices = [
      ["owner", "I'm the owner"],
      ["family_friend", "Family or friend"],
      ["knows", "I know it's Greek-owned"]
    ];
    for (const [value, label] of choices) {
      const p = document.createElement("p");
      const input = document.createElement("input");
      input.type = "radio"; input.name = "relationship"; input.value = value; input.required = true;
      const text = document.createElement("label");
      text.append(input, document.createTextNode(" " + label));
      p.appendChild(text); form.appendChild(p);
    }
    const noteLabel = document.createElement("p"); noteLabel.textContent = "Optional note";
    const note = document.createElement("textarea"); note.maxLength = 500; note.style.cssText = "width:100%;min-height:65px";
    const message = document.createElement("p"); message.setAttribute("aria-live", "polite");
    const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "Cancel";
    cancel.onclick = () => overlay.remove();
    const submit = document.createElement("button"); submit.type = "submit"; submit.textContent = "Submit suggestion";
    if (!place.id) {
      message.textContent = "Google Maps has not exposed a supported Google Place ID for this business. This version cannot submit it yet.";
      submit.disabled = true;
    }
    form.append(noteLabel, note, message, cancel, document.createTextNode(" "), submit);
    form.onsubmit = async event => {
      event.preventDefault();
      if (!place.id) return;
      submit.disabled = true; message.textContent = "Submitting…";
      try {
        const result = await chrome.runtime.sendMessage({type:"SUBMIT",payload:{
          placeId:place.id,businessName:place.name,address:place.address || "",
          relationship:form.querySelector('[name="relationship"]:checked')?.value,
          note:note.value
        }});
        if (result?.error) throw new Error(result.error);
        message.textContent = result?.data?.message || "Submitted for review.";
        setTimeout(() => overlay.remove(), 1800);
      } catch (error) {
        message.textContent = error.message || "Submission failed.";
        submit.disabled = false;
      }
    };
    panel.append(title,intro,business,form);
    overlay.appendChild(panel);
    overlay.addEventListener("click",event=>{if(event.target===overlay)overlay.remove()});
    document.documentElement.appendChild(overlay);
  }

  async function scan() {
    if (!document.body) return;
    const detailId = idFrom(location.href);
    const heading = document.querySelector("h1");
    const placeName = heading?.textContent?.trim() || "";
    const detailPage = Boolean(heading && (location.href.includes("/place/") || detailId));

    const entries = [];
    for (const anchor of document.querySelectorAll('a[href*="/maps/place/"],a[href*="query_place_id"],a[href*="place_id="]')) {
      const card = anchor.closest('[role="article"]');
      if (!card || card.dataset.tgdScanned === "1") continue;
      card.dataset.tgdScanned = "1";
      const id = idFrom(anchor.href);
      const name = card.querySelector('[role="heading"]')?.textContent?.trim() || anchor.getAttribute("aria-label") || "";
      if (id && name) entries.push({id,card,name:name.slice(0,200),address:""});
    }

    if (detailPage && heading) {
      const parent = heading.parentElement || heading;
      if (!parent.querySelector(".tgd-suggest")) {
        const button = document.createElement("button");
        button.className = "tgd-suggest";
        button.textContent = "Suggest for the Greek-owned list";
        button.onclick = () => showForm({id:detailId,name:placeName,address:""});
        parent.appendChild(button);
      }
      if (!detailId) {
        status("Active. This business page does not expose a supported Place ID, so its listing cannot be checked or suggested yet.");
      } else {
        try {
          const result = await chrome.runtime.sendMessage({type:"LOOKUP",ids:[detailId]});
          if (result?.error) throw new Error(result.error);
          if (result.data?.[detailId] && !parent.querySelector(".tgd-badge")) {
            const badge = document.createElement("span"); badge.className="tgd-badge";
            badge.textContent = "✓ Greek-owned · TGD"; parent.appendChild(badge);
          }
          status(result.data?.[detailId] ? "This business is listed in TGD." : "Active. This business is not currently matched to a visible TGD listing.");
        } catch (error) { status("Extension active, but the directory check failed: " + (error.message || "network error")); }
      }
    } else {
      status("Extension is active on Google Maps. Open a business page to check it or suggest it.");
    }

    if (entries.length) {
      try {
        const result = await chrome.runtime.sendMessage({type:"LOOKUP",ids:entries.map(item=>item.id)});
        if (result?.error) throw new Error(result.error);
        for (const item of entries) {
          if (result.data?.[item.id] && !item.card.querySelector(".tgd-badge")) {
            const badge=document.createElement("span"); badge.className="tgd-badge";
            badge.textContent="✓ Greek-owned · TGD"; item.card.appendChild(badge);
          }
          if (!item.card.querySelector(".tgd-suggest")) {
            const button=document.createElement("button"); button.className="tgd-suggest";
            button.textContent="Suggest for the Greek-owned list";
            button.onclick=()=>showForm(item); item.card.appendChild(button);
          }
        }
      } catch (error) { status("Extension active, but lookup failed: " + (error.message || "network error")); }
    }
  }

  let timer;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => scan(), 700); };
  const observer = new MutationObserver(schedule);
  if (document.documentElement) observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("hashchange",schedule);
  scan();
})();