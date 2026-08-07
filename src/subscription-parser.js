// Pure subscription decoding and sing-box outbound conversion.

// This file is inlined before app.js by the build script.

function decodeBase64(value) {
  const normalized = value
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
}

function decodeSubscription(text) {
  const input = text.trim();
  if (!input) throw new Error("Подписка пустая");

  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      const hasNativeOutbounds = parsed.some(
        (item) => item && typeof item === "object" && item.type,
      );
      return hasNativeOutbounds
        ? parsed.filter((item) =>
            ["vless", "trojan", "hysteria2"].includes(item?.type),
          )
        : parsed;
    }
    if (Array.isArray(parsed.links)) return parsed.links;
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.outbounds)
    ) {
      const hasNativeOutbounds = parsed.outbounds.some(
        (item) => item && typeof item === "object" && item.type,
      );
      if (hasNativeOutbounds) {
        const nodes = parsed.outbounds.filter((item) =>
          ["vless", "trojan", "hysteria2"].includes(item?.type),
        );
        if (nodes.length === 0) {
          throw new Error("В JSON sing-box нет поддерживаемых узлов");
        }
        return nodes;
      }
      return [parsed];
    }
  } catch {
    // Continue with URI text or base64.
  }

  let linkText = input;
  if (!linkText.includes("://")) {
    const decoded = decodeBase64(linkText);
    if (decoded.includes("://")) linkText = decoded;
  }

  const links = linkText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (links.length === 0) throw new Error("В подписке нет узлов");
  return links;
}

function parseLink(link, index, prefix) {
  let uri;
  try {
    uri = new URL(link);
  } catch {
    return unsupportedNode(link, index, prefix, "некорректная ссылка");
  }

  const scheme = uri.protocol.slice(0, -1);
  const params = uri.searchParams;
  const tag = entryName(link, index, prefix);
  const server = normalizeServerHost(uri.hostname);
  const serverPort = normalizeServerPort(uri.port);
  if (!server || !serverPort) {
    return unsupportedNode(
      link,
      index,
      prefix,
      "некорректный или локальный адрес сервера",
    );
  }
  const rawServerName = params.get("sni");
  if (rawServerName && !normalizeServerHost(rawServerName)) {
    return unsupportedNode(link, index, prefix, "некорректный SNI");
  }

  if (scheme === "vless") {
    const transportInfo = transportFromLink(params);
    if (transportInfo.fallback) {
      return unsupportedNode(
        link,
        index,
        prefix,
        transportInfo.sourceType === "xhttp" ||
          transportInfo.sourceType === "splithttp"
          ? "XHTTP не поддерживается sing-box"
          : `транспорт ${transportInfo.sourceType} не поддерживается`,
      );
    }
    const uuid = normalizeVlessUuid(uri.username);
    if (!uuid) {
      return unsupportedNode(link, index, prefix, "некорректный UUID VLESS");
    }
    const outbound = {
      type: "vless",
      tag,
      server,
      server_port: serverPort,
      uuid,
    };
    const flow = params.get("flow");
    if (flow) outbound.flow = flow;
    const packetEncoding = params.get("packetEncoding");
    if (packetEncoding) outbound.packet_encoding = packetEncoding;
    const tls = tlsFromLink(uri, server);
    if (tls === null) {
      return unsupportedNode(link, index, prefix, "некорректный TLS/Reality");
    }
    if (tls) outbound.tls = tls;
    if (transportInfo.transport) {
      outbound.transport = transportInfo.transport;
    }
    return { outbound, ...transportInfo };
  }

  if (scheme === "trojan") {
    const transportInfo = transportFromLink(params);
    if (transportInfo.fallback) {
      return unsupportedNode(
        link,
        index,
        prefix,
        `транспорт ${transportInfo.sourceType} не поддерживается`,
      );
    }
    const outbound = {
      type: "trojan",
      tag,
      server,
      server_port: serverPort,
      password: safeDecode(uri.username),
    };
    const tls = tlsFromLink(uri, server);
    if (tls === null) {
      return unsupportedNode(link, index, prefix, "некорректный TLS/Reality");
    }
    outbound.tls = tls || { enabled: true, server_name: server };
    if (transportInfo.transport) {
      outbound.transport = transportInfo.transport;
    }
    return { outbound, ...transportInfo };
  }

  if (scheme === "hysteria2" || scheme === "hy2") {
    return {
      outbound: {
        type: "hysteria2",
        tag,
        server,
        server_port: serverPort,
        password: safeDecode(uri.username),
        tls: {
          enabled: true,
          server_name:
            normalizeServerHost(params.get("sni") || server) || server,
          insecure: truthy(params.get("insecure")),
        },
      },
      fallback: false,
      sourceType: "hysteria2",
    };
  }

  return unsupportedNode(
    link,
    index,
    prefix,
    `протокол ${scheme || "не определён"} не поддерживается`,
  );
}

