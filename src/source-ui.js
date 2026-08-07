// Subscription source state and rendering.



function setStatus(sourceId, message, kind = "") {
  const source = sources.get(sourceId);
  if (!source) return;
  source.status.textContent = message;
  source.status.className = `status ${kind}`.trim();
}

function selectedSourceCount(source) {
  return source.inspected.reduce(
    (count, item, index) =>
      count + (item.outbound && source.enabled[index] !== false ? 1 : 0),
    0,
  );
}

function updatePickerCount(source) {
  const found = source.inspected.length;
  const supported = source.inspected.filter((item) => item.outbound).length;
  const selected = selectedSourceCount(source);
  source.pickerCount.textContent = t("picker.count", {
    selected,
    supported,
    found,
  });
}

function filterNodePicker(source) {
  const query = source.nodeSearch.value
    .trim()
    .toLocaleLowerCase(currentNumberLocale);
  for (const row of source.nodeOptions.children) {
    row.classList.toggle(
      "hidden",
      Boolean(query) && !row.dataset.search.includes(query),
    );
  }
}

function renderNodePicker(source) {
  source.nodeOptions.replaceChildren();
  source.picker.classList.toggle("hidden", source.inspected.length === 0);
  if (source.inspected.length === 0) {
    updatePickerCount(source);
    return;
  }

  source.inspected.forEach((item, index) => {
    const supported = Boolean(item.outbound);
    const tag =
      item.outbound?.tag ||
      item.tag ||
      t("node.generated", { number: index + 1 });
    const row = document.createElement("label");
    row.className = `node-option${supported ? "" : " unsupported"}`;
    row.dataset.search = `${tag} ${item.reason || ""} ${item.sourceType || ""}`
      .toLocaleLowerCase(currentNumberLocale);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = supported && source.enabled[index] !== false;
    checkbox.disabled = !supported;
    checkbox.setAttribute("aria-label", t("picker.addAria", { tag }));
    checkbox.addEventListener("change", () => {
      source.enabled[index] = checkbox.checked;
      updatePickerCount(source);
      updateSourceSummary();
    });

    const copy = document.createElement("span");
    copy.className = "node-option-copy";
    const name = document.createElement("span");
    name.className = "node-option-name";
    name.textContent = tag;
    const meta = document.createElement("span");
    meta.className = "node-option-meta";
    meta.textContent = supported
      ? `${item.outbound.type.toUpperCase()} · ${String(item.sourceType || t("picker.noTransport")).toUpperCase()}`
      : t("picker.unsupported", { reason: item.reason });
    copy.append(name, meta);
    row.append(checkbox, copy);
    source.nodeOptions.append(row);
  });

  updatePickerCount(source);
  filterNodePicker(source);
}

function inspectSource(source, resetSelection = false) {
  source.inspected = parseEntries(
    source.parsed,
    source.prefix.value.trim(),
  );
  if (resetSelection || source.enabled.length !== source.inspected.length) {
    source.enabled = source.inspected.map((item) => Boolean(item.outbound));
  } else {
    source.enabled = source.inspected.map(
      (item, index) => Boolean(item.outbound) && source.enabled[index] !== false,
    );
  }
  renderNodePicker(source);
  updateSourceSummary();
}

function updateSourceSummary() {
  invalidateGeneratedConfig();
  let found = 0;
  let supported = 0;
  let selected = 0;
  for (const source of sources.values()) {
    found += source.inspected?.length || 0;
    supported +=
      source.inspected?.filter((item) => item.outbound).length || 0;
    selected += source.inspected?.length
      ? selectedSourceCount(source)
      : 0;
  }
  elements.sourceSummary.textContent =
    found === 0
      ? t("summary.zeroNodes")
      : t("summary.nodes", { selected, supported, found });
}

function normalizeSubscriptionUrl(value) {
  const trimmed = value.trim();
  const happPrefix = "happ://add/";
  return trimmed.toLowerCase().startsWith(happPrefix)
    ? trimmed.slice(happPrefix.length)
    : trimmed;
}

function subscriptionUsesHwid(url) {
  try {
    return new URL(url).hostname.toLowerCase() === "sub.tconnect.services";
  } catch {
    return false;
  }
}

