// Shared Russian and English interface translations.

const TRANSLATIONS = {
  ru: {
    "meta.description": "Локальный генератор sing-box config.json для OpenWrt",
    "hero.description":
      "Собирает полный <strong>config.json</strong> из VPN-подписок, оставляет DIRECT режимом по умолчанию, а мимо VPN отправляет только сервисы из встроенных белых списков.",
    "notice.title": "Важно.",
    "notice.body":
      "Подписки содержат секретные ключи. Страница ничего не отправляет сторонним сервисам и не сохраняет ссылки. При запуске через <code>sing-box-config-builder.py</code> подписку скачивает локальный Python, поэтому CORS не мешает.",
    "subscriptions.title": "1. VPN-подписки",
    "subscriptions.description":
      "Можно добавить любое количество источников и префикс имён.",
    "subscriptions.add": "+ Добавить подписку",
    "direct.title": "2. Всегда напрямую",
    "direct.description":
      "Белые списки российских сервисов уже добавлены по умолчанию. Свои домены или URL можно добавить по одному на строку.",
    "direct.aria": "Домены прямого маршрута",
    "direct.reset": "Вернуть базовый список",
    "direct.sort": "Очистить дубли и сортировать",
    "settings.title": "3. Настройки",
    "settings.description": "Настройки подходят для sing-box версии 1.12.17.",
    "settings.healthInterval": "Проверка туннелей",
    "settings.controllerAddress": "Адрес Yacd API",
    "settings.controllerSecret": "Пароль Yacd",
    "settings.tunName": "Имя TUN",
    "settings.build": "Собрать полный config.json",
    "settings.warning":
      "Адрес <code>0.0.0.0:9090</code> открывает Yacd для устройств в домашней сети. Пароль берётся из рабочего конфига и сохраняется в браузере. Команда удаления <code>cache.db</code> ниже один раз сбросит старый выбор на <code>DIRECT</code>.",
    "settings.initialStatus": "Сначала загрузите хотя бы одну подписку.",
    "output.title": "Готовый конфиг",
    "output.description": "DIRECT выбран по умолчанию, AUTO проверяет все узлы.",
    "output.tunnels": "туннелей",
    "output.skipped": "пропущено",
    "output.directDomains": "DIRECT доменов",
    "output.placeholder": "Здесь появится полный JSON…",
    "output.aria": "Готовый config.json",
    "output.download": "Скачать config.json",
    "output.copy": "Копировать JSON",
    "commands.title": "Команды после загрузки",
    "commands.description":
      "Положите файл в <code>/etc/sing-box/config.json</code>, затем выполните:",
    "commands.copy": "Копировать команды",
    "commands.checkHint":
      "Пустой вывод команды <code>sing-box check</code> означает, что конфиг прошёл проверку.",
    "commands.recoveryTitle": "Если после запуска пропал интернет",
    "commands.recoveryCopy": "Копировать аварийное отключение",
    "source.urlLabel": "Ссылка подписки",
    "source.urlPlaceholder": "https://example.com/sub/…",
    "source.prefixLabel": "Префикс имён",
    "source.prefixPlaceholder": "необязательно",
    "source.fetch": "Загрузить по URL",
    "source.file": "Выбрать .txt/.json",
    "source.hwidTitle": "Отправлять HWID установленного Happ этому провайдеру",
    "source.hwid": "HWID Happ",
    "source.hwidHint":
      "<strong>HWID Happ</strong> нужен только для подписок, привязанных к установленному приложению Happ, например tconnect. Для ссылок <code>happ://…</code> он включается автоматически.",
    "source.remove": "Удалить",
    "source.manualSummary": "Или вставить содержимое подписки вручную",
    "source.rawPlaceholder": "vless://… или base64/JSON",
    "source.parseRaw": "Прочитать вставленный текст",
    "source.selection": "Выбор туннелей",
    "source.selectedZero": "0 выбрано",
    "source.searchPlaceholder": "Поиск по названию…",
    "source.searchAria": "Поиск туннелей",
    "source.selectSupported": "Все рабочие",
    "source.clear": "Снять все",
    "source.excludeRussia": "Отключить Россию",
    "source.groupAria": "Выбор VPN-туннелей",
    "source.initial": "Источник ещё не загружен.",
    "picker.count": "{selected} выбрано из {supported} рабочих · {found} всего",
    "picker.addAria": "Добавить туннель {tag}",
    "picker.noTransport": "без транспорта",
    "picker.unsupported": "Не будет добавлен: {reason}",
    "summary.zeroNodes": "0 узлов",
    "summary.nodes":
      "{selected} выбрано из {supported} рабочих ({found} найдено)",
    "node.generated": "{number} Узел",
    "source.providerStub":
      "Провайдер вернул заглушку. Включите «HWID Happ» и загрузите ещё раз.",
    "source.loadedWithSkipped":
      "Найдено {found}: поддерживаются {supported}, будут пропущены {skipped}.",
    "source.loaded": "Загружено узлов: {count}.",
    "source.error": "Ошибка: {message}",
    "source.enterUrl": "Вставьте ссылку подписки.",
    "source.loading": "Загружаю…",
    "source.hwidNeedsBackend": "Для HWID Happ нужен запущенный Python/Docker сервер",
    "source.fileNeedsBackend":
      "HTML открыт без Python. Закройте вкладку и запустите start-sing-box-builder.command",
    "source.fetchFailed": "Не удалось загрузить: {message}",
    "backend.fileHelp":
      "Эта вкладка открыта напрямую, поэтому браузер не даст скачать подписки. Закройте её и дважды нажмите start-sing-box-builder.command — Python откроет правильный адрес http://127.0.0.1:8765/.",
    "backend.unavailable":
      "Локальный Python-сервер недоступен. Запустите start-sing-box-builder.command и работайте во вкладке http://127.0.0.1:8765/.",
    "domain.count": "{count} доменов",
    "config.invalidated": "Выбор туннелей изменён — соберите config.json заново.",
    "validation.intervalFormat": "Интервал должен выглядеть как 10m, 20m или 1h.",
    "validation.intervalMinimum":
      "Для большого списка туннелей интервал должен быть не меньше 10m.",
    "validation.controller": "Адрес Yacd должен выглядеть как 0.0.0.0:9090.",
    "validation.tunName":
      "Имя TUN: от 1 до 15 букв, цифр, точек, дефисов или подчёркиваний.",
    "validation.secret": "Пароль Yacd должен содержать минимум 8 символов.",
    "config.noLoadedNodes": "Не найдено ни одного загруженного узла.",
    "config.chooseTunnel": "Выберите хотя бы один поддерживаемый туннель.",
    "config.noSupported":
      "Найдено {found} узлов, но ни один не поддерживается sing-box. Для XHTTP используйте PassWall2 + Xray-core.",
    "config.disabled": "Отключено вручную: {count}.",
    "config.xhttpOnly": "XHTTP нельзя превратить в рабочий sing-box outbound.",
    "config.disabledReason": "отключено вручную",
    "config.notAdded": "Не добавлены: {reasons}.",
    "config.ready":
      "Готово: {count} рабочих форматов, DIRECT по умолчанию{suffix}",
    "config.skippedSuffix": ", не добавлено {count}.",
    "config.noSkippedSuffix": ".",
    "toast.built": "config.json собран",
    "toast.sorted": "Список очищен и отсортирован",
    "toast.jsonCopied": "JSON скопирован",
    "toast.commandsCopied": "Команды скопированы",
    "toast.recoveryCopied": "Команды отключения скопированы",
    "subscription.empty": "Подписка пустая",
    "subscription.noSupportedJsonNodes": "В JSON sing-box нет поддерживаемых узлов",
    "subscription.noNodes": "В подписке нет узлов",
    "reason.invalidLink": "некорректная ссылка",
    "reason.invalidServer": "некорректный или локальный адрес сервера",
    "reason.invalidSni": "некорректный SNI",
    "reason.xhttpUnsupported": "XHTTP не поддерживается sing-box",
    "reason.unsupportedTransport": "транспорт {transport} не поддерживается",
    "reason.invalidVlessUuid": "некорректный UUID VLESS",
    "reason.invalidTlsReality": "некорректный TLS/Reality",
    "reason.unsupportedProtocol": "протокол {protocol} не поддерживается",
    "reason.unknownProtocol": "не определён",
    "reason.missingOutbound": "в JSON отсутствует outbound",
    "reason.invalidVless": "некорректный VLESS",
    "reason.invalidVlessTarget": "некорректный адрес, порт или UUID VLESS",
    "reason.invalidTrojan": "некорректный Trojan",
    "reason.invalidHysteria2": "некорректный Hysteria2",
    "reason.invalidHysteria2Tls": "некорректный TLS Hysteria2",
    "reason.missingTrojanPassword": "в Trojan отсутствует пароль",
    "reason.missingHysteria2Password": "в Hysteria2 отсутствует пароль",
  },
  en: {
    "meta.description": "Local sing-box config.json generator for OpenWrt",
    "hero.description":
      "Builds a complete <strong>config.json</strong> from VPN subscriptions, keeps DIRECT as the default mode, and bypasses the VPN only for services in the built-in allowlists.",
    "notice.title": "Important.",
    "notice.body":
      "Subscriptions contain secret keys. This page does not send data to third-party services or store subscription URLs. When started through <code>sing-box-config-builder.py</code>, the local Python server downloads subscriptions, so browser CORS restrictions do not apply.",
    "subscriptions.title": "1. VPN subscriptions",
    "subscriptions.description":
      "Add any number of sources and optional name prefixes.",
    "subscriptions.add": "+ Add subscription",
    "direct.title": "2. Always direct",
    "direct.description":
      "Allowlists for Russian services are included by default. Add your own domains or URLs, one per line.",
    "direct.aria": "Direct-route domains",
    "direct.reset": "Restore built-in list",
    "direct.sort": "Remove duplicates and sort",
    "settings.title": "3. Settings",
    "settings.description": "These settings target sing-box version 1.12.17.",
    "settings.healthInterval": "Tunnel check interval",
    "settings.controllerAddress": "Yacd API address",
    "settings.controllerSecret": "Yacd password",
    "settings.tunName": "TUN name",
    "settings.build": "Build complete config.json",
    "settings.warning":
      "Address <code>0.0.0.0:9090</code> exposes Yacd to devices on your home network. The password is taken from the working config and stored in the browser. The <code>cache.db</code> removal command below resets the previous selection to <code>DIRECT</code> once.",
    "settings.initialStatus": "Load at least one subscription first.",
    "output.title": "Generated config",
    "output.description": "DIRECT is selected by default; AUTO checks every node.",
    "output.tunnels": "tunnels",
    "output.skipped": "skipped",
    "output.directDomains": "DIRECT domains",
    "output.placeholder": "The complete JSON will appear here…",
    "output.aria": "Generated config.json",
    "output.download": "Download config.json",
    "output.copy": "Copy JSON",
    "commands.title": "Commands after upload",
    "commands.description":
      "Place the file at <code>/etc/sing-box/config.json</code>, then run:",
    "commands.copy": "Copy commands",
    "commands.checkHint":
      "No output from <code>sing-box check</code> means the config passed validation.",
    "commands.recoveryTitle": "If internet access disappears after startup",
    "commands.recoveryCopy": "Copy emergency shutdown",
    "source.urlLabel": "Subscription URL",
    "source.urlPlaceholder": "https://example.com/sub/…",
    "source.prefixLabel": "Name prefix",
    "source.prefixPlaceholder": "optional",
    "source.fetch": "Load from URL",
    "source.file": "Choose .txt/.json",
    "source.hwidTitle": "Send the installed Happ HWID to this provider",
    "source.hwid": "Happ HWID",
    "source.hwidHint":
      "<strong>Happ HWID</strong> is only needed for subscriptions tied to an installed Happ app, such as tconnect. It is enabled automatically for <code>happ://…</code> links.",
    "source.remove": "Remove",
    "source.manualSummary": "Or paste the subscription contents manually",
    "source.rawPlaceholder": "vless://… or base64/JSON",
    "source.parseRaw": "Parse pasted text",
    "source.selection": "Tunnel selection",
    "source.selectedZero": "0 selected",
    "source.searchPlaceholder": "Search by name…",
    "source.searchAria": "Search tunnels",
    "source.selectSupported": "All supported",
    "source.clear": "Clear all",
    "source.excludeRussia": "Disable Russia",
    "source.groupAria": "VPN tunnel selection",
    "source.initial": "Source has not been loaded yet.",
    "picker.count": "{selected} of {supported} supported selected · {found} total",
    "picker.addAria": "Add tunnel {tag}",
    "picker.noTransport": "no transport",
    "picker.unsupported": "Will not be added: {reason}",
    "summary.zeroNodes": "0 nodes",
    "summary.nodes":
      "{selected} of {supported} supported selected ({found} found)",
    "node.generated": "{number} Node",
    "source.providerStub":
      "The provider returned a placeholder. Enable “Happ HWID” and load again.",
    "source.loadedWithSkipped":
      "Found {found}: {supported} supported, {skipped} will be skipped.",
    "source.loaded": "Loaded nodes: {count}.",
    "source.error": "Error: {message}",
    "source.enterUrl": "Enter a subscription URL.",
    "source.loading": "Loading…",
    "source.hwidNeedsBackend": "Happ HWID requires the Python/Docker server",
    "source.fileNeedsBackend":
      "The HTML file was opened without Python. Close this tab and run start-sing-box-builder.command",
    "source.fetchFailed": "Could not load: {message}",
    "backend.fileHelp":
      "This tab was opened as a file, so the browser cannot download subscriptions. Close it and double-click start-sing-box-builder.command; Python will open the correct address at http://127.0.0.1:8765/.",
    "backend.unavailable":
      "The local Python server is unavailable. Run start-sing-box-builder.command and use http://127.0.0.1:8765/.",
    "domain.count": "{count} domains",
    "config.invalidated": "Tunnel selection changed — rebuild config.json.",
    "validation.intervalFormat": "Use an interval such as 10m, 20m, or 1h.",
    "validation.intervalMinimum":
      "For a large tunnel list, the interval must be at least 10m.",
    "validation.controller": "The Yacd address must look like 0.0.0.0:9090.",
    "validation.tunName":
      "TUN name: 1–15 letters, digits, dots, hyphens, or underscores.",
    "validation.secret": "The Yacd password must contain at least 8 characters.",
    "config.noLoadedNodes": "No loaded nodes were found.",
    "config.chooseTunnel": "Select at least one supported tunnel.",
    "config.noSupported":
      "Found {found} nodes, but none are supported by sing-box. Use PassWall2 + Xray-core for XHTTP.",
    "config.disabled": "Disabled manually: {count}.",
    "config.xhttpOnly": "XHTTP cannot be converted into a working sing-box outbound.",
    "config.disabledReason": "disabled manually",
    "config.notAdded": "Not added: {reasons}.",
    "config.ready":
      "Ready: {count} supported nodes, DIRECT by default{suffix}",
    "config.skippedSuffix": ", {count} not added.",
    "config.noSkippedSuffix": ".",
    "toast.built": "config.json built",
    "toast.sorted": "List cleaned and sorted",
    "toast.jsonCopied": "JSON copied",
    "toast.commandsCopied": "Commands copied",
    "toast.recoveryCopied": "Shutdown commands copied",
    "subscription.empty": "The subscription is empty",
    "subscription.noSupportedJsonNodes": "The sing-box JSON contains no supported nodes",
    "subscription.noNodes": "The subscription contains no nodes",
    "reason.invalidLink": "invalid URL",
    "reason.invalidServer": "invalid or local server address",
    "reason.invalidSni": "invalid SNI",
    "reason.xhttpUnsupported": "XHTTP is not supported by sing-box",
    "reason.unsupportedTransport": "transport {transport} is not supported",
    "reason.invalidVlessUuid": "invalid VLESS UUID",
    "reason.invalidTlsReality": "invalid TLS/Reality settings",
    "reason.unsupportedProtocol": "protocol {protocol} is not supported",
    "reason.unknownProtocol": "unknown",
    "reason.missingOutbound": "the JSON has no outbound",
    "reason.invalidVless": "invalid VLESS configuration",
    "reason.invalidVlessTarget": "invalid VLESS address, port, or UUID",
    "reason.invalidTrojan": "invalid Trojan configuration",
    "reason.invalidHysteria2": "invalid Hysteria2 configuration",
    "reason.invalidHysteria2Tls": "invalid Hysteria2 TLS settings",
    "reason.missingTrojanPassword": "Trojan password is missing",
    "reason.missingHysteria2Password": "Hysteria2 password is missing",
  },
};

const currentLocale = document.documentElement.lang === "en" ? "en" : "ru";
const currentNumberLocale = currentLocale === "en" ? "en-US" : "ru-RU";

function t(key, values = {}) {
  const template =
    TRANSLATIONS[currentLocale][key] ?? TRANSLATIONS.ru[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : `{${name}}`,
  );
}

function applyStaticTranslations() {
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-html]")) {
    element.innerHTML = t(element.dataset.i18nHtml);
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }
  for (const element of document.querySelectorAll("[data-i18n-content]")) {
    element.setAttribute("content", t(element.dataset.i18nContent));
  }

  for (const link of document.querySelectorAll("[data-locale-link]")) {
    const locale = link.dataset.localeLink;
    link.classList.toggle("active", locale === currentLocale);
    if (locale === currentLocale) link.setAttribute("aria-current", "page");
    const filename =
      locale === "en"
        ? "sing-box-config-builder.en.html"
        : "sing-box-config-builder.html";
    link.href =
      location.protocol === "file:"
        ? filename
        : locale === "en"
          ? "/en/"
          : "/";
  }
}

applyStaticTranslations();
