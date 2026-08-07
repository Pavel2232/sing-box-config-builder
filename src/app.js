const baseConfig = JSON.parse(
  document.getElementById("baseConfig").textContent,
);
const baseDomains = [
  ...baseConfig.route.rule_set[0].rules[0].domain_suffix,
];
const sources = new Map();
let sourceSequence = 0;
let generatedConfig = null;
let backendAvailable = false;
const SETTINGS_STORAGE_KEY = "sing-box-config-builder.settings.v3";
const MIN_HEALTH_INTERVAL_MS = 10 * 60 * 1000;

const elements = {
  sourceList: document.getElementById("sourceList"),
  sourceSummary: document.getElementById("sourceSummary"),
  directDomains: document.getElementById("directDomains"),
  domainCount: document.getElementById("domainCount"),
  healthInterval: document.getElementById("healthInterval"),
  controllerAddress: document.getElementById("controllerAddress"),
  controllerSecret: document.getElementById("controllerSecret"),
  tunName: document.getElementById("tunName"),
  buildStatus: document.getElementById("buildStatus"),
  jsonOutput: document.getElementById("jsonOutput"),
  downloadConfig: document.getElementById("downloadConfig"),
  copyConfig: document.getElementById("copyConfig"),
  nodeStat: document.getElementById("nodeStat"),
  skippedStat: document.getElementById("skippedStat"),
  directStat: document.getElementById("directStat"),
  skippedDetails: document.getElementById("skippedDetails"),
  toast: document.getElementById("toast"),
  backendHelp: document.getElementById("backendHelp"),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(
    () => elements.toast.classList.add("hidden"),
    2600,
  );
}

function parseDuration(value) {
  const match = String(value || "").match(/^(\d+)(ms|s|m|h)$/);
  if (!match || Number(match[1]) < 1) return 0;
  const factors = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };
  return Number(match[1]) * factors[match[2]];
}

function loadSettings() {
  try {
    const value = JSON.parse(
      localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}",
    );
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function persistSettings() {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        healthInterval: elements.healthInterval.value.trim(),
        controllerAddress: elements.controllerAddress.value.trim(),
        controllerSecret: elements.controllerSecret.value,
        tunName: elements.tunName.value.trim(),
      }),
    );
  } catch {
    // The builder still works when browser storage is disabled.
  }
}

function initializeSettings() {
  const saved = loadSettings();
  elements.healthInterval.value = saved.healthInterval || "20m";
  elements.controllerAddress.value =
    saved.controllerAddress || "0.0.0.0:9090";
  elements.controllerSecret.value =
    saved.controllerSecret ||
    baseConfig.experimental?.clash_api?.secret ||
    randomSecret();
  elements.tunName.value = saved.tunName || "singtun0";
  persistSettings();
}

function randomSecret() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const suffix = [...bytes]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `SINGBOX-${suffix}`;
}

function normalizeDomain(line) {
  let value = line.trim().toLowerCase();
  if (!value || value.startsWith("#")) return "";
  if (value.includes("://")) {
    try {
      value = new URL(value).hostname;
    } catch {
      return "";
    }
  } else {
    value = value.split("/")[0].split(":")[0];
  }
  return value.replace(/^\.+|\.+$/g, "");
}

function normalizedDomains() {
  return [
    ...new Set(
      elements.directDomains.value
        .split(/\r?\n/)
        .map(normalizeDomain)
        .filter(
          (domain) =>
            domain &&
            domain.length <= 253 &&
            /^[a-z0-9._-]+$/.test(domain),
        ),
    ),
  ].sort();
}

function updateDomainCount() {
  const count = normalizedDomains().length;
  elements.domainCount.textContent = `${count} доменов`;
}

function isRussianNodeTag(tag) {
  const value = String(tag || "").toLocaleLowerCase("ru-RU");
  return (
    value.includes("🇷🇺") ||
    value.includes("росси") ||
    value.includes("russia")
  );
}