function renderSource(prefix = "") {
  const id = ++sourceSequence;
  const wrapper = document.createElement("article");
  wrapper.className = "source";
  wrapper.innerHTML = `
    <div class="source-grid">
      <label>
        ${t("source.urlLabel")}
        <input class="source-url" type="url" placeholder="${t("source.urlPlaceholder")}" autocomplete="off" />
      </label>
      <label>
        ${t("source.prefixLabel")}
        <input class="source-prefix" value="${prefix.replaceAll('"', "&quot;")}" placeholder="${t("source.prefixPlaceholder")}" />
      </label>
    </div>
    <div class="source-actions">
      <button class="btn btn-blue fetch-source" type="button">${t("source.fetch")}</button>
      <label class="btn file-label">
        ${t("source.file")}
        <input class="file-source" type="file" accept=".txt,.json,text/plain,application/json" />
      </label>
      <label class="hwid-toggle" title="${t("source.hwidTitle")}">
        <input class="source-use-hwid" type="checkbox" />
        <span>${t("source.hwid")}</span>
      </label>
      <button class="btn btn-danger remove-source" type="button">${t("source.remove")}</button>
    </div>
    <p class="hint">${t("source.hwidHint")}</p>
    <details>
      <summary>${t("source.manualSummary")}</summary>
      <textarea class="raw-input" spellcheck="false" placeholder="${t("source.rawPlaceholder")}"></textarea>
      <button class="btn parse-raw" type="button">${t("source.parseRaw")}</button>
    </details>
    <details class="node-picker hidden" open>
      <summary>
        <span>${t("source.selection")}</span>
        <span class="node-picker-count">${t("source.selectedZero")}</span>
      </summary>
      <div class="node-picker-toolbar">
        <input class="node-search" type="search" placeholder="${t("source.searchPlaceholder")}" aria-label="${t("source.searchAria")}" />
        <button class="btn select-supported" type="button">${t("source.selectSupported")}</button>
        <button class="btn clear-nodes" type="button">${t("source.clear")}</button>
        <button class="btn exclude-russia" type="button">${t("source.excludeRussia")}</button>
      </div>
      <div class="node-options" role="group" aria-label="${t("source.groupAria")}"></div>
    </details>
    <div class="status">${t("source.initial")}</div>
  `;
  elements.sourceList.append(wrapper);

  const source = {
    id,
    wrapper,
    url: wrapper.querySelector(".source-url"),
    prefix: wrapper.querySelector(".source-prefix"),
    raw: wrapper.querySelector(".raw-input"),
    file: wrapper.querySelector(".file-source"),
    useHwid: wrapper.querySelector(".source-use-hwid"),
    status: wrapper.querySelector(".status"),
    parsed: [],
    inspected: [],
    enabled: [],
    picker: wrapper.querySelector(".node-picker"),
    pickerCount: wrapper.querySelector(".node-picker-count"),
    nodeOptions: wrapper.querySelector(".node-options"),
    nodeSearch: wrapper.querySelector(".node-search"),
  };
  sources.set(id, source);

  wrapper
    .querySelector(".fetch-source")
    .addEventListener("click", () => fetchSource(id));
  wrapper.querySelector(".parse-raw").addEventListener("click", () => {
    parseSourceText(id, source.raw.value);
  });
  source.prefix.addEventListener("input", () => {
    if (source.parsed.length) inspectSource(source, false);
  });
  source.nodeSearch.addEventListener("input", () => {
    filterNodePicker(source);
  });
  wrapper.querySelector(".select-supported").addEventListener("click", () => {
    source.enabled = source.inspected.map((item) => Boolean(item.outbound));
    renderNodePicker(source);
    updateSourceSummary();
  });
  wrapper.querySelector(".clear-nodes").addEventListener("click", () => {
    source.enabled = source.inspected.map(() => false);
    renderNodePicker(source);
    updateSourceSummary();
  });
  wrapper.querySelector(".exclude-russia").addEventListener("click", () => {
    source.enabled = source.inspected.map(
      (item, index) =>
        Boolean(item.outbound) &&
        source.enabled[index] !== false &&
        !isRussianNodeTag(item.outbound?.tag || item.tag),
    );
    renderNodePicker(source);
    updateSourceSummary();
  });
  source.file.addEventListener("change", async () => {
    const file = source.file.files?.[0];
    if (!file) return;
    parseSourceText(id, await file.text());
  });
  wrapper
    .querySelector(".remove-source")
    .addEventListener("click", () => {
      sources.delete(id);
      wrapper.remove();
      updateSourceSummary();
    });
  return source;
}

function parseSourceText(id, text) {
  const source = sources.get(id);
  if (!source) return;
  try {
    const entries = decodeSubscription(text);
    source.parsed = entries;
    source.raw.value = text;
    inspectSource(source, true);
    const onlyItem = source.inspected[0];
    const onlyTag = onlyItem?.outbound?.tag || onlyItem?.tag || "";
    if (
      source.inspected.length === 1 &&
      onlyTag.toLocaleLowerCase("ru-RU").includes("приложение не поддерживается")
    ) {
      throw new Error(t("source.providerStub"));
    }
    const supported = source.inspected.filter((item) => item.outbound).length;
    const skipped = source.inspected.length - supported;
    setStatus(
      id,
      skipped
        ? t("source.loadedWithSkipped", {
            found: entries.length,
            supported,
            skipped,
          })
        : t("source.loaded", { count: entries.length }),
      skipped ? "warn" : "ok",
    );
  } catch (error) {
    source.parsed = [];
    source.inspected = [];
    source.enabled = [];
    renderNodePicker(source);
    setStatus(id, t("source.error", { message: error.message }), "bad");
    updateSourceSummary();
  }
}

async function fetchSource(id) {
  const source = sources.get(id);
  if (!source) return;
  const rawUrl = source.url.value.trim();
  const fromHappLink = rawUrl.toLowerCase().startsWith("happ://add/");
  const url = normalizeSubscriptionUrl(rawUrl);
  if (!url) {
    setStatus(id, t("source.enterUrl"), "warn");
    return;
  }
  if (fromHappLink || subscriptionUsesHwid(url)) {
    source.useHwid.checked = true;
    source.url.value = url;
  }
  setStatus(id, t("source.loading"));
  try {
    let text;
    if (backendAvailable) {
      const response = await fetch("/api/fetch-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": currentLocale,
        },
        body: JSON.stringify({
          url,
          useHwid: source.useHwid.checked,
          locale: currentLocale,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      text = payload.text;
    } else if (source.useHwid.checked) {
      throw new Error(t("source.hwidNeedsBackend"));
    } else if (location.protocol !== "file:") {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
    } else {
      throw new Error(t("source.fileNeedsBackend"));
    }
    parseSourceText(id, text);
  } catch (error) {
    setStatus(
      id,
      t("source.fetchFailed", { message: error.message }),
      "bad",
    );
  }
}

async function checkBackend() {
  if (location.protocol === "file:") {
    backendAvailable = false;
    elements.backendHelp.textContent = t("backend.fileHelp");
    return;
  }
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) throw new Error();
    backendAvailable = true;
  } catch {
    backendAvailable = false;
    elements.backendHelp.textContent = t("backend.unavailable");
  }
}