function parseXray(config, index, prefix) {
  const sourceOutbound = config?.outbounds?.[0];
  if (!sourceOutbound) {
    return unsupportedNode(
      config,
      index,
      prefix,
      "в JSON отсутствует outbound",
    );
  }
  const protocol = sourceOutbound.protocol;
  const stream = sourceOutbound.streamSettings || {};
  const tag = entryName(config, index, prefix);

  if (protocol === "vless") {
    const destination = sourceOutbound.settings?.vnext?.[0];
    const user = destination?.users?.[0];
    if (!destination || !user) {
      return unsupportedNode(
        config,
        index,
        prefix,
        "некорректный VLESS",
      );
    }
    const transportInfo = transportFromXray(stream);
    if (transportInfo.fallback) {
      return unsupportedNode(
        config,
        index,
        prefix,
        transportInfo.sourceType === "xhttp" ||
          transportInfo.sourceType === "splithttp"
          ? "XHTTP не поддерживается sing-box"
          : `транспорт ${transportInfo.sourceType} не поддерживается`,
      );
    }
    const server = normalizeServerHost(destination.address);
    const serverPort = normalizeServerPort(destination.port);
    const uuid = normalizeVlessUuid(user.id);
    if (!server || !serverPort || !uuid) {
      return unsupportedNode(
        config,
        index,
        prefix,
        "некорректный адрес, порт или UUID VLESS",
      );
    }
    const outbound = {
      type: "vless",
      tag,
      server,
      server_port: serverPort,
      uuid,
    };
    if (user.flow) outbound.flow = user.flow;
    if (user.packetEncoding) {
      outbound.packet_encoding = user.packetEncoding;
    }
    const tls = tlsFromXray(stream, server);
    if (tls === null) {
      return unsupportedNode(config, index, prefix, "некорректный TLS/Reality");
    }
    if (tls) outbound.tls = tls;
    if (transportInfo.transport) {
      outbound.transport = transportInfo.transport;
    }
    return { outbound, ...transportInfo };
  }

  if (protocol === "trojan") {
    const destination = sourceOutbound.settings?.servers?.[0];
    if (!destination) {
      return unsupportedNode(
        config,
        index,
        prefix,
        "некорректный Trojan",
      );
    }
    const transportInfo = transportFromXray(stream);
    if (transportInfo.fallback) {
      return unsupportedNode(
        config,
        index,
        prefix,
        `транспорт ${transportInfo.sourceType} не поддерживается`,
      );
    }
    const server = normalizeServerHost(destination.address);
    const serverPort = normalizeServerPort(destination.port);
    if (!server || !serverPort || !destination.password) {
      return unsupportedNode(
        config,
        index,
        prefix,
        "некорректный Trojan",
      );
    }
    const outbound = {
      type: "trojan",
      tag,
      server,
      server_port: serverPort,
      password: destination.password,
    };
    const tls = tlsFromXray(stream, server);
    if (tls === null) {
      return unsupportedNode(config, index, prefix, "некорректный TLS/Reality");
    }
    if (tls) outbound.tls = tls;
    if (transportInfo.transport) {
      outbound.transport = transportInfo.transport;
    }
    return { outbound, ...transportInfo };
  }

  if (
    protocol === "hysteria2" ||
    (protocol === "hysteria" &&
      (sourceOutbound.settings?.version === 2 ||
        stream.hysteriaSettings?.version === 2))
  ) {
    const settings = sourceOutbound.settings || {};
    const server = normalizeServerHost(settings.address);
    const serverPort = normalizeServerPort(settings.port);
    if (!server || !serverPort) {
      return unsupportedNode(config, index, prefix, "некорректный Hysteria2");
    }
    const outbound = {
      type: "hysteria2",
      tag,
      server,
      server_port: serverPort,
      password:
        stream.hysteriaSettings?.auth ||
        settings.auth ||
        settings.password ||
        "",
    };
    const tls = tlsFromXray(stream, server);
    if (tls === null) {
      return unsupportedNode(config, index, prefix, "некорректный TLS Hysteria2");
    }
    if (tls) outbound.tls = tls;
    return {
      outbound,
      fallback: false,
      sourceType: "hysteria2",
    };
  }

  return unsupportedNode(
    config,
    index,
    prefix,
    `протокол ${protocol || "не определён"} не поддерживается`,
  );
}

