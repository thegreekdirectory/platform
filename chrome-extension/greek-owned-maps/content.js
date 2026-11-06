(() => {
  if (window.__tgdMapsExtension) return;
  window.__tgdMapsExtension = true;

  const GREEK_FLAG_SVG = '<svg class="tgd-greek-flag" viewBox="0 0 27 18" aria-hidden="true" focusable="false"><rect width="27" height="18" fill="#0D5EAF"/><path d="M0 3h27M0 7h27M0 11h27M0 15h27" stroke="#fff" stroke-width="2"/><rect width="10" height="10" fill="#0D5EAF"/><path d="M5 0v10M0 5h10" stroke="#fff" stroke-width="2"/></svg>';

  // Material "open in new" / "content copy" glyphs. Only used for the Open listing
  // action (Google's own copy icon is kept) and the unknown-layout fallback below.
  const OPEN_LISTING_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';
  const COPY_LINK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
  // Channel shared with main-world.js, which lets Google's own copy handler write the TGD link.
  const COPY_CHANNEL = "TGD_MAPS_NATIVE_COPY";

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
    document.querySelectorAll(".tgd-top-suggest,.tgd-bottom-suggest-wrap,.tgd-bottom-suggest-block,.tgd-bottom-suggest-break,.tgd-edit-suggest").forEach(button=>button.remove());
  }
  function removeTopGreekOwnedBadge() {
    document.querySelectorAll(".tgd-top-badge").forEach(badge=>badge.remove());
  }
  function removeGreekOwnedDetailRow() {
    hideTgdTooltip();
    document.querySelectorAll(".tgd-owned-detail-row").forEach(row=>row.remove());
  }

  // Original top-of-profile badge with the reference extension's Google Sans type treatment.
  function addTopGreekOwnedBadge(heading, slug) {
    const container=heading?.parentElement;
    if(!container || !slug || container.querySelector(":scope > .tgd-top-badge")) return;
    const listingUrl=listingUrlFor(slug);
    if(!listingUrl) return;
    const badge=document.createElement("a");
    badge.className="tgd-badge tgd-top-badge";
    badge.href=listingUrl;
    badge.target="_blank";
    badge.rel="noopener noreferrer";
    badge.setAttribute("aria-label","Greek-owned · TGD — View listing");
    badge.title="View this listing on The Greek Directory";
    badge.innerHTML=GREEK_FLAG_SVG+
      '<span class="tgd-top-badge-label">Greek-owned · TGD</span>'+
      '<span class="tgd-badge-view" aria-hidden="true"><span>View</span><svg viewBox="0 0 16 16" focusable="false"><path d="M3 8h9M8 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    container.appendChild(badge);
  }

  function listingUrlFor(slug) {
    const safeSlug=String(slug||"").split("/").filter(Boolean).map(part=>encodeURIComponent(part)).join("/");
    return safeSlug ? "https://thegreekdirectory.org/listing/"+safeSlug : "";
  }

  function svgFromMarkup(markup) {
    const template=document.createElement("template");
    template.innerHTML=markup.trim();
    return template.content.firstElementChild;
  }

  function nativeActionLabel(el) {
    return [
      el.getAttribute("aria-label"),
      el.getAttribute("data-tooltip"),
      el.getAttribute("data-value"),
      el.getAttribute("title")
    ].filter(Boolean).join(" ").replace(/\s+/g," ").trim().toLowerCase();
  }

  // A clone of a Google Maps node must not keep Google's identifiers or jsaction
  // wiring, otherwise Maps' own delegated handlers could act on the copy.
  const IDENTITY_DATA_ATTRS=new Set(["data-item-id","data-tooltip","data-value"]);
  function scrubClonedNode(root, keepData) {
    for(const el of [root,...root.querySelectorAll("*")]) {
      for(const name of el.getAttributeNames()) {
        if(name==="id" || name==="ping" || name.startsWith("js") ||
           (name.startsWith("data-") && (!keepData || IDENTITY_DATA_ATTRS.has(name))) ||
           name==="aria-labelledby" || name==="aria-describedby" || name==="aria-controls" ||
           (el.localName==="a" && (name==="href" || name==="target" || name==="rel"))) {
          el.removeAttribute(name);
        }
      }
    }
  }

  // Maps' own tooltip code does not fire on a cloned node, so our controls get a tooltip drawn
  // to match Maps' (look and behaviour both measured from a screen recording of Maps):
  //  - #303030 box, 24px tall, 4px radius, white 13px text, ~100ms ease-out fade-in;
  //  - appears the moment the pointer enters a control, goes away at once on leaving;
  //  - does not follow the pointer: it stays put while the pointer moves inside the control;
  //  - moving to another control swaps the tooltip in place, with no gap;
  //  - a row's tooltip sits just under the row, 11px in from its left edge; an icon button's is
  //    centred just under the icon;
  //  - also shown on keyboard focus.
  const TGD_TOOLTIP_ROW_INSET=11;
  const TGD_TOOLTIP_SWAP_GRACE=60;
  let tooltipEl=null;
  let tooltipHideTimer=0;
  let tooltipGlobalHooked=false;

  function hideTgdTooltip() {
    clearTimeout(tooltipHideTimer);
    tooltipEl?.remove();
    tooltipEl=null;
  }

  // Leaving a control hides the tooltip, but mouseenter on the next control fires right after
  // mouseleave: a very short grace lets that control reuse the same tooltip (no flicker, no
  // second fade-in). With nowhere to go it is removed within a frame or two.
  function releaseTgdTooltip() {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer=setTimeout(hideTgdTooltip,TGD_TOOLTIP_SWAP_GRACE);
  }

  function showTgdTooltip(target, text, kind) {
    clearTimeout(tooltipHideTimer);
    if(!target.isConnected) { hideTgdTooltip(); return; }
    let tip=tooltipEl;
    if(!tip) {
      tip=document.createElement("div");
      tip.className="tgd-maps-tooltip tgd-maps-tooltip-fade";
      tip.setAttribute("role","tooltip");
      document.body.appendChild(tip);
      tooltipEl=tip;
    }
    tip.textContent=text;
    const rect=target.getBoundingClientRect();
    const width=tip.offsetWidth, height=tip.offsetHeight;
    const viewportWidth=document.documentElement.clientWidth, viewportHeight=document.documentElement.clientHeight;
    const wanted=kind==="row" ? rect.left+TGD_TOOLTIP_ROW_INSET : rect.left+rect.width/2-width/2;
    const left=Math.max(8,Math.min(wanted,viewportWidth-width-8));
    const below=rect.bottom+(kind==="row" ? 1 : 2);
    const top=(below+height>viewportHeight-4 && rect.top-height-2>=4) ? rect.top-height-2 : below;
    tip.style.left=Math.round(left)+"px";
    tip.style.top=Math.round(top)+"px";
  }

  // kind: "row" for a wide row control, "icon" for a small icon button.
  function attachTgdTooltip(el, text, kind) {
    el.setAttribute("data-tgd-tooltip",text);
    el.removeAttribute("title");
    if(!tooltipGlobalHooked) {
      tooltipGlobalHooked=true;
      window.addEventListener("scroll",hideTgdTooltip,true);
      window.addEventListener("blur",hideTgdTooltip);
    }
    el.addEventListener("mouseenter",()=>showTgdTooltip(el,text,kind));
    el.addEventListener("mouseleave",releaseTgdTooltip);
    el.addEventListener("blur",releaseTgdTooltip);
    for(const type of ["mousedown","click"]) el.addEventListener(type,hideTgdTooltip);
    el.addEventListener("focus",()=>{
      let focusVisible=true;
      try { focusVisible=el.matches(":focus-visible"); } catch {}
      if(focusVisible) showTgdTooltip(el,text,kind);
    });
  }

  // Swap the glyph inside a cloned Maps control for our own SVG while keeping the
  // size, classes and colour hooks Maps gave the original glyph.
  const ICON_SELECTOR='svg,img,.google-symbols,[class*="google-symbols"],[class*="material-symbols"],[class*="material-icons"]';
  function findIconElement(container) {
    // An icon-font glyph is a leaf element; a wrapper that merely has such a class is not the icon.
    return [...container.querySelectorAll(ICON_SELECTOR)]
      .find(el=>el.localName==="svg" || el.localName==="img" || !el.firstElementChild);
  }
  function placeIcon(container, svg, sizeSource) {
    const icon=findIconElement(container);
    if(!icon) {
      svg.setAttribute("width","24");
      svg.setAttribute("height","24");
      svg.style.setProperty("flex","none");
      svg.style.setProperty("margin-right","8px");
      container.insertBefore(svg,container.firstChild);
      return;
    }
    if(icon.localName==="svg" || icon.localName==="img") {
      const classes=[icon.getAttribute("class"),svg.getAttribute("class")].filter(Boolean).join(" ");
      if(classes) svg.setAttribute("class",classes);
      for(const name of ["width","height","style","fill"]) {
        const value=icon.getAttribute(name);
        if(value) svg.setAttribute(name,value);
      }
      icon.replaceWith(svg);
      return;
    }
    // Icon-font ligature: keep Google's box and size the SVG from its font size. A clone is
    // detached and has no computed style, so measure the attached original (sizeSource).
    let size=24;
    try { size=parseFloat(getComputedStyle(sizeSource||icon).fontSize)||24; } catch {}
    icon.textContent="";
    svg.setAttribute("width",String(size));
    svg.setAttribute("height",String(size));
    icon.appendChild(svg);
  }

  function replaceNativeLabel(root, pattern, text) {
    const target=[...root.querySelectorAll("*")].find(el=>!el.firstElementChild && pattern.test(el.textContent||""));
    if(target) { target.textContent=text; return true; }
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()) {
      if(pattern.test(node.nodeValue||"")) { node.nodeValue=text; return true; }
    }
    return false;
  }

  function openTgdListing(url) {
    if(!url) return;
    // Open synchronously inside the user's click so Chrome does not treat it as a popup.
    window.open(url,"_blank","noopener,noreferrer");
  }

  // Last-resort copy used only when Maps' own copy path cannot be driven.
  function writeClipboardDirect(text) {
    const legacy=()=>{
      const area=document.createElement("textarea");
      area.value=text;
      area.setAttribute("readonly","");
      area.style.cssText="position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0";
      (document.body||document.documentElement).appendChild(area);
      area.select();
      try { return document.execCommand("copy"); }
      finally { area.remove(); }
    };
    try {
      if(navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).catch(()=>legacy());
    } catch {}
    try { return legacy(); }
    catch(error) { console.warn("[TGD Maps] Clipboard unavailable:",error); }
  }

  // The trailing "Copy ..." action that sits beside a row's main control.
  function findTrailingCopyAction(row, control) {
    return [...row.querySelectorAll('button,[role="button"],a')]
      .find(el=>el!==control && !control.contains(el) && !el.contains(control) && /copy/.test(nativeActionLabel(el)));
  }

  // Google's original Plus Code copy control, never our clone (clones have no data-item-id).
  function findNativeCopyControl() {
    const pane=document.querySelector('[role="main"]')||document;
    const control=pane.querySelector('button[data-item-id="oloc"]') || pane.querySelector('[data-item-id="oloc"]');
    if(!control) return null;
    const row=findInformationRow(control,pane);
    return (row && findTrailingCopyAction(row,control)) || control;
  }

  // Copy the TGD link through Google's own copy handler so Maps shows its native
  // "Copied to clipboard" snackbar. main-world.js swaps the Plus Code text for the
  // TGD URL inside that handler's clipboard write. We never draw a toast of our own.
  // One hand-off at a time. A second click while one is pending would nest two bridge
  // wrappers: Google's first copy would consume both and its second would write the raw
  // Plus Code over the TGD link.
  let copyInFlight=false;
  function copyTgdLink(url) {
    if(!url || copyInFlight) return;
    const nativeCopy=findNativeCopyControl();
    if(!nativeCopy) { writeClipboardDirect(url); return; }

    copyInFlight=true;
    const token=crypto.randomUUID();
    let armTimer, confirmTimer;
    const cleanup=()=>{
      copyInFlight=false;
      window.removeEventListener("message",onMessage);
      clearTimeout(armTimer);
      clearTimeout(confirmTimer);
    };
    function onMessage(event) {
      const data=event.data;
      if(event.source!==window || event.origin!==location.origin ||
         data?.channel!==COPY_CHANNEL || data?.token!==token) return;
      if(data.type==="ARMED") {
        clearTimeout(armTimer);
        // If Maps never reports a clipboard write, make sure the link is still copied.
        confirmTimer=setTimeout(()=>{ cleanup(); writeClipboardDirect(url); },2200);
        nativeCopy.click();
      } else if(data.type==="COPIED") {
        cleanup();
      } else if(data.type==="FAILED") {
        cleanup();
        writeClipboardDirect(url);
      }
    }
    window.addEventListener("message",onMessage);
    // If the MAIN-world bridge is unavailable, copy directly instead of doing nothing.
    armTimer=setTimeout(()=>{
      cleanup();
      console.warn("[TGD Maps] Native copy bridge unavailable; copied without Maps' snackbar.");
      writeClipboardDirect(url);
    },900);
    window.postMessage({channel:COPY_CHANNEL,type:"ARM",token,url},location.origin);
  }

  // The outer Google information row (holds the main control and its trailing actions).
  function findInformationRow(control, pane) {
    const byClass=control.closest(".RcCsl");
    if(byClass && byClass!==pane && pane.contains(byClass)) return byClass;
    let el=control.parentElement;
    for(let level=0;level<4 && el && el!==pane;level++,el=el.parentElement) {
      if([...el.querySelectorAll("button,[role=\"button\"]")].some(node=>node!==control && /copy/.test(nativeActionLabel(node)))) return el;
    }
    return control.parentElement;
  }

  // Drop every other interactive control from the cloned row (e.g. the Plus Code row's info
  // button), plus any wrapper that is left empty, so only the controls in `keep` remain.
  function pruneOtherControls(row, keep) {
    for(const el of [...row.querySelectorAll('button,a,[role="button"],[tabindex]')]) {
      if(!row.contains(el) || keep.some(k=>k===el || k.contains(el) || el.contains(k))) continue;
      let parent=el.parentElement;
      el.remove();
      while(parent && parent!==row && !parent.firstElementChild && !(parent.textContent||"").trim() && !keep.some(k=>parent.contains(k))) {
        const up=parent.parentElement;
        parent.remove();
        parent=up;
      }
    }
  }

  // Only used when the cloned Maps row has no trailing action container to reuse.
  function appendFallbackActions(row) {
    const actions=document.createElement("div");
    actions.className="tgd-fallback-actions";
    for(const [kind,label,markup] of [["open","Open listing",OPEN_LISTING_SVG],["copy","Copy TGD link",COPY_LINK_SVG]]) {
      const button=document.createElement("button");
      button.type="button";
      button.className="tgd-fallback-action";
      button.dataset.tgdAction=kind;
      button.setAttribute("aria-label",label);
      attachTgdTooltip(button,label,"icon");
      button.appendChild(svgFromMarkup(markup));
      actions.appendChild(button);
    }
    row.classList.add("tgd-fallback-row");
    row.appendChild(actions);
    return actions;
  }

  // The lower Greek-owned row is a deep clone of Google's own Plus Code row, so Maps'
  // CSS supplies the layout, hover background and hover-revealed trailing actions.
  // Only the flag, the text, the trailing action targets and the click behaviour are ours.
  function addGreekOwnedDetailRow(slug) {
    if(document.querySelector(".tgd-owned-detail-row")) return;
    const url=listingUrlFor(slug);
    const pane=document.querySelector('[role="main"]')||document;
    const plusCodeControl=pane.querySelector('button[data-item-id="oloc"]')
      || pane.querySelector('[data-item-id="oloc"]')
      || [...pane.querySelectorAll('button,[role="button"]')]
        .find(el=>/plus code/i.test(el.getAttribute("aria-label")||el.textContent||""));
    if(!plusCodeControl?.parentElement) return;
    const plusCodeRow=findInformationRow(plusCodeControl,pane);
    if(!plusCodeRow?.parentElement) return;

    const row=plusCodeRow.cloneNode(true);
    const bodyControl=row.matches('[data-item-id="oloc"]') ? row
      : (row.querySelector('[data-item-id="oloc"]') || row.querySelector('button,[role="button"],a'));
    if(!bodyControl) return;
    // Find the trailing copy action before scrubbing removes the labels that identify it.
    const copyAction=findTrailingCopyAction(row,bodyControl);
    scrubClonedNode(row);

    row.classList.add("tgd-owned-detail-row");
    if(url) row.dataset.tgdListingUrl=url;
    bodyControl.setAttribute("aria-label",url
      ? "Greek-owned — Listed in The Greek Directory. Copy TGD link"
      : "Greek-owned — Listed in The Greek Directory");
    bodyControl.removeAttribute("title");
    if(bodyControl.localName==="button") bodyControl.type="button";
    else {
      bodyControl.setAttribute("role","button");
      bodyControl.tabIndex=0;
    }

    placeIcon(bodyControl,svgFromMarkup(GREEK_FLAG_SVG),plusCodeControl.querySelector(ICON_SELECTOR));
    const textLeaves=[...bodyControl.querySelectorAll("*")]
      .filter(el=>!el.firstElementChild && (el.textContent||"").trim() && !el.matches(ICON_SELECTOR) && !el.closest(ICON_SELECTOR));
    const nativeText=bodyControl.querySelector(".Io6YTe,.fontBodyMedium") || textLeaves[textLeaves.length-1];
    const stack=document.createElement("div");
    stack.className="tgd-detail-row-copy";
    const subtitle=document.createElement("div");
    subtitle.className="tgd-detail-row-subtitle";
    subtitle.textContent="Listed in The Greek Directory";
    if(nativeText) {
      nativeText.textContent="Greek-owned";
      nativeText.replaceWith(stack);
      stack.append(nativeText,subtitle);
    } else {
      const title=document.createElement("div");
      title.className="tgd-detail-row-title";
      title.textContent="Greek-owned";
      stack.append(title,subtitle);
      bodyControl.appendChild(stack);
    }

    if(!url) {
      // Without a listing slug there is nothing to open or copy.
      copyAction?.remove();
      pruneOtherControls(row,[bodyControl]);
    } else {
      if(copyAction) {
        // Keep Google's own trailing copy button (and its icon); add a sibling Open listing
        // button cloned from it, in the same order as Maps' website row: Open, then Copy.
        const sourceCopy=findTrailingCopyAction(plusCodeRow,plusCodeControl);
        copyAction.dataset.tgdAction="copy";
        copyAction.setAttribute("aria-label","Copy TGD link");
        attachTgdTooltip(copyAction,"Copy TGD link","icon");
        const openAction=copyAction.cloneNode(true);
        placeIcon(openAction,svgFromMarkup(OPEN_LISTING_SVG),sourceCopy?.querySelector(ICON_SELECTOR));
        openAction.dataset.tgdAction="open";
        openAction.setAttribute("aria-label","Open listing");
        attachTgdTooltip(openAction,"Open listing","icon");
        for(const action of [openAction,copyAction]) if(action.localName==="button") action.type="button";
        copyAction.insertAdjacentElement("beforebegin",openAction);
        pruneOtherControls(row,[bodyControl,openAction,copyAction]);
      } else {
        console.warn("[TGD Maps] Maps' trailing copy action was not found; using fallback row actions.");
        pruneOtherControls(row,[bodyControl,appendFallbackActions(row)]);
      }
      // The row itself reads "Copy TGD link", like Maps' own "Copy phone number" on its rows.
      attachTgdTooltip(bodyControl,"Copy TGD link","row");
      if(bodyControl.localName!=="button") {
        // A non-<button> main control has no native Enter/Space activation.
        bodyControl.addEventListener("keydown",event=>{
          if(event.target===bodyControl && (event.key==="Enter" || event.key===" ")) {
            event.preventDefault();
            copyTgdLink(url);
          }
        });
      }
      row.addEventListener("click",event=>{
        const trigger=event.target.closest?.("[data-tgd-action]");
        event.preventDefault();
        event.stopPropagation();
        if(trigger?.dataset.tgdAction==="open") openTgdListing(url);
        else copyTgdLink(url);
      });
    }

    plusCodeRow.insertAdjacentElement("afterend",row);
  }

  function makeDetailSuggestButton(place, extraClass) {
    const button=document.createElement("button");
    button.type="button";
    button.className="tgd-suggest "+extraClass;
    button.textContent="Suggest to The Greek Directory";
    button.addEventListener("click",()=>showForm(place));
    return button;
  }

  // Original TGD-styled top button remains unchanged.
  function addTopDetailSuggestButton(place, heading) {
    const container=heading?.parentElement;
    if(!container || container.querySelector(":scope > .tgd-top-suggest")) return;
    container.appendChild(makeDetailSuggestButton(place,"tgd-top-suggest"));
  }

  // Clone the slice of Google's layout that holds `target`: from the child of `container` that
  // contains it, down to `target`, dropping every other branch. Maps styles its buttons with
  // parent/child CSS, so the copy must sit inside the same ancestor chain as the original.
  function cloneContextAround(container, target) {
    let block=target;
    while(block.parentElement && block.parentElement!==container) block=block.parentElement;
    const path=[];
    for(let el=target;el!==block;el=el.parentElement) path.unshift(Array.prototype.indexOf.call(el.parentElement.children,el));
    const blockClone=block.cloneNode(true);
    let targetClone=blockClone;
    for(const index of path) targetClone=targetClone.children[index];
    for(let el=targetClone;el!==blockClone;el=el.parentElement) {
      for(const sibling of [...el.parentElement.children]) if(sibling!==el) sibling.remove();
    }
    return {block,blockClone,targetClone};
  }

  // Same look as Google's Suggest an edit button: a clone of it (inside a clone of its own
  // ancestor chain), with only the pencil swapped for the Greek flag and the label changed.
  // Its Maps wiring is scrubbed.
  function buildNativeSuggestBlock(googleButton, container, place) {
    const {block,blockClone,targetClone:button}=cloneContextAround(container,googleButton);
    scrubClonedNode(blockClone,true);
    blockClone.classList.add("tgd-bottom-suggest-block");
    button.classList.add("tgd-bottom-suggest","tgd-native-clone");
    button.removeAttribute("title");
    button.setAttribute("aria-label","Suggest to The Greek Directory");
    if(button.localName==="button") button.type="button";
    else {
      button.setAttribute("role","button");
      button.tabIndex=0;
      button.addEventListener("keydown",event=>{
        if(event.key==="Enter" || event.key===" ") { event.preventDefault(); showForm(place); }
      });
    }
    placeIcon(button,svgFromMarkup(GREEK_FLAG_SVG),googleButton.querySelector(ICON_SELECTOR));
    if(!replaceNativeLabel(button,/suggest an edit/i,"Suggest to The Greek Directory")) {
      const label=document.createElement("span");
      label.textContent="Suggest to The Greek Directory";
      button.appendChild(label);
    }
    button.addEventListener("click",event=>{
      event.preventDefault();
      event.stopPropagation();
      showForm(place);
    });
    return {block,blockClone};
  }

  // TGD-styled fallback, used only when Google's Suggest an edit button cannot be found.
  function buildFallbackSuggestButton(place) {
    const button=document.createElement("button");
    button.type="button";
    button.className="tgd-suggest tgd-bottom-suggest";
    button.innerHTML=GREEK_FLAG_SVG+'<span>Suggest to The Greek Directory</span>';
    button.addEventListener("click",()=>showForm(place));
    return button;
  }

  // Keep Google's native Suggest an edit control intact. Add the centered TGD
  // action beneath it, using the Greek flag instead of Google's pencil.
  function addSuggestEditAdjacentButton(place) {
    if(document.querySelector(".tgd-bottom-suggest-wrap,.tgd-bottom-suggest-block")) return;
    const pane=document.querySelector('[role="main"]')||document;
    const candidates=[...pane.querySelectorAll('button,[role="button"],a')]
      .filter(el=>!el.closest("#tgd-form")&&!el.closest(".tgd-bottom-suggest-block")&&!el.classList.contains("tgd-bottom-suggest"))
      .filter(el=>{
        const label=(el.getAttribute("aria-label")||el.textContent||"").replace(/\s+/g," ").trim();
        return /^suggest an edit(?:\b|$)/i.test(label) && el.getClientRects().length>0;
      })
      .sort((a,b)=>(a.textContent||"").length-(b.textContent||"").length);
    const googleButton=candidates[0];

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
        const {blockClone}=buildNativeSuggestBlock(googleButton,row,place);
        // A full-width, zero-height flex item forces the TGD button onto its own centered line.
        const lineBreak=document.createElement("div");
        lineBreak.className="tgd-bottom-suggest-break";
        lineBreak.setAttribute("aria-hidden","true");
        row.append(lineBreak,blockClone);
      } else {
        const parent=googleButton.parentElement;
        if(!parent?.parentElement) return;
        parent.style.setProperty("text-align","center","important");
        const {block,blockClone}=buildNativeSuggestBlock(googleButton,parent.parentElement,place);
        block.insertAdjacentElement("afterend",blockClone);
      }
      return;
    }

    // No Google button to copy: TGD-styled fallback under the address row.
    const wrap=document.createElement("div");
    wrap.className="tgd-bottom-suggest-wrap";
    wrap.appendChild(buildFallbackSuggestButton(place));
    const address=pane.querySelector('button[data-item-id="address"]');
    if(address?.parentElement) {
      const parent=address.parentElement;
      parent.style.setProperty("text-align","center","important");
      parent.insertAdjacentElement("afterend",wrap);
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
            addGreekOwnedDetailRow(typeof match==="object"?match.slug:null);
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
            button.textContent="Suggest to The Greek Directory";
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