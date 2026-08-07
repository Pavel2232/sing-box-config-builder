// TLS and transport conversion for supported subscription formats.



function tlsFromLink(uri, server) {
  const params = uri.searchParams;
  const security = params.get("security");
  if (security !== "tls" && security !== "reality") return undefined;

  const serverName = normalizeServerHost(params.get("sni") || server);
  if (!serverName) return null;

  const tls = {
    enabled: true,
    server_name: serverName,
    insecure:
      truthy(params.get("allowInsecure")) ||
      truthy(params.get("insecure")),
  };
  const alpn = params.get("alpn");
  if (alpn) tls.alpn = alpn.split(",").filter(Boolean);
  const fingerprint = params.get("fp");
  if (fingerprint) {
    tls.utls = { enabled: true, fingerprint };
  }
  if (security === "reality") {
    const publicKey = params.get("pbk") || "";
    if (!publicKey) return null;
    tls.reality = {
      enabled: true,
      public_key: publicKey,
    };
    const shortId = params.get("sid");
    if (shortId) tls.reality.short_id = shortId;
  }
  return tls;
}

function tlsFromXray(stream, server) {
  const security = stream?.security;
  if (security !== "tls" && security !== "reality") return undefined;
  const source =
    security === "reality"
      ? stream.realitySettings || {}
      : stream.tlsSettings || {};
  const serverName = normalizeServerHost(source.serverName || server);
  if (!serverName) return null;
  const tls = {
    enabled: true,
    server_name: serverName,
    insecure: Boolean(source.allowInsecure),
  };
  if (Array.isArray(source.alpn) && source.alpn.length) {
    tls.alpn = source.alpn;
  }
  if (source.fingerprint) {
    tls.utls = {
      enabled: true,
      fingerprint: source.fingerprint,
    };
  }
  if (security === "reality") {
    if (!source.publicKey) return null;
    tls.reality = {
      enabled: true,
      public_key: source.publicKey || "",
    };
    if (source.shortId) tls.reality.short_id = source.shortId;
  }
  return tls;
}

function transportFromLink(params) {
  const sourceType = (params.get("type") || "tcp").toLowerCase();
  if (sourceType === "tcp" || sourceType === "raw") {
    return { sourceType, fallback: false };
  }
  if (sourceType === "xhttp" || sourceType === "splithttp") {
    return { sourceType, fallback: true };
  }
  if (sourceType === "grpc") {
    return {
      sourceType,
      fallback: false,
      transport: {
        type: "grpc",
        service_name:
          params.get("serviceName") ||
          params.get("service_name") ||
          "",
      },
    };
  }
  if (sourceType === "ws") {
    const transport = {
      type: "ws",
      path: params.get("path") || "/",
    };
    const host = params.get("host");
    if (host) transport.headers = { Host: host };
    return { sourceType, fallback: false, transport };
  }
  if (sourceType === "http" || sourceType === "h2") {
    const host = params.get("host");
    return {
      sourceType,
      fallback: false,
      transport: {
        type: "http",
        host: host ? host.split(",").filter(Boolean) : [],
        path: params.get("path") || "/",
      },
    };
  }
  if (sourceType === "httpupgrade") {
    return {
      sourceType,
      fallback: false,
      transport: {
        type: "httpupgrade",
        host: params.get("host") || "",
        path: params.get("path") || "/",
      },
    };
  }
  return { sourceType, fallback: true };
}