function parseSingBoxOutbound(source, index, prefix) {
  const type = String(source?.type || "").toLowerCase();
  const tag = entryName(source, index, prefix);
  const server = normalizeServerHost(source?.server);
  const serverPort = normalizeServerPort(source?.server_port);
  if (!server || !serverPort) {
    return unsupportedNode(
      source,
      index,
      prefix,
      "некорректный или локальный адрес сервера",
    );
  }

  const transportInfo = transportFromSingBox(source.transport);
  if (transportInfo.fallback) {
    return unsupportedNode(
      source,
      index,
      prefix,
      transportInfo.sourceType === "xhttp" ||
        transportInfo.sourceType === "splithttp"
        ? "XHTTP не поддерживается sing-box"
        : `транспорт ${transportInfo.sourceType} не поддерживается`,
    );
  }

  if (type === "vless") {
    const uuid = normalizeVlessUuid(source.uuid);
    if (!uuid) {
      return unsupportedNode(
        source,
        index,
        prefix,
        "некорректный UUID VLESS",
      );
    }
    const outbound = {
      type: "vless",
      tag,
      server,
      server_port: serverPort,
      uuid,
    };
    const flow = safeTransportText(source.flow, "", 64);
    if (flow) outbound.flow = flow;
    const packetEncoding = safeTransportText(
      source.packet_encoding,
      "",
      32,
    );
    if (packetEncoding) outbound.packet_encoding = packetEncoding;
    const tls = tlsFromSingBox(source.tls, server);
    if (tls === null) {
      return unsupportedNode(
        source,
        index,
        prefix,
        "некорректный TLS/Reality",
      );
    }
    if (tls) outbound.tls = tls;
    if (transportInfo.transport) {
      outbound.transport = transportInfo.transport;
    }
    return { outbound, ...transportInfo };
  }

  if (type === "trojan") {
    const password = String(source.password || "");
    if (!password) {
      return unsupportedNode(
        source,
        index,
        prefix,
        "в Trojan отсутствует пароль",
      );
    }
    const outbound = {
      type: "trojan",
      tag,
      server,
      server_port: serverPort,
      password,
    };
    const tls = tlsFromSingBox(source.tls, server);
    if (tls === null) {
      return unsupportedNode(
        source,
        index,
        prefix,
        "некорректный TLS/Reality",
      );
    }
    outbound.tls = tls || { enabled: true, server_name: server };
    if (transportInfo.transport) {
      outbound.transport = transportInfo.transport;
    }
    return { outbound, ...transportInfo };
  }

  if (type === "hysteria2") {
    const password = String(source.password || "");
    if (!password) {
      return unsupportedNode(
        source,
        index,
        prefix,
        "в Hysteria2 отсутствует пароль",
      );
    }
    const tls = tlsFromSingBox(source.tls, server);
    if (!tls) {
      return unsupportedNode(
        source,
        index,
        prefix,
        "некорректный TLS Hysteria2",
      );
    }
    const outbound = {
      type: "hysteria2",
      tag,
      server,
      server_port: serverPort,
      password,
      tls,
    };
    const obfsType = safeTransportText(source.obfs?.type, "", 32);
    const obfsPassword = String(source.obfs?.password || "");
    if (obfsType && obfsPassword) {
      outbound.obfs = { type: obfsType, password: obfsPassword };
    }
    return {
      outbound,
      fallback: false,
      sourceType: "hysteria2",
    };
  }

  return unsupportedNode(
    source,
    index,
    prefix,
    `протокол ${type || "не определён"} не поддерживается`,
  );
}

function parseEntries(entries, prefix) {
  return entries.map((entry, index) =>
    typeof entry === "string"
      ? parseLink(entry, index, prefix)
      : entry?.type
        ? parseSingBoxOutbound(entry, index, prefix)
        : parseXray(entry, index, prefix),
  );
}
