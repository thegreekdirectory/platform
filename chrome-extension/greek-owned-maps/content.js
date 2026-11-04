(() => {
  if (window.__tgdMapsExtension) return;
  window.__tgdMapsExtension = true;

  const GREEK_FLAG_SVG = '<svg class="tgd-greek-flag" viewBox="0 0 27 18" aria-hidden="true" focusable="false"><rect width="27" height="18" fill="#0D5EAF"/><path d="M0 3h27M0 7h27M0 11h27M0 15h27" stroke="#fff" stroke-width="2"/><rect width="10" height="10" fill="#0D5EAF"/><path d="M5 0v10M0 5h10" stroke="#fff" stroke-width="2"/></svg>';

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

  function removeDetailSuggestButtons() {
    document.querySelectorAll(".tgd-top-suggest,.tgd-bottom-suggest-wrap,.tgd-edit-suggest").forEach(button=>button.remove());
  }
  function removeTopGreekOwnedBadge() {
    document.querySelectorAll(".tgd-top-badge").forEach(badge=>badge.remove());
  }
  function removeGreekOwnedDetailRow() {
    document.querySelectorAll(".tgd-owned-detail-row").forEach(row=>row.remove());
  }

  // Original top-of-profile badge with the reference extension's Google Sans type treatment.
  function addTopGreekOwnedBadge(heading, slug) {
    const container=heading?.parentElement;
    if(!container || !slug || container.querySelector(":scope > .tgd-top-badge")) return;
    const safeSlug=String(slug).split("/").filter(Boolean).map(part=>encodeURIComponent(part)).join("/");
    if(!safeSlug) return;
    const badge=document.createElement("a");
    badge.className="tgd-badge tgd-top-badge";
    badge.href="https://thegreekdirectory.org/listing/"+safeSlug;
    badge.target="_blank";
    badge.rel="noopener noreferrer";
    badge.setAttribute("aria-label","Greek-owned · TGD — View listing");
    badge.title="View this listing on The Greek Directory";
    badge.innerHTML=GREEK_FLAG_SVG+
      '<span class="tgd-top-badge-label">Greek-owned · TGD</span>'+
      '<span class="tgd-badge-view" aria-hidden="true"><span>View</span><svg viewBox="0 0 16 16" focusable="false"><path d="M3 8h9M8 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    container.appendChild(badge);
  }

  // Mirror Google's information-row structure. The Greek-owned row is a distinct
  // sibling below Plus Code, not content inside the Plus Code row.
  function addGreekOwnedDetailRow() {
    if(document.querySelector(".tgd-owned-detail-row")) return;
    const pane=document.querySelector('[role="main"]')||document;
    const plusCodeControl=pane.querySelector('button[data-item-id="oloc"]')
      || pane.querySelector('[data-item-id="oloc"]')
      || [...pane.querySelectorAll('button,[role="button"]')]
        .find(el=>/plus code/i.test(el.getAttribute("aria-label")||el.textContent||""));
    if(!plusCodeControl?.parentElement) return;
    const plusCodeRow=plusCodeControl.parentElement;
    if(plusCodeRow.querySelector(".tgd-owned-detail-row")) return;

    const row=document.createElement("div");
    row.className="tgd-owned-detail-row";
    row.setAttribute("role","listitem");
    row.setAttribute("aria-label","Greek-owned — Listed in The Greek Directory");
    const icon=document.createElement("span");
    icon.className="tgd-detail-row-icon";
    icon.innerHTML=GREEK_FLAG_SVG;
    const copy=document.createElement("span");
    copy.className="tgd-detail-row-copy";
    const title=document.createElement("span");
    title.className="tgd-detail-row-title";
    title.textContent="Greek-owned";
    const subtitle=document.createElement("span");
    subtitle.className="tgd-detail-row-subtitle";
    subtitle.textContent="Listed in The Greek Directory";
    copy.append(title,subtitle);
    row.append(icon,copy);
    const referenceText=plusCodeControl.querySelector("div div")||plusCodeControl;
    try { row.style.color=getComputedStyle(referenceText).color; } catch {}
    const layout=plusCodeRow.parentElement;
    if(layout) {
      const style=getComputedStyle(layout);
      if(style.display==="flex" && !style.flexDirection.startsWith("column")) {
        layout.style.setProperty("flex-wrap","wrap","important");
      }
    }
    plusCodeRow.insertAdjacentElement("afterend",row);
  }

  function makeDetailSuggestButton(place, extraClass) {
    const button=document.createElement("button");
    button.type="button";
    button.className="tgd-suggest "+extraClass;
    button.textContent="Suggest for the Greek-owned list";
    button.addEventListener("click",()=>showForm(place));
    return button;
  }

  // Original TGD-styled top button remains unchanged.
  function addTopDetailSuggestButton(place, heading) {
    const container=heading?.parentElement;
    if(!container || container.querySelector(":scope > .tgd-top-suggest")) return;
    container.appendChild(makeDetailSuggestButton(place,"tgd-top-suggest"));
  }

  // Keep Google's native Suggest an edit control intact. Add the centered TGD
  // action beneath it, using the Greek flag instead of Google's pencil.
  function addSuggestEditAdjacentButton(place) {
    if(document.querySelector(".tgd-bottom-suggest-wrap")) return;
    const pane=document.querySelector('[role="main"]')||document;
    const candidates=[...pane.querySelectorAll('button,[role="button"],a')]
      .filter(el=>!el.closest("#tgd-form")&&!el.classList.contains("tgd-bottom-suggest"))
      .filter(el=>{
        const label=(el.getAttribute("aria-label")||el.textContent||"").replace(/\s+/g," ").trim();
        return /^suggest an edit(?:\b|$)/i.test(label) && el.getClientRects().length>0;
      })
      .sort((a,b)=>(a.textContent||"").length-(b.textContent||"").length);
    const googleButton=candidates[0];
    const wrap=document.createElement("div");
    wrap.className="tgd-bottom-suggest-wrap";
    const button=document.createElement("button");
    button.type="button";
    button.className="tgd-suggest tgd-bottom-suggest";
    button.innerHTML=GREEK_FLAG_SVG+'<span>Suggest for the Greek-owned list</span>';
    button.addEventListener("click",()=>showForm(place));
    wrap.appendChild(button);

    if(googleButton) {
      let row=googleButton.parentElement;
      for(let i=0;i<4 && row && row!==pane;i++) {
        const style=getComputedStyle(row);
        if(style.display.includes("flex") && !style.flexDirection.startsWith("column")) break;
        row=row.parentElement;
      }
      if(row && row!==pane && getComputedStyle(row).display.includes("flex")) {
        row.style.setProperty("flex-wrap","wrap","important");
        row.style.setProperty("justify-content","center","important");
        row.insertAdjacentElement("beforeend",wrap);
      } else {
        const parent=googleButton.parentElement;
        if(parent) {
          parent.style.setProperty("text-align","center","important");
          parent.insertAdjacentElement("afterend",wrap);
        } else return;
      }
    } else {
      const address=pane.querySelector('button[data-item-id="address"]');
      if(address?.parentElement) {
        const parent=address.parentElement;
        parent.style.setProperty("text-align","center","important");
        parent.insertAdjacentElement("afterend",wrap);
      } else return;
    }
  }

  let activeDetailPlaceId = null;
  let detailLookupToken = 0;
  async function scan() {
    if (!document.body) return;
    const detailId=idFrom(location.href), heading=document.querySelector("h1"), placeName=heading?.textContent?.trim()||"";
    const detailPage=Boolean(heading&&(location.href.includes("/place/")||detailId));
    const entries=[];

    for(const anchor of document.querySelectorAll('a[href*="/maps/place/"],a[href*="query_place_id"],a[href*="place_id="]')){
      const card=anchor.closest('[role="article"]');
      if(!card||card.dataset.tgdScanned==="1")continue;
      card.dataset.tgdScanned="1";
      const id=idFrom(anchor.href);
      const name=card.querySelector('[role="heading"]')?.textContent?.trim()||anchor.getAttribute("aria-label")||"";
      if(id&&name)entries.push({id,card,name:name.slice(0,200),address:""});
    }

    if(detailPage&&heading){
      if(detailId!==activeDetailPlaceId) {
        removeGreekOwnedDetailRow();
        removeTopGreekOwnedBadge();
        removeDetailSuggestButtons();
        activeDetailPlaceId=detailId;
      }

      if(detailId) {
        const lookupToken=++detailLookupToken;
        try {
          const result=await chrome.runtime.sendMessage({type:"LOOKUP",ids:[detailId]});
          // Ignore delayed responses after navigating to a different Maps place.
          if(lookupToken!==detailLookupToken || idFrom(location.href)!==detailId) return;
          if(result?.error) throw new Error(result.error);
          const match=result.data?.[detailId];
          const listed=Boolean(match);
          const place={id:detailId,name:placeName,address:""};

          if(listed) {
            removeDetailSuggestButtons();
            addTopGreekOwnedBadge(heading,typeof match==="object"?match.slug:null);
            addGreekOwnedDetailRow();
          } else {
            removeTopGreekOwnedBadge();
            removeGreekOwnedDetailRow();
            addTopDetailSuggestButton(place,heading);
            addSuggestEditAdjacentButton(place);
          }
        } catch(error) {
          console.warn("[TGD Maps] Directory lookup failed:",error.message||error);
        }
      }
    } else {
      // Clear the previous profile's injected controls when leaving its detail view.
      if(activeDetailPlaceId!==null) {
        activeDetailPlaceId=null;
        detailLookupToken++;
        removeGreekOwnedDetailRow();
        removeTopGreekOwnedBadge();
        removeDetailSuggestButtons();
      }
    }

    if(entries.length) {
      try {
        const result=await chrome.runtime.sendMessage({type:"LOOKUP",ids:entries.map(item=>item.id)});
        if(result?.error) throw new Error(result.error);
        for(const item of entries) {
          const listed=Boolean(result.data?.[item.id]);
          if(listed) {
            if(!item.card.querySelector(".tgd-badge")) {
              const badge=document.createElement("span");
              badge.className="tgd-badge";
              badge.textContent="Greek-owned · TGD";
              item.card.appendChild(badge);
            }
            item.card.querySelectorAll(".tgd-suggest").forEach(button=>button.remove());
          } else if(!item.card.querySelector(".tgd-suggest")) {
            const button=document.createElement("button");
            button.className="tgd-suggest";
            button.textContent="Suggest for the Greek-owned list";
            button.addEventListener("click",()=>showForm(item));
            item.card.appendChild(button);
          }
        }
      } catch(error) {
        console.warn("[TGD Maps] Search-result lookup failed:",error.message||error);
      }
    }
  }
  let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(scan,700)};
  const observer=new MutationObserver(schedule);if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("hashchange",schedule);scan();
})();