function transportFromXray(stream = {}) {
  const sourceType = (stream.network || "tcp").toLowerCase();
  if (sourceType === "tcp" || sourceType === "raw") {
    return { sourceType, fallback: false };
  }
  if (sourceType === "xhttp" || sourceType === "splithttp") {
    return { sourceType, fallback: true };
  }
  if (sourceType === "grpc") {
    return {
      sourceType,
      fallback: false,
      transport: {
        type: "grpc",
        service_name: stream.grpcSettings?.serviceName || "",
      },
    };
  }
  if (sourceType === "ws") {
    const transport = {
      type: "ws",
      path: stream.wsSettings?.path || "/",
    };
    const host =
      stream.wsSettings?.headers?.Host ||
      stream.wsSettings?.headers?.host;
    if (host) transport.headers = { Host: host };
    return { sourceType, fallback: false, transport };
  }
  if (sourceType === "http" || sourceType === "h2") {
    const settings =
      stream.httpSettings || stream.http2Settings || {};
    const hosts = Array.isArray(settings.host)
      ? settings.host
      : settings.host
        ? [settings.host]
        : [];
    return {
      sourceType,
      fallback: false,
      transport: {
        type: "http",
        host: hosts,
        path: settings.path || "/",
      },
    };
  }
  if (sourceType === "httpupgrade") {
    return {
      sourceType,
      fallback: false,
      transport: {
        type: "httpupgrade",
        host: stream.httpupgradeSettings?.host || "",
        path: stream.httpupgradeSettings?.path || "/",
      },
    };
  }
  return { sourceType, fallback: true };
}

function transportFromSingBox(source = {}) {
  if (!source || typeof source !== "object") {
    return { sourceType: "tcp", fallback: false };
  }
  const sourceType = String(source.type || "tcp").toLowerCase();
  if (sourceType === "tcp" || sourceType === "raw") {
    return { sourceType, fallback: false };
  }
  if (sourceType === "xhttp" || sourceType === "splithttp") {
    return { sourceType, fallback: true };
  }
  if (sourceType === "grpc") {
    return {
      sourceType,
      fallback: false,
      transport: {
        type: "grpc",
        service_name: safeTransportText(source.service_name),
      },
    };
  }
  if (sourceType === "ws") {
    const transport = {
      type: "ws",
      path: safeTransportText(source.path, "/"),
    };
    const host = safeTransportText(
      source.headers?.Host || source.headers?.host,
      "",
      253,
    );
    if (host) transport.headers = { Host: host };
    return { sourceType, fallback: false, transport };
  }
  if (sourceType === "http") {
    const hosts = (Array.isArray(source.host)
      ? source.host
      : source.host
        ? [source.host]
        : []
    )
      .map((host) => safeTransportText(host, "", 253))
      .filter(Boolean);
    return {
      sourceType,
      fallback: false,
      transport: {
        type: "http",
        host: hosts,
        path: safeTransportText(source.path, "/"),
      },
    };
  }
  if (sourceType === "httpupgrade") {
    return {
      sourceType,
      fallback: false,
      transport: {
        type: "httpupgrade",
        host: safeTransportText(source.host, "", 253),
        path: safeTransportText(source.path, "/"),
      },
    };
  }
  return { sourceType, fallback: true };
}

function tlsFromSingBox(source, server) {
  if (!source?.enabled) return undefined;
  const serverName = normalizeServerHost(source.server_name || server);
  if (!serverName) return null;
  const tls = {
    enabled: true,
    server_name: serverName,
    insecure: Boolean(source.insecure),
  };
  if (Array.isArray(source.alpn)) {
    const alpn = source.alpn
      .map((item) => safeTransportText(item, "", 64))
      .filter(Boolean);
    if (alpn.length) tls.alpn = alpn;
  }
  if (source.utls?.enabled && source.utls?.fingerprint) {
    const fingerprint = safeTransportText(
      source.utls.fingerprint,
      "",
      64,
    );
    if (fingerprint) {
      tls.utls = { enabled: true, fingerprint };
    }
  }
  if (source.reality?.enabled) {
    const publicKey = safeTransportText(
      source.reality.public_key,
      "",
      256,
    );
    if (!publicKey) return null;
    tls.reality = { enabled: true, public_key: publicKey };
    const shortId = safeTransportText(
      source.reality.short_id,
      "",
      32,
    );
    if (shortId) tls.reality.short_id = shortId;
  }
  return tls;
}