function invalidateGeneratedConfig() {
  if (!generatedConfig) return;
  generatedConfig = null;
  elements.downloadConfig.disabled = true;
  elements.copyConfig.disabled = true;
  elements.buildStatus.textContent =
    "Выбор туннелей изменён — соберите config.json заново.";
  elements.buildStatus.className = "status warn";
}

function settingError(message) {
  elements.buildStatus.textContent = message;
  elements.buildStatus.className = "status bad";
  return false;
}

function validateSettings() {
  const interval = elements.healthInterval.value.trim();
  const intervalMs = parseDuration(interval);
  if (!intervalMs) {
    return settingError(
      "Интервал должен выглядеть как 10m, 20m или 1h.",
    );
  }
  if (intervalMs < MIN_HEALTH_INTERVAL_MS) {
    return settingError(
      "Для большого списка туннелей интервал должен быть не меньше 10m.",
    );
  }

  const controller = elements.controllerAddress.value.trim();
  const controllerMatch = controller.match(/^(.+):(\d{1,5})$/);
  const controllerPort = Number(controllerMatch?.[2] || 0);
  if (
    !controllerMatch ||
    controllerPort < 1 ||
    controllerPort > 65535
  ) {
    return settingError(
      "Адрес Yacd должен выглядеть как 0.0.0.0:9090.",
    );
  }

  const tunName = elements.tunName.value.trim();
  if (!/^[a-zA-Z0-9_.-]{1,15}$/.test(tunName)) {
    return settingError(
      "Имя TUN: от 1 до 15 букв, цифр, точек, дефисов или подчёркиваний.",
    );
  }

  if (!elements.controllerSecret.value) {
    elements.controllerSecret.value = randomSecret();
  }
  if (elements.controllerSecret.value.length < 8) {
    return settingError("Пароль Yacd должен содержать минимум 8 символов.");
  }
  persistSettings();
  return true;
}

