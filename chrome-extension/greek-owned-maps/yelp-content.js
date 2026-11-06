(() => {
  if (window.__tgdYelpExtension) return;
  window.__tgdYelpExtension = true;

  const FLAG_SVG = '<svg class="tgd-yelp-flag" viewBox="0 0 27 18" aria-hidden="true" focusable="false"><rect width="27" height="18" fill="#0D5EAF"/><path d="M0 3h27M0 7h27M0 11h27M0 15h27" stroke="#fff" stroke-width="2"/><rect width="10" height="10" fill="#0D5EAF"/><path d="M5 0v10M0 5h10" stroke="#fff" stroke-width="2"/></svg>';

  function extractYelpId(value) {
    try {
      const url = new URL(value, location.href);
      const match = url.pathname.match(/^\/biz\/([^/]+)\/?$/i);
      if (!match) return null;
      const id = decodeURIComponent(match[1]).trim();
      return /^[A-Za-z0-9_-]{1,255}$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  function listingUrlFor(slug) {
    const safeSlug = String(slug || "").split("/").filter(Boolean)
      .map((part) => encodeURIComponent(part)).join("/");
    return safeSlug ? "https://thegreekdirectory.org/listing/" + safeSlug : "";
  }

  function makeFlag() {
    const template = document.createElement("template");
    template.innerHTML = FLAG_SVG;
    return template.content.firstElementChild;
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

    const header = document.createElement("header");
    header.className = "tgd-modal-header";
    const mark = document.createElement("span");
    mark.className = "tgd-modal-mark";
    mark.textContent = "TGD";
    mark.setAttribute("aria-hidden", "true");
    const branding = document.createElement("div");
    branding.className = "tgd-modal-branding";
    const eyebrow = document.createElement("span");
    eyebrow.className = "tgd-modal-eyebrow";
    eyebrow.textContent = "Community submission";
    const title = document.createElement("h2");
    title.className = "tgd-modal-title";
    title.id = "tgd-modal-title";
    title.textContent = "Suggest a Greek-owned business";
    branding.append(eyebrow, title);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "tgd-modal-close";
    close.setAttribute("aria-label", "Close suggestion form");
    close.innerHTML = "&times;";
    header.append(mark, branding, close);

    const body = document.createElement("div");
    body.className = "tgd-modal-body";
    const intro = document.createElement("p");
    intro.className = "tgd-modal-intro";
    intro.textContent = "Help grow the Greek-American business community. Every suggestion is reviewed before it is added to TGD.";

    const businessCard = document.createElement("div");
    businessCard.className = "tgd-business-card";
    const businessIcon = document.createElement("span");
    businessIcon.className = "tgd-business-icon";
    businessIcon.textContent = "⌖";
    businessIcon.setAttribute("aria-hidden", "true");
    const businessDetails = document.createElement("span");
    businessDetails.className = "tgd-business-details";
    const businessLabel = document.createElement("span");
    businessLabel.className = "tgd-business-label";
    businessLabel.textContent = "Yelp business";
    const businessName = document.createElement("strong");
    businessName.className = "tgd-business-name";
    businessName.textContent = place.name || "Current Yelp business";
    businessDetails.append(businessLabel, businessName);
    businessCard.append(businessIcon, businessDetails);

    const form = document.createElement("form");
    const fieldset = document.createElement("fieldset");
    fieldset.className = "tgd-choice-fieldset";
    const legend = document.createElement("legend");
    legend.className = "tgd-choice-legend";
    legend.textContent = "How do you know this business is Greek-owned?";
    fieldset.appendChild(legend);

    for (const [value, labelText] of [
      ["owner", "I'm the owner"],
      ["family_friend", "Family or friend"],
      ["knows", "I know it's Greek-owned"]
    ]) {
      const label = document.createElement("label");
      label.className = "tgd-choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "relationship";
      input.value = value;
      input.required = true;
      const text = document.createElement("span");
      text.textContent = labelText;
      label.append(input, text);
      fieldset.appendChild(label);
    }

    const noteLabel = document.createElement("label");
    noteLabel.className = "tgd-note-label";
    noteLabel.textContent = "Additional information";
    const note = document.createElement("textarea");
    note.className = "tgd-note";
    note.maxLength = 500;
    note.placeholder = "Optional — share anything helpful for the review.";
    noteLabel.appendChild(note);

    const message = document.createElement("p");
    message.className = "tgd-form-status";
    message.setAttribute("aria-live", "polite");
    const actions = document.createElement("div");
    actions.className = "tgd-modal-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "tgd-btn tgd-btn-secondary";
    cancel.textContent = "Cancel";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "tgd-btn tgd-btn-primary";
    submit.textContent = "Submit suggestion";

    if (!place.id) {
      message.textContent = "Yelp has not exposed a supported business ID for this page. It cannot be submitted yet.";
      message.classList.add("is-error");
      submit.disabled = true;
    }

    actions.append(cancel, submit);
    form.append(fieldset, noteLabel, message, actions);
    body.append(intro, businessCard, form);
    panel.append(header, body);
    overlay.appendChild(panel);

    const closeForm = () => overlay.remove();
    close.addEventListener("click", closeForm);
    cancel.addEventListener("click", closeForm);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeForm();
    });
    const escapeHandler = (event) => {
      if (event.key === "Escape") {
        closeForm();
        document.removeEventListener("keydown", escapeHandler);
      }
    };
    document.addEventListener("keydown", escapeHandler);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!place.id) return;
      submit.disabled = true;
      cancel.disabled = true;
      message.className = "tgd-form-status";
      message.textContent = "Submitting your suggestion…";

      try {
        const result = await chrome.runtime.sendMessage({
          type: "SUBMIT_YELP",
          payload: {
            yelpId: place.id,
            businessName: place.name,
            address: place.address || "",
            relationship: form.querySelector('[name="relationship"]:checked')?.value,
            note: note.value
          }
        });
        if (result?.error) throw new Error(result.error);
        message.classList.add("is-success");
        message.textContent = result?.data?.message ||
          "Thank you. Your suggestion has been submitted for review.";
        submit.textContent = "Submitted";
        setTimeout(closeForm, 2000);
      } catch (error) {
        message.classList.add("is-error");
        message.textContent = error.message || "Submission failed. Please try again.";
        submit.disabled = false;
        cancel.disabled = false;
      }
    });

    document.documentElement.appendChild(overlay);
    close.focus();
  }

  function addTopBadge(heading, slug) {
    const container = heading?.parentElement;
    if (!container || !slug || container.querySelector(":scope > .tgd-top-badge")) return;
    const badge = document.createElement("a");
    badge.className = "tgd-badge tgd-top-badge";
    badge.href = listingUrlFor(slug);
    badge.target = "_blank";
    badge.rel = "noopener noreferrer";
    badge.setAttribute("aria-label", "Greek-owned · TGD — View listing");
    badge.title = "View this listing on The Greek Directory";
    badge.innerHTML = FLAG_SVG +
      '<span class="tgd-top-badge-label">Greek-owned · TGD</span>' +
      '<span class="tgd-badge-view" aria-hidden="true"><span>View</span><svg viewBox="0 0 16 16" focusable="false"><path d="M3 8h9M8 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    container.appendChild(badge);
  }

  function makeTopSuggestButton(place) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tgd-suggest tgd-top-suggest";
    button.textContent = "Suggest to The Greek Directory";
    button.addEventListener("click", () => showForm(place));
    return button;
  }

  function addTopSuggestButton(place, heading) {
    const container = heading?.parentElement;
    if (!container || container.querySelector(":scope > .tgd-top-suggest")) return;
    container.appendChild(makeTopSuggestButton(place));
  }

  function yelpBusinessName() {
    const heading = document.querySelector('[data-testid="photoHeader"] h1') ||
      document.querySelector("main h1") || document.querySelector("h1");
    return heading?.textContent?.trim() || "";
  }

  function yelpBusinessAddress(sidebar) {
    const mapLink = [...(sidebar?.querySelectorAll('a[href^="/map/"]') || [])]
      .find((anchor) => /get directions/i.test(anchor.textContent || ""));
    if (!mapLink) return "";
    const row = mapLink.closest(".y-css-1hzr4wa") || mapLink.parentElement?.parentElement;
    const paragraphs = [...(row?.querySelectorAll("p") || [])]
      .map((el) => el.textContent.trim()).filter(Boolean);
    return paragraphs.find((text) => /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(text)) || "";
  }

  function findSidebarEditButton() {
    return [...document.querySelectorAll('aside [data-testid="cookbook-island"] button')]
      .find((button) => /^suggest an edit$/i.test(button.textContent.trim()));
  }

  function removeDetailControls() {
    document.querySelectorAll(".tgd-top-badge, .tgd-top-suggest, .tgd-yelp-owned-row, .tgd-yelp-bottom-suggest")
      .forEach((node) => node.remove());
  }

  function openListing(url) {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  function copyLink(url) {
    if (!url) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => legacyCopy(url));
      return;
    }
    legacyCopy(url);
  }

  function legacyCopy(url) {
    const area = document.createElement("textarea");
    area.value = url;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0";
    (document.body || document.documentElement).appendChild(area);
    area.select();
    try { document.execCommand("copy"); } finally { area.remove(); }
  }

  function makeBottomOwnedRow(slug) {
    const url = listingUrlFor(slug);
    const row = document.createElement("div");
    row.className = "tgd-yelp-owned-row";

    const flag = document.createElement("span");
    flag.className = "tgd-yelp-owned-flag";
    flag.appendChild(makeFlag());

    const text = document.createElement("span");
    text.className = "tgd-yelp-owned-copy";
    const title = document.createElement("strong");
    title.textContent = "Greek-owned";
    const subtitle = document.createElement("span");
    subtitle.textContent = "Listed in The Greek Directory";
    text.append(title, subtitle);

    const actions = document.createElement("span");
    actions.className = "tgd-yelp-owned-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "tgd-yelp-action";
    open.textContent = "View listing";
    open.setAttribute("aria-label", "Open listing on The Greek Directory");
    open.addEventListener("click", () => openListing(url));
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "tgd-yelp-action tgd-yelp-copy";
    copy.textContent = "Copy link";
    copy.setAttribute("aria-label", "Copy TGD link");
    copy.addEventListener("click", () => copyLink(url));
    actions.append(open, copy);
    row.append(flag, text, actions);
    return row;
  }

  function addBottomOwnedRow(slug) {
    if (document.querySelector(".tgd-yelp-owned-row")) return;
    const editButton = findSidebarEditButton();
    const sidebar = editButton?.closest('[data-testid="cookbook-island"]');
    if (!sidebar) return;
    const wrapper = editButton.parentElement;
    if (!wrapper) return;
    wrapper.insertAdjacentElement("beforebegin", makeBottomOwnedRow(slug));
  }

  function replaceYelpButtonIcon(button) {
    const icon = button.querySelector('[role="img"]');
    if (!icon) return;
    icon.innerHTML = "";
    icon.appendChild(makeFlag());
  }

  function replaceYelpButtonLabel(button) {
    const leaf = [...button.querySelectorAll("*")]
      .find((node) => node.children.length === 0 &&
        /suggest an edit/i.test(node.textContent || ""));
    if (leaf) {
      leaf.textContent = "Suggest to The Greek Directory";
    } else {
      button.appendChild(document.createTextNode("Suggest to The Greek Directory"));
    }
  }

  function addBottomSuggestButton(place) {
    if (document.querySelector(".tgd-yelp-bottom-suggest")) return;
    const editButton = findSidebarEditButton();
    if (!editButton?.parentElement) return;

    const clone = editButton.cloneNode(true);
    clone.classList.add("tgd-yelp-bottom-suggest");
    clone.removeAttribute("data-activated");
    clone.removeAttribute("data-button");
    clone.removeAttribute("value");
    clone.removeAttribute("aria-controls");
    clone.removeAttribute("aria-expanded");
    clone.setAttribute("type", "button");
    clone.setAttribute("aria-label", "Suggest to The Greek Directory");
    replaceYelpButtonIcon(clone);
    replaceYelpButtonLabel(clone);
    clone.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showForm(place);
    });

    editButton.parentElement.insertBefore(clone, editButton);
  }

  function searchCardInfo() {
    const cards = [...document.querySelectorAll(
      '[data-testid="serp-ia-card"], [data-traffic-crawl-id="OrganicBusinessResult"], [data-traffic-crawl-id="AdBusinessResult"]'
    )];
    const output = [];
    for (const card of cards) {
      if (card.dataset.tgdYelpScanned === "1") continue;
      const anchor = card.querySelector(
        '[data-traffic-crawl-id="SearchResultBizName"] a[href*="/biz/"], h3 a[href*="/biz/"]'
      );
      const id = anchor ? extractYelpId(anchor.href) : null;
      const name = anchor?.textContent?.trim() || "";
      const target = anchor?.closest('[data-traffic-crawl-id="SearchResultBizName"]') ||
        anchor?.closest("h3")?.parentElement;
      card.dataset.tgdYelpScanned = "1";
      if (id && name && target) output.push({ id, name, card, target });
    }
    return output;
  }

  let activeDetailId = null;
  let detailRequestToken = 0;

  async function scan() {
    if (!document.body) return;

    const currentId = extractYelpId(location.href);
    const heading = document.querySelector('[data-testid="photoHeader"] h1') ||
      (currentId ? document.querySelector("main h1") : null);
    const isDetailPage = Boolean(currentId && heading);
    const entries = searchCardInfo();

    if (isDetailPage) {
      if (currentId !== activeDetailId) {
        removeDetailControls();
        activeDetailId = currentId;
      }

      const token = ++detailRequestToken;
      try {
        const response = await chrome.runtime.sendMessage({
          type: "LOOKUP_YELP",
          ids: [currentId]
        });
        if (token !== detailRequestToken || extractYelpId(location.href) !== currentId) return;
        if (response?.error) throw new Error(response.error);

        const match = response.data?.[currentId];
        const place = {
          id: currentId,
          name: heading.textContent.trim() || yelpBusinessName(),
          address: yelpBusinessAddress(findSidebarEditButton()?.closest('[data-testid="cookbook-island"]'))
        };

        if (match) {
          document.querySelectorAll(".tgd-top-suggest, .tgd-yelp-bottom-suggest")
            .forEach((node) => node.remove());
          addTopBadge(heading, typeof match === "object" ? match.slug : null);
          if (typeof match === "object" && match.slug) addBottomOwnedRow(match.slug);
        } else {
          document.querySelectorAll(".tgd-top-badge, .tgd-yelp-owned-row")
            .forEach((node) => node.remove());
          addTopSuggestButton(place, heading);
          addBottomSuggestButton(place);
        }
      } catch (error) {
        console.warn("[TGD Yelp] Directory lookup failed:", error.message || error);
      }
    } else if (activeDetailId !== null) {
      activeDetailId = null;
      detailRequestToken++;
      removeDetailControls();
    }

    if (entries.length) {
      const ids = [...new Set(entries.map((item) => item.id))];
      for (let offset = 0; offset < ids.length; offset += 30) {
        const batch = ids.slice(offset, offset + 30);
        try {
          const response = await chrome.runtime.sendMessage({
            type: "LOOKUP_YELP",
            ids: batch
          });
          if (response?.error) throw new Error(response.error);
          for (const item of entries.filter((entry) => batch.includes(entry.id))) {
            const match = response.data?.[item.id];
            if (!match) continue;
            if (!item.target.querySelector(".tgd-yelp-search-badge")) {
              const badge = document.createElement("span");
              badge.className = "tgd-yelp-search-badge";
              badge.appendChild(makeFlag());
              const label = document.createElement("span");
              label.textContent = "Greek-owned · TGD";
              badge.appendChild(label);
              item.target.appendChild(badge);
            }
          }
        } catch (error) {
          console.warn("[TGD Yelp] Search-result lookup failed:", error.message || error);
        }
      }
    }
  }

  let scanTimer;
  const schedule = () => {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 650);
  };
  const observer = new MutationObserver(schedule);
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  window.addEventListener("hashchange", schedule);
  window.addEventListener("popstate", schedule);
  scan();
})();