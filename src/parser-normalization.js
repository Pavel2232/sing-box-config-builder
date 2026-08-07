// Shared validation and normalization helpers.



function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function truthy(value) {
  return value === "1" || value === "true";
}

function normalizeServerHost(value) {
  let host = String(value || "").trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  host = host.replace(/\.$/, "");
  if (
    !host ||
    host.length > 253 ||
    host.includes("%") ||
    /[^\x21-\x7e]/.test(host)
  ) {
    return "";
  }

  if (host.includes(":")) {
    if (!/^[0-9a-f:.]+$/i.test(host) || host.includes(":::")) return "";
    if (
      host === "::" ||
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      /^fe[89ab]/.test(host)
    ) {
      return "";
    }
    return host;
  }

  if (/^[0-9.]+$/.test(host)) {
    const parts = host.split(".");
    if (
      parts.length !== 4 ||
      parts.some(
        (part) =>
          !/^\d{1,3}$/.test(part) ||
          Number(part) > 255 ||
          (part.length > 1 && part.startsWith("0")),
      )
    ) {
      return "";
    }
    const octets = parts.map(Number);
    if (
      octets[0] === 0 ||
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19)) ||
      octets[0] >= 224
    ) {
      return "";
    }
    return host;
  }

  const labels = host.split(".");
  if (
    labels.length < 2 ||
    labels.some(
      (label) =>
        !/^[a-z0-9-]{1,63}$/i.test(label) ||
        label.startsWith("-") ||
        label.endsWith("-"),
    )
  ) {
    return "";
  }
  return host;
}

function normalizeServerPort(value, fallback = 443) {
  const port = Number(value || fallback);
  return Number.isInteger(port) && port >= 1 && port <= 65535
    ? port
    : 0;
}

function normalizeVlessUuid(value) {
  const uuid = safeDecode(String(value || "")).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    uuid,
  )
    ? uuid
    : "";
}

function safeTransportText(value, fallback = "", maxLength = 1024) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text.length <= maxLength && !/[\x00-\x1f\x7f]/.test(text)
    ? text
    : fallback;
}

function entryName(entry, index, prefix) {
  if (typeof entry === "string") {
    try {
      const uri = new URL(entry);
      if (uri.hash) {
        return `${prefix}${safeDecode(uri.hash.slice(1)).replace(/\+/g, " ")}`;
      }
    } catch {
      // Use generated name.
    }
  } else if (entry?.remarks) {
    return `${prefix}${entry.remarks}`;
  } else if (entry?.tag) {
    return `${prefix}${entry.tag}`;
  }
  return `${prefix}${t("node.generated", {
    number: String(index + 1).padStart(2, "0"),
  })}`;
}

function unsupportedNode(entry, index, prefix, reason) {
  return {
    outbound: null,
    tag: entryName(entry, index, prefix),
    reason,
    sourceType: `unsupported:${reason}`,
  };
}

function makeTagsUnique(nodes) {
  const occurrences = new Map();
  for (const node of nodes) {
    const original = node.tag;
    const count = (occurrences.get(original) || 0) + 1;
    occurrences.set(original, count);
    if (count > 1) node.tag = `${original} [${count}]`;
  }
}
