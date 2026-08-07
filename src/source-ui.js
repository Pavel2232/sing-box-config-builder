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
  source.pickerCount.textContent =
    `${selected} выбрано из ${supported} рабочих · ${found} всего`;
}

function filterNodePicker(source) {
  const query = source.nodeSearch.value.trim().toLocaleLowerCase("ru-RU");
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
    const tag = item.outbound?.tag || item.tag || `${index + 1} Узел`;
    const row = document.createElement("label");
    row.className = `node-option${supported ? "" : " unsupported"}`;
    row.dataset.search = `${tag} ${item.reason || ""} ${item.sourceType || ""}`
      .toLocaleLowerCase("ru-RU");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = supported && source.enabled[index] !== false;
    checkbox.disabled = !supported;
    checkbox.setAttribute("aria-label", `Добавить туннель ${tag}`);
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
      ? `${item.outbound.type.toUpperCase()} · ${String(item.sourceType || "без транспорта").toUpperCase()}`
      : `Не будет добавлен: ${item.reason}`;
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
      ? "0 узлов"
      : `${selected} выбрано из ${supported} рабочих (${found} найдено)`;
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
        Ссылка подписки
        <input class="source-url" type="url" placeholder="https://example.com/sub/…" autocomplete="off" />
      </label>
      <label>
        Префикс имён
        <input class="source-prefix" value="${prefix.replaceAll('"', "&quot;")}" placeholder="необязательно" />
      </label>
    </div>
    <div class="source-actions">
      <button class="btn btn-blue fetch-source" type="button">Загрузить по URL</button>
      <label class="btn file-label">
        Выбрать .txt/.json
        <input class="file-source" type="file" accept=".txt,.json,text/plain,application/json" />
      </label>
      <label class="hwid-toggle" title="Отправлять HWID установленного Happ этому провайдеру">
        <input class="source-use-hwid" type="checkbox" />
        <span>HWID Happ</span>
      </label>
      <button class="btn btn-danger remove-source" type="button">Удалить</button>
    </div>
    <p class="hint">
      <strong>HWID Happ</strong> нужен только для подписок, привязанных к
      установленному приложению Happ, например tconnect. Для ссылок
      <code>happ://…</code> он включается автоматически.
    </p>
    <details>
      <summary>Или вставить содержимое подписки вручную</summary>
      <textarea class="raw-input" spellcheck="false" placeholder="vless://… или base64/JSON"></textarea>
      <button class="btn parse-raw" type="button">Прочитать вставленный текст</button>
    </details>
    <details class="node-picker hidden" open>
      <summary>
        <span>Выбор туннелей</span>
        <span class="node-picker-count">0 выбрано</span>
      </summary>
      <div class="node-picker-toolbar">
        <input class="node-search" type="search" placeholder="Поиск по названию…" aria-label="Поиск туннелей" />
        <button class="btn select-supported" type="button">Все рабочие</button>
        <button class="btn clear-nodes" type="button">Снять все</button>
        <button class="btn exclude-russia" type="button">Отключить Россию</button>
      </div>
      <div class="node-options" role="group" aria-label="Выбор VPN-туннелей"></div>
    </details>
    <div class="status">Источник ещё не загружен.</div>
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
      throw new Error(
        "Провайдер вернул заглушку. Включите «HWID Happ» и загрузите ещё раз.",
      );
    }
    const supported = source.inspected.filter((item) => item.outbound).length;
    const skipped = source.inspected.length - supported;
    setStatus(
      id,
      skipped
        ? `Найдено ${entries.length}: поддерживаются ${supported}, будут пропущены ${skipped}.`
        : `Загружено узлов: ${entries.length}.`,
      skipped ? "warn" : "ok",
    );
  } catch (error) {
    source.parsed = [];
    source.inspected = [];
    source.enabled = [];
    renderNodePicker(source);
    setStatus(id, `Ошибка: ${error.message}`, "bad");
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
    setStatus(id, "Вставьте ссылку подписки.", "warn");
    return;
  }
  if (fromHappLink || subscriptionUsesHwid(url)) {
    source.useHwid.checked = true;
    source.url.value = url;
  }
  setStatus(id, "Загружаю…");
  try {
    let text;
    if (backendAvailable) {
      const response = await fetch("/api/fetch-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          useHwid: source.useHwid.checked,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      text = payload.text;
    } else if (source.useHwid.checked) {
      throw new Error("Для HWID Happ нужен запущенный Python/Docker сервер");
    } else if (location.protocol !== "file:") {
      const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
    } else {
      throw new Error(
        "HTML открыт без Python. Закройте вкладку и запустите start-sing-box-builder.command",
      );
    }
    parseSourceText(id, text);
  } catch (error) {
    setStatus(
      id,
      `Не удалось загрузить: ${error.message}`,
      "bad",
    );
  }
}

async function checkBackend() {
  if (location.protocol === "file:") {
    backendAvailable = false;
    elements.backendHelp.textContent =
      "Эта вкладка открыта напрямую, поэтому браузер не даст скачать подписки. Закройте её и дважды нажмите start-sing-box-builder.command — Python откроет правильный адрес http://127.0.0.1:8765/.";
    return;
  }
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) throw new Error();
    backendAvailable = true;
  } catch {
    backendAvailable = false;
    elements.backendHelp.textContent =
      "Локальный Python-сервер недоступен. Запустите start-sing-box-builder.command и работайте во вкладке http://127.0.0.1:8765/.";
  }
}
