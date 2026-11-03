(() => {
  if (window.__tgdMapsExtension) return;
  window.__tgdMapsExtension = true;

  function getPlaceIdFromUrl(url) {
    const regex = /0x[0-9a-fA-F]+:0x[0-9a-fA-F]+/g;
    const matches = String(url).match(regex);
    if (!matches || matches.length === 0) return null;
    const targetPair = matches[matches.length - 1];
    const [midHex, cidHex] = targetPair.split(":");
    const mid = BigInt(midHex), cid = BigInt(cidHex);
    const buffer = new Uint8Array(21);
    buffer[0] = 0x0a; buffer[1] = 0x12; buffer[2] = 0x09;
    let tempMid = mid;
    for (let i = 0; i < 8; i++) { buffer[3 + i] = Number(tempMid & 0xffn); tempMid >>= 8n; }
    buffer[11] = 0x11;
    let tempCid = cid;
    for (let i = 0; i < 8; i++) { buffer[12 + i] = Number(tempCid & 0xffn); tempCid >>= 8n; }
    let binaryString = "";
    for (let i = 0; i < buffer.length; i++) binaryString += String.fromCharCode(buffer[i]);
    // Google Place IDs use Base64URL, not standard Base64.
    // Convert "+" -> "-" and "/" -> "_" before matching the directory's stored IDs.
    const base64 = btoa(binaryString).replace(/\+/g, "-").replace(/\//g, "_");
    return base64.endsWith("A") ? base64.slice(0, -1) : base64;
  }

  // TGD stores normalized 27-character Place IDs. Some Maps URLs expose
  // the same Base64 value with an extra trailing A (28 characters).
  // Trim only that 28th character; 27-character IDs ending in A are valid.
  function normalizePlaceId(value) {
    if (typeof value !== "string") return null;
    let id = value.trim();
    if (id.length === 28 && id.startsWith("ChIJ") && id.endsWith("A")) id = id.slice(0, -1);
    return /^ChIJ[A-Za-z0-9_-]{23}$/.test(id) ? id : null;
  }

  function idFrom(value) {
    try {
      const url = new URL(value, location.href);
      const decoded = decodeURIComponent(url.href);

      // Prefer the MID/CID conversion when the Maps URL includes its pair.
      // It is the same conversion used to generate TGD's stored Place IDs.
      const fromPair = getPlaceIdFromUrl(decoded);
      if (fromPair) return normalizePlaceId(fromPair);

      const parameter = url.searchParams.get("query_place_id") || url.searchParams.get("place_id");
      const fromParameter = normalizePlaceId(parameter);
      if (fromParameter) return fromParameter;

      const direct = decoded.match(/(ChIJ[A-Za-z0-9_-]{10,})/);
      return direct ? normalizePlaceId(direct[1]) : null;
    } catch {
      try { return normalizePlaceId(getPlaceIdFromUrl(value)); }
      catch { return null; }
    }
  }

  function showForm(place) {
    if (document.getElementById("tgd-form")) return;
    const overlay = document.createElement("div");
    overlay.id = "tgd-form";
    const panel = document.createElement("section");
    panel.id = "tgd-form-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "tgd-modal-title");

    const header = document.createElement("header"); header.className = "tgd-modal-header";
    const mark = document.createElement("span"); mark.className = "tgd-modal-mark"; mark.textContent = "TGD"; mark.setAttribute("aria-hidden", "true");
    const branding = document.createElement("div"); branding.className = "tgd-modal-branding";
    const eyebrow = document.createElement("span"); eyebrow.className = "tgd-modal-eyebrow"; eyebrow.textContent = "Community submission";
    const title = document.createElement("h2"); title.className = "tgd-modal-title"; title.id = "tgd-modal-title"; title.textContent = "Suggest a Greek-owned business";
    branding.append(eyebrow,title);
    const close = document.createElement("button"); close.type = "button"; close.className = "tgd-modal-close"; close.setAttribute("aria-label","Close suggestion form"); close.innerHTML = "&times;";
    header.append(mark,branding,close);

    const body = document.createElement("div"); body.className = "tgd-modal-body";
    const intro = document.createElement("p"); intro.className = "tgd-modal-intro"; intro.textContent = "Help grow the Greek-American business community. Every suggestion is reviewed before it is added to TGD.";
    const businessCard = document.createElement("div"); businessCard.className = "tgd-business-card";
    const businessIcon = document.createElement("span"); businessIcon.className = "tgd-business-icon"; businessIcon.textContent = "⌖"; businessIcon.setAttribute("aria-hidden","true");
    const businessDetails = document.createElement("span"); businessDetails.className = "tgd-business-details";
    const businessLabel = document.createElement("span"); businessLabel.className = "tgd-business-label"; businessLabel.textContent = "Google Maps business";
    const businessName = document.createElement("strong"); businessName.className = "tgd-business-name"; businessName.textContent = place.name || "Current Google Maps business";
    businessDetails.append(businessLabel,businessName); businessCard.append(businessIcon,businessDetails);

    const form = document.createElement("form");
    const fieldset = document.createElement("fieldset"); fieldset.className = "tgd-choice-fieldset";
    const legend = document.createElement("legend"); legend.className = "tgd-choice-legend"; legend.textContent = "How do you know this business is Greek-owned?";
    fieldset.appendChild(legend);
    for (const [value,labelText] of [["owner","I'm the owner"],["family_friend","Family or friend"],["knows","I know it's Greek-owned"]]) {
      const label = document.createElement("label"); label.className = "tgd-choice";
      const input = document.createElement("input"); input.type="radio"; input.name="relationship"; input.value=value; input.required=true;
      const text = document.createElement("span"); text.textContent=labelText;
      label.append(input,text); fieldset.appendChild(label);
    }
    const noteLabel = document.createElement("label"); noteLabel.className = "tgd-note-label"; noteLabel.textContent = "Additional information";
    const note = document.createElement("textarea"); note.className = "tgd-note"; note.maxLength=500; note.placeholder="Optional — share anything helpful for the review."; noteLabel.appendChild(note);
    const message = document.createElement("p"); message.className="tgd-form-status"; message.setAttribute("aria-live","polite");
    const actions = document.createElement("div"); actions.className="tgd-modal-actions";
    const cancel = document.createElement("button"); cancel.type="button"; cancel.className="tgd-btn tgd-btn-secondary"; cancel.textContent="Cancel";
    const submit = document.createElement("button"); submit.type="submit"; submit.className="tgd-btn tgd-btn-primary"; submit.textContent="Submit suggestion";
    if (!place.id) { message.textContent="Google Maps has not exposed a supported Place ID for this business. It cannot be submitted yet."; message.classList.add("is-error"); submit.disabled=true; }
    actions.append(cancel,submit); form.append(fieldset,noteLabel,message,actions); body.append(intro,businessCard,form); panel.append(header,body); overlay.appendChild(panel);

    const closeForm=()=>overlay.remove();
    close.addEventListener("click",closeForm); cancel.addEventListener("click",closeForm);
    overlay.addEventListener("click",event=>{if(event.target===overlay)closeForm()});
    const escapeHandler=event=>{if(event.key==="Escape"){closeForm();document.removeEventListener("keydown",escapeHandler)}};
    document.addEventListener("keydown",escapeHandler);
    form.onsubmit=async event=>{
      event.preventDefault(); if(!place.id)return;
      submit.disabled=true; cancel.disabled=true; message.className="tgd-form-status"; message.textContent="Submitting your suggestion…";
      try{
        const result=await chrome.runtime.sendMessage({type:"SUBMIT",payload:{placeId:place.id,businessName:place.name,address:place.address||"",relationship:form.querySelector('[name="relationship"]:checked')?.value,note:note.value}});
        if(result?.error)throw new Error(result.error);
        message.classList.add("is-success"); message.textContent=result?.data?.message||"Thank you. Your suggestion has been submitted for review."; submit.textContent="Submitted";
        setTimeout(closeForm,2000);
      }catch(error){message.classList.add("is-error");message.textContent=error.message||"Submission failed. Please try again.";submit.disabled=false;cancel.disabled=false}
    };
    document.documentElement.appendChild(overlay); close.focus();
  }

  function removeSuggestButtons(root=document) {
    root.querySelectorAll(".tgd-suggest").forEach(button=>button.remove());
  }

  function removeGreekOwnedDetailRow() {
    document.querySelectorAll(".tgd-owned-detail-row").forEach(row=>row.remove());
  }

  function addGreekOwnedDetailRow() {
    if(document.querySelector(".tgd-owned-detail-row")) return;
    const pane=document.querySelector('[role="main"]')||document;
    const plusCode=pane.querySelector('[data-item-id="oloc"]') ||
      [...pane.querySelectorAll('button,[role="button"]')].find(el=>/plus code/i.test(el.getAttribute("aria-label")||el.textContent||""));
    if(!plusCode) {
      // Maps' detail rows can vary between layouts. Add the TGD row immediately
      // after the plus-code row once that row is present.
      return;
    }
    const row=plusCode.closest('[data-item-id="oloc"]')||plusCode;
    const tgdRow=document.createElement("div");
    tgdRow.className="tgd-owned-detail-row";
    tgdRow.setAttribute("role","listitem");
    tgdRow.innerHTML='<div class="tgd-owned-detail-icon" aria-hidden="true"><span>✓</span></div><div class="tgd-owned-detail-copy"><div class="tgd-owned-detail-title">Greek-owned</div><div class="tgd-owned-detail-subtitle">Listed in The Greek Directory</div></div>';
    row.insertAdjacentElement("afterend",tgdRow);
  }

  function addDetailSuggestButton(place) {
    if(document.querySelector(".tgd-detail-suggest")) return;
    const pane=document.querySelector('[role="main"]')||document;
    // Reviews appears as a button/tab in the profile details and as a section heading.
    const reviews=[...pane.querySelectorAll('[role="tab"],button,h2,h3,[role="heading"]')]
      .find(el=>/^reviews(?:\\s|$)/i.test((el.getAttribute("aria-label")||el.textContent||"").trim()));
    const button=document.createElement("button");
    button.className="tgd-suggest tgd-detail-suggest";
    button.textContent="Suggest for the Greek-owned list";
    button.addEventListener("click",()=>showForm(place));
    if(reviews) {
      const target=reviews.closest('[role="tab"]')||reviews.closest('section')||reviews.parentElement||reviews;
      target.insertAdjacentElement("beforebegin",button);
    } else {
      // Keep the button inside the business panel, not next to the title.
      const details=pane.querySelector('[data-item-id="oloc"]')||pane.querySelector('[data-item-id="address"]');
      if(details) (details.closest('[data-item-id]')||details).insertAdjacentElement("afterend",button);
      else pane.appendChild(button);
    }
  }

  async function scan() {
    if (!document.body) return;
    const detailId=idFrom(location.href), heading=document.querySelector("h1"), placeName=heading?.textContent?.trim()||"";
    const detailPage=Boolean(heading&&(location.href.includes("/place/")||detailId));
    const entries=[];
    for(const anchor of document.querySelectorAll('a[href*="/maps/place/"],a[href*="query_place_id"],a[href*="place_id="]')){
      const card=anchor.closest('[role="article"]'); if(!card||card.dataset.tgdScanned==="1")continue;
      card.dataset.tgdScanned="1"; const id=idFrom(anchor.href);
      const name=card.querySelector('[role="heading"]')?.textContent?.trim()||anchor.getAttribute("aria-label")||"";
      if(id&&name)entries.push({id,card,name:name.slice(0,200),address:""});
    }
    if(detailPage&&heading){
      if(!detailId) console.warn("[TGD Maps] Place ID unavailable on current Maps profile.");
      else try{
        const result=await chrome.runtime.sendMessage({type:"LOOKUP",ids:[detailId]});if(result?.error)throw new Error(result.error);
        const listed=Boolean(result.data?.[detailId]);
        if(listed) {
          removeSuggestButtons(document);
          addGreekOwnedDetailRow();
        } else {
          removeGreekOwnedDetailRow();
          addDetailSuggestButton({id:detailId,name:placeName,address:""});
        }
      }catch(error){console.warn("[TGD Maps] Directory lookup failed:",error.message||error)}
    }
    if(entries.length)try{
      const result=await chrome.runtime.sendMessage({type:"LOOKUP",ids:entries.map(item=>item.id)});if(result?.error)throw new Error(result.error);
      for(const item of entries){
        const listed=Boolean(result.data?.[item.id]);
        if(listed) {
          if(!item.card.querySelector(".tgd-badge")){const badge=document.createElement("span");badge.className="tgd-badge";badge.textContent="Greek-owned · TGD";item.card.appendChild(badge)}
          item.card.querySelectorAll(".tgd-suggest").forEach(button=>button.remove());
        } else if(!item.card.querySelector(".tgd-suggest")) {
          const button=document.createElement("button");button.className="tgd-suggest";button.textContent="Suggest for the Greek-owned list";button.onclick=()=>showForm(item);item.card.appendChild(button);
        }
      }
    }catch(error){console.warn("[TGD Maps] Directory lookup failed:",error.message||error)}
  }
  let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(scan,700)};
  const observer=new MutationObserver(schedule);if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("hashchange",schedule);scan();
})();