function buildConfig() {
  const parsedNodes = [];
  let foundCount = 0;
  let disabledCount = 0;
  for (const source of sources.values()) {
    if (!source.parsed?.length) continue;
    if (source.inspected.length !== source.parsed.length) {
      inspectSource(source, false);
    }
    foundCount += source.inspected.length;
    source.inspected.forEach((item, index) => {
      if (item.outbound && source.enabled[index] === false) {
        disabledCount += 1;
        return;
      }
      parsedNodes.push(item);
    });
  }
  if (foundCount === 0) {
    elements.buildStatus.textContent =
      "Не найдено ни одного загруженного узла.";
    elements.buildStatus.className = "status bad";
    return;
  }

  if (!validateSettings()) return;

  const supportedNodes = parsedNodes.filter((item) => item.outbound);
  const skippedNodes = parsedNodes.filter((item) => !item.outbound);
  const nodes = supportedNodes.map((item) => clone(item.outbound));
  if (nodes.length === 0) {
    elements.buildStatus.textContent =
      disabledCount > 0
        ? "Выберите хотя бы один поддерживаемый туннель."
        : `Найдено ${foundCount} узлов, но ни один не поддерживается sing-box. Для XHTTP используйте PassWall2 + Xray-core.`;
    elements.buildStatus.className = "status bad";
    elements.skippedStat.textContent = skippedNodes.length + disabledCount;
    elements.skippedDetails.textContent =
      disabledCount > 0
        ? `Отключено вручную: ${disabledCount}.`
        : "XHTTP нельзя превратить в рабочий sing-box outbound.";
    elements.skippedDetails.classList.remove("hidden");
    return;
  }
  makeTagsUnique(nodes);
  const nodeTags = nodes.map((node) => node.tag);
  const domains = normalizedDomains();
  const config = clone(baseConfig);

  config.inbounds[0].interface_name =
    elements.tunName.value.trim() || "singtun0";
  config.experimental.clash_api.external_controller =
    elements.controllerAddress.value.trim() || "0.0.0.0:9090";
  config.experimental.clash_api.secret =
    elements.controllerSecret.value;
  config.outbounds = [
    {
      type: "selector",
      tag: "SELECT",
      outbounds: ["DIRECT", "AUTO", ...nodeTags],
      default: "DIRECT",
      interrupt_exist_connections: true,
    },
    {
      type: "urltest",
      tag: "AUTO",
      outbounds: nodeTags,
      url: "https://www.gstatic.com/generate_204",
      interval: elements.healthInterval.value.trim() || "20m",
      tolerance: 50,
      interrupt_exist_connections: false,
    },
    {
      type: "direct",
      tag: "DIRECT",
    },
    ...nodes,
  ];
  config.route.final = "SELECT";
  config.route.auto_detect_interface = true;
  config.route.rule_set[0].rules[0].domain_suffix = domains;

  const json = `${JSON.stringify(config, null, 2)}\n`;
  generatedConfig = json;
  elements.jsonOutput.value = json;
  elements.downloadConfig.disabled = false;
  elements.copyConfig.disabled = false;
  elements.nodeStat.textContent = nodes.length;
  elements.skippedStat.textContent = skippedNodes.length + disabledCount;
  if (skippedNodes.length || disabledCount) {
    const reasons = new Map();
    for (const item of skippedNodes) {
      reasons.set(item.reason, (reasons.get(item.reason) || 0) + 1);
    }
    if (disabledCount) {
      reasons.set("отключено вручную", disabledCount);
    }
    elements.skippedDetails.textContent =
      "Не добавлены: " +
      [...reasons]
        .map(([reason, count]) => `${reason} — ${count}`)
        .join("; ") +
      ".";
    elements.skippedDetails.classList.remove("hidden");
  } else {
    elements.skippedDetails.textContent = "";
    elements.skippedDetails.classList.add("hidden");
  }
  elements.directStat.textContent = domains.length;
  elements.buildStatus.textContent =
    `Готово: ${nodes.length} рабочих форматов, DIRECT по умолчанию` +
    (skippedNodes.length || disabledCount
      ? `, не добавлено ${skippedNodes.length + disabledCount}.`
      : ".");
  elements.buildStatus.className = "status ok";
  showToast("config.json собран");
}

function downloadConfig() {
  if (!generatedConfig) return;
  const blob = new Blob([generatedConfig], {
    type: "application/json;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "config.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function copyText(text, message) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  showToast(message);
}

elements.directDomains.value = baseDomains.join("\n");
initializeSettings();
updateDomainCount();
renderSource("");
renderSource("");
checkBackend();

[
  elements.healthInterval,
  elements.controllerAddress,
  elements.controllerSecret,
  elements.tunName,
].forEach((element) => element.addEventListener("change", persistSettings));

document.getElementById("addSource").addEventListener("click", () => {
  renderSource("");
});
elements.directDomains.addEventListener("input", updateDomainCount);
document.getElementById("resetDomains").addEventListener("click", () => {
  elements.directDomains.value = baseDomains.join("\n");
  updateDomainCount();
});
document.getElementById("sortDomains").addEventListener("click", () => {
  elements.directDomains.value = normalizedDomains().join("\n");
  updateDomainCount();
  showToast("Список очищен и отсортирован");
});
document
  .getElementById("buildConfig")
  .addEventListener("click", buildConfig);
elements.downloadConfig.addEventListener("click", downloadConfig);
elements.copyConfig.addEventListener("click", () => {
  if (generatedConfig) {
    copyText(generatedConfig, "JSON скопирован");
  }
});
document.getElementById("copyCommands").addEventListener("click", () => {
  copyText(
    document.getElementById("commands").textContent,
    "Команды скопированы",
  );
});
document.getElementById("copyRecovery").addEventListener("click", () => {
  copyText(
    document.getElementById("recoveryCommands").textContent,
    "Команды отключения скопированы",
  );
